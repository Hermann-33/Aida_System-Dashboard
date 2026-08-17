import { beforeEach, describe, expect, it, vi } from 'vitest';
import { employeeFetch } from '../../auth/employeeSession';
import type { CartLine } from '../pos/cartTypes';
import {
  LEGAL_NEXT_STATUSES,
  buildOrderIntent,
  fetchOrders,
  generateScheduleSlots,
  placeOrder,
  quoteOrder,
} from './orderClient';

vi.mock('../../auth/employeeSession', () => ({ employeeFetch: vi.fn() }));

const lines: CartLine[] = [{
  id: 'local-line',
  menuItemId: '11111111-1111-4111-8111-111111111111',
  name: 'Client name must not be trusted',
  unitPriceSen: 1,
  qty: 2,
  modifiers: [
    { groupId: 'variant', optionIds: ['22222222-2222-4222-8222-222222222222'] },
    { groupId: 'addons', optionIds: ['33333333-3333-4333-8333-333333333333'] },
  ],
  note: '  less ice  ',
}];

describe('order client trust boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps cart selections to IDs and intent without client commercial fields', () => {
    const payload = buildOrderIntent(lines, 'asap');
    expect(payload).toEqual({
      fulfillmentType: 'asap',
      items: [{
        itemId: '11111111-1111-4111-8111-111111111111',
        variantId: '22222222-2222-4222-8222-222222222222',
        addOnIds: ['33333333-3333-4333-8333-333333333333'],
        quantity: 2,
        note: 'less ice',
      }],
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('unitPriceSen');
    expect(serialized).not.toContain('totalSen');
    expect(serialized).not.toContain('Client name');
    expect(serialized).not.toContain('memberId');
    expect(serialized).not.toContain('status');
  });

  it('uses employee same-origin endpoints for quote, place and queue', async () => {
    vi.mocked(employeeFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ totalSen: 1450 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'order-1', totalSen: 1450 }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const intent = buildOrderIntent(lines, 'asap');
    await quoteOrder(intent);
    await placeOrder({ ...intent, clientRequestId: '44444444-4444-4444-8444-444444444444' });
    await fetchOrders(['confirmed', 'scheduled']);

    expect(employeeFetch).toHaveBeenNthCalledWith(1, '/api/v1/orders/quote', expect.objectContaining({ method: 'POST' }));
    expect(employeeFetch).toHaveBeenNthCalledWith(2, '/api/v1/orders/place', expect.objectContaining({ method: 'POST' }));
    expect(employeeFetch).toHaveBeenNthCalledWith(3, '/api/v1/orders?status=confirmed&status=scheduled&limit=100', { method: 'GET' });
  });

  it('derives aligned scheduled slots from server time and policy', () => {
    const slots = generateScheduleSlots({
      serverNow: '2026-08-14T00:02:30.000Z',
      timezone: 'Asia/Kuala_Lumpur',
      scheduleEnabled: true,
      minimumLeadMinutes: 15,
      slotIntervalMinutes: 15,
      maximumAdvanceDays: 1,
    });
    expect(slots[0]).toBe('2026-08-14T00:30:00.000Z');
    expect(new Date(slots.at(-1)!).getTime()).toBeLessThanOrEqual(new Date('2026-08-15T00:02:30.000Z').getTime());
  });

  it('exposes only legal versioned status progressions and terminal states', () => {
    expect(LEGAL_NEXT_STATUSES.confirmed).toEqual(['preparing', 'cancelled']);
    expect(LEGAL_NEXT_STATUSES.scheduled).toEqual(['preparing', 'cancelled']);
    expect(LEGAL_NEXT_STATUSES.preparing).toEqual(['ready', 'cancelled']);
    expect(LEGAL_NEXT_STATUSES.ready).toEqual(['completed']);
    expect(LEGAL_NEXT_STATUSES.completed).toEqual([]);
    expect(LEGAL_NEXT_STATUSES.cancelled).toEqual([]);
  });
});
