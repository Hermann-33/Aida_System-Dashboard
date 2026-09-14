import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ShiftSummary } from '../../auth/types';
import { formatRmFromSen } from '../../shared/formatting/money';
import { recordCashMovement, ShiftClientError } from './shiftClient';

type Props = {
  shift: ShiftSummary;
  busy?: boolean;
  onShiftChange: (shift: ShiftSummary) => void;
  onLock: () => void;
  onCloseRequest: () => void;
};

function message(error: unknown): string {
  if (error instanceof ShiftClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Cash movement failed.';
}

export function LiveShiftControls({
  shift,
  busy = false,
  onShiftChange,
  onLock,
  onCloseRequest,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(type: 'cash_in' | 'cash_out') {
    const amountRm = Number(amount);
    if (!Number.isFinite(amountRm) || amountRm <= 0 || reason.trim().length < 3) {
      setError('Enter a positive cash amount and a reason of at least 3 characters.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const updated = await recordCashMovement({
        shiftId: shift.id,
        type,
        amountRm,
        reason: reason.trim(),
      });
      onShiftChange(updated);
      setAmount('');
      setReason('');
    } catch (movementError) {
      setError(message(movementError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label="Live shift controls" className="border-b border-border bg-card px-4 py-2 sm:px-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold text-foreground">Shift cash</span>
        {shift.openingFloatSen !== undefined && (
          <span className="text-muted-foreground">Opening {formatRmFromSen(shift.openingFloatSen)}</span>
        )}
        {shift.cashSalesSen !== undefined && (
          <span className="text-muted-foreground">Cash sales {formatRmFromSen(shift.cashSalesSen)}</span>
        )}
        {shift.expectedCashSen !== undefined && (
          <span className="font-semibold text-foreground">Expected {formatRmFromSen(shift.expectedCashSen)}</span>
        )}
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Hide cash controls' : 'Cash controls'}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy || submitting} onClick={onLock}>
          Lock shift
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy || submitting} onClick={onCloseRequest}>
          Close shift
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="live-cash-amount">Amount (RM)</Label>
            <Input
              id="live-cash-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="live-cash-reason">Reason</Label>
            <Input
              id="live-cash-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={200}
              placeholder="Drawer adjustment reason"
            />
          </div>
          <Button type="button" variant="outline" disabled={submitting || busy} onClick={() => void submit('cash_in')}>
            Record cash in
          </Button>
          <Button type="button" variant="outline" disabled={submitting || busy} onClick={() => void submit('cash_out')}>
            Record cash out
          </Button>
          {error && <p role="alert" className="text-sm font-semibold text-destructive sm:col-span-4">{error}</p>}
          <p className="text-xs text-muted-foreground sm:col-span-4">
            These movements are appended to the server-owned shift ledger. The browser cannot edit drawer balance or reconciliation facts.
          </p>
        </div>
      )}
    </section>
  );
}
