import { employeeFetch } from '../../auth/employeeSession';
import type { CartLine } from '../pos/cartTypes';

export const ORDER_QUERY_KEY = ['employee-orders'] as const;
export const ORDER_POLL_INTERVAL_MS = 2_500;

export type FulfillmentType = 'asap' | 'scheduled';
export type ScheduleState = 'future' | 'due' | 'overdue';
export type TenderType = 'unpaid' | 'cash';
export type PaymentState = 'unpaid' | 'paid';
export type OrderStatus =
  | 'confirmed'
  | 'scheduled'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';
export type VoucherRewardType = 'fixed_amount' | 'free_item';

export type OrderSelectionLine = {
  itemId: string;
  variantId?: string;
  addOnIds: string[];
  optionValueIds: string[];
  quantity: number;
  note?: string;
};

export type OrderIntentPayload = {
  fulfillmentType: FulfillmentType;
  requestedPickupAt?: string;
  items: OrderSelectionLine[];
};

export type OrderPlacementPayload = OrderIntentPayload & {
  clientRequestId: string;
  tenderType?: TenderType;
};

export type OrderingPolicy = {
  serverNow: string;
  timezone: string;
  scheduleEnabled: boolean;
  minimumLeadMinutes: number;
  preparationLeadMinutes: number;
  slotIntervalMinutes: number;
  maximumAdvanceDays: number;
};

export type OrderAddOnSnapshot = {
  itemId: string;
  sku: string;
  name: string;
  priceSen: number;
};

export type OrderOptionSnapshot = {
  groupId: string;
  groupCode: string;
  groupName: string;
  optionValueId: string;
  optionCode: string;
  optionLabel: string;
  priceDeltaSen: number;
};

export type OrderLineSnapshot = {
  id?: string;
  lineNumber: number;
  itemId: string;
  sku: string;
  name: string;
  prepRoute: 'bar' | 'kitchen';
  basePriceSen: number;
  variant: {
    id: string;
    code: string;
    label: string;
    priceDeltaSen: number;
  } | null;
  addOns: OrderAddOnSnapshot[];
  addOnTotalSen: number;
  options: OrderOptionSnapshot[];
  optionTotalSen: number;
  unitPriceSen: number;
  quantity: number;
  lineTotalSen: number;
  note: string | null;
};

export type OrderQuoteVoucher = {
  id: string;
  code: string;
  rewardCode: string;
  rewardName: string;
  rewardType: VoucherRewardType;
  discountSen: number;
  freeItemLineNumber: number | null;
  expiresAt: string;
};

export type OrderVoucherSnapshot = {
  code: string;
  rewardCode: string;
  rewardName: string;
  rewardType: VoucherRewardType;
  discountSen: number;
  appliedAt: string;
};

export type OrderQuote = {
  pricingVersion: number;
  currency: 'MYR';
  subtotalSen: number;
  discountSen: number;
  totalSen: number;
  voucher: OrderQuoteVoucher | null;
  fulfillmentType: FulfillmentType;
  requestedPickupAt: string | null;
  serverNow: string;
  schedulePolicy: Omit<OrderingPolicy, 'serverNow'>;
  lines: OrderLineSnapshot[];
};

export type OrderBranchSnapshot = {
  id: string;
  code: string;
  name: string;
  timezone: string;
};

export type OrderSalesPointSnapshot = {
  id: string;
  code: string;
  name: string;
};

export type OrderTerminalSnapshot = {
  id: string;
  code: string;
};

export type OrderSnapshot = {
  id: string;
  orderNumber: number;
  source: 'customer' | 'pos';
  customerUserId: string | null;
  memberId: string | null;
  branchId: string;
  branch: OrderBranchSnapshot;
  salesPointId: string | null;
  salesPoint: OrderSalesPointSnapshot | null;
  terminalId: string | null;
  terminal: OrderTerminalSnapshot | null;
  shiftId: string | null;
  tenderType: TenderType;
  paymentState: PaymentState;
  paidAt: string | null;
  fulfillmentType: FulfillmentType;
  requestedPickupAt: string | null;
  prepareAt: string | null;
  serverNow: string;
  scheduleState: ScheduleState | null;
  status: OrderStatus;
  statusVersion: number;
  currency: 'MYR';
  pricingVersion: number;
  subtotalSen: number;
  discountSen: number;
  totalSen: number;
  voucher: OrderVoucherSnapshot | null;
  createdAt: string;
  updatedAt: string;
  statusUpdatedAt: string;
  preparingAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  lines: OrderLineSnapshot[];
};

export class OrderClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'OrderClientError';
    this.status = status;
    this.code = code;
  }
}

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => null) as
    | { error?: unknown; code?: unknown }
    | T
    | null;
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : fallback;
    const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
      ? body.code
      : 'ORDER_REQUEST_FAILED';
    throw new OrderClientError(error, response.status, code);
  }
  if (!body || typeof body !== 'object') {
    throw new OrderClientError(`${fallback} The response was invalid.`, 502, 'ORDER_RESPONSE_INVALID');
  }
  return body as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isIsoTimestamp(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function invalidResponse(message: string): never {
  throw new OrderClientError(message, 502, 'ORDER_RESPONSE_INVALID');
}

function validAddOn(value: unknown): value is OrderAddOnSnapshot {
  return isRecord(value)
    && typeof value.itemId === 'string'
    && typeof value.sku === 'string'
    && typeof value.name === 'string'
    && isNonNegativeInteger(value.priceSen);
}

function validOption(value: unknown): value is OrderOptionSnapshot {
  return isRecord(value)
    && typeof value.groupId === 'string'
    && typeof value.groupCode === 'string'
    && typeof value.groupName === 'string'
    && typeof value.optionValueId === 'string'
    && typeof value.optionCode === 'string'
    && typeof value.optionLabel === 'string'
    && isSafeInteger(value.priceDeltaSen);
}

function validVariant(value: unknown): boolean {
  return value === null || (
    isRecord(value)
    && typeof value.id === 'string'
    && typeof value.code === 'string'
    && typeof value.label === 'string'
    && isSafeInteger(value.priceDeltaSen)
  );
}

function validOrderLine(value: unknown): value is OrderLineSnapshot {
  return isRecord(value)
    && (value.id === undefined || typeof value.id === 'string')
    && isPositiveInteger(value.lineNumber)
    && typeof value.itemId === 'string'
    && typeof value.sku === 'string'
    && typeof value.name === 'string'
    && (value.prepRoute === 'bar' || value.prepRoute === 'kitchen')
    && isNonNegativeInteger(value.basePriceSen)
    && validVariant(value.variant)
    && Array.isArray(value.addOns)
    && value.addOns.every(validAddOn)
    && isNonNegativeInteger(value.addOnTotalSen)
    && Array.isArray(value.options)
    && value.options.every(validOption)
    && isSafeInteger(value.optionTotalSen)
    && isNonNegativeInteger(value.unitPriceSen)
    && isPositiveInteger(value.quantity)
    && isNonNegativeInteger(value.lineTotalSen)
    && isNullableString(value.note);
}

function validRewardType(value: unknown): value is VoucherRewardType {
  return value === 'fixed_amount' || value === 'free_item';
}

function parseQuoteVoucher(value: unknown): OrderQuoteVoucher | null {
  if (value === null) return null;
  if (!isRecord(value)
    || typeof value.id !== 'string' || value.id.length === 0
    || typeof value.code !== 'string' || value.code.length === 0
    || typeof value.rewardCode !== 'string' || value.rewardCode.length === 0
    || typeof value.rewardName !== 'string' || value.rewardName.length === 0
    || !validRewardType(value.rewardType)
    || !isPositiveInteger(value.discountSen)
    || !(value.freeItemLineNumber === null || isPositiveInteger(value.freeItemLineNumber))
    || !isIsoTimestamp(value.expiresAt)) {
    return invalidResponse('Order quote voucher snapshot is invalid.');
  }
  return value as OrderQuoteVoucher;
}

function parseOrderVoucher(value: unknown): OrderVoucherSnapshot | null {
  if (value === null) return null;
  if (!isRecord(value)
    || typeof value.code !== 'string' || value.code.length === 0
    || typeof value.rewardCode !== 'string' || value.rewardCode.length === 0
    || typeof value.rewardName !== 'string' || value.rewardName.length === 0
    || !validRewardType(value.rewardType)
    || !isPositiveInteger(value.discountSen)
    || !isIsoTimestamp(value.appliedAt)) {
    return invalidResponse('Order voucher commercial snapshot is invalid.');
  }
  return value as OrderVoucherSnapshot;
}

function validateCommercialSnapshot(
  subtotalSen: number,
  discountSen: number,
  totalSen: number,
  voucher: { discountSen: number } | null,
  label: string,
): void {
  if (discountSen > subtotalSen || totalSen !== subtotalSen - discountSen) {
    invalidResponse(`${label} commercial totals are inconsistent.`);
  }
  if (discountSen === 0 && voucher !== null) {
    invalidResponse(`${label} contains a voucher without an accepted discount.`);
  }
  if (discountSen > 0 && (voucher === null || voucher.discountSen !== discountSen)) {
    invalidResponse(`${label} discount is not backed by the accepted Phase 6 voucher snapshot.`);
  }
}

export function parseOrderingPolicy(value: unknown): OrderingPolicy {
  if (!isRecord(value)
    || !isIsoTimestamp(value.serverNow)
    || typeof value.timezone !== 'string'
    || typeof value.scheduleEnabled !== 'boolean'
    || !isNonNegativeNumber(value.minimumLeadMinutes)
    || !isNonNegativeNumber(value.preparationLeadMinutes)
    || !isNonNegativeNumber(value.slotIntervalMinutes)
    || value.slotIntervalMinutes === 0
    || !isNonNegativeNumber(value.maximumAdvanceDays)) {
    return invalidResponse('Ordering policy response is invalid.');
  }
  return value as OrderingPolicy;
}

function validSchedulePolicy(value: unknown): value is Omit<OrderingPolicy, 'serverNow'> {
  return isRecord(value)
    && typeof value.timezone === 'string'
    && typeof value.scheduleEnabled === 'boolean'
    && isNonNegativeNumber(value.minimumLeadMinutes)
    && isNonNegativeNumber(value.preparationLeadMinutes)
    && isNonNegativeNumber(value.slotIntervalMinutes)
    && value.slotIntervalMinutes > 0
    && isNonNegativeNumber(value.maximumAdvanceDays);
}

export function parseOrderQuote(value: unknown): OrderQuote {
  if (!isRecord(value)
    || !isPositiveInteger(value.pricingVersion)
    || value.currency !== 'MYR'
    || !isNonNegativeInteger(value.subtotalSen)
    || !isNonNegativeInteger(value.discountSen)
    || !isNonNegativeInteger(value.totalSen)
    || (value.fulfillmentType !== 'asap' && value.fulfillmentType !== 'scheduled')
    || !isNullableTimestamp(value.requestedPickupAt)
    || !isIsoTimestamp(value.serverNow)
    || !validSchedulePolicy(value.schedulePolicy)
    || !Array.isArray(value.lines)
    || value.lines.length === 0
    || !value.lines.every(validOrderLine)) {
    return invalidResponse('Order quote response is invalid.');
  }

  const lineSubtotal = value.lines.reduce((sum, line) => sum + line.lineTotalSen, 0);
  if (!Number.isSafeInteger(lineSubtotal) || lineSubtotal !== value.subtotalSen) {
    return invalidResponse('Order quote line snapshot is inconsistent.');
  }
  const voucher = parseQuoteVoucher(value.voucher);
  validateCommercialSnapshot(value.subtotalSen, value.discountSen, value.totalSen, voucher, 'Order quote');

  if (value.fulfillmentType === 'scheduled') {
    if (!isIsoTimestamp(value.requestedPickupAt)) {
      return invalidResponse('Scheduled quote pickup authority is invalid.');
    }
  } else if (value.requestedPickupAt !== null) {
    return invalidResponse('ASAP quote unexpectedly contains scheduled pickup authority.');
  }

  return { ...value, voucher } as OrderQuote;
}

export function parseOrderSnapshot(value: unknown): OrderSnapshot {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || value.id.length === 0
    || !isPositiveInteger(value.orderNumber)
    || (value.source !== 'customer' && value.source !== 'pos')
    || !isNullableString(value.customerUserId)
    || !isNullableString(value.memberId)
    || typeof value.branchId !== 'string'
    || !isRecord(value.branch)
    || value.branch.id !== value.branchId
    || typeof value.branch.code !== 'string'
    || typeof value.branch.name !== 'string'
    || typeof value.branch.timezone !== 'string'
    || !(value.shiftId === null || typeof value.shiftId === 'string')
    || (value.tenderType !== 'unpaid' && value.tenderType !== 'cash')
    || (value.paymentState !== 'unpaid' && value.paymentState !== 'paid')
    || !isNullableTimestamp(value.paidAt)
    || (value.fulfillmentType !== 'asap' && value.fulfillmentType !== 'scheduled')
    || !isNullableTimestamp(value.requestedPickupAt)
    || !isIsoTimestamp(value.serverNow)
    || !isNullableTimestamp(value.prepareAt)
    || !(value.scheduleState === null
      || value.scheduleState === 'future'
      || value.scheduleState === 'due'
      || value.scheduleState === 'overdue')
    || !(['confirmed', 'scheduled', 'preparing', 'ready', 'completed', 'cancelled'] as const).includes(value.status as OrderStatus)
    || !isPositiveInteger(value.statusVersion)
    || value.currency !== 'MYR'
    || !isPositiveInteger(value.pricingVersion)
    || !isNonNegativeInteger(value.subtotalSen)
    || !isNonNegativeInteger(value.discountSen)
    || !isNonNegativeInteger(value.totalSen)
    || !isIsoTimestamp(value.createdAt)
    || !isIsoTimestamp(value.updatedAt)
    || !isIsoTimestamp(value.statusUpdatedAt)
    || !isNullableTimestamp(value.preparingAt)
    || !isNullableTimestamp(value.readyAt)
    || !isNullableTimestamp(value.completedAt)
    || !isNullableTimestamp(value.cancelledAt)
    || !Array.isArray(value.lines)
    || value.lines.length === 0
    || !value.lines.every(validOrderLine)) {
    return invalidResponse('Order response is invalid.');
  }

  const lineSubtotal = value.lines.reduce((sum, line) => sum + line.lineTotalSen, 0);
  if (!Number.isSafeInteger(lineSubtotal) || lineSubtotal !== value.subtotalSen) {
    return invalidResponse('Order commercial line snapshot is inconsistent.');
  }
  const voucher = parseOrderVoucher(value.voucher);
  validateCommercialSnapshot(value.subtotalSen, value.discountSen, value.totalSen, voucher, 'Order');

  if (value.fulfillmentType === 'scheduled') {
    if (!isIsoTimestamp(value.requestedPickupAt)) {
      return invalidResponse('Scheduled order pickup authority is invalid.');
    }
  } else if (value.requestedPickupAt !== null || value.scheduleState !== null) {
    return invalidResponse('ASAP order unexpectedly contains scheduled pickup authority.');
  }

  const salesPoint = isRecord(value.salesPoint) ? value.salesPoint : null;
  const terminal = isRecord(value.terminal) ? value.terminal : null;
  const hasSalesPointId = typeof value.salesPointId === 'string';
  const hasTerminalId = typeof value.terminalId === 'string';
  const hasCompleteOperationalContext = hasSalesPointId
    && hasTerminalId
    && salesPoint !== null
    && terminal !== null
    && salesPoint.id === value.salesPointId
    && typeof salesPoint.code === 'string'
    && typeof salesPoint.name === 'string'
    && terminal.id === value.terminalId
    && typeof terminal.code === 'string';

  if (value.source === 'pos') {
    if (!hasCompleteOperationalContext
      || typeof value.shiftId !== 'string'
      || value.customerUserId !== null) {
      return invalidResponse('POS operational attribution is invalid.');
    }
  } else if (
    value.salesPointId !== null
    || value.terminalId !== null
    || value.salesPoint !== null
    || value.terminal !== null
    || value.shiftId !== null
  ) {
    return invalidResponse('Customer order unexpectedly contains POS operational authority.');
  }

  if (value.tenderType === 'cash') {
    if (value.source !== 'pos'
      || value.paymentState !== 'paid'
      || !isIsoTimestamp(value.paidAt)) {
      return invalidResponse('Cash payment authority is invalid.');
    }
  } else if (value.paymentState !== 'unpaid' || value.paidAt !== null) {
    return invalidResponse('Unpaid order authority is invalid.');
  }

  if (value.source === 'customer' && (
    value.tenderType !== 'unpaid'
    || value.paymentState !== 'unpaid'
    || value.paidAt !== null
  )) {
    return invalidResponse('Customer order unexpectedly contains POS payment authority.');
  }

  return { ...value, voucher } as OrderSnapshot;
}

export function cartToOrderItems(lines: CartLine[]): OrderSelectionLine[] {
  return lines.map((line) => {
    const variantId = line.modifiers.find((group) => group.groupId === 'variant')?.optionIds[0];
    const addOnIds = line.modifiers.find((group) => group.groupId === 'addons')?.optionIds ?? [];
    const optionValueIds = line.modifiers
      .filter((group) => group.groupId.startsWith('option:'))
      .flatMap((group) => group.optionIds);
    return {
      itemId: line.menuItemId,
      ...(variantId ? { variantId } : {}),
      addOnIds: [...addOnIds],
      optionValueIds: [...optionValueIds],
      quantity: line.qty,
      ...(line.note?.trim() ? { note: line.note.trim() } : {}),
    };
  });
}

export function buildOrderIntent(
  lines: CartLine[],
  fulfillmentType: FulfillmentType,
  requestedPickupAt?: string,
): OrderIntentPayload {
  return {
    fulfillmentType,
    ...(fulfillmentType === 'scheduled' && requestedPickupAt ? { requestedPickupAt } : {}),
    items: cartToOrderItems(lines),
  };
}

export function orderIntentSignature(payload: OrderIntentPayload): string {
  return JSON.stringify(payload);
}

export function createClientRequestId(): string {
  return crypto.randomUUID();
}

export function generateScheduleSlots(policy: OrderingPolicy): string[] {
  if (!policy.scheduleEnabled) return [];
  const serverNow = new Date(policy.serverNow).getTime();
  if (!Number.isFinite(serverNow)) return [];
  const intervalMs = policy.slotIntervalMinutes * 60_000;
  const earliest = serverNow + policy.minimumLeadMinutes * 60_000;
  const firstSlot = Math.ceil(earliest / intervalMs) * intervalMs;
  const horizon = serverNow + policy.maximumAdvanceDays * 86_400_000;
  const slots: string[] = [];
  for (let instant = firstSlot; instant <= horizon; instant += intervalMs) {
    slots.push(new Date(instant).toISOString());
  }
  return slots;
}

export async function fetchOrderingPolicy(fetcher: typeof fetch = fetch): Promise<OrderingPolicy> {
  const response = await fetcher('/api/v1/orders/policy', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return parseOrderingPolicy(await parseResponse<unknown>(response, 'Ordering policy is unavailable.'));
}

export async function quoteOrder(payload: OrderIntentPayload): Promise<OrderQuote> {
  const response = await employeeFetch('/api/v1/orders/quote', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return parseOrderQuote(await parseResponse<unknown>(response, 'Unable to quote this order.'));
}

export async function placeOrder(payload: OrderPlacementPayload): Promise<OrderSnapshot> {
  const response = await employeeFetch('/api/v1/orders/place', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return parseOrderSnapshot(await parseResponse<unknown>(response, 'Unable to place this order.'));
}

export async function fetchOrders(statuses?: OrderStatus[]): Promise<OrderSnapshot[]> {
  const params = new URLSearchParams();
  for (const status of statuses ?? []) params.append('status', status);
  params.set('limit', '100');
  const response = await employeeFetch(`/api/v1/orders?${params.toString()}`, { method: 'GET' });
  const orders = await parseResponse<unknown>(response, 'Unable to load orders.');
  if (!Array.isArray(orders)) {
    throw new OrderClientError('Orders response is invalid.', 502, 'ORDERS_INVALID');
  }
  return orders.map(parseOrderSnapshot);
}

export async function fetchOrderDetail(orderId: string): Promise<OrderSnapshot> {
  const response = await employeeFetch(`/api/v1/orders/detail?id=${encodeURIComponent(orderId)}`, {
    method: 'GET',
  });
  return parseOrderSnapshot(await parseResponse<unknown>(response, 'Unable to load order detail.'));
}

export async function transitionOrderStatus(input: {
  orderId: string;
  toStatus: OrderStatus;
  expectedVersion: number;
  reason?: string;
}): Promise<OrderSnapshot> {
  const response = await employeeFetch('/api/v1/orders/status', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return parseOrderSnapshot(await parseResponse<unknown>(response, 'Unable to update order status.'));
}

export const LEGAL_NEXT_STATUSES: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  confirmed: ['preparing', 'cancelled'],
  scheduled: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
};
