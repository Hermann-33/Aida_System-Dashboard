export type ReportFilter = {
  fromDate: string;
  toDate: string;
  branchId?: string;
  salesPointId?: string;
  pageSize?: number;
  offset?: number;
};

type JsonRecord = Record<string, unknown>;

export type ReportingSummary = {
  semantics: {
    commercialValue: string;
    cancelledOrdersExcludedFromCommercialTotals: boolean;
    inventoryQuantitiesGroupedByBaseUnitItem: boolean;
    statutoryAccountingIncluded: boolean;
    processorSettlementIncluded: boolean;
    refundDataAvailable: boolean;
    paymentFactsIncludeCancelledOrders: boolean;
    acceptedOrderValueIsSettlement: boolean;
    providerSettlementStateAvailable: boolean;
  };
  filter: JsonRecord;
  orders: {
    orderCount: number;
    acceptedOrderCount: number;
    cancelledOrderCount: number;
    subtotalSen: number;
    voucherDiscountSen: number;
    promotionDiscountSen: number;
    discountSen: number;
    acceptedOrderValueSen: number;
    averageAcceptedOrderValueSen: number;
    paidPosCashSen: number;
    unpaidAcceptedOrderValueSen: number;
    discountReconciled: boolean;
    statusCounts: Record<string, number>;
  };
  byBranch: Array<{
    branchId: string;
    branchCode: string;
    branchName: string;
    timezone: string;
    orderCount: number;
    subtotalSen: number;
    voucherDiscountSen: number;
    promotionDiscountSen: number;
    discountSen: number;
    acceptedOrderValueSen: number;
  }>;
  bySalesPoint: Array<{
    salesPointId: string | null;
    salesPointCode: string | null;
    salesPointName: string | null;
    orderCount: number;
    acceptedOrderValueSen: number;
  }>;
  byProduct: Array<{
    itemId: string;
    sku: string;
    name: string;
    quantity: number;
    lineValueSen: number;
  }>;
  shifts: {
    shiftOpenedCount: number;
    openOrLockedShiftCount: number;
    closedShiftCount: number;
    openingFloatSen: number;
    closingExpectedCashSen: number;
    closingActualCashSen: number;
    cashVarianceSen: number;
    unapprovedClosedShiftCount: number;
  };
  cashMovements: {
    movementCount: number;
    cashInSen: number;
    cashOutSen: number;
    netMovementSen: number;
  };
  loyaltyAndDiscountApplications: {
    awardedOrderCount: number;
    pointsAwarded: number;
    stampsAwarded: number;
    voucherApplicationCount: number;
    voucherDiscountSen: number;
    promotionApplicationCount: number;
    promotionDiscountSen: number;
  };
  inventoryMovements: {
    movementCount: number;
    byItem: unknown[];
  };
  payments: {
    capturedOrderCount: number;
    grossCapturedSen: number;
    cashCapturedSen: number;
    externalCapturedSen: number;
    pendingExternalSen: number;
    succeededRefundSen: number;
    cashRefundedSen: number;
    externalRefundedSen: number;
    netCapturedAfterRefundSen: number;
    refundReconciled: boolean;
    paymentStateCounts: Record<string, number>;
    externalSettlement: {
      settledSen: number;
      pendingSen: number;
      failedSen: number;
      notReportedSen: number;
    };
  };
};

export type TransactionItem = {
  orderId: string;
  orderNumber: number;
  createdAt: string;
  localDate: string;
  localTime: string;
  branch: { id: string; code: string; name: string; timezone: string };
  salesPoint: { id: string; code: string | null; name: string | null } | null;
  terminalCode: string | null;
  source: string;
  status: string;
  fulfillmentType: string;
  requestedPickupAt: string | null;
  subtotalSen: number;
  voucherDiscountSen: number;
  promotionDiscountSen: number;
  discountSen: number;
  totalSen: number;
  currency: string;
  refundedSen: number;
  refundableSen: number;
  refundReservedSen: number;
  refundReconciled: boolean;
  latestPaymentIntent: JsonRecord | null;
  refunds: JsonRecord[];
  discountReconciled: boolean;
  tenderType: string;
  paymentState: string;
  paidAt: string | null;
  shiftId: string | null;
  createdByUserId: string | null;
  memberAttached: boolean;
  voucher: JsonRecord | null;
  promotions: unknown[];
  lines: unknown[];
};

export type TransactionReport = {
  semantics: {
    totalSen: string;
    refundDataAvailable: boolean;
    processorSettlementIncluded: boolean;
    providerLifecycleAvailable: boolean;
    acceptedOrderValueUnchangedByRefunds: boolean;
    providerSettlementStateAvailable: boolean;
  };
  filter: JsonRecord;
  totalCount: number;
  items: TransactionItem[];
};

export type AuditItem = {
  eventKey: string;
  occurredAt: string;
  localDate: string;
  localTime: string;
  timezone: string;
  category: string;
  action: string;
  actorUserId: string | null;
  branchId: string | null;
  salesPointId: string | null;
  entityType: string;
  entityId: string;
  entityLabel: string;
  details: JsonRecord;
};

export type AuditReport = {
  filter: JsonRecord;
  totalCount: number;
  items: AuditItem[];
  coverage: {
    sourceBackedOnly: boolean;
    completeGeneralAuditLog: boolean;
    notes: string[];
  };
};

export type PaymentAuditReport = {
  filter: JsonRecord;
  totalCount: number;
  items: AuditItem[];
  coverage: {
    sourceBackedOnly: boolean;
    rawProviderPayloadIncluded: boolean;
    notes: string[];
  };
};

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as JsonRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${label}`);
  return value;
}

function nullableText(value: unknown, label: string): string | null {
  if (value === null) return null;
  return text(value, label);
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${label}`);
  return value;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  const parsed = integer(value, label);
  if (parsed < 0) throw new Error(`Invalid ${label}`);
  return parsed;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  return array(value, label).map((entry, index) => text(entry, `${label}[${index}]`));
}

function statusCounts(value: unknown): Record<string, number> {
  const row = record(value, 'reporting status counts');
  return Object.fromEntries(Object.entries(row).map(([key, count]) => [key, nonNegativeInteger(count, `reporting status count ${key}`)]));
}

function parseSummary(value: unknown): ReportingSummary {
  const row = record(value, 'reporting summary');
  const semantics = record(row.semantics, 'reporting semantics');
  const orders = record(row.orders, 'reporting orders');
  const shifts = record(row.shifts, 'reporting shifts');
  const cash = record(row.cashMovements, 'reporting cash movements');
  const loyalty = record(row.loyaltyAndDiscountApplications, 'reporting loyalty');
  const inventory = record(row.inventoryMovements, 'reporting inventory movements');
  const payments = record(row.payments, 'reporting payments');
  const settlement = record(payments.externalSettlement, 'reporting external settlement');

  return {
    semantics: {
      commercialValue: text(semantics.commercialValue, 'reporting commercialValue'),
      cancelledOrdersExcludedFromCommercialTotals: bool(semantics.cancelledOrdersExcludedFromCommercialTotals, 'reporting cancelled-order semantics'),
      inventoryQuantitiesGroupedByBaseUnitItem: bool(semantics.inventoryQuantitiesGroupedByBaseUnitItem, 'reporting inventory semantics'),
      statutoryAccountingIncluded: bool(semantics.statutoryAccountingIncluded, 'reporting statutory-accounting semantics'),
      processorSettlementIncluded: bool(semantics.processorSettlementIncluded, 'reporting processor-settlement semantics'),
      refundDataAvailable: bool(semantics.refundDataAvailable, 'reporting refund semantics'),
      paymentFactsIncludeCancelledOrders: bool(semantics.paymentFactsIncludeCancelledOrders, 'reporting payment cancellation semantics'),
      acceptedOrderValueIsSettlement: bool(semantics.acceptedOrderValueIsSettlement, 'reporting accepted-value settlement semantics'),
      providerSettlementStateAvailable: bool(semantics.providerSettlementStateAvailable, 'reporting settlement-state semantics'),
    },
    filter: record(row.filter, 'reporting summary filter'),
    orders: {
      orderCount: nonNegativeInteger(orders.orderCount, 'reporting orderCount'),
      acceptedOrderCount: nonNegativeInteger(orders.acceptedOrderCount, 'reporting acceptedOrderCount'),
      cancelledOrderCount: nonNegativeInteger(orders.cancelledOrderCount, 'reporting cancelledOrderCount'),
      subtotalSen: nonNegativeInteger(orders.subtotalSen, 'reporting subtotalSen'),
      voucherDiscountSen: nonNegativeInteger(orders.voucherDiscountSen, 'reporting voucherDiscountSen'),
      promotionDiscountSen: nonNegativeInteger(orders.promotionDiscountSen, 'reporting promotionDiscountSen'),
      discountSen: nonNegativeInteger(orders.discountSen, 'reporting discountSen'),
      acceptedOrderValueSen: nonNegativeInteger(orders.acceptedOrderValueSen, 'reporting acceptedOrderValueSen'),
      averageAcceptedOrderValueSen: nonNegativeInteger(orders.averageAcceptedOrderValueSen, 'reporting averageAcceptedOrderValueSen'),
      paidPosCashSen: nonNegativeInteger(orders.paidPosCashSen, 'reporting paidPosCashSen'),
      unpaidAcceptedOrderValueSen: nonNegativeInteger(orders.unpaidAcceptedOrderValueSen, 'reporting unpaidAcceptedOrderValueSen'),
      discountReconciled: bool(orders.discountReconciled, 'reporting discountReconciled'),
      statusCounts: statusCounts(orders.statusCounts),
    },
    byBranch: array(row.byBranch, 'reporting byBranch').map((value, index) => {
      const item = record(value, `reporting byBranch[${index}]`);
      return {
        branchId: text(item.branchId, 'reporting branchId'),
        branchCode: text(item.branchCode, 'reporting branchCode'),
        branchName: text(item.branchName, 'reporting branchName'),
        timezone: text(item.timezone, 'reporting branch timezone'),
        orderCount: nonNegativeInteger(item.orderCount, 'reporting branch orderCount'),
        subtotalSen: nonNegativeInteger(item.subtotalSen, 'reporting branch subtotalSen'),
        voucherDiscountSen: nonNegativeInteger(item.voucherDiscountSen, 'reporting branch voucherDiscountSen'),
        promotionDiscountSen: nonNegativeInteger(item.promotionDiscountSen, 'reporting branch promotionDiscountSen'),
        discountSen: nonNegativeInteger(item.discountSen, 'reporting branch discountSen'),
        acceptedOrderValueSen: nonNegativeInteger(item.acceptedOrderValueSen, 'reporting branch acceptedOrderValueSen'),
      };
    }),
    bySalesPoint: array(row.bySalesPoint, 'reporting bySalesPoint').map((value, index) => {
      const item = record(value, `reporting bySalesPoint[${index}]`);
      return {
        salesPointId: nullableText(item.salesPointId, 'reporting salesPointId'),
        salesPointCode: nullableText(item.salesPointCode, 'reporting salesPointCode'),
        salesPointName: nullableText(item.salesPointName, 'reporting salesPointName'),
        orderCount: nonNegativeInteger(item.orderCount, 'reporting sales-point orderCount'),
        acceptedOrderValueSen: nonNegativeInteger(item.acceptedOrderValueSen, 'reporting sales-point acceptedOrderValueSen'),
      };
    }),
    byProduct: array(row.byProduct, 'reporting byProduct').map((value, index) => {
      const item = record(value, `reporting byProduct[${index}]`);
      return {
        itemId: text(item.itemId, 'reporting product itemId'),
        sku: text(item.sku, 'reporting product sku'),
        name: text(item.name, 'reporting product name'),
        quantity: nonNegativeInteger(item.quantity, 'reporting product quantity'),
        lineValueSen: nonNegativeInteger(item.lineValueSen, 'reporting product lineValueSen'),
      };
    }),
    shifts: {
      shiftOpenedCount: nonNegativeInteger(shifts.shiftOpenedCount, 'reporting shiftOpenedCount'),
      openOrLockedShiftCount: nonNegativeInteger(shifts.openOrLockedShiftCount, 'reporting openOrLockedShiftCount'),
      closedShiftCount: nonNegativeInteger(shifts.closedShiftCount, 'reporting closedShiftCount'),
      openingFloatSen: nonNegativeInteger(shifts.openingFloatSen, 'reporting openingFloatSen'),
      closingExpectedCashSen: nonNegativeInteger(shifts.closingExpectedCashSen, 'reporting closingExpectedCashSen'),
      closingActualCashSen: nonNegativeInteger(shifts.closingActualCashSen, 'reporting closingActualCashSen'),
      cashVarianceSen: integer(shifts.cashVarianceSen, 'reporting cashVarianceSen'),
      unapprovedClosedShiftCount: nonNegativeInteger(shifts.unapprovedClosedShiftCount, 'reporting unapprovedClosedShiftCount'),
    },
    cashMovements: {
      movementCount: nonNegativeInteger(cash.movementCount, 'reporting cash movementCount'),
      cashInSen: nonNegativeInteger(cash.cashInSen, 'reporting cashInSen'),
      cashOutSen: nonNegativeInteger(cash.cashOutSen, 'reporting cashOutSen'),
      netMovementSen: integer(cash.netMovementSen, 'reporting netMovementSen'),
    },
    loyaltyAndDiscountApplications: {
      awardedOrderCount: nonNegativeInteger(loyalty.awardedOrderCount, 'reporting awardedOrderCount'),
      pointsAwarded: nonNegativeInteger(loyalty.pointsAwarded, 'reporting pointsAwarded'),
      stampsAwarded: nonNegativeInteger(loyalty.stampsAwarded, 'reporting stampsAwarded'),
      voucherApplicationCount: nonNegativeInteger(loyalty.voucherApplicationCount, 'reporting voucherApplicationCount'),
      voucherDiscountSen: nonNegativeInteger(loyalty.voucherDiscountSen, 'reporting loyalty voucherDiscountSen'),
      promotionApplicationCount: nonNegativeInteger(loyalty.promotionApplicationCount, 'reporting promotionApplicationCount'),
      promotionDiscountSen: nonNegativeInteger(loyalty.promotionDiscountSen, 'reporting loyalty promotionDiscountSen'),
    },
    inventoryMovements: {
      movementCount: nonNegativeInteger(inventory.movementCount, 'reporting inventory movementCount'),
      byItem: array(inventory.byItem, 'reporting inventory byItem'),
    },
    payments: {
      capturedOrderCount: nonNegativeInteger(payments.capturedOrderCount, 'reporting capturedOrderCount'),
      grossCapturedSen: nonNegativeInteger(payments.grossCapturedSen, 'reporting grossCapturedSen'),
      cashCapturedSen: nonNegativeInteger(payments.cashCapturedSen, 'reporting cashCapturedSen'),
      externalCapturedSen: nonNegativeInteger(payments.externalCapturedSen, 'reporting externalCapturedSen'),
      pendingExternalSen: nonNegativeInteger(payments.pendingExternalSen, 'reporting pendingExternalSen'),
      succeededRefundSen: nonNegativeInteger(payments.succeededRefundSen, 'reporting succeededRefundSen'),
      cashRefundedSen: nonNegativeInteger(payments.cashRefundedSen, 'reporting cashRefundedSen'),
      externalRefundedSen: nonNegativeInteger(payments.externalRefundedSen, 'reporting externalRefundedSen'),
      netCapturedAfterRefundSen: nonNegativeInteger(payments.netCapturedAfterRefundSen, 'reporting netCapturedAfterRefundSen'),
      refundReconciled: bool(payments.refundReconciled, 'reporting refundReconciled'),
      paymentStateCounts: statusCounts(payments.paymentStateCounts),
      externalSettlement: {
        settledSen: nonNegativeInteger(settlement.settledSen, 'reporting settledSen'),
        pendingSen: nonNegativeInteger(settlement.pendingSen, 'reporting pending settlementSen'),
        failedSen: nonNegativeInteger(settlement.failedSen, 'reporting failed settlementSen'),
        notReportedSen: nonNegativeInteger(settlement.notReportedSen, 'reporting notReported settlementSen'),
      },
    },
  };
}

function parseTransactionItem(value: unknown, index: number): TransactionItem {
  const item = record(value, `transaction report items[${index}]`);
  const branch = record(item.branch, 'transaction branch');
  const salesPoint = item.salesPoint === null ? null : record(item.salesPoint, 'transaction salesPoint');
  return {
    orderId: text(item.orderId, 'transaction orderId'),
    orderNumber: nonNegativeInteger(item.orderNumber, 'transaction orderNumber'),
    createdAt: text(item.createdAt, 'transaction createdAt'),
    localDate: text(item.localDate, 'transaction localDate'),
    localTime: text(item.localTime, 'transaction localTime'),
    branch: {
      id: text(branch.id, 'transaction branch id'),
      code: text(branch.code, 'transaction branch code'),
      name: text(branch.name, 'transaction branch name'),
      timezone: text(branch.timezone, 'transaction branch timezone'),
    },
    salesPoint: salesPoint ? {
      id: text(salesPoint.id, 'transaction salesPoint id'),
      code: nullableText(salesPoint.code, 'transaction salesPoint code'),
      name: nullableText(salesPoint.name, 'transaction salesPoint name'),
    } : null,
    terminalCode: nullableText(item.terminalCode, 'transaction terminalCode'),
    source: text(item.source, 'transaction source'),
    status: text(item.status, 'transaction status'),
    fulfillmentType: text(item.fulfillmentType, 'transaction fulfillmentType'),
    requestedPickupAt: nullableText(item.requestedPickupAt, 'transaction requestedPickupAt'),
    subtotalSen: nonNegativeInteger(item.subtotalSen, 'transaction subtotalSen'),
    voucherDiscountSen: nonNegativeInteger(item.voucherDiscountSen, 'transaction voucherDiscountSen'),
    promotionDiscountSen: nonNegativeInteger(item.promotionDiscountSen, 'transaction promotionDiscountSen'),
    discountSen: nonNegativeInteger(item.discountSen, 'transaction discountSen'),
    totalSen: nonNegativeInteger(item.totalSen, 'transaction totalSen'),
    currency: text(item.currency, 'transaction currency'),
    refundedSen: nonNegativeInteger(item.refundedSen, 'transaction refundedSen'),
    refundableSen: nonNegativeInteger(item.refundableSen, 'transaction refundableSen'),
    refundReservedSen: nonNegativeInteger(item.refundReservedSen, 'transaction refundReservedSen'),
    refundReconciled: bool(item.refundReconciled, 'transaction refundReconciled'),
    latestPaymentIntent: item.latestPaymentIntent === null ? null : record(item.latestPaymentIntent, 'transaction latestPaymentIntent'),
    refunds: array(item.refunds, 'transaction refunds').map((value, refundIndex) => record(value, `transaction refunds[${refundIndex}]`)),
    discountReconciled: bool(item.discountReconciled, 'transaction discountReconciled'),
    tenderType: text(item.tenderType, 'transaction tenderType'),
    paymentState: text(item.paymentState, 'transaction paymentState'),
    paidAt: nullableText(item.paidAt, 'transaction paidAt'),
    shiftId: nullableText(item.shiftId, 'transaction shiftId'),
    createdByUserId: nullableText(item.createdByUserId, 'transaction createdByUserId'),
    memberAttached: bool(item.memberAttached, 'transaction memberAttached'),
    voucher: item.voucher === null ? null : record(item.voucher, 'transaction voucher'),
    promotions: array(item.promotions, 'transaction promotions'),
    lines: array(item.lines, 'transaction lines'),
  };
}

function parseTransactionReport(value: unknown): TransactionReport {
  const row = record(value, 'transaction report');
  const semantics = record(row.semantics, 'transaction report semantics');
  return {
    semantics: {
      totalSen: text(semantics.totalSen, 'transaction total semantics'),
      refundDataAvailable: bool(semantics.refundDataAvailable, 'transaction refund semantics'),
      processorSettlementIncluded: bool(semantics.processorSettlementIncluded, 'transaction settlement semantics'),
      providerLifecycleAvailable: bool(semantics.providerLifecycleAvailable, 'transaction provider lifecycle semantics'),
      acceptedOrderValueUnchangedByRefunds: bool(semantics.acceptedOrderValueUnchangedByRefunds, 'transaction accepted-value semantics'),
      providerSettlementStateAvailable: bool(semantics.providerSettlementStateAvailable, 'transaction provider settlement semantics'),
    },
    filter: record(row.filter, 'transaction report filter'),
    totalCount: nonNegativeInteger(row.totalCount, 'transaction report totalCount'),
    items: array(row.items, 'transaction report items').map(parseTransactionItem),
  };
}

function parseAuditItem(value: unknown, index: number, label = 'audit report'): AuditItem {
  const item = record(value, `${label} items[${index}]`);
  return {
    eventKey: text(item.eventKey, 'audit eventKey'),
    occurredAt: text(item.occurredAt, 'audit occurredAt'),
    localDate: text(item.localDate, 'audit localDate'),
    localTime: text(item.localTime, 'audit localTime'),
    timezone: text(item.timezone, 'audit timezone'),
    category: text(item.category, 'audit category'),
    action: text(item.action, 'audit action'),
    actorUserId: nullableText(item.actorUserId, 'audit actorUserId'),
    branchId: nullableText(item.branchId, 'audit branchId'),
    salesPointId: nullableText(item.salesPointId, 'audit salesPointId'),
    entityType: text(item.entityType, 'audit entityType'),
    entityId: text(item.entityId, 'audit entityId'),
    entityLabel: text(item.entityLabel, 'audit entityLabel'),
    details: record(item.details, 'audit details'),
  };
}

function parseAuditReport(value: unknown): AuditReport {
  const row = record(value, 'audit report');
  const coverage = record(row.coverage, 'audit report coverage');
  return {
    filter: record(row.filter, 'audit report filter'),
    totalCount: nonNegativeInteger(row.totalCount, 'audit report totalCount'),
    items: array(row.items, 'audit report items').map((value, index) => parseAuditItem(value, index)),
    coverage: {
      sourceBackedOnly: bool(coverage.sourceBackedOnly, 'audit sourceBackedOnly'),
      completeGeneralAuditLog: bool(coverage.completeGeneralAuditLog, 'audit completeGeneralAuditLog'),
      notes: stringArray(coverage.notes, 'audit coverage notes'),
    },
  };
}

function parsePaymentAuditReport(value: unknown): PaymentAuditReport {
  const row = record(value, 'payment audit report');
  const coverage = record(row.coverage, 'payment audit coverage');
  return {
    filter: record(row.filter, 'payment audit filter'),
    totalCount: nonNegativeInteger(row.totalCount, 'payment audit totalCount'),
    items: array(row.items, 'payment audit items').map((value, index) => parseAuditItem(value, index, 'payment audit')),
    coverage: {
      sourceBackedOnly: bool(coverage.sourceBackedOnly, 'payment audit sourceBackedOnly'),
      rawProviderPayloadIncluded: bool(coverage.rawProviderPayloadIncluded, 'payment audit rawProviderPayloadIncluded'),
      notes: stringArray(coverage.notes, 'payment audit coverage notes'),
    },
  };
}

function query(filter: ReportFilter): string {
  const params = new URLSearchParams({ fromDate: filter.fromDate, toDate: filter.toDate });
  if (filter.branchId) params.set('branchId', filter.branchId);
  if (filter.salesPointId) params.set('salesPointId', filter.salesPointId);
  if (filter.pageSize !== undefined) params.set('pageSize', String(filter.pageSize));
  if (filter.offset !== undefined) params.set('offset', String(filter.offset));
  return params.toString();
}

async function request<T>(path: string, filter: ReportFilter, parser: (value: unknown) => T): Promise<T> {
  const response = await fetch(`${path}?${query(filter)}`, { credentials: 'include', cache: 'no-store' });
  const body = await response.json().catch(() => ({})) as { data?: unknown; error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  if (body.data === undefined) throw new Error('Backend response is missing data');
  return parser(body.data);
}

export function loadReportingSummary(filter: ReportFilter): Promise<ReportingSummary> {
  return request('/api/v1/admin/reporting/summary', filter, parseSummary);
}

export function loadTransactionReport(filter: ReportFilter): Promise<TransactionReport> {
  return request('/api/v1/admin/reporting/transactions', filter, parseTransactionReport);
}

export function loadAuditReport(filter: ReportFilter): Promise<AuditReport> {
  return request('/api/v1/admin/reporting/audit', filter, parseAuditReport);
}


export function loadPaymentAuditReport(filter: ReportFilter): Promise<PaymentAuditReport> {
  return request('/api/v1/admin/reporting/payment-audit', filter, parsePaymentAuditReport);
}
