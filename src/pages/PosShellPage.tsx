import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSyncExternalStore } from 'react';
import {
  getEmployeeSession,
  logoutEmployee,
  subscribeEmployeeSession,
} from '../auth/employeeSession';
import type { ShiftSummary, TerminalLocation } from '../auth/types';
import { fetchTerminalStatus } from '../auth/terminalCredential';
import { PosContextBar } from '../components/PosContextBar';
import { previewShiftRepository } from '../preview/repositories/previewShiftRepository';
import { previewTerminalRepository } from '../preview/repositories/previewTerminalRepository';
import { isUiPreviewMode } from '../preview/uiPreviewMode';
import { CounterWorkspace } from '../features/pos/CounterWorkspace';
import type { ConnectionState } from '../preview/fixtures/catalog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Phase = 'loading' | 'need-location' | 'need-shift' | 'ready' | 'closing' | 'closed';

export function PosShellPage() {
  const session = useSyncExternalStore(subscribeEmployeeSession, getEmployeeSession, getEmployeeSession);
  const [phase, setPhase] = useState<Phase>('loading');
  const [location, setLocation] = useState<TerminalLocation | null>(null);
  const [shift, setShift] = useState<ShiftSummary | null>(null);
  const [openingFloat, setOpeningFloat] = useState('100');
  const [expectedCash, setExpectedCash] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('online');

  const loadContext = useCallback(async () => {
    setError('');
    setPhase('loading');

    const preview = isUiPreviewMode();
    const status = preview
      ? await previewTerminalRepository.getStatus()
      : await fetchTerminalStatus();

    if (!status.enrolled) {
      setError(
        preview
          ? 'Terminal not registered — activate from Employee Access (preview).'
          : status.code === 'TERMINAL_BRANCH_FORBIDDEN'
            ? 'Your employee account is not authorised for this terminal branch.'
            : 'This terminal is not active. Sign out and enter a manager-issued activation code.',
      );
      setLocation(null);
      setShift(null);
      setPhase('need-location');
      return;
    }

    const loc = status.location;
    const assigned = session.identity?.assignedBranchIds || [];
    if (assigned.length && !assigned.includes(loc.branchId) && session.identity?.role === 'staff') {
      setError('Unauthorised location for this employee');
      setLocation(null);
      setShift(null);
      setPhase('need-location');
      return;
    }

    setLocation(loc);

    if (preview) {
      const s = previewShiftRepository.getCurrent();
      if (s) {
        setShift(s);
        setPhase(s.status === 'closed' ? 'closed' : 'ready');
      } else {
        setShift(null);
        setPhase('need-shift');
      }
      return;
    }

    // Shift authority is Phase 2. Live Phase 1 requires terminal/location
    // authority but deliberately does not manufacture a browser shift.
    setShift(null);
    setPhase('ready');
  }, [session.identity?.assignedBranchIds, session.identity?.role]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  async function openShift(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!location || !session.identity) {
        setError('Preview terminal or employee missing');
        return;
      }
      const s = previewShiftRepository.open(location, session.identity.id, Number(openingFloat) || 0);
      setShift(s);
      setPhase('ready');
    } finally {
      setBusy(false);
    }
  }

  async function lockShift() {
    if (!shift) return;
    setBusy(true);
    try {
      setShift(previewShiftRepository.lock());
    } finally {
      setBusy(false);
    }
  }

  async function resumeShift() {
    if (!shift) return;
    setBusy(true);
    try {
      setShift(previewShiftRepository.resume());
    } finally {
      setBusy(false);
    }
  }

  async function closeShift(e: FormEvent) {
    e.preventDefault();
    if (!shift) return;
    if (!confirmClose) {
      setConfirmClose(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const closed = previewShiftRepository.close(Number(expectedCash), Number(actualCash), notes || undefined, handoverNotes || undefined);
      setShift(closed);
      setPhase('closed');
      setConfirmClose(false);
    } finally {
      setBusy(false);
    }
  }

  const identity = session.identity;
  const preview = isUiPreviewMode();
  const workspaceReady = identity && phase === 'ready'
    && Boolean(location)
    && (!preview || shift?.status === 'open');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PosContextBar employee={identity} location={location} shift={shift} connection={connectionState} operationalMode={preview ? 'preview' : 'live'} />
      {workspaceReady ? (
        <CounterWorkspace
          employee={identity}
          {...(location ? { location } : {})}
          {...(shift ? { shift } : {})}
          previewOperationalContext={preview}
          onLock={() => void lockShift()}
          onCloseRequest={() => setPhase('closing')}
          onLogout={() => void logoutEmployee().then(() => { window.location.href = '/employee'; })}
          busy={busy}
          connectionState={connectionState}
          onConnectionStateChange={setConnectionState}
        />
      ) : (
        <div className="flex flex-1 items-start justify-center p-6 sm:p-10">
          <Card className="w-full max-w-lg">
            <CardContent className="flex flex-col gap-4 p-6">
              <h2 className="font-display text-2xl text-primary">Aida Counter</h2>

              {error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                  {error}
                </p>
              )}

              {phase === 'loading' && (
                <p role="status" className="text-sm text-muted-foreground">
                  Loading terminal and shift…
                </p>
              )}

              {phase === 'need-location' && (
                <p role="alert" className="text-sm font-semibold text-destructive">
                  {preview
                    ? 'Register this terminal from Employee Access before using POS.'
                    : 'This terminal must be activated for your assigned branch before using POS.'}
                </p>
              )}

              {phase === 'need-shift' && (
                <form onSubmit={openShift} className="flex flex-col gap-4">
                  <h3 className="text-lg font-bold text-foreground">Open shift</h3>
                  <p className="text-sm text-muted-foreground">
                    Location is locked to {location?.salesPointCode} at {location?.branchCode}.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="opening-float">Opening float (RM)</Label>
                    <Input
                      id="opening-float"
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingFloat}
                      onChange={(e) => setOpeningFloat(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" disabled={busy}>
                    Open shift
                  </Button>
                </form>
              )}

              {phase === 'ready' && shift && shift.status === 'locked' && (
                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-bold text-foreground">Shift locked</h3>
                  <p className="text-sm text-muted-foreground">
                    Opening float: RM {shift.openingFloat.toFixed(2)}
                  </p>
                  <Button type="button" onClick={() => void resumeShift()} disabled={busy}>
                    Resume shift
                  </Button>
                </div>
              )}

              {phase === 'closing' && shift && (
                <form onSubmit={closeShift} className="flex flex-col gap-4">
                  <h3 className="text-lg font-bold text-foreground">Close shift</h3>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="expected-cash">Expected cash</Label>
                    <Input
                      id="expected-cash"
                      type="number"
                      step="0.01"
                      value={expectedCash}
                      onChange={(e) => setExpectedCash(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="actual-cash">Actual cash</Label>
                    <Input
                      id="actual-cash"
                      type="number"
                      step="0.01"
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      required
                    />
                  </div>
                  {expectedCash !== '' && actualCash !== '' && (
                    <p className="text-sm text-foreground">
                      Variance: RM {(Number(actualCash) - Number(expectedCash)).toFixed(2)}
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="close-notes">Notes</Label>
                    <Input id="close-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="handover-notes">Handover notes</Label>
                    <Input
                      id="handover-notes"
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={busy}>
                      {confirmClose ? 'Confirm close shift' : 'Review & close'}
                    </Button>
                    {confirmClose && (
                      <Button type="button" variant="outline" onClick={() => setConfirmClose(false)}>
                        Back
                      </Button>
                    )}
                    <Button type="button" variant="outline" onClick={() => setPhase('ready')}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {phase === 'closed' && shift && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-bold text-foreground">Shift closed</h3>
                  <p className="text-sm text-muted-foreground">
                    Expected: RM {Number(shift.closingExpectedCash).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Actual: RM {Number(shift.closingActualCash).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Variance: RM {Number(shift.cashVariance).toFixed(2)}
                  </p>
                  <Button type="button" onClick={() => void loadContext()} className="mt-2">
                    Start next shift
                  </Button>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => void logoutEmployee().then(() => { window.location.href = '/employee'; })}
              >
                Log out
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
