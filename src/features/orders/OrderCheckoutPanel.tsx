import { useMemo, useState, type MutableRefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRmFromSen } from '../../shared/formatting/money';
import type { CartLine } from '../pos/cartTypes';
import { fetchPosMemberLoyalty, type PosMemberLoyalty } from '../loyalty/posLoyaltyClient';
import {
  ORDER_QUERY_KEY,
  buildOrderIntent,
  createClientRequestId,
  fetchOrderingPolicy,
  generateScheduleSlots,
  orderIntentSignature,
  placeOrder,
  quoteOrder,
  type FulfillmentType,
  type OrderIntentPayload,
  type OrderPlacementPayload,
  type OrderQuote,
  type OrderSnapshot,
} from './orderClient';

export type PlacementAttempt = { signature: string; clientRequestId: string };
type TenderType = 'cash' | 'unpaid';
type PosLoyaltyIntent = OrderIntentPayload & { memberCode?: string; voucherId?: string };

type Props = {
  lines: CartLine[];
  placementAttempt: MutableRefObject<PlacementAttempt | null>;
  onCancel: () => void;
  onPlaced: (order: OrderSnapshot) => void;
};

function slotLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function OrderCheckoutPanel({ lines, placementAttempt, onCancel, onPlaced }: Props) {
  const queryClient = useQueryClient();
  const policy = useQuery({ queryKey: ['ordering-policy'], queryFn: () => fetchOrderingPolicy() });
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('asap');
  const [requestedPickupAt, setRequestedPickupAt] = useState('');
  const [tenderType, setTenderType] = useState<TenderType>('cash');
  const [memberCode, setMemberCode] = useState('');
  const [member, setMember] = useState<PosMemberLoyalty | null>(null);
  const [voucherId, setVoucherId] = useState('');
  const [trustedQuote, setTrustedQuote] = useState<{ signature: string; quote: OrderQuote } | null>(null);
  const slots = useMemo(
    () => policy.data ? generateScheduleSlots(policy.data) : [],
    [policy.data],
  );
  const intent = useMemo<PosLoyaltyIntent>(() => ({
    ...buildOrderIntent(lines, fulfillmentType, requestedPickupAt || undefined),
    ...(member ? { memberCode: member.memberCode } : {}),
    ...(member && voucherId ? { voucherId } : {}),
  }), [fulfillmentType, lines, member, requestedPickupAt, voucherId]);
  const pricingSignature = orderIntentSignature(intent);
  const signature = `${pricingSignature}|tender:${tenderType}`;
  const currentQuote = trustedQuote?.signature === pricingSignature ? trustedQuote.quote : null;

  const memberLookup = useMutation({
    mutationFn: () => fetchPosMemberLoyalty(memberCode),
    onSuccess: (result) => {
      setMember(result);
      setMemberCode(result.memberCode);
      setVoucherId('');
      setTrustedQuote(null);
    },
  });

  const quote = useMutation({
    mutationFn: () => quoteOrder(intent),
    onSuccess: (result) => setTrustedQuote({ signature: pricingSignature, quote: result }),
  });

  const place = useMutation({
    mutationFn: async () => {
      if (!currentQuote) throw new Error('Review the authoritative total before placing the order.');
      if (placementAttempt.current?.signature !== signature) {
        placementAttempt.current = { signature, clientRequestId: createClientRequestId() };
      }
      const payload = {
        ...intent,
        clientRequestId: placementAttempt.current.clientRequestId,
        tenderType,
      } as OrderPlacementPayload & { tenderType: TenderType; memberCode?: string; voucherId?: string };
      return placeOrder(payload);
    },
    onSuccess: async (order) => {
      placementAttempt.current = null;
      await queryClient.invalidateQueries({ queryKey: ORDER_QUERY_KEY });
      onPlaced(order);
    },
  });

  const scheduledReady = fulfillmentType === 'asap' || requestedPickupAt.length > 0;

  return (
    <section aria-labelledby="order-checkout-title" className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 id="order-checkout-title" className="font-display text-xl text-primary">Review order</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The server revalidates catalogue availability, options, scheduling, price, promotions, member, voucher, shift and tender before placement.
      </p>

      <fieldset className="mt-5">
        <legend className="text-sm font-bold text-foreground">Pickup timing</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={fulfillmentType === 'asap' ? 'default' : 'outline'}
            onClick={() => {
              setFulfillmentType('asap');
              setRequestedPickupAt('');
            }}
          >
            Now
          </Button>
          <Button
            type="button"
            variant={fulfillmentType === 'scheduled' ? 'default' : 'outline'}
            disabled={policy.data?.scheduleEnabled === false}
            onClick={() => setFulfillmentType('scheduled')}
          >
            Schedule for later
          </Button>
        </div>
      </fieldset>

      {policy.isPending && <p className="mt-3 text-sm text-muted-foreground">Loading server scheduling policy…</p>}
      {policy.isError && (
        <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Scheduling policy is unavailable. Retry before placing this order.
          <Button type="button" variant="outline" size="sm" className="ml-3" onClick={() => void policy.refetch()}>Retry</Button>
        </div>
      )}

      {fulfillmentType === 'scheduled' && policy.data && (
        <div className="mt-4 flex max-w-md flex-col gap-2">
          <Label htmlFor="scheduled-pickup">Pickup time ({policy.data.timezone})</Label>
          <select
            id="scheduled-pickup"
            value={requestedPickupAt}
            onChange={(event) => setRequestedPickupAt(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Select a server-policy slot</option>
            {slots.map((slot) => <option key={slot} value={slot}>{slotLabel(slot, policy.data.timezone)}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">
            {policy.data.minimumLeadMinutes}-minute lead · {policy.data.slotIntervalMinutes}-minute intervals · up to {policy.data.maximumAdvanceDays} days.
          </p>
        </div>
      )}

      <fieldset className="mt-5 rounded-xl border border-border p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Member &amp; voucher</legend>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <Label htmlFor="pos-member-code">Member code</Label>
            <Input
              id="pos-member-code"
              value={memberCode}
              onChange={(event) => {
                const nextCode = event.target.value.toUpperCase();
                setMemberCode(nextCode);
                if (member && nextCode.trim() !== member.memberCode) {
                  setMember(null);
                  setVoucherId('');
                  setTrustedQuote(null);
                  placementAttempt.current = null;
                }
              }}
              placeholder="Member code"
              autoComplete="off"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!memberCode.trim() || memberLookup.isPending || quote.isPending || place.isPending}
            onClick={() => memberLookup.mutate()}
          >
            {memberLookup.isPending ? 'Looking up…' : member ? 'Refresh member' : 'Lookup member'}
          </Button>
          {member && (
            <Button
              type="button"
              variant="outline"
              disabled={quote.isPending || place.isPending}
              onClick={() => {
                setMember(null);
                setMemberCode('');
                setVoucherId('');
                setTrustedQuote(null);
                placementAttempt.current = null;
              }}
            >
              Remove
            </Button>
          )}
        </div>
        {memberLookup.error && <p role="alert" className="mt-2 text-sm font-semibold text-destructive">{memberLookup.error.message}</p>}
        {member && (
          <div className="mt-3 rounded-lg bg-muted p-3">
            <p className="text-sm font-semibold text-foreground">Member {member.memberCode}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {member.pointsBalance} points · {member.stampBalance}/{member.program.stampGoal} stamps · shift-bound lookup {member.shiftId.slice(0, 8)}…
            </p>
            <div className="mt-3">
              <Label htmlFor="pos-voucher">Issued voucher</Label>
              <select
                id="pos-voucher"
                value={voucherId}
                onChange={(event) => {
                  setVoucherId(event.target.value);
                  setTrustedQuote(null);
                  placementAttempt.current = null;
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                disabled={quote.isPending || place.isPending}
              >
                <option value="">No voucher</option>
                {member.vouchers.map((voucher) => (
                  <option key={voucher.id} value={voucher.id}>
                    {voucher.rewardName} · expires {new Date(voucher.expiresAt).toLocaleDateString('en-MY')}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                This selection is intent only. The server revalidates member ownership, voucher status, expiry and order eligibility.
              </p>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="mt-5 rounded-xl bg-muted p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Tender</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={tenderType === 'cash' ? 'default' : 'outline'}
            onClick={() => setTenderType('cash')}
          >
            Cash paid now
          </Button>
          <Button
            type="button"
            variant={tenderType === 'unpaid' ? 'default' : 'outline'}
            onClick={() => setTenderType('unpaid')}
          >
            Leave unpaid
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Cash is recorded by the server against the active shift. Card and e-wallet processor settlement remain outside the current payment authority.
        </p>
      </fieldset>

      {currentQuote && (
        <div aria-live="polite" className="mt-5 rounded-xl border border-primary/30 bg-accent p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Authoritative server total</p>
          <p className="mt-1 text-2xl font-bold text-primary">{formatRmFromSen(currentQuote.totalSen)}</p>
          {currentQuote.discountSen > 0 && (
            <p className="mt-1 text-sm font-semibold text-[var(--aida-success)]">
              Total discount {formatRmFromSen(currentQuote.discountSen)}
            </p>
          )}
          {currentQuote.voucherDiscountSen > 0 && currentQuote.voucher && (
            <p className="mt-1 text-xs text-muted-foreground">
              Voucher · {currentQuote.voucher.rewardName} · −{formatRmFromSen(currentQuote.voucherDiscountSen)}
            </p>
          )}
          {currentQuote.promotions.map((promotion) => (
            <p key={promotion.id} className="mt-1 text-xs text-muted-foreground">
              Promotion · {promotion.name} · −{formatRmFromSen(promotion.discountSen)}
            </p>
          ))}
          <p className="mt-1 text-sm text-muted-foreground">
            {currentQuote.lines.length} line{currentQuote.lines.length === 1 ? '' : 's'} · pricing version {currentQuote.pricingVersion}
          </p>
        </div>
      )}

      {quote.error && <p role="alert" className="mt-4 text-sm font-semibold text-destructive">{quote.error.message}</p>}
      {place.error && <p role="alert" className="mt-4 text-sm font-semibold text-destructive">{place.error.message}</p>}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={place.isPending} onClick={onCancel}>Back to sale</Button>
        <Button
          type="button"
          variant="outline"
          disabled={!policy.data || !scheduledReady || quote.isPending || place.isPending}
          onClick={() => quote.mutate()}
        >
          {quote.isPending ? 'Checking…' : currentQuote ? 'Refresh total' : 'Review authoritative total'}
        </Button>
        <Button
          type="button"
          disabled={!currentQuote || place.isPending}
          onClick={() => place.mutate()}
        >
          {place.isPending ? 'Placing…' : tenderType === 'cash' ? 'Place order · Record cash' : 'Place order · Unpaid'}
        </Button>
      </div>
    </section>
  );
}

export function AuthoritativeOrderReceipt({ order, onNewSale }: { order: OrderSnapshot; onNewSale: () => void }) {
  return (
    <section aria-labelledby="persisted-order-title" className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--aida-success)]">Persisted order</p>
      <h2 id="persisted-order-title" className="mt-1 font-display text-2xl text-primary">Order #{order.orderNumber}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {order.fulfillmentType === 'scheduled' && order.requestedPickupAt
          ? `Scheduled for ${slotLabel(order.requestedPickupAt, 'Asia/Kuala_Lumpur')}`
          : 'Now pickup'} · status {order.status}
      </p>
      <p className="mt-4 text-2xl font-bold text-foreground">{formatRmFromSen(order.totalSen)}</p>
      {order.discountSen > 0 && (
        <p className="mt-1 text-sm font-semibold text-[var(--aida-success)]">
          Discount {formatRmFromSen(order.discountSen)}
        </p>
      )}
      {order.voucherDiscountSen > 0 && order.voucher && (
        <p className="mt-1 text-xs text-muted-foreground">Voucher · {order.voucher.rewardName} · −{formatRmFromSen(order.voucherDiscountSen)}</p>
      )}
      {order.promotions.map((promotion) => (
        <p key={`${promotion.code}-${promotion.priority}`} className="mt-1 text-xs text-muted-foreground">
          Promotion · {promotion.name} · −{formatRmFromSen(promotion.discountSen)}
        </p>
      ))}
      <p className="mt-1 text-sm font-semibold text-muted-foreground">Tender and payment state persisted by the server.</p>
      <Button type="button" className="mt-5" onClick={onNewSale}>New sale</Button>
    </section>
  );
}