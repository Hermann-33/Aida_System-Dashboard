import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadPaymentAuditReport,
  loadReportingSummary,
  loadTransactionReport,
} from './reportingClient';

afterEach(() => vi.restoreAllMocks());

const semantics = {
  commercialValue: 'accepted_order_value_not_processor_settlement',
  cancelledOrdersExcludedFromCommercialTotals: true,
  inventoryQuantitiesGroupedByBaseUnitItem: true,
  statutoryAccountingIncluded: false,
  processorSettlementIncluded: false,
  refundDataAvailable: true,
  paymentFactsIncludeCancelledOrders: true,
  acceptedOrderValueIsSettlement: false,
  providerSettlementStateAvailable: true,
};

const summary = {
  semantics,
  filter: { fromDate: '2026-09-18', toDate: '2026-09-18' },
  orders: {
    orderCount: 1, acceptedOrderCount: 1, cancelledOrderCount: 0,
    subtotalSen: 1000, voucherDiscountSen: 0, promotionDiscountSen: 0,
    discountSen: 0, acceptedOrderValueSen: 1000, averageAcceptedOrderValueSen: 1000,
    paidPosCashSen: 0, unpaidAcceptedOrderValueSen: 0, discountReconciled: true,
    statusCounts: { completed: 1 },
  },
  byBranch: [],
  bySalesPoint: [],
  byProduct: [],
  shifts: {
    shiftOpenedCount: 0, openOrLockedShiftCount: 0, closedShiftCount: 0,
    openingFloatSen: 0, closingExpectedCashSen: 0, closingActualCashSen: 0,
    cashVarianceSen: 0, unapprovedClosedShiftCount: 0,
  },
  cashMovements: { movementCount: 0, cashInSen: 0, cashOutSen: 0, netMovementSen: 0 },
  loyaltyAndDiscountApplications: {
    awardedOrderCount: 0, pointsAwarded: 0, stampsAwarded: 0,
    voucherApplicationCount: 0, voucherDiscountSen: 0,
    promotionApplicationCount: 0, promotionDiscountSen: 0,
  },
  inventoryMovements: { movementCount: 0, byItem: [] },
  payments: {
    capturedOrderCount: 1, grossCapturedSen: 1000, cashCapturedSen: 0,
    externalCapturedSen: 1000, pendingExternalSen: 0, succeededRefundSen: 400,
    cashRefundedSen: 0, externalRefundedSen: 400, netCapturedAfterRefundSen: 600,
    refundReconciled: true, paymentStateCounts: { partially_refunded: 1 },
    externalSettlement: { settledSen: 0, pendingSen: 1000, failedSen: 0, notReportedSen: 0 },
  },
};

const transaction = {
  semantics: {
    totalSen: 'accepted_order_value_not_processor_settlement',
    refundDataAvailable: true,
    processorSettlementIncluded: false,
    providerLifecycleAvailable: true,
    acceptedOrderValueUnchangedByRefunds: true,
    providerSettlementStateAvailable: true,
  },
  filter: {},
  totalCount: 1,
  items: [{
    orderId: 'order-1', orderNumber: 100001, createdAt: '2026-09-18T01:00:00Z',
    localDate: '2026-09-18', localTime: '09:00:00',
    branch: { id: 'branch-1', code: 'BR-1', name: 'Main', timezone: 'Asia/Kuala_Lumpur' },
    salesPoint: null, terminalCode: null, source: 'customer', status: 'completed',
    fulfillmentType: 'asap', requestedPickupAt: null,
    subtotalSen: 1000, voucherDiscountSen: 0, promotionDiscountSen: 0,
    discountSen: 0, totalSen: 1000, currency: 'MYR',
    refundedSen: 400, refundableSen: 600, refundReservedSen: 400, refundReconciled: true,
    latestPaymentIntent: {
      id: 'intent-1', providerKey: 'test_provider', state: 'captured',
      settlementState: 'pending', amountSen: 1000, currency: 'MYR',
    },
    refunds: [{
      id: 'refund-1', tenderType: 'external', state: 'succeeded', amountSen: 400,
      reason: 'Customer request', createdAt: '2026-09-18T02:00:00Z',
      succeededAt: '2026-09-18T02:01:00Z',
    }],
    discountReconciled: true, tenderType: 'external', paymentState: 'partially_refunded',
    paidAt: '2026-09-18T01:01:00Z', shiftId: null, createdByUserId: null,
    memberAttached: true, voucher: null, promotions: [], lines: [],
  }],
};

const paymentAudit = {
  coverage: {
    sourceBackedOnly: true,
    rawProviderPayloadIncluded: false,
    notes: ['Payment/refund lifecycle events are source-backed.'],
  },
  filter: {},
  totalCount: 1,
  items: [{
    eventKey: 'refund:event-1', occurredAt: '2026-09-18T02:01:00Z',
    localDate: '2026-09-18', localTime: '10:01:00', timezone: 'Asia/Kuala_Lumpur',
    category: 'refund', action: 'succeeded', actorUserId: null,
    branchId: 'branch-1', salesPointId: null, entityType: 'payment_refund',
    entityId: 'refund-1', entityLabel: 'Order 100001 refund',
    details: { amountSen: 400, payloadSha256: 'a'.repeat(64) },
  }],
};

describe('Phase 9 reporting client', () => {
  it('parses payment/refund summary without redefining accepted order value', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: summary }), { status: 200 }),
    );
    const result = await loadReportingSummary({ fromDate: '2026-09-18', toDate: '2026-09-18' });
    expect(result.orders.acceptedOrderValueSen).toBe(1000);
    expect(result.payments.grossCapturedSen).toBe(1000);
    expect(result.payments.succeededRefundSen).toBe(400);
    expect(result.payments.netCapturedAfterRefundSen).toBe(600);
    expect(result.semantics.acceptedOrderValueIsSettlement).toBe(false);
  });

  it('parses transaction refund facts and provider lifecycle separately', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: transaction }), { status: 200 }),
    );
    const result = await loadTransactionReport({ fromDate: '2026-09-18', toDate: '2026-09-18' });
    expect(result.items[0]?.refundedSen).toBe(400);
    expect(result.items[0]?.totalSen).toBe(1000);
    expect(result.items[0]?.latestPaymentIntent?.settlementState).toBe('pending');
    expect(result.semantics.acceptedOrderValueUnchangedByRefunds).toBe(true);
  });

  it('loads a separate payment/refund audit feed without raw payload claims', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: paymentAudit }), { status: 200 }),
    );
    const result = await loadPaymentAuditReport({ fromDate: '2026-09-18', toDate: '2026-09-18' });
    expect(result.coverage.rawProviderPayloadIncluded).toBe(false);
    expect(result.items[0]?.category).toBe('refund');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/reporting/payment-audit?fromDate=2026-09-18&toDate=2026-09-18',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });

  it('fails closed when the Phase 9 payment summary is missing', async () => {
    const { payments: _payments, ...withoutPayments } = summary;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: withoutPayments }), { status: 200 }),
    );
    await expect(loadReportingSummary({ fromDate: '2026-09-18', toDate: '2026-09-18' }))
      .rejects.toThrow(/reporting payments/i);
  });
});
