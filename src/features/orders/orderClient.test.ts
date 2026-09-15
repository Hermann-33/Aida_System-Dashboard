import { beforeEach, describe, expect, it, vi } from 'vitest';
import { employeeFetch } from '../../auth/employeeSession';
import type { CartLine } from '../pos/cartTypes';
import {
  LEGAL_NEXT_STATUSES,
  buildOrderIntent,
  fetchOrderingPolicy,
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
    { groupId: 'option:temperature', optionIds: ['55555555-5555-4555-8555-555555555555'] },
    { groupId: 'option:sweetness', optionIds: ['66666666-6666-4666-8666-666666666666'] },
    { groupId: 'addons', optionIds: ['33333333-3333-4333-8333-333333333333'] },
  ],
  note: '  less foam  ',
}];

const validSnapshotLine = {
  id: 'line-1',
  lineNumber: 1,
  itemId: '11111111-1111-4111-8111-111111111111',
  sku: 'CF-LAT',
  name: 'Latte',
  prepRoute: 'bar' as const,
  basePriceSen: 1450,
  variant: null,
  addOns: [],
  addOnTotalSen: 0,
  options: [],
  optionTotalSen: 0,
  unitPriceSen: 1450,
  quantity: 1,
  lineTotalSen: 1450,
  note: null,
};

const baseOrderSnapshot = {
  id: 'order-1',
  orderNumber: 100001,
  source: 'customer' as const,
  customerUserId: 'customer-1',
  memberId: 'member-1',
  branchId: 'branch-main',
  branch: {
    id: 'branch-main',
    code: 'BR-MAIN',
    name: 'Main Café',
    timezone: 'Asia/Kuala_Lumpur',
  },
  salesPointId: null,
  salesPoint: null,
  terminalId: null,
  terminal: null,
  shiftId: null,
  tenderType: 'unpaid' as const,
  paymentState: 'unpaid' as const,
  paidAt: null,
  fulfillmentType: 'asap' as const,
  requestedPickupAt: null,
  prepareAt: null,
  serverNow: '2026-08-20T12:00:00Z',
  scheduleState: null,
  status: 'confirmed' as const,
  statusVersion: 1,
  currency: 'MYR' as const,
  pricingVersion: 2,
  subtotalSen: 1450,
  totalSen: 1450,
  createdAt: '2026-08-20T12:00:00Z',
  updatedAt: '2026-08-20T12:00:00Z',
  statusUpdatedAt: '2026-08-20T12:00:00Z',
  preparingAt: null,
  readyAt: null,
  completedAt: null,
  cancelledAt: null,
  lines: [validSnapshotLine],
};

describe('order client trust boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps per-line variant, drink options and add-ons to IDs without client commercial fields', () => {
    const payload = buildOrderIntent(lines, 'asap');
    expect(payload).toEqual({
      fulfillmentType: 'asap',
      items: [{
        itemId: '11111111-1111-4111-8111-111111111111',
        variantId: '22222222-2222-4222-8222-222222222222',
        addOnIds: ['33333333-3333-4333-8333-333333333333'],
        optionValueIds: [
          '55555555-5555-4555-8555-555555555555',
          '66666666-6666-4666-8666-666666666666',
        ],
        quantity: 2,
        note: 'less foam',
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
      .mockResolvedValueOnce(new Response(JSON.stringify(baseOrderSnapshot), { status: 201 }))
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
      preparationLeadMinutes: 15,
      slotIntervalMinutes: 15,
      maximumAdvanceDays: 1,
    });
    expect(slots[0]).toBe('2026-08-14T00:30:00.000Z');
    expect(new Date(slots.at(-1)!).getTime()).toBeLessThanOrEqual(new Date('2026-08-15T00:02:30.000Z').getTime());
  });

  it('parses trusted preparation policy and rejects a missing preparation lead', async () => {
    const valid = {
      serverNow: '2026-08-20T12:00:00Z', timezone: 'Asia/Kuala_Lumpur', scheduleEnabled: true,
      minimumLeadMinutes: 15, preparationLeadMinutes: 15, slotIntervalMinutes: 15, maximumAdvanceDays: 7,
    };
    await expect(fetchOrderingPolicy(vi.fn().mockResolvedValue(new Response(JSON.stringify(valid))))).resolves.toEqual(valid);
    const { preparationLeadMinutes: _omitted, ...invalid } = valid;
    await expect(fetchOrderingPolicy(vi.fn().mockResolvedValue(new Response(JSON.stringify(invalid))))).rejects.toMatchObject({ code: 'ORDER_RESPONSE_INVALID' });
  });

  it('rejects malformed authoritative schedule classifications on order snapshots', async () => {
    vi.mocked(employeeFetch).mockResolvedValueOnce(new Response(JSON.stringify([{
      ...baseOrderSnapshot,
      prepareAt: '2026-08-20T12:00:00Z',
      serverNow: '2026-08-20T12:15:00Z',
      scheduleState: 'preparing-soon',
    }])));
    await expect(fetchOrders()).rejects.toMatchObject({ code: 'ORDER_RESPONSE_INVALID' });
  });

  it('accepts trusted POS terminal/shift attribution and rejects partial or customer terminal context', async () => {
    vi.mocked(employeeFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        ...baseOrderSnapshot,
        source: 'pos',
        customerUserId: null,
        memberId: null,
        salesPointId: 'sales-main',
        salesPoint: { id: 'sales-main', code: 'SP-MAIN', name: 'Main Counter' },
        terminalId: 'terminal-main',
        terminal: { id: 'terminal-main', code: 'POS-MAIN-01' },
        shiftId: 'shift-main',
      }])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        ...baseOrderSnapshot,
        source: 'pos',
        customerUserId: null,
        memberId: null,
        salesPointId: 'sales-main',
        salesPoint: null,
        terminalId: 'terminal-main',
        terminal: { id: 'terminal-main', code: 'POS-MAIN-01' },
        shiftId: 'shift-main',
      }])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        ...baseOrderSnapshot,
        source: 'customer',
        salesPointId: 'sales-main',
        salesPoint: { id: 'sales-main', code: 'SP-MAIN', name: 'Main Counter' },
        terminalId: 'terminal-main',
        terminal: { id: 'terminal-main', code: 'POS-MAIN-01' },
      }])));

    await expect(fetchOrders()).resolves.toMatchObject([{
      shiftId: 'shift-main',
      salesPoint: { code: 'SP-MAIN' },
      terminal: { code: 'POS-MAIN-01' },
    }]);
    await expect(fetchOrders()).rejects.toMatchObject({ code: 'ORDER_RESPONSE_INVALID' });
    await expect(fetchOrders()).rejects.toMatchObject({ code: 'ORDER_RESPONSE_INVALID' });
  });

  it('accepts server-owned cash payment authority and rejects cash claims without a shift', async () => {
    const cashOrder = {
      ...baseOrderSnapshot,
      source: 'pos' as const,
      customerUserId: null,
      memberId: null,
      salesPointId: 'sales-main',
      salesPoint: { id: 'sales-main', code: 'SP-MAIN', name: 'Main Counter' },
      terminalId: 'terminal-main',
      terminal: { id: 'terminal-main', code: 'POS-MAIN-01' },
      shiftId: 'shift-main',
      tenderType: 'cash' as const,
      paymentState: 'paid' as const,
      paidAt: '2026-08-20T12:00:00Z',
    };
    vi.mocked(employeeFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify([cashOrder])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...cashOrder, shiftId: null }])));

    await expect(fetchOrders()).resolves.toMatchObject([{
      shiftId: 'shift-main', tenderType: 'cash', paymentState: 'paid',
    }]);
    await expect(fetchOrders()).rejects.toMatchObject({ code: 'ORDER_RESPONSE_INVALID' });
  });

  it('accepts POS member identity for loyalty but rejects POS customer identity', async () => {
    const posOrder = {
      ...baseOrderSnapshot,
      source: 'pos' as const,
      customerUserId: null,
      memberId: 'member-loyalty',
      salesPointId: 'sales-main',
      salesPoint: { id: 'sales-main', code: 'SP-MAIN', name: 'Main Counter' },
      terminalId: 'terminal-main',
      terminal: { id: 'terminal-main', code: 'POS-MAIN-01' },
      shiftId: 'shift-main',
    };
    vi.mocked(employeeFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify([posOrder])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...posOrder, customerUserId: 'customer-forbidden' }])));

    await expect(fetchOrders()).resolves.toMatchObject([{ memberId: 'member-loyalty' }]);
    await expect(fetchOrders()).rejects.toMatchObject({ code: 'ORDER_RESPONSE_INVALID' });
  });

  it('rejects customer attempts to carry shift or payment authority', async () => {
    vi.mocked(employeeFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        ...baseOrderSnapshot,
        shiftId: 'shift-main',
      }])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        ...baseOrderSnapshot,
        tenderType: 'cash',
        paymentState: 'paid',
        paidAt: '2026-08-20T12:00:00Z',
      }])));

    await expect(fetchOrders()).rejects.toMatchObject({ code: 'ORDER_RESPONSE_INVALID' });
    await expect(fetchOrders()).rejects.toMatchObject({ code: 'ORDER_RESPONSE_INVALID' });
  });

  it('rejects malformed monetary or line snapshots', async () => {
    vi.mocked(employeeFetch)
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        ...baseOrderSnapshot,
        totalSen: 1450.5,
      }])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        ...baseOrderSnapshot,
        lines: [{ ...validSnapshotLine, lineTotalSen: 1400 }],
      }])));
    await expect(fetchOrders()).rejects.toMatchObject({ code: 'ORDER_RESPONSE_INVALID' });
    await expect(fetchOrders()).rejects.toMatchObject({ code: 'ORDER_RESPONSE_INVALID' });
  });

  it('rejects a branch snapshot that disagrees with branchId', async () => {
    vi.mocked(employeeFetch).mockResolvedValueOnce(new Response(JSON.stringify([{
      ...baseOrderSnapshot,
      branch: { ...baseOrderSnapshot.branch, id: 'branch-other' },
    }])));

    await expect(fetchOrders()).rejects.toMatchObject({ code: 'ORDER_RESPONSE_INVALID' });
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
