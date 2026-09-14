import { employeeFetch } from '../../auth/employeeSession';
import type { ShiftSummary } from '../../auth/types';

type ShiftEnvelope = { data: unknown };

export class ShiftClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ShiftClientError';
    this.status = status;
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return integer(value) && value >= 0;
}

function timestampOrNull(value: unknown): value is string | null {
  return value === null
    || (typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value)));
}

async function parseEnvelope(response: Response, fallback: string): Promise<unknown> {
  const body = await response.json().catch(() => null) as
    | { data?: unknown; error?: unknown; code?: unknown }
    | null;
  if (!response.ok) {
    const message = body && typeof body.error === 'string' ? body.error : fallback;
    const code = body && typeof body.code === 'string' ? body.code : 'SHIFT_REQUEST_FAILED';
    throw new ShiftClientError(message, response.status, code);
  }
  if (!body || !Object.prototype.hasOwnProperty.call(body, 'data')) {
    throw new ShiftClientError(`${fallback} The response was invalid.`, 502, 'SHIFT_RESPONSE_INVALID');
  }
  return (body as ShiftEnvelope).data;
}

export function parseShiftSnapshot(value: unknown): ShiftSummary {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || (value.status !== 'open' && value.status !== 'locked' && value.status !== 'closed')
    || !integer(value.statusVersion)
    || value.statusVersion < 1
    || typeof value.terminalId !== 'string'
    || typeof value.salesPointId !== 'string'
    || typeof value.branchId !== 'string'
    || typeof value.operatorUserId !== 'string'
    || typeof value.canOperate !== 'boolean'
    || !nonNegativeInteger(value.openingFloatSen)
    || !nonNegativeInteger(value.expectedCashSen)
    || !nonNegativeInteger(value.cashInSen)
    || !nonNegativeInteger(value.cashOutSen)
    || !nonNegativeInteger(value.cashSalesSen)
    || typeof value.openedAt !== 'string'
    || !Number.isFinite(Date.parse(value.openedAt))) {
    throw new ShiftClientError('Shift response is invalid.', 502, 'SHIFT_RESPONSE_INVALID');
  }

  const closingActualCashSen = value.closingActualCashSen;
  const cashVarianceSen = value.cashVarianceSen;
  const lockedAt = value.lockedAt ?? null;
  const closedAt = value.closedAt ?? null;

  if (!(closingActualCashSen === null || nonNegativeInteger(closingActualCashSen))
    || !(cashVarianceSen === null || integer(cashVarianceSen))
    || !timestampOrNull(lockedAt)
    || !timestampOrNull(closedAt)
    || (value.status === 'closed' && (
      closingActualCashSen === null
      || cashVarianceSen === null
      || closedAt === null
    ))) {
    throw new ShiftClientError('Shift reconciliation response is invalid.', 502, 'SHIFT_RESPONSE_INVALID');
  }

  return {
    id: value.id,
    status: value.status,
    terminalId: value.terminalId,
    salesPointId: value.salesPointId,
    branchId: value.branchId,
    staffUserId: value.operatorUserId,
    statusVersion: value.statusVersion,
    operatorUserId: value.operatorUserId,
    canOperate: value.canOperate,
    openingFloatSen: value.openingFloatSen,
    expectedCashSen: value.expectedCashSen,
    cashInSen: value.cashInSen,
    cashOutSen: value.cashOutSen,
    cashSalesSen: value.cashSalesSen,
    closingActualCashSen,
    cashVarianceSen,
    openingFloat: value.openingFloatSen / 100,
    closingExpectedCash: value.status === 'closed' ? value.expectedCashSen / 100 : null,
    closingActualCash: closingActualCashSen === null ? null : closingActualCashSen / 100,
    cashVariance: cashVarianceSen === null ? null : cashVarianceSen / 100,
    openedAt: value.openedAt,
    lockedAt,
    closedAt,
    notes: typeof value.closeNotes === 'string' ? value.closeNotes : null,
    handoverNotes: typeof value.handoverNotes === 'string' ? value.handoverNotes : null,
  };
}

function toSen(rm: number): number {
  const sen = Math.round(rm * 100);
  if (!Number.isSafeInteger(sen) || sen < 0) {
    throw new ShiftClientError('Cash amount is invalid.', 400, 'SHIFT_CASH_INVALID');
  }
  return sen;
}

export async function fetchCurrentShift(): Promise<ShiftSummary | null> {
  const response = await employeeFetch('/api/v1/shifts/current', { method: 'GET' });
  const data = await parseEnvelope(response, 'Unable to load current shift.');
  return data === null ? null : parseShiftSnapshot(data);
}

export async function fetchAdminShifts(limit = 100): Promise<ShiftSummary[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 250) {
    throw new ShiftClientError('Shift history limit is invalid.', 400, 'SHIFT_LIMIT_INVALID');
  }
  const response = await employeeFetch(`/api/v1/admin/shifts?limit=${limit}`, { method: 'GET' });
  const data = await parseEnvelope(response, 'Unable to load shift history.');
  if (!Array.isArray(data)) {
    throw new ShiftClientError('Shift history response is invalid.', 502, 'SHIFT_RESPONSE_INVALID');
  }
  return data.map(parseShiftSnapshot);
}

export async function openTrustedShift(openingFloatRm: number): Promise<ShiftSummary> {
  const response = await employeeFetch('/api/v1/shifts/open', {
    method: 'POST',
    body: JSON.stringify({ openingFloatSen: toSen(openingFloatRm) }),
  });
  return parseShiftSnapshot(await parseEnvelope(response, 'Unable to open shift.'));
}

async function transition(path: 'lock' | 'resume', shift: ShiftSummary): Promise<ShiftSummary> {
  if (!shift.statusVersion) {
    throw new ShiftClientError('Shift version is unavailable.', 409, 'SHIFT_VERSION_REQUIRED');
  }
  const response = await employeeFetch(`/api/v1/shifts/${path}`, {
    method: 'POST',
    body: JSON.stringify({ shiftId: shift.id, expectedVersion: shift.statusVersion }),
  });
  return parseShiftSnapshot(await parseEnvelope(response, `Unable to ${path} shift.`));
}

export function lockTrustedShift(shift: ShiftSummary): Promise<ShiftSummary> {
  return transition('lock', shift);
}

export function resumeTrustedShift(shift: ShiftSummary): Promise<ShiftSummary> {
  return transition('resume', shift);
}

export async function closeTrustedShift(input: {
  shift: ShiftSummary;
  actualCashRm: number;
  notes?: string;
  handoverNotes?: string;
}): Promise<ShiftSummary> {
  if (!input.shift.statusVersion) {
    throw new ShiftClientError('Shift version is unavailable.', 409, 'SHIFT_VERSION_REQUIRED');
  }
  const response = await employeeFetch('/api/v1/shifts/close', {
    method: 'POST',
    body: JSON.stringify({
      shiftId: input.shift.id,
      actualCashSen: toSen(input.actualCashRm),
      expectedVersion: input.shift.statusVersion,
      notes: input.notes ?? null,
      handoverNotes: input.handoverNotes ?? null,
    }),
  });
  return parseShiftSnapshot(await parseEnvelope(response, 'Unable to close shift.'));
}

export async function recordCashMovement(input: {
  shiftId: string;
  type: 'cash_in' | 'cash_out';
  amountRm: number;
  reason: string;
}): Promise<ShiftSummary> {
  const response = await employeeFetch('/api/v1/shifts/cash-movement', {
    method: 'POST',
    body: JSON.stringify({
      shiftId: input.shiftId,
      type: input.type,
      amountSen: toSen(input.amountRm),
      reason: input.reason,
    }),
  });
  const data = await parseEnvelope(response, 'Unable to record cash movement.');
  if (!isRecord(data) || !Object.prototype.hasOwnProperty.call(data, 'shift')) {
    throw new ShiftClientError('Cash movement response is invalid.', 502, 'SHIFT_RESPONSE_INVALID');
  }
  return parseShiftSnapshot(data.shift);
}
