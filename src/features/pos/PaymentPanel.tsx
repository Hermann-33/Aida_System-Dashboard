import { useState } from 'react';
import type { EmployeeIdentity, ShiftSummary, TerminalLocation } from '../../auth/types';
import type { OrderType, PreviewMember } from '../../preview/fixtures/catalog';
import { PREVIEW_REWARD_RULES } from '../../preview/fixtures/catalog';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import type { CartLine } from './cartTypes';
import { formatRmFromSen } from '../../shared/formatting/money';
import { formatKlDateTime } from '../../shared/formatting/datetime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  buildPreviewReceipt,
  type PaymentMethod,
  type PreviewSaleReceipt,
} from './paymentReceipt';

interface Props {
  lines: CartLine[];
  orderType: OrderType;
  member: PreviewMember | null;
  employee: EmployeeIdentity;
  location: TerminalLocation;
  shift: ShiftSummary;
  discountSen: number;
  rewardLabel?: string;
  onPaid: (receipt: PreviewSaleReceipt) => void;
  onCancel: () => void;
}

type NonCashPhase =
  | 'idle'
  | 'awaiting'
  | 'processing'
  | 'approved'
  | 'declined'
  | 'timeout'
  | 'unknown';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  ewallet: 'E-wallet',
  student_wallet: 'Student wallet',
};

const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  pickup: 'Pickup',
};

const QUICK_TENDERS_SEN = [1000, 2000, 5000, 10000];

export function PaymentPanel({
  lines,
  orderType,
  member,
  employee,
  location,
  shift,
  discountSen,
  rewardLabel,
  onPaid,
  onCancel,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [phase, setPhase] = useState<NonCashPhase>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const previewMode = isUiPreviewMode();

  const draft = buildPreviewReceipt({
    lines,
    orderType,
    method,
    employee,
    location,
    shift,
    member,
    discountSen,
    rewardLabel,
  });
  const totalSen = draft.totalSen;
  const cashSen = Math.round(Number(cashReceived) * 100) || 0;
  const changeSen = cashSen - totalSen;
  const insufficient = method === 'cash' && cashSen > 0 && cashSen < totalSen;

  function pay(extra: Partial<PreviewSaleReceipt>) {
    if (submitting) return;
    setSubmitting(true);
    onPaid({
      ...buildPreviewReceipt({
        lines,
        orderType,
        method,
        employee,
        location,
        shift,
        member,
        discountSen,
        rewardLabel,
        tenderSen: extra.tenderSen,
        changeSen: extra.changeSen,
        providerRef: extra.providerRef,
      }),
      printStatus: 'printed',
      ...extra,
    });
  }

  function completeCash() {
    setError('');
    if (cashSen < totalSen) {
      setError('Cash received is less than total due.');
      return;
    }
    pay({ tenderSen: cashSen, changeSen });
  }

  function startNonCash() {
    if (submitting || phase === 'processing' || phase === 'awaiting') return;
    setError('');
    setPhase('awaiting');
    window.setTimeout(() => setPhase('processing'), 500);
    window.setTimeout(() => {
      const ref = `PREV-${Date.now().toString(36).toUpperCase()}`;
      setPhase('approved');
      pay({ providerRef: ref });
    }, 1500);
  }

  return (
    <section aria-labelledby="payment-title" data-page="pos-payment" className="max-w-xl">
      <h3 id="payment-title" className="font-display text-xl text-primary">
        Payment
      </h3>
      <p role="status" className="mt-1 inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">
        {previewMode
          ? 'Sample data · sales API not called'
          : 'POS sales API disabled'}
      </p>

      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-foreground">Method</legend>
        <div className="mt-2 flex flex-col gap-2">
          {(['cash', 'card', 'ewallet'] as PaymentMethod[]).map((key) => (
            <label
              key={key}
              className={
                method === key
                  ? 'flex cursor-pointer items-center gap-3 rounded-lg border-2 border-primary bg-accent p-3 text-sm font-semibold text-foreground'
                  : 'flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm font-medium text-foreground hover:bg-accent/50'
              }
            >
              <input
                type="radio"
                name="payment-method"
                value={key}
                checked={method === key}
                disabled={submitting}
                onChange={() => {
                  setMethod(key);
                  setPhase('idle');
                }}
                className="h-4 w-4 accent-[var(--aida-burgundy)]"
              />
              {METHOD_LABELS[key]}
            </label>
          ))}
          <label className="flex cursor-not-allowed items-center gap-3 rounded-lg border border-border p-3 text-sm text-muted-foreground opacity-60">
            <input type="radio" name="payment-method" disabled className="h-4 w-4" />
            Student wallet — pending integration decision
          </label>
        </div>
      </fieldset>

      <p className="mt-4 text-lg font-bold text-foreground">Total due: {formatRmFromSen(totalSen)}</p>
      {discountSen > 0 && (
        <p className="text-sm text-muted-foreground">Reward discount: −{formatRmFromSen(discountSen)}</p>
      )}

      {method === 'cash' && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cash-received">Cash received (RM)</Label>
            <Input
              id="cash-received"
              type="number"
              min="0"
              step="0.01"
              value={cashReceived}
              disabled={submitting}
              onChange={(e) => setCashReceived(e.target.value)}
              className="max-w-[12rem]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => setCashReceived((totalSen / 100).toFixed(2))}
            >
              Exact
            </Button>
            {QUICK_TENDERS_SEN.map((sen) => (
              <Button
                key={sen}
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => setCashReceived((sen / 100).toFixed(2))}
              >
                {formatRmFromSen(sen)}
              </Button>
            ))}
          </div>
          {cashSen > 0 && (
            <p
              role={insufficient ? 'alert' : undefined}
              className={insufficient ? 'text-sm font-semibold text-destructive' : 'text-sm text-muted-foreground'}
            >
              {insufficient
                ? `Insufficient cash — short ${formatRmFromSen(totalSen - cashSen)}`
                : `Change due: ${formatRmFromSen(changeSen)}`}
            </p>
          )}
        </div>
      )}

      {(method === 'card' || method === 'ewallet') && (
        <div role="status" className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-foreground">
            External terminal: <strong className="font-semibold">{phase === 'idle' ? 'Ready' : phase}</strong>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">No card number or CVV is collected.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => setPhase('declined')}>
              Simulate decline
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => setPhase('timeout')}>
              Simulate timeout
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => setPhase('unknown')}>
              Simulate unknown
            </Button>
          </div>
          {(phase === 'declined' || phase === 'timeout' || phase === 'unknown') && (
            <p role="alert" className="mt-2 text-sm font-semibold text-destructive">
              {phase === 'unknown'
                ? 'Unknown result — check status before retry (Team 2).'
                : `${phase} — resolve before safe retry.`}
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={phase === 'processing'}>
          Back
        </Button>
        {method === 'cash' ? (
          <Button type="button" disabled={lines.length === 0 || submitting || cashSen < totalSen} onClick={completeCash}>
            Confirm payment
          </Button>
        ) : phase === 'declined' || phase === 'timeout' || phase === 'unknown' ? (
          <Button type="button" onClick={() => setPhase('idle')}>
            Check status / allow retry
          </Button>
        ) : (
          <Button
            type="button"
            disabled={lines.length === 0 || submitting || phase === 'processing' || phase === 'awaiting'}
            onClick={startNonCash}
          >
            {phase === 'processing' || phase === 'awaiting' ? 'Processing…' : 'Charge terminal (preview)'}
          </Button>
        )}
      </div>
    </section>
  );
}

export function CompletedSaleReceipt({ receipt }: { receipt: PreviewSaleReceipt }) {
  return (
    <section aria-labelledby="receipt-title" data-page="pos-receipt" className="max-w-xl">
      <h3 id="receipt-title" className="font-display text-xl text-primary">
        Sale complete
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Preview receipt — cart locked · Pay disabled · no second payment.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-muted-foreground">Order</dt>
          <dd>{receipt.orderNumber}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">When</dt>
          <dd>{formatKlDateTime(receipt.dateTime)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Employee</dt>
          <dd>{receipt.employeeName} ({receipt.employeeRole})</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Branch</dt>
          <dd>{receipt.branchCode}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Sales point</dt>
          <dd>{receipt.salesPointCode}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Terminal</dt>
          <dd>{receipt.terminalCode}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Shift</dt>
          <dd>{receipt.shiftId} · {receipt.shiftStatus}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Order type</dt>
          <dd>{ORDER_TYPE_LABEL[receipt.orderType]}</dd>
        </div>
        <div>
          <dt className="font-semibold text-muted-foreground">Method</dt>
          <dd>{METHOD_LABELS[receipt.method]}</dd>
        </div>
        {receipt.tenderSen != null && (
          <>
            <div>
              <dt className="font-semibold text-muted-foreground">Tendered</dt>
              <dd>{formatRmFromSen(receipt.tenderSen)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">Change</dt>
              <dd>{formatRmFromSen(receipt.changeSen || 0)}</dd>
            </div>
          </>
        )}
        {receipt.providerRef && (
          <div>
            <dt className="font-semibold text-muted-foreground">Provider ref</dt>
            <dd>{receipt.providerRef}</dd>
          </div>
        )}
        {receipt.memberName && (
          <div>
            <dt className="font-semibold text-muted-foreground">Member</dt>
            <dd>{receipt.memberName}</dd>
          </div>
        )}
        {receipt.rewardLabel && (
          <div>
            <dt className="font-semibold text-muted-foreground">Reward</dt>
            <dd>{receipt.rewardLabel}</dd>
          </div>
        )}
        {receipt.pointsBefore != null && (
          <div>
            <dt className="font-semibold text-muted-foreground">Aida Points</dt>
            <dd>
              {receipt.pointsBefore} → {receipt.pointsAfter}
              {receipt.pointsEarned != null ? ` (+${receipt.pointsEarned}, RM 1 = 1 pt)` : ''}
            </dd>
          </div>
        )}
        {receipt.stampsBefore != null && (
          <div>
            <dt className="font-semibold text-muted-foreground">Stamps</dt>
            <dd>
              {receipt.stampsBefore} → {receipt.stampsAfter} / {PREVIEW_REWARD_RULES.stampsForFreeDrink}
            </dd>
          </div>
        )}
        <div>
          <dt className="font-semibold text-muted-foreground">Print</dt>
          <dd>{receipt.printStatus}</dd>
        </div>
      </dl>
      <ul className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-sm">
        {receipt.lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-2">
            <span>
              {line.qty}× {line.name}
              {line.modifierSummary && <span className="text-muted-foreground"> ({line.modifierSummary})</span>}
              {line.note && <span className="text-muted-foreground"> — {line.note}</span>}
            </span>
            <span className="font-semibold text-foreground">{formatRmFromSen(line.unitPriceSen * line.qty)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">Subtotal: {formatRmFromSen(receipt.subtotalSen)}</p>
      {receipt.discountSen > 0 && (
        <p className="text-sm text-muted-foreground">Discounts/rewards: −{formatRmFromSen(receipt.discountSen)}</p>
      )}
      <p className="mt-1 text-lg font-bold text-foreground">Total: {formatRmFromSen(receipt.totalSen)}</p>
    </section>
  );
}
