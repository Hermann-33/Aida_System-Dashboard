import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getEmployeeSession,
  loginWithBadge,
  loginWithPassword,
  logoutEmployee,
  refreshEmployeeSessionFromServer,
} from '../auth/employeeSession';
import { resolvePostLoginPath } from '../auth/permissions';
import type { TerminalLocation } from '../auth/types';
import { enrolTerminal, fetchTerminalStatus } from '../auth/terminalCredential';
import {
  PREVIEW_DEMO_NOTICE,
  PREVIEW_EXPIRED_ENROLMENT_CODE,
  PREVIEW_SAMPLE_ENROLMENT_CODE,
} from '../preview/demoAccounts';
import {
  PREVIEW_STAFF_PIN,
  PREVIEW_STAFF_ROSTER,
  type PreviewStaffPickerEntry,
} from '../preview/repositories/previewAuthRepository';
import { previewTerminalRepository } from '../preview/repositories/previewTerminalRepository';
import { isUiPreviewMode } from '../preview/uiPreviewMode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmployeeAuthShell } from './employee/EmployeeAuthShell';

type Mode = 'password' | 'badge';

const ROLE_LABEL: Record<PreviewStaffPickerEntry['role'], string> = {
  staff: 'Staff',
  admin: 'Manager',
  dual: 'Manager · POS',
};

function StaffAvatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      className={
        size === 'lg'
          ? 'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--aida-blush)] text-lg font-bold text-[var(--aida-burgundy)]'
          : 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--aida-blush)] text-base font-bold text-[var(--aida-burgundy)]'
      }
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function EmployeeWelcomePage() {
  const navigate = useNavigate();
  const preview = isUiPreviewMode();
  const [mode, setMode] = useState<Mode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [badgeValue, setBadgeValue] = useState('');
  const [pin, setPin] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<PreviewStaffPickerEntry | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<TerminalLocation | null>(null);
  const [needsEnrol, setNeedsEnrol] = useState(false);
  const [terminalAccessBlocked, setTerminalAccessBlocked] = useState(false);
  const [enrolCode, setEnrolCode] = useState(
    preview ? PREVIEW_SAMPLE_ENROLMENT_CODE : '',
  );
  const [sampleExpiresInSec, setSampleExpiresInSec] = useState(15 * 60);
  const badgeRef = useRef<HTMLInputElement>(null);

  const resolveTerminal = useCallback(async (): Promise<TerminalLocation | null> => {
    const status = preview
      ? await previewTerminalRepository.getStatus()
      : await fetchTerminalStatus();

    if (!status.enrolled) {
      setLocation(null);
      if (status.code === 'TERMINAL_BRANCH_FORBIDDEN') {
        setNeedsEnrol(false);
        setTerminalAccessBlocked(true);
        setError('Your employee account is not authorised for this terminal branch.');
      } else {
        setTerminalAccessBlocked(false);
        setNeedsEnrol(true);
      }
      return null;
    }

    setTerminalAccessBlocked(false);
    setLocation(status.location);
    setNeedsEnrol(false);
    return status.location;
  }, [preview]);

  useEffect(() => {
    void (async () => {
      const session = await refreshEmployeeSessionFromServer();
      if (session.status === 'authenticated' && session.identity) {
        const target = resolvePostLoginPath(session.identity);
        if (target.startsWith('/pos')) {
          const terminal = await resolveTerminal();
          if (!terminal) return;
        }
        navigate(target, { replace: true });
        return;
      }
      if (preview) await resolveTerminal();
    })();
  }, [navigate, preview, resolveTerminal]);

  useEffect(() => {
    if (!preview || !needsEnrol) return;
    const id = window.setInterval(() => {
      setSampleExpiresInSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [preview, needsEnrol]);

  async function onEnrol(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (preview && sampleExpiresInSec <= 0 && enrolCode.trim().toUpperCase() === PREVIEW_SAMPLE_ENROLMENT_CODE) {
        setError('This enrolment code has expired. Ask a manager to issue a new code.');
        return;
      }

      const result = preview
        ? await previewTerminalRepository.enrol(enrolCode)
        : await enrolTerminal(enrolCode);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setEnrolCode('');
      setLocation(result.location);
      setNeedsEnrol(false);

      if (!preview) {
        const identity = getEmployeeSession().identity;
        if (identity) {
          navigate(resolvePostLoginPath(identity), { replace: true });
        }
      }
    } catch {
      setError('Terminal activation failed');
    } finally {
      setBusy(false);
    }
  }

  async function afterLogin() {
    const identity = getEmployeeSession().identity;
    if (!identity) return;

    const target = resolvePostLoginPath(identity);
    if (target.startsWith('/pos')) {
      const terminal = await resolveTerminal();
      if (!terminal) return;
    }

    navigate(target, { replace: true });
  }

  async function onPasswordLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await loginWithPassword(username.trim(), password);
      setPassword('');
      await afterLogin();
    } catch {
      setError(preview ? 'Invalid demonstration credentials' : 'Invalid credentials');
    } finally {
      setBusy(false);
    }
  }

  async function onBadgeLogin(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const rawBadge = badgeValue;
    setBadgeValue('');
    try {
      await loginWithBadge(rawBadge, pin);
      setPin('');
      await afterLogin();
    } catch {
      setError(preview ? 'Invalid demonstration badge/PIN' : 'Invalid credentials');
    } finally {
      setBusy(false);
      badgeRef.current?.focus();
    }
  }

  async function onPinLogin(e: FormEvent) {
    e.preventDefault();
    if (!selectedStaff) return;
    setError('');
    setBusy(true);
    try {
      await loginWithBadge(selectedStaff.username, pin);
      setPin('');
      await afterLogin();
    } catch {
      setError('Invalid PIN');
    } finally {
      setBusy(false);
    }
  }

  const expireLabel = `${Math.floor(sampleExpiresInSec / 60)}:${String(sampleExpiresInSec % 60).padStart(2, '0')}`;

  if (terminalAccessBlocked) {
    return (
      <EmployeeAuthShell
        titleId="terminal-access-blocked-title"
        kicker="Location access"
        title="Branch access required"
        lede="This terminal is active, but your employee account is not authorised for its branch."
      >
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error || 'Ask an administrator to update your branch assignment.'}
        </p>
        <p className="text-sm text-muted-foreground">
          Do not reactivate the terminal. Its device credential remains valid for employees who are authorised for this branch.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void logoutEmployee().then(() => {
            setTerminalAccessBlocked(false);
            setError('');
          })}
        >
          Sign out
        </Button>
      </EmployeeAuthShell>
    );
  }

  if (needsEnrol) {
    return (
      <EmployeeAuthShell
        titleId="enrol-title"
        kicker="Terminal activation"
        title="Activate this terminal"
        lede="Enter the one-time code issued by a manager. This device cannot generate its own code."
      >
        {preview ? (
          <aside
            aria-label="Preview enrolment helpers"
            className="rounded-lg border border-dashed border-primary bg-accent p-4"
          >
            <p className="text-sm">
              Sample manager-issued code:{' '}
              <code className="rounded bg-card px-1.5 py-0.5 font-mono font-bold text-foreground">
                {PREVIEW_SAMPLE_ENROLMENT_CODE}
              </code>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Binds to <strong className="font-semibold text-foreground">Main Café</strong> ·{' '}
              <strong className="font-semibold text-foreground">Main Counter</strong> ·{' '}
              <strong className="font-semibold text-foreground">POS-MAIN-01</strong>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Simulated expiry countdown: <strong className="font-semibold text-foreground">{expireLabel}</strong>
              {sampleExpiresInSec <= 0 ? ' (expired — use demo controls or reset)' : ''}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try invalid: <code className="rounded bg-card px-1.5 py-0.5 font-mono">WRONG-CODE</code> · Try expired:{' '}
              <code className="rounded bg-card px-1.5 py-0.5 font-mono">{PREVIEW_EXPIRED_ENROLMENT_CODE}</code>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  previewTerminalRepository.markSampleCodeExpired();
                  setSampleExpiresInSec(0);
                  setError('Sample code marked expired for the next attempt.');
                }}
              >
                Simulate expiry now
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  previewTerminalRepository.clearLocalPreview();
                  setSampleExpiresInSec(15 * 60);
                  setEnrolCode(PREVIEW_SAMPLE_ENROLMENT_CODE);
                  setError('');
                }}
              >
                Reset preview terminal
              </Button>
            </div>
          </aside>
        ) : (
          <p role="note" className="text-sm text-muted-foreground">
            Enter the short-lived activation code issued by an administrator for this physical terminal.
          </p>
        )}

        <form onSubmit={onEnrol} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="enrol-code">Enrolment code</Label>
            <Input
              id="enrol-code"
              name="enrolmentCode"
              autoComplete="one-time-code"
              value={enrolCode}
              onChange={(e) => setEnrolCode(e.target.value)}
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Activating…' : 'Activate terminal'}
          </Button>
          {!preview && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void logoutEmployee().then(() => {
                setNeedsEnrol(false);
                setLocation(null);
              })}
            >
              Sign out
            </Button>
          )}
        </form>
      </EmployeeAuthShell>
    );
  }

  return (
    <EmployeeAuthShell
      titleId="employee-welcome-title"
      kicker="Employee Access"
      title="Sign in"
      lede="Staff POS and management access only. No customer rewards or menu."
    >
      {location && (
        <div
          aria-live="polite"
          className="flex flex-col gap-1 rounded-lg bg-[var(--aida-espresso)] px-4 py-3 text-sm text-[var(--aida-cream)]"
        >
          <span>
            <strong className="text-[var(--aida-gold)]">Terminal</strong> {location.terminalCode}
          </span>
          <span>
            <strong className="text-[var(--aida-gold)]">Location</strong>{' '}
            {location.salesPointName || location.salesPointCode} ·{' '}
            {location.branchName || location.branchCode}
          </span>
        </div>
      )}

      {preview ? (
        selectedStaff ? (
          <form onSubmit={onPinLogin} aria-label="PIN login" className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <StaffAvatar name={selectedStaff.fullName} size="lg" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{selectedStaff.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedStaff.username} · {ROLE_LABEL[selectedStaff.role]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedStaff(null);
                  setPin('');
                  setError('');
                }}
                className="text-xs font-semibold text-primary underline underline-offset-2"
              >
                Not you?
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="staff-pin">PIN</Label>
              <Input
                id="staff-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Demo PIN:{' '}
                <code className="rounded bg-card px-1 py-0.5 font-mono font-bold text-foreground">
                  {PREVIEW_STAFF_PIN}
                </code>
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        ) : (
          <div>
            <aside
              aria-label="Demonstration PIN"
              className="rounded-lg border border-dashed border-primary bg-accent p-4"
            >
              <p className="text-xs font-extrabold uppercase tracking-wide text-primary">
                UI preview — sample data
              </p>
              <p className="mt-1 text-sm">
                Tap any name below, then enter demo PIN{' '}
                <code className="rounded bg-card px-1.5 py-0.5 font-mono font-bold text-foreground">
                  {PREVIEW_STAFF_PIN}
                </code>
                .
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{PREVIEW_DEMO_NOTICE}</p>
            </aside>

            <p className="mt-4 text-sm font-semibold text-foreground">Who&rsquo;s working?</p>
            <div role="group" aria-label="Select employee" className="mt-2 grid grid-cols-2 gap-2">
              {PREVIEW_STAFF_ROSTER.map((staff) => (
                <button
                  key={staff.username}
                  type="button"
                  onClick={() => {
                    setSelectedStaff(staff);
                    setError('');
                  }}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-center transition-colors hover:border-primary hover:bg-accent"
                >
                  <StaffAvatar name={staff.fullName} />
                  <span className="text-sm font-semibold text-foreground">{staff.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {staff.username} · {ROLE_LABEL[staff.role]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      ) : (
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList aria-label="Login method" className="grid w-full grid-cols-2">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="badge">Badge + PIN</TabsTrigger>
          </TabsList>

          <TabsContent value="password">
            <form onSubmit={onPasswordLogin} aria-label="Password login" className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp-username">Username</Label>
                <Input
                  id="emp-username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp-password">Password</Label>
                <Input
                  id="emp-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p role="alert" className="text-sm font-semibold text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="badge">
            <form onSubmit={onBadgeLogin} aria-label="Badge and PIN login" className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp-badge">Badge / card (keyboard wedge)</Label>
                <Input
                  id="emp-badge"
                  ref={badgeRef}
                  name="badge"
                  autoComplete="off"
                  value={badgeValue}
                  onChange={(e) => setBadgeValue(e.target.value)}
                  required
                  aria-describedby="badge-hint"
                />
                <p id="badge-hint" className="text-sm text-muted-foreground">
                  Badge value is cleared after submit and never shown in logs.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="emp-pin">PIN</Label>
                <Input
                  id="emp-pin"
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                />
              </div>
              {error && (
                <p role="alert" className="text-sm font-semibold text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Signing in…' : 'Sign in with badge'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      )}
    </EmployeeAuthShell>
  );
}
