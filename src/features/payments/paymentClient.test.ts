import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadAdminPaymentState,
  parsePaymentSnapshot,
  requestAdminRefund,
  requestableRefundSen,
} from './paymentClient';

const captured = {
  id: 'intent-1',
  providerKey: 'test_provider',
  state: 'captured',
  settlementState: 'pending',
  amountSen: 1000,
  currency: 'MYR',
  createdAt: '2026-09-18T01:00:00Z',
  authorizedAt: '2026-09-18T01:00:30Z',
  capturedAt: '2026-09-18T01:01:00Z',
  settledAt: null,
};

const paid = {
  tenderType: 'external',
  paymentState: 'paid',
  paidAt: '2026-09-18T01:01:00Z',
  refundedSen: 0,
  refundableSen: 1000,
  providerAvailable: true,
  latestIntent: captured,
  refunds: [],
};

afterEach(() => vi.restoreAllMocks());

describe('Phase 9 payment client', () => {
  it('accepts a captured external payment and keeps settlement distinct', () => {
    const parsed = parsePaymentSnapshot(paid, 1000, 'MYR');
    expect(parsed.paymentState).toBe('paid');
    expect(parsed.latestIntent?.state).toBe('captured');
    expect(parsed.latestIntent?.settlementState).toBe('pending');
  });

  it('accepts requested refund reservations without falsely increasing refundedSen', () => {
    const parsed = parsePaymentSnapshot({
      ...paid,
      refunds: [{
        id: 'refund-1', tenderType: 'external', state: 'requested', amountSen: 600,
        reason: 'Customer request', createdAt: '2026-09-18T02:00:00Z', succeededAt: null,
      }],
    }, 1000, 'MYR');
    expect(parsed.refundedSen).toBe(0);
    expect(requestableRefundSen(parsed, 1000)).toBe(400);
  });

  it('rejects succeeded refunds that do not reconcile to refundedSen', () => {
    expect(() => parsePaymentSnapshot({
      ...paid,
      refundedSen: 400,
      refundableSen: 600,
      paymentState: 'partially_refunded',
      refunds: [{
        id: 'refund-1', tenderType: 'external', state: 'succeeded', amountSen: 300,
        reason: null, createdAt: '2026-09-18T02:00:00Z', succeededAt: '2026-09-18T02:01:00Z',
      }],
    }, 1000, 'MYR')).toThrow(/reconcile/i);
  });

  it('rejects external paid state without a captured provider intent', () => {
    expect(() => parsePaymentSnapshot({
      ...paid,
      latestIntent: { ...captured, state: 'authorized', capturedAt: null },
    }, 1000, 'MYR')).toThrow(/captured intent/i);
  });

  it('loads payment state from the same-origin Admin BFF', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: paid }), { status: 200 }),
    );
    await expect(loadAdminPaymentState('order-1', 1000)).resolves.toMatchObject({ paymentState: 'paid' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/payments/state?orderId=order-1',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('submits only refund intent to the same-origin Admin BFF', async () => {
    const requested = {
      ...paid,
      refunds: [{
        id: 'refund-1', tenderType: 'external', state: 'requested', amountSen: 400,
        reason: 'Duplicate drink', createdAt: '2026-09-18T02:00:00Z', succeededAt: null,
      }],
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: requested }), { status: 200 }),
    );
    await requestAdminRefund({
      orderId: 'order-1',
      tenderType: 'external',
      amountSen: 400,
      reason: 'Duplicate drink',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    }, 1000);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      orderId: 'order-1',
      tenderType: 'external',
      amountSen: 400,
      reason: 'Duplicate drink',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    });
  });
});
