import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getEmployeeSession,
  loginWithPassword,
  logoutEmployee,
  subscribeEmployeeSession,
} from '../auth/employeeSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmployeeAuthShell } from './employee/EmployeeAuthShell';

type AdminLoginLocationState = {
  from?: string;
  reason?: string;
  sessionErrorCode?: string | null;
};

function safeAdminDestination(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/admin') && value !== '/admin/login'
    ? value
    : '/admin';
}

function loginErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';

  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'Invalid email or password.';
    case 'EMPLOYEE_ACCESS_FORBIDDEN':
    case 'ADMIN_REQUIRED':
      return 'This account does not have AIDA administrator access.';
    case 'EMPLOYEE_DISABLED':
      return 'This AIDA employee account is disabled.';
    case 'BACKEND_CONFIGURATION_MISSING':
      return 'The local AIDA backend configuration is unavailable.';
    case 'AUTH_UPSTREAM_UNAVAILABLE':
    case 'NETWORK_ERROR':
      return 'AIDA authentication is temporarily unreachable.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Administrator sign-in failed.';
  }
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? {}) as AdminLoginLocationState;
  const destination = useMemo(
    () => safeAdminDestination(locationState.from),
    [locationState.from],
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const session = useSyncExternalStore(
    subscribeEmployeeSession,
    getEmployeeSession,
    getEmployeeSession,
  );

  useEffect(() => {
    if (session.status === 'authenticated' && session.identity?.role === 'admin') {
      navigate(destination, { replace: true });
    }
  }, [destination, navigate, session]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await loginWithPassword(email.trim(), password);
      setPassword('');
      const identity = getEmployeeSession().identity;
      if (identity?.role !== 'admin') {
        await logoutEmployee();
        setError('This account does not have AIDA administrator access.');
        return;
      }
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(loginErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <EmployeeAuthShell
      titleId="admin-login-title"
      kicker="Administration"
      title="Admin sign in"
      lede="Management access uses the trusted AIDA employee session. POS terminal enrolment is not required."
    >
      <form onSubmit={onSubmit} aria-label="Administrator login" className="flex flex-col gap-4">
        {locationState.reason === 'ADMIN_SIGN_IN_REQUIRED' && (
          <p role="status" className="text-sm text-muted-foreground">
            Sign in with an AIDA admin or owner account to open Members or Menu. After sign-in you will return to the page you selected.
          </p>
        )}
        {locationState.sessionErrorCode === 'NETWORK_ERROR' && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            The dashboard could not reach its local authentication backend. Restart the Vite dev server and try again.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="admin-email">Email</Label>
          <Input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="admin-password">Password</Label>
          <Input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
    </EmployeeAuthShell>
  );
}
