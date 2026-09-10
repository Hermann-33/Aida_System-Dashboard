import { employeeFetch } from '../../auth/employeeSession';
import type { CartLine } from '../pos/cartTypes';

export const ORDER_QUERY_KEY = ['employee-orders'] as const;
export const ORDER_POLL_INTERVAL_MS = 2_500;

export type FulfillmentType = 'asap' | 'scheduled';
export type ScheduleState = 'future' | 'due' | 'overdue';
export type OrderStatus =
  | 'confirmed'
  | 'scheduled'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

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

export type OrderQuote = {
  pricingVersion: number;
  currency: 'MYR';
  subtotalSen: number;
  totalSen: number;
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
  totalSen: number;
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

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function invalidResponse(message: string): never {
  throw new OrderClientError(message, 502, 'ORDER_RESPONSE_INVALID');
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

export function parseOrderSnapshot(value: unknown): OrderSnapshot {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.orderNumber !== 'number'
    || (value.source !== 'customer' && value.source !== 'pos')
    || typeof value.branchId !== 'string'
    || !isRecord(value.branch)
    || value.branch.id !== value.branchId
    || typeof value.branch.code !== 'string'
    || typeof value.branch.name !== 'string'
    || typeof value.branch.timezone !== 'string'
    || !isIsoTimestamp(value.serverNow)
    || !(value.prepareAt === null || isIsoTimestamp(value.prepareAt))
    || !(value.scheduleState === null
      || value.scheduleState === 'future'
      || value.scheduleState === 'due'
      || value.scheduleState === 'overdue')) {
    return invalidResponse('Order response is invalid.');
  }

  const hasSalesPointId = typeof value.salesPointId === 'string';
  const hasTerminalId = typeof value.terminalId === 'string';
  const hasSalesPoint = isRecord(value.salesPoint);
  const hasTerminal = isRecord(value.terminal);
  const hasOperationalContext =
    hasSalesPointId || hasTerminalId || hasSalesPoint || hasTerminal;

  if (hasOperationalContext) {
    if (!hasSalesPointId
      || !hasTerminalId
      || !hasSalesPoint
      || !hasTerminal
      || value.salesPoint.id !== value.salesPointId
      || typeof value.salesPoint.code !== 'string'
      || typeof value.salesPoint.name !== 'string'
      || value.terminal.id !== value.terminalId
      || typeof value.terminal.code !== 'string'
      || value.source !== 'pos') {
      return invalidResponse('Order operational attribution is invalid.');
    }
  } else if (
    value.salesPointId !== null
    || value.terminalId !== null
    || value.salesPoint !== null
    || value.terminal !== null
  ) {
    return invalidResponse('Order operational attribution is invalid.');
  }

  return value as OrderSnapshot;
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
  return parseResponse<OrderQuote>(response, 'Unable to quote this order.');
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
