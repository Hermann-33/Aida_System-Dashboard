import type { OrderSnapshot } from './orderClient';

export type OrderWorkloadView = 'active' | 'scheduled' | 'ready' | 'history';
export type ScheduledDayGroup = 'Today' | 'Tomorrow' | 'Later';

const ACTIVE_PRIORITY: Record<string, number> = {
  overdue: 0,
  due: 1,
  preparing: 2,
  confirmed: 3,
};

function instant(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function activeKey(order: OrderSnapshot): string {
  if (order.status === 'scheduled') return order.scheduleState ?? 'scheduled';
  return order.status;
}

function activeTime(order: OrderSnapshot): number {
  if (order.status === 'scheduled') return instant(order.prepareAt ?? order.requestedPickupAt);
  if (order.status === 'preparing') return instant(order.preparingAt ?? order.statusUpdatedAt);
  return instant(order.createdAt);
}

export function workloadForOrder(order: OrderSnapshot): OrderWorkloadView | null {
  if (order.status === 'scheduled') {
    if (order.scheduleState === 'future') return 'scheduled';
    if (order.scheduleState === 'due' || order.scheduleState === 'overdue') return 'active';
    return null;
  }
  if (order.status === 'confirmed' || order.status === 'preparing') return 'active';
  if (order.status === 'ready') return 'ready';
  if (order.status === 'completed' || order.status === 'cancelled') return 'history';
  return null;
}

export function ordersForWorkload(
  orders: readonly OrderSnapshot[],
  view: OrderWorkloadView,
): OrderSnapshot[] {
  const matching = orders.filter((order) => workloadForOrder(order) === view);
  return matching.sort((left, right) => {
    if (view === 'active') {
      const priority = (ACTIVE_PRIORITY[activeKey(left)] ?? 99) - (ACTIVE_PRIORITY[activeKey(right)] ?? 99);
      return priority || activeTime(left) - activeTime(right);
    }
    if (view === 'scheduled') {
      return instant(left.prepareAt) - instant(right.prepareAt)
        || instant(left.requestedPickupAt) - instant(right.requestedPickupAt);
    }
    if (view === 'ready') return instant(left.readyAt) - instant(right.readyAt);
    return instant(right.completedAt ?? right.cancelledAt ?? right.statusUpdatedAt)
      - instant(left.completedAt ?? left.cancelledAt ?? left.statusUpdatedAt);
  });
}

function dateParts(value: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function scheduledDayGroup(order: OrderSnapshot): ScheduledDayGroup {
  if (!order.requestedPickupAt) return 'Later';
  const today = dateParts(order.serverNow);
  const tomorrowInstant = new Date(order.serverNow);
  tomorrowInstant.setUTCDate(tomorrowInstant.getUTCDate() + 1);
  const tomorrow = dateParts(tomorrowInstant.toISOString());
  const pickup = dateParts(order.requestedPickupAt);
  if (pickup === today) return 'Today';
  if (pickup === tomorrow) return 'Tomorrow';
  return 'Later';
}
