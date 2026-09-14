import { beforeEach, describe, expect, it, vi } from 'vitest';
import { employeeFetch } from '../../auth/employeeSession';
import {
  fetchCurrentShift,
  openTrustedShift,
  parseShiftSnapshot,
  recordCashMovement,
  ShiftClientError,
} from './shiftClient';

vi.mock('../../auth/employeeSession', () => ({
  employeeFetch: vi.fn(),
}));

const shift = {
  id: 'shift-1',
  status: 'open',
  statusVersion: 4,
  branchId: 'branch-main',
  salesPointId: 'sales-main',
  terminalId: 'terminal-main',
  operatorUserId: 'staff-1',
  canOperate: true,
  openingFloatSen: 10000,
  expectedCashSen: 13750,
  cashInSen: 500,
  cashOutSen: 250,
  cashSalesSen: 3500,
  closingActualCashSen: null,
  cashVarianceSen: null,
  openedAt: '2026-09-12T00:00:00Z',
  lockedAt: null,
  closedAt: null,
  closeNotes: null,
  handoverNotes: null,
};

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('trusted shift client', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps integer-sen authority without making browser balances authoritative', () => {
    const parsed = parseShiftSnapshot(shift);
    expect(parsed.statusVersion).toBe(4);
    expect(parsed.openingFloatSen).toBe(10000);
    expect(parsed.expectedCashSen).toBe(13750);
    expect(parsed.openingFloat).toBe(100);
    expect(parsed.closingExpectedCash).toBeNull();
  });

  it('accepts null current shift as the explicit no-shift state', async () => {
    vi.mocked(employeeFetch).mockResolvedValue(response({ data: null }));
    await expect(fetchCurrentShift()).resolves.toBeNull();
    expect(employeeFetch).toHaveBeenCalledWith('/api/v1/shifts/current', { method: 'GET' });
  });

  it('converts opening float to integer sen before calling the same-origin BFF', async () => {
    vi.mocked(employeeFetch).mockResolvedValue(response({ data: shift }));
    await openTrustedShift(123.45);
    expect(employeeFetch).toHaveBeenCalledWith('/api/v1/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ openingFloatSen: 12345 }),
    });
  });

  it('records cash movement and consumes only the server-returned updated shift', async () => {
    vi.mocked(employeeFetch).mockResolvedValue(response({
      data: {
        movement: { id: 'move-1' },
        shift: { ...shift, cashOutSen: 750, expectedCashSen: 13250 },
      },
    }));
    const updated = await recordCashMovement({
      shiftId: shift.id,
      type: 'cash_out',
      amountRm: 5,
      reason: 'Safe drop',
    });

    expect(updated.cashOutSen).toBe(750);
    expect(updated.expectedCashSen).toBe(13250);
    expect(employeeFetch).toHaveBeenCalledWith('/api/v1/shifts/cash-movement', {
      method: 'POST',
      body: JSON.stringify({
        shiftId: shift.id,
        type: 'cash_out',
        amountSen: 500,
        reason: 'Safe drop',
      }),
    });
  });

  it('rejects malformed shift authority instead of inventing fallback state', () => {
    expect(() => parseShiftSnapshot({ ...shift, expectedCashSen: 137.5 })).toThrow(ShiftClientError);
  });
});
