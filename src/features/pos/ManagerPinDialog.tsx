import { useState, type FormEvent } from 'react';
import {
  PREVIEW_STAFF_PIN,
  PREVIEW_STAFF_ROSTER,
  type PreviewStaffPickerEntry,
} from '../../preview/repositories/previewAuthRepository';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MANAGER_ROSTER = PREVIEW_STAFF_ROSTER.filter((s) => s.role === 'admin' || s.role === 'dual');

interface Props {
  open: boolean;
  actionLabel: string;
  onApprove: (managerName: string) => void;
  onCancel: () => void;
}

/** POS-X10 — void, comp, refund and manual discount all require a manager
 * to authorise with their own PIN, attributed to whoever approved it. Same
 * name-then-PIN shape as the Employee Access login, scoped to the two
 * manager-role roster entries. */
export function ManagerPinDialog({ open, actionLabel, onApprove, onCancel }: Props) {
  const [selectedManager, setSelectedManager] = useState<PreviewStaffPickerEntry | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  function reset() {
    setSelectedManager(null);
    setPin('');
    setError('');
  }

  function handleCancel() {
    reset();
    onCancel();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedManager) return;
    if (pin === PREVIEW_STAFF_PIN) {
      const name = selectedManager.fullName;
      reset();
      onApprove(name);
      return;
    }
    setError('Invalid manager PIN');
  }

  return (
    <div
      role="presentation"
      onClick={handleCancel}
      className="fixed inset-0 z-[200] grid place-items-center bg-[var(--aida-espresso)]/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-pin-title"
        className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl"
      >
        <h2 id="manager-pin-title" className="text-lg font-bold text-foreground">
          Manager approval required
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">A manager must approve to {actionLabel}.</p>

        {!selectedManager ? (
          <div role="group" aria-label="Select manager" className="mt-4 grid grid-cols-2 gap-2">
            {MANAGER_ROSTER.map((m) => (
              <button
                key={m.username}
                type="button"
                onClick={() => setSelectedManager(m)}
                className="flex flex-col items-center gap-1 rounded-lg border border-border p-3 text-center transition-colors hover:border-primary hover:bg-accent"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--aida-blush)] text-sm font-bold text-[var(--aida-burgundy)]">
                  {m.fullName.charAt(0)}
                </span>
                <span className="text-sm font-semibold text-foreground">{m.fullName}</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--aida-blush)] text-sm font-bold text-[var(--aida-burgundy)]">
                {selectedManager.fullName.charAt(0)}
              </span>
              <p className="flex-1 text-sm font-semibold text-foreground">{selectedManager.fullName}</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedManager(null);
                  setPin('');
                  setError('');
                }}
                className="text-xs font-semibold text-primary underline underline-offset-2"
              >
                Not them?
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="manager-pin">Manager PIN</Label>
              <Input
                id="manager-pin"
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
                <code className="rounded bg-background px-1 py-0.5 font-mono font-bold text-foreground">
                  {PREVIEW_STAFF_PIN}
                </code>
              </p>
            </div>
            {error && (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {error}
              </p>
            )}
            <div className="mt-1 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit">Approve</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
