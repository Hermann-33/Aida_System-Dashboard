import { useState, type FormEvent } from 'react';
import { getEmployeeSession, reauthenticateWithPin } from '../auth/employeeSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function IdleLockModal() {
  const session = getEmployeeSession();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const username = session.identity?.username || '';
  const fullName = session.identity?.fullName || username;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await reauthenticateWithPin(username, pin);
      setPin('');
    } catch {
      setError('Invalid PIN');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-lock-title"
      className="fixed inset-0 z-[1000] grid place-items-center bg-[var(--aida-espresso)]/90 p-6"
    >
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-[var(--aida-cream)] p-8 shadow-xl">
        <h2 id="idle-lock-title" className="text-xl font-bold text-foreground">
          Session locked
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your shift stays open. Re-enter your PIN to continue.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="idle-username">Employee</Label>
          <Input id="idle-username" value={fullName} readOnly aria-readonly="true" />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor="idle-pin">PIN</Label>
          <Input
            id="idle-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="mt-6 w-full">
          {busy ? 'Unlocking…' : 'Unlock'}
        </Button>
      </form>
    </div>
  );
}
