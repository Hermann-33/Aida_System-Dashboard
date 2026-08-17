import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatRmFromSen } from '../../shared/formatting/money';
import {
  LEGAL_NEXT_STATUSES,
  ORDER_POLL_INTERVAL_MS,
  ORDER_QUERY_KEY,
  OrderClientError,
  fetchOrderDetail,
  fetchOrders,
  transitionOrderStatus,
  type OrderSnapshot,
  type OrderStatus,
} from './orderClient';

const ALL_STATUSES: OrderStatus[] = [
  'scheduled',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function orderWhen(order: OrderSnapshot): string {
  const instant = order.requestedPickupAt ?? order.createdAt;
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(instant));
}

export function OrderBoard() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const orders = useQuery({
    queryKey: ORDER_QUERY_KEY,
    queryFn: () => fetchOrders(ALL_STATUSES),
    refetchInterval: ORDER_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
  const detail = useQuery({
    queryKey: [...ORDER_QUERY_KEY, 'detail', selectedId],
    queryFn: () => fetchOrderDetail(selectedId!),
    enabled: selectedId !== null,
  });

  const transition = useMutation({
    mutationFn: ({ order, toStatus }: { order: OrderSnapshot; toStatus: OrderStatus }) =>
      transitionOrderStatus({
        orderId: order.id,
        toStatus,
        expectedVersion: order.statusVersion,
      }),
    onSuccess: async (updated) => {
      setFeedback(`Order #${updated.orderNumber} is now ${STATUS_LABEL[updated.status].toLowerCase()}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ORDER_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: [...ORDER_QUERY_KEY, 'detail', updated.id] }),
      ]);
    },
    onError: async (error) => {
      if (error instanceof OrderClientError && error.code === 'ORDER_VERSION_CONFLICT') {
        setFeedback('This order changed elsewhere. The latest server state has been reloaded; retry the action if it is still available.');
        await queryClient.invalidateQueries({ queryKey: ORDER_QUERY_KEY });
        return;
      }
      setFeedback(error instanceof Error ? error.message : 'Order status update failed.');
    },
  });

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (orders.data ?? []).filter((order) => {
      if (status !== 'all' && order.status !== status) return false;
      if (!normalized) return true;
      return String(order.orderNumber).includes(normalized)
        || order.lines.some((line) => line.name.toLowerCase().includes(normalized));
    });
  }, [orders.data, query, status]);

  const selectedOrder = detail.data
    ?? orders.data?.find((order) => order.id === selectedId)
    ?? null;

  return (
    <section aria-labelledby="live-orders-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="live-orders-title" className="font-display text-xl text-primary">Live orders</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Persisted server queue · refreshes every {ORDER_POLL_INTERVAL_MS / 1_000} seconds · pay at counter
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void orders.refetch()}>Refresh now</Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Label htmlFor="live-orders-search" className="sr-only">Search live orders</Label>
        <Input
          id="live-orders-search"
          type="search"
          placeholder="Order # or item…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-[18rem]"
        />
        <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
          <SelectTrigger aria-label="Filter live order status" className="w-[11rem]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ALL_STATUSES.map((value) => <SelectItem key={value} value={value}>{STATUS_LABEL[value]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {feedback && <p role="status" className="mt-3 rounded-lg border border-border bg-muted p-3 text-sm text-foreground">{feedback}</p>}
      {orders.isPending && <p className="mt-4 text-sm text-muted-foreground">Loading live orders…</p>}
      {orders.isError && (
        <div role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-semibold text-destructive">{orders.error.message}</p>
          <p className="mt-1 text-sm text-muted-foreground">No preview orders are used as a fallback.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void orders.refetch()}>Retry orders</Button>
        </div>
      )}

      {orders.isSuccess && filtered.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">No persisted orders match this view.</p>
      )}

      {filtered.length > 0 && (
        <table className="data-table admin-table mt-4">
          <thead><tr><th>Order</th><th>Pickup</th><th>Source</th><th>Status</th><th>Total</th><th /></tr></thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id}>
                <td>#{order.orderNumber}</td>
                <td>{orderWhen(order)}</td>
                <td>{order.source === 'pos' ? 'POS guest' : 'Customer'}</td>
                <td><span className="status-pill status-pill--info">{STATUS_LABEL[order.status]}</span></td>
                <td>{formatRmFromSen(order.totalSen)}</td>
                <td><Button type="button" variant="outline" size="sm" onClick={() => setSelectedId(order.id)}>Detail</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedOrder && (
        <div role="region" aria-label="Live order detail" className="mt-4 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-foreground">Order #{selectedOrder.orderNumber}</h3>
              <p className="text-sm text-muted-foreground">
                {STATUS_LABEL[selectedOrder.status]} · version {selectedOrder.statusVersion} · {formatRmFromSen(selectedOrder.totalSen)}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedId(null)}>Close</Button>
          </div>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-foreground">
            {selectedOrder.lines.map((line) => (
              <li key={line.id ?? line.lineNumber}>
                {line.quantity}× {line.name}{line.variant ? ` · ${line.variant.label}` : ''}
                {line.addOns.length > 0 ? ` · ${line.addOns.map((addOn) => addOn.name).join(', ')}` : ''}
              </li>
            ))}
          </ul>
          <div aria-label="Legal order actions" className="mt-5 flex flex-wrap gap-2">
            {LEGAL_NEXT_STATUSES[selectedOrder.status].map((next) => (
              <Button
                key={next}
                type="button"
                variant={next === 'cancelled' ? 'outline' : 'default'}
                disabled={transition.isPending}
                onClick={() => transition.mutate({ order: selectedOrder, toStatus: next })}
              >
                {next === 'preparing' ? 'Start preparing' : next === 'ready' ? 'Mark ready' : next === 'completed' ? 'Complete fulfilment' : 'Cancel order'}
              </Button>
            ))}
            {LEGAL_NEXT_STATUSES[selectedOrder.status].length === 0 && (
              <p className="text-sm text-muted-foreground">This is a terminal order state; no further transition is available.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
