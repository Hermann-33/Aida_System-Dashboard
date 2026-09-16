import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAuditReport, loadReportingSummary, loadTransactionReport } from './reportingClient';

afterEach(() => vi.unstubAllGlobals());

function response(data: unknown, ok = true) {
  return Promise.resolve(new Response(JSON.stringify(ok ? { data } : { error: 'denied' }), {
    status: ok ? 200 : 403,
    headers: { 'Content-Type': 'application/json' },
  }));
}

const validSummary = {
  semantics: {
    commercialValue: 'accepted_order_value_not_processor_settlement',
    cancelledOrdersExcludedFromCommercialTotals: true,
    inventoryQuantitiesGroupedByBaseUnitItem: true,
    statutoryAccountingIncluded: false,
    processorSettlementIncluded: false,
  },
  filter: { fromDate: '2026-09-16', toDate: '2026-09-16' },
  orders: {
    orderCount: 1,
    acceptedOrderCount: 1,
    cancelledOrderCount: 0,
    subtotalSen: 1500,
    voucherDiscountSen: 100,
    promotionDiscountSen: 200,
    discountSen: 300,
    acceptedOrderValueSen: 1200,
    averageAcceptedOrderValueSen: 1200,
    paidPosCashSen: 0,
    unpaidAcceptedOrderValueSen: 1200,
    discountReconciled: true,
    statusCounts: { confirmed: 1 },
  },
  byBranch: [],
  bySalesPoint: [],
  byProduct: [],
  shifts: {
    shiftOpenedCount: 0,
    openOrLockedShiftCount: 0,
    closedShiftCount: 0,
    openingFloatSen: 0,
    closingExpectedCashSen: 0,
    closingActualCashSen: 0,
    cashVarianceSen: 0,
    unapprovedClosedShiftCount: 0,
  },
  cashMovements: { movementCount: 0, cashInSen: 0, cashOutSen: 0, netMovementSen: 0 },
  loyaltyAndDiscountApplications: {
    awardedOrderCount: 0,
    pointsAwarded: 0,
    stampsAwarded: 0,
    voucherApplicationCount: 1,
    voucherDiscountSen: 100,
    promotionApplicationCount: 1,
    promotionDiscountSen: 200,
  },
  inventoryMovements: { movementCount: 0, byItem: [] },
};

describe('Phase 8 reporting client', () => {
  it('loads summary through the same-origin BFF with bounded filter intent', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response(validSummary));
    vi.stubGlobal('fetch', fetchMock);
    const result = await loadReportingSummary({ fromDate: '2026-09-16', toDate: '2026-09-16', branchId: 'branch-1' });
    expect(result.orders.discountSen).toBe(300);
    expect(result.orders.voucherDiscountSen + result.orders.promotionDiscountSen).toBe(result.orders.discountSen);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/admin/reporting/summary?');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('branchId=branch-1');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include', cache: 'no-store' });
  });

  it('rejects a malformed monetary summary instead of coercing it', async () => {
    vi.stubGlobal('fetch', vi.fn(() => response({ ...validSummary, orders: { ...validSummary.orders, discountSen: '300' } })));
    await expect(loadReportingSummary({ fromDate: '2026-09-16', toDate: '2026-09-16' })).rejects.toThrow('Invalid reporting discountSen');
  });

  it('fails closed on malformed transaction pagination', async () => {
    vi.stubGlobal('fetch', vi.fn(() => response({
      semantics: {
        totalSen: 'accepted_order_value_not_processor_settlement',
        refundDataAvailable: false,
        processorSettlementIncluded: false,
      },
      filter: {},
      totalCount: '1',
      items: [],
    })));
    await expect(loadTransactionReport({ fromDate: '2026-09-16', toDate: '2026-09-16' })).rejects.toThrow('Invalid transaction report totalCount');
  });

  it('requires declared audit coverage and item pagination', async () => {
    vi.stubGlobal('fetch', vi.fn(() => response({ filter: {}, totalCount: 0, items: [] })));
    await expect(loadAuditReport({ fromDate: '2026-09-16', toDate: '2026-09-16' })).rejects.toThrow('Invalid audit report coverage');
  });
});
