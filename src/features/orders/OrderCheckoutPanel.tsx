import { useMemo, useState, type MutableRefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatRmFromSen } from '../../shared/formatting/money';
import type { CartLine } from '../pos/cartTypes';
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
  type OrderQuote,
  type OrderSnapshot,
} from './orderClient';

export type PlacementAttempt = { signature: string; clientRequestId: string };

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
  const [trustedQuote, setTrustedQuote] = useState<{ signature: string; quote: OrderQuote } | null>(null);
  const slots = useMemo(
    () => policy.data ? generateScheduleSlots(policy.data) : [],
    [policy.data],
  );
  const intent = useMemo(
    () => buildOrderIntent(lines, fulfillmentType, requestedPickupAt || undefined),
    [fulfillmentType, lines, requestedPickupAt],
  );
  const signature = orderIntentSignature(intent);
  const currentQuote = trustedQuote?.signature === signature ? trustedQuote.quote : null;

  const quote = useMutation({
    mutationFn: () => quoteOrder(intent),
    onSuccess: (result) => setTrustedQuote({ signature, quote: result }),
  });

  const place = useMutation({
    mutationFn: async () => {
      if (!currentQuote) throw new Error('Review the authoritative total before placing the order.');
      if (placementAttempt.current?.signature !== signature) {
        placementAttempt.current = { signature, clientRequestId: createClientRequestId() };
      }
      return placeOrder({ ...intent, clientRequestId: placementAttempt.current.clientRequestId });
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
        The server revalidates catalogue availability, options, scheduling and price before placement.
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

      <div className="mt-5 rounded-xl bg-muted p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Payment</p>
        <p className="mt-1 text-lg font-bold text-foreground">Pay at counter</p>
        <p className="text-sm text-muted-foreground">Order placement does not claim payment or settlement.</p>
      </div>

      {currentQuote && (
        <div aria-live="polite" className="mt-5 rounded-xl border border-primary/30 bg-accent p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Authoritative server total</p>
          <p className="mt-1 text-2xl font-bold text-primary">{formatRmFromSen(currentQuote.totalSen)}</p>
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
          {place.isPending ? 'Placing…' : 'Place order · Pay at counter'}
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
      <p className="mt-1 text-sm font-semibold text-muted-foreground">Pay at counter · unpaid settlement state</p>
      <Button type="button" className="mt-5" onClick={onNewSale}>New sale</Button>
    </section>
  );
}
