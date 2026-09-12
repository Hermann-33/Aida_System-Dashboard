import { describe, expect, it } from 'vitest';
import type { OrderSnapshot, OrderStatus, ScheduleState } from './orderClient';
import { ordersForWorkload, workloadForOrder } from './orderWorkloads';

function order(status: OrderStatus, scheduleState: ScheduleState | null = null, orderNumber = 100001): OrderSnapshot {
  return {
    id: `order-${orderNumber}`, orderNumber, source: 'customer', customerUserId: 'customer', memberId: 'member',
    branchId: 'branch-main', branch: { id: 'branch-main', code: 'BR-MAIN', name: 'Main Café', timezone: 'Asia/Kuala_Lumpur' },
    salesPointId: null, salesPoint: null, terminalId: null, terminal: null,
    shiftId: null, tenderType: 'unpaid', paymentState: 'unpaid', paidAt: null,
    fulfillmentType: status === 'scheduled' ? 'scheduled' : 'asap',
    requestedPickupAt: status === 'scheduled' ? '2026-08-20T14:00:00Z' : null,
    prepareAt: status === 'scheduled' ? '2026-08-20T13:45:00Z' : null,
    serverNow: '2026-08-20T13:50:00Z', scheduleState, status, statusVersion: 1,
    currency: 'MYR', pricingVersion: 1, subtotalSen: 1000, totalSen: 1000,
    createdAt: '2026-08-20T13:00:00Z', updatedAt: '2026-08-20T13:00:00Z', statusUpdatedAt: '2026-08-20T13:00:00Z',
    preparingAt: null, readyAt: status === 'ready' ? '2026-08-20T13:30:00Z' : null,
    completedAt: status === 'completed' ? '2026-08-20T13:40:00Z' : null,
    cancelledAt: status === 'cancelled' ? '2026-08-20T13:40:00Z' : null, lines: [],
  };
}

describe('order workload classification', () => {
  it('keeps future scheduled work out of Active', () => {
    const future = order('scheduled', 'future');
    expect(workloadForOrder(future)).toBe('scheduled');
    expect(ordersForWorkload([future], 'active')).toEqual([]);
  });

  it('moves due and overdue scheduled work into Active without changing persisted status', () => {
    const due = order('scheduled', 'due', 100002);
    const overdue = order('scheduled', 'overdue', 100003);
    expect(ordersForWorkload([due, overdue], 'active').map((item) => item.orderNumber)).toEqual([100003, 100002]);
    expect(due.status).toBe('scheduled');
    expect(overdue.status).toBe('scheduled');
  });

  it('ranks overdue, due, preparing and confirmed in operational order', () => {
    const input = [order('confirmed', null, 1), order('preparing', null, 2), order('scheduled', 'due', 3), order('scheduled', 'overdue', 4)];
    expect(ordersForWorkload(input, 'active').map((item) => item.orderNumber)).toEqual([4, 3, 2, 1]);
  });

  it('routes ready and terminal states to their dedicated workloads', () => {
    expect(workloadForOrder(order('ready'))).toBe('ready');
    expect(workloadForOrder(order('completed'))).toBe('history');
    expect(workloadForOrder(order('cancelled'))).toBe('history');
  });
});