import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatRmFromSen } from '../../shared/formatting/money';
import {
  LEGAL_NEXT_STATUSES, ORDER_POLL_INTERVAL_MS, ORDER_QUERY_KEY, OrderClientError,
  fetchOrderDetail, fetchOrders, transitionOrderStatus,
  type OrderSnapshot, type OrderStatus,
} from './orderClient';
import {
  ordersForWorkload, scheduledDayGroup,
  type OrderWorkloadView, type ScheduledDayGroup,
} from './orderWorkloads';

const ALL_STATUSES: OrderStatus[] = ['scheduled', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
const VIEWS: { id: OrderWorkloadView; label: string }[] = [
  { id: 'active', label: 'Active' }, { id: 'scheduled', label: 'Scheduled' },
  { id: 'ready', label: 'Ready' }, { id: 'history', label: 'History' },
];
const STATUS_LABEL: Record<OrderStatus, string> = {
  scheduled: 'Scheduled', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled',
};
const STATUS_CLASS: Record<OrderStatus, string> = {
  scheduled: 'status-pill--info', confirmed: 'status-pill--info', preparing: 'status-pill--warn', ready: 'status-pill--ok', completed: 'status-pill--ok', cancelled: 'status-pill--err',
};

function formatWhen(value: string | null, includeDate = false): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur', ...(includeDate ? { day: 'numeric', month: 'short' } : {}),
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));
}

function lateness(order: OrderSnapshot): string | null {
  if (order.scheduleState !== 'overdue' || !order.requestedPickupAt) return null;
  const minutes = Math.max(0, Math.floor((Date.parse(order.serverNow) - Date.parse(order.requestedPickupAt)) / 60_000));
  if (!Number.isFinite(minutes)) return null;
  if (minutes < 60) return `${minutes} min late`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min late`;
}

function actionLabel(next: OrderStatus): string {
  if (next === 'preparing') return 'Start preparing';
  if (next === 'ready') return 'Mark ready';
  if (next === 'completed') return 'Complete fulfilment';
  return 'Cancel order';
}

type OrderCardProps = {
  order: OrderSnapshot;
  busy: boolean;
  onDetail: () => void;
  onTransition: (toStatus: OrderStatus) => void;
};

function OrderCard({ order, busy, onDetail, onTransition }: OrderCardProps) {
  const urgent = order.status === 'scheduled' && order.scheduleState === 'overdue';
  const due = order.status === 'scheduled' && order.scheduleState === 'due';
  const itemCount = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const lateBy = lateness(order);
  return (
    <article className={`order-workload-card${urgent ? ' order-workload-card--overdue' : due ? ' order-workload-card--due' : ''}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-extrabold text-foreground">#{order.orderNumber}</h3>
          {urgent && <span className="status-pill status-pill--err">Overdue</span>}
          {due && <span className="status-pill status-pill--warn">Due</span>}
          <span className={`status-pill ${STATUS_CLASS[order.status]}`}>{STATUS_LABEL[order.status]}</span>
        </div>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm sm:grid-cols-4">
          <div><dt className="font-semibold text-muted-foreground">Pickup</dt><dd className="font-semibold text-foreground">{formatWhen(order.requestedPickupAt ?? order.createdAt, true)}</dd></div>
          {order.status === 'scheduled' && <div><dt className="font-semibold text-muted-foreground">Preparation</dt><dd className="font-semibold text-foreground">{urgent || due ? 'Due ' : 'At '}{formatWhen(order.prepareAt, true)}</dd></div>}
          <div><dt className="font-semibold text-muted-foreground">Order</dt><dd>{itemCount} item{itemCount === 1 ? '' : 's'} · {formatRmFromSen(order.totalSen)}</dd></div>
          <div><dt className="font-semibold text-muted-foreground">Source</dt><dd>{order.source === 'pos' ? 'POS guest' : 'Customer'}</dd></div>
        </dl>
        {lateBy && <p className="text-sm font-bold text-[var(--aida-error)]">Pickup is {lateBy}. Start preparation or cancel the order.</p>}
      </div>
      <div aria-label={`Actions for order ${order.orderNumber}`} className="flex flex-wrap items-center gap-2 sm:justify-end">
        {LEGAL_NEXT_STATUSES[order.status].map((next) => <Button key={next} type="button" variant={next === 'cancelled' ? 'outline' : 'default'} disabled={busy} onClick={() => onTransition(next)}>{actionLabel(next)}</Button>)}
        <Button type="button" variant="outline" onClick={onDetail}>Detail</Button>
      </div>
    </article>
  );
}

export function OrderBoard() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<OrderWorkloadView>('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const orders = useQuery({ queryKey: ORDER_QUERY_KEY, queryFn: () => fetchOrders(ALL_STATUSES), refetchInterval: ORDER_POLL_INTERVAL_MS, refetchOnWindowFocus: true });
  const detail = useQuery({ queryKey: [...ORDER_QUERY_KEY, 'detail', selectedId], queryFn: () => fetchOrderDetail(selectedId!), enabled: selectedId !== null });

  const transition = useMutation({
    mutationFn: ({ order, toStatus }: { order: OrderSnapshot; toStatus: OrderStatus }) => transitionOrderStatus({ orderId: order.id, toStatus, expectedVersion: order.statusVersion }),
    onSuccess: async (updated) => {
      setFeedback(`Order #${updated.orderNumber} is now ${STATUS_LABEL[updated.status].toLowerCase()}.`);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ORDER_QUERY_KEY }), queryClient.invalidateQueries({ queryKey: [...ORDER_QUERY_KEY, 'detail', updated.id] })]);
    },
    onError: async (error) => {
      if (error instanceof OrderClientError && error.code === 'ORDER_VERSION_CONFLICT') {
        setFeedback('This order changed elsewhere. The latest server state has been reloaded; retry the action if it is still available.');
        await Promise.all([queryClient.invalidateQueries({ queryKey: ORDER_QUERY_KEY }), selectedId ? queryClient.invalidateQueries({ queryKey: [...ORDER_QUERY_KEY, 'detail', selectedId] }) : Promise.resolve()]);
        return;
      }
      setFeedback(error instanceof Error ? error.message : 'Order status update failed.');
    },
  });

  const counts = useMemo(() => Object.fromEntries(VIEWS.map(({ id }) => [id, ordersForWorkload(orders.data ?? [], id).length])) as Record<OrderWorkloadView, number>, [orders.data]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ordersForWorkload(orders.data ?? [], view).filter((order) => !normalized || String(order.orderNumber).includes(normalized) || order.lines.some((line) => line.name.toLowerCase().includes(normalized)));
  }, [orders.data, query, view]);
  const scheduledGroups = useMemo(() => {
    const groups: Record<ScheduledDayGroup, OrderSnapshot[]> = { Today: [], Tomorrow: [], Later: [] };
    for (const order of filtered) groups[scheduledDayGroup(order)].push(order);
    return groups;
  }, [filtered]);
  const selectedOrder = detail.data ?? orders.data?.find((order) => order.id === selectedId) ?? null;
  const mutate = (order: OrderSnapshot, toStatus: OrderStatus) => transition.mutate({ order, toStatus });
  const cards = (items: OrderSnapshot[]) => <div className="mt-4 grid gap-3">{items.map((order) => <OrderCard key={order.id} order={order} busy={transition.isPending} onDetail={() => setSelectedId(order.id)} onTransition={(next) => mutate(order, next)} />)}</div>;

  return (
    <section aria-labelledby="live-orders-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="live-orders-title" className="font-display text-xl text-primary">Orders</h2><p className="mt-1 text-sm text-muted-foreground">Live operational queue · refreshes every {ORDER_POLL_INTERVAL_MS / 1_000} seconds · pay at counter</p></div><Button type="button" variant="outline" size="sm" onClick={() => void orders.refetch()}>Refresh now</Button></div>
      <Tabs value={view} onValueChange={(value) => setView(value as OrderWorkloadView)} className="mt-4"><TabsList aria-label="Order workload" className="h-auto w-full justify-start overflow-x-auto bg-muted p-1 sm:w-auto">{VIEWS.map(({ id, label }) => <TabsTrigger key={id} value={id} className="min-h-11 min-w-24">{label} <span aria-label={`${counts[id]} orders`} className="ml-1 rounded-full bg-card px-2 py-0.5 text-xs">{counts[id]}</span></TabsTrigger>)}</TabsList></Tabs>
      <div className="mt-4"><Label htmlFor="live-orders-search" className="sr-only">Search orders in current workload</Label><Input id="live-orders-search" type="search" placeholder="Order # or item…" value={query} onChange={(event) => setQuery(event.target.value)} className="max-w-[18rem]" /></div>
      {feedback && <p role="status" className="mt-3 rounded-lg border border-border bg-muted p-3 text-sm text-foreground">{feedback}</p>}
      {orders.isPending && <p className="mt-4 text-sm text-muted-foreground">Loading live orders…</p>}
      {orders.isError && <div role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4"><p className="text-sm font-semibold text-destructive">{orders.error.message}</p><p className="mt-1 text-sm text-muted-foreground">No preview orders are used as a fallback.</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void orders.refetch()}>Retry orders</Button></div>}
      {orders.isSuccess && filtered.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">No persisted orders match this workload.</p>}
      {view === 'scheduled' ? (Object.entries(scheduledGroups) as [ScheduledDayGroup, OrderSnapshot[]][]).map(([group, groupOrders]) => groupOrders.length > 0 && <section key={group} aria-labelledby={`scheduled-${group.toLowerCase()}`} className="mt-5"><h3 id={`scheduled-${group.toLowerCase()}`} className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">{group}</h3>{cards(groupOrders)}</section>) : cards(filtered)}
      {selectedOrder && <div role="region" aria-label="Live order detail" className="mt-5 rounded-xl border border-border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-bold text-foreground">Order #{selectedOrder.orderNumber}</h3><p className="text-sm text-muted-foreground">{STATUS_LABEL[selectedOrder.status]} · version {selectedOrder.statusVersion} · {formatRmFromSen(selectedOrder.totalSen)}</p></div><Button type="button" variant="outline" size="sm" onClick={() => setSelectedId(null)}>Close</Button></div><ul className="mt-4 flex flex-col gap-2 text-sm text-foreground">{selectedOrder.lines.map((line) => <li key={line.id ?? line.lineNumber}>{line.quantity}× {line.name}{line.variant ? ` · ${line.variant.label}` : ''}{line.addOns.length > 0 ? ` · ${line.addOns.map((addOn) => addOn.name).join(', ')}` : ''}</li>)}</ul><div aria-label="Legal order actions" className="mt-5 flex flex-wrap gap-2">{LEGAL_NEXT_STATUSES[selectedOrder.status].map((next) => <Button key={next} type="button" variant={next === 'cancelled' ? 'outline' : 'default'} disabled={transition.isPending} onClick={() => mutate(selectedOrder, next)}>{actionLabel(next)}</Button>)}{LEGAL_NEXT_STATUSES[selectedOrder.status].length === 0 && <p className="text-sm text-muted-foreground">This is a terminal order state; no further transition is available.</p>}</div></div>}
    </section>
  );
}
