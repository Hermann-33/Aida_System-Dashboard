export type PaymentTenderType = 'unpaid' | 'cash' | 'external';
export type OrderPaymentState = 'unpaid' | 'pending' | 'paid' | 'partially_refunded' | 'refunded';
export type PaymentIntentState = 'created' | 'requires_action' | 'authorized' | 'captured' | 'failed' | 'cancelled';
export type PaymentSettlementState = 'not_reported' | 'pending' | 'settled' | 'failed';
export type RefundTenderType = 'cash' | 'external';
export type RefundState = 'requested' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

export type PaymentIntentSnapshot = {
  id: string;
  providerKey: string;
  state: PaymentIntentState;
  settlementState: PaymentSettlementState;
  amountSen: number;
  currency: string;
  createdAt: string;
  authorizedAt: string | null;
  capturedAt: string | null;
  settledAt: string | null;
};

export type RefundSnapshot = {
  id: string;
  tenderType: RefundTenderType;
  state: RefundState;
  amountSen: number;
  reason: string | null;
  createdAt: string;
  succeededAt: string | null;
};

export type PaymentSnapshot = {
  tenderType: PaymentTenderType;
  paymentState: OrderPaymentState;
  paidAt: string | null;
  refundedSen: number;
  refundableSen: number;
  providerAvailable: boolean;
  latestIntent: PaymentIntentSnapshot | null;
  refunds: RefundSnapshot[];
};

export type RefundRequest = {
  orderId: string;
  tenderType: RefundTenderType;
  amountSen: number;
  reason: string;
  idempotencyKey: string;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as JsonRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Invalid ${label}`);
  return value;
}

function nullableText(value: unknown, label: string): string | null {
  if (value === null) return null;
  return text(value, label);
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`Invalid ${label}`);
  return value;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${label}`);
  return value;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ${label}`);
  return value;
}

function nullableTimestamp(value: unknown, label: string): string | null {
  if (value === null) return null;
  return timestamp(value, label);
}

function tender(value: unknown): PaymentTenderType {
  if (value !== 'unpaid' && value !== 'cash' && value !== 'external') throw new Error('Invalid payment tender type');
  return value;
}

function paymentState(value: unknown): OrderPaymentState {
  if (!['unpaid', 'pending', 'paid', 'partially_refunded', 'refunded'].includes(String(value))) {
    throw new Error('Invalid order payment state');
  }
  return value as OrderPaymentState;
}

function intentState(value: unknown): PaymentIntentState {
  if (!['created', 'requires_action', 'authorized', 'captured', 'failed', 'cancelled'].includes(String(value))) {
    throw new Error('Invalid payment intent state');
  }
  return value as PaymentIntentState;
}

function settlementState(value: unknown): PaymentSettlementState {
  if (!['not_reported', 'pending', 'settled', 'failed'].includes(String(value))) {
    throw new Error('Invalid settlement state');
  }
  return value as PaymentSettlementState;
}

function refundTender(value: unknown): RefundTenderType {
  if (value !== 'cash' && value !== 'external') throw new Error('Invalid refund tender type');
  return value;
}

function refundState(value: unknown): RefundState {
  if (!['requested', 'processing', 'succeeded', 'failed', 'cancelled'].includes(String(value))) {
    throw new Error('Invalid refund state');
  }
  return value as RefundState;
}

function parseIntent(value: unknown): PaymentIntentSnapshot | null {
  if (value === null) return null;
  const row = record(value, 'payment intent');
  const state = intentState(row.state);
  const settlement = settlementState(row.settlementState);
  const authorizedAt = nullableTimestamp(row.authorizedAt, 'payment authorizedAt');
  const capturedAt = nullableTimestamp(row.capturedAt, 'payment capturedAt');
  const settledAt = nullableTimestamp(row.settledAt, 'payment settledAt');
  if (state === 'authorized' && authorizedAt === null) throw new Error('Authorized payment requires authorizedAt');
  if (state === 'captured' && capturedAt === null) throw new Error('Captured payment requires capturedAt');
  if (settlement === 'settled' && settledAt === null) throw new Error('Settled payment requires settledAt');
  return {
    id: text(row.id, 'payment intent id'),
    providerKey: text(row.providerKey, 'payment provider key'),
    state,
    settlementState: settlement,
    amountSen: integer(row.amountSen, 'payment amountSen', 1),
    currency: text(row.currency, 'payment currency'),
    createdAt: timestamp(row.createdAt, 'payment createdAt'),
    authorizedAt,
    capturedAt,
    settledAt,
  };
}

function parseRefund(value: unknown): RefundSnapshot {
  const row = record(value, 'refund');
  const state = refundState(row.state);
  const succeededAt = nullableTimestamp(row.succeededAt, 'refund succeededAt');
  if (state === 'succeeded' && succeededAt === null) throw new Error('Succeeded refund requires succeededAt');
  return {
    id: text(row.id, 'refund id'),
    tenderType: refundTender(row.tenderType),
    state,
    amountSen: integer(row.amountSen, 'refund amountSen', 1),
    reason: nullableText(row.reason, 'refund reason'),
    createdAt: timestamp(row.createdAt, 'refund createdAt'),
    succeededAt,
  };
}

export function parsePaymentSnapshot(
  value: unknown,
  orderTotalSen: number,
  orderCurrency: string,
): PaymentSnapshot {
  if (!Number.isSafeInteger(orderTotalSen) || orderTotalSen < 0 || !orderCurrency) {
    throw new Error('Invalid accepted order context');
  }
  const row = record(value, 'payment snapshot');
  const tenderType = tender(row.tenderType);
  const state = paymentState(row.paymentState);
  const paidAt = nullableTimestamp(row.paidAt, 'payment paidAt');
  const refundedSen = integer(row.refundedSen, 'payment refundedSen');
  const refundableSen = integer(row.refundableSen, 'payment refundableSen');
  if (refundedSen + refundableSen !== orderTotalSen) throw new Error('Payment refund balance does not reconcile');

  const latestIntent = parseIntent(row.latestIntent);
  if (latestIntent && (latestIntent.amountSen !== orderTotalSen || latestIntent.currency !== orderCurrency)) {
    throw new Error('Payment intent does not match accepted order');
  }

  if (!Array.isArray(row.refunds)) throw new Error('Invalid refund list');
  const refunds = row.refunds.map(parseRefund);
  const succeededSen = refunds
    .filter((refund) => refund.state === 'succeeded')
    .reduce((sum, refund) => sum + refund.amountSen, 0);
  if (succeededSen !== refundedSen) throw new Error('Succeeded refunds do not reconcile');

  const reservedSen = refunds
    .filter((refund) => refund.state === 'requested' || refund.state === 'processing' || refund.state === 'succeeded')
    .reduce((sum, refund) => sum + refund.amountSen, 0);
  if (!Number.isSafeInteger(reservedSen) || reservedSen > orderTotalSen) {
    throw new Error('Refund reservations exceed accepted order total');
  }

  if (state === 'unpaid') {
    if (tenderType !== 'unpaid' || paidAt !== null || refundedSen !== 0 || latestIntent?.state === 'captured') {
      throw new Error('Invalid unpaid payment projection');
    }
  } else if (state === 'pending') {
    if (tenderType !== 'external' || paidAt !== null || refundedSen !== 0 || !latestIntent
      || !['created', 'requires_action', 'authorized'].includes(latestIntent.state)) {
      throw new Error('Invalid pending payment projection');
    }
  } else {
    if (tenderType === 'unpaid' || paidAt === null) throw new Error('Paid payment projection requires paid tender');
    if (state === 'paid' && refundedSen !== 0) throw new Error('Paid projection cannot include succeeded refunds');
    if (state === 'partially_refunded' && (refundedSen <= 0 || refundedSen >= orderTotalSen)) {
      throw new Error('Invalid partially-refunded projection');
    }
    if (state === 'refunded' && refundedSen !== orderTotalSen) throw new Error('Invalid refunded projection');
    if (tenderType === 'external' && latestIntent?.state !== 'captured') {
      throw new Error('External paid projection requires captured intent');
    }
    if (tenderType === 'cash' && latestIntent !== null) throw new Error('Cash payment cannot carry provider intent');
  }

  return {
    tenderType,
    paymentState: state,
    paidAt,
    refundedSen,
    refundableSen,
    providerAvailable: bool(row.providerAvailable, 'provider availability'),
    latestIntent,
    refunds,
  };
}

export function reservedRefundSen(snapshot: PaymentSnapshot): number {
  return snapshot.refunds
    .filter((refund) => refund.state === 'requested' || refund.state === 'processing' || refund.state === 'succeeded')
    .reduce((sum, refund) => sum + refund.amountSen, 0);
}

export function requestableRefundSen(snapshot: PaymentSnapshot, orderTotalSen: number): number {
  return Math.max(0, orderTotalSen - reservedRefundSen(snapshot));
}

async function dataResponse(
  response: Response,
  orderTotalSen: number,
  orderCurrency: string,
): Promise<PaymentSnapshot> {
  const body = await response.json().catch(() => ({})) as { data?: unknown; error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  if (body.data === undefined) throw new Error('Backend response is missing payment data');
  return parsePaymentSnapshot(body.data, orderTotalSen, orderCurrency);
}

export async function loadAdminPaymentState(
  orderId: string,
  orderTotalSen: number,
  orderCurrency = 'MYR',
): Promise<PaymentSnapshot> {
  const params = new URLSearchParams({ orderId });
  return dataResponse(
    await fetch(`/api/v1/admin/payments/state?${params.toString()}`, {
      credentials: 'include',
      cache: 'no-store',
    }),
    orderTotalSen,
    orderCurrency,
  );
}

export async function requestAdminRefund(
  input: RefundRequest,
  orderTotalSen: number,
  orderCurrency = 'MYR',
): Promise<PaymentSnapshot> {
  return dataResponse(
    await fetch('/api/v1/admin/payments/refund', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
    orderTotalSen,
    orderCurrency,
  );
}
