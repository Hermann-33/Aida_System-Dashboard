import { describe, expect, it } from 'vitest';
import type { EmployeeBffDependencies } from './employeeBff.js';
import {
  handleCashMovement,
  handleCloseShift,
  handleCurrentShift,
  handleOpenShift,
} from './shiftBff.js';

const env = {
  AIDA_SUPABASE_URL: 'https://example.supabase.co',
  AIDA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};

const staffProfile = {
  user_id: 'staff-user',
  email: 'staff@example.test',
  display_name: 'Aida Staff',
  app_role: 'staff',
  disabled_at: null,
};

const shift = {
  id: 'shift-1',
  status: 'open',
  statusVersion: 1,
  branchId: 'branch-main',
  salesPointId: 'sales-main',
  terminalId: 'terminal-main',
  openedByUserId: 'staff-user',
  operatorUserId: 'staff-user',
  canOperate: true,
  openingFloatSen: 10000,
  expectedCashSen: 10000,
  cashInSen: 0,
  cashOutSen: 0,
  cashSalesSen: 0,
  closingActualCashSen: null,
  cashVarianceSen: null,
  openedAt: '2026-09-12T00:00:00Z',
  lockedAt: null,
  closedAt: null,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function depsWith(responses: Response[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected upstream request: ${String(input)}`);
    return next;
  }) as typeof fetch;
  return { deps: { env, fetchImpl } satisfies EmployeeBffDependencies, calls };
}

function sessionResponses(): Response[] {
  return [
    jsonResponse({ id: 'staff-user', email: 'staff@example.test' }),
    jsonResponse([staffProfile]),
    jsonResponse([{ branch_id: 'branch-main' }]),
  ];
}

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('cookie')) {
    headers.set(
      'cookie',
      'aida_employee_access=employee-access; aida_employee_refresh=refresh-token; aida_terminal_credential=terminal-secret-abcdefghijklmnopqrstuvwxyz-1234567890',
    );
  }
  if ((init.method ?? 'GET') !== 'GET' && !headers.has('origin')) {
    headers.set('origin', 'https://dashboard.example');
  }
  return new Request(`https://dashboard.example${path}`, { ...init, headers });
}

describe('shift BFF', () => {
  it('requires a server-held terminal credential after validating employee identity', async () => {
    const { deps, calls } = depsWith(sessionResponses());
    const response = await handleCurrentShift(
      request('/api/v1/shifts/current', {
        headers: { cookie: 'aida_employee_access=employee-access; aida_employee_refresh=refresh-token' },
      }),
      deps,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Activate this terminal before managing a shift',
      code: 'TERMINAL_ENROLMENT_REQUIRED',
    });
    expect(calls).toHaveLength(3);
  });

  it('forwards caller JWT and HttpOnly terminal credential to current-shift authority', async () => {
    const { deps, calls } = depsWith([...sessionResponses(), jsonResponse(shift)]);
    const response = await handleCurrentShift(request('/api/v1/shifts/current'), deps);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: shift });
    expect(calls[3]?.url).toContain('/rest/v1/rpc/get_current_shift');
    expect(new Headers(calls[3]?.init?.headers).get('Authorization')).toBe('Bearer employee-access');
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
      p_terminal_credential: 'terminal-secret-abcdefghijklmnopqrstuvwxyz-1234567890',
    });
  });

  it('rejects cross-origin shift mutation before opening a shift', async () => {
    const { deps, calls } = depsWith([]);
    const response = await handleOpenShift(
      request('/api/v1/shifts/open', {
        method: 'POST',
        headers: { origin: 'https://attacker.example' },
        body: JSON.stringify({ openingFloatSen: 10000 }),
      }),
      deps,
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ORIGIN_FORBIDDEN');
    expect(calls).toHaveLength(0);
  });

  it('opens a shift with integer sen without exposing reusable authority to JavaScript', async () => {
    const { deps, calls } = depsWith([...sessionResponses(), jsonResponse(shift)]);
    const response = await handleOpenShift(
      request('/api/v1/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ openingFloatSen: 10000 }),
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: shift });
    expect(calls[3]?.url).toContain('/rest/v1/rpc/open_shift');
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
      p_terminal_credential: 'terminal-secret-abcdefghijklmnopqrstuvwxyz-1234567890',
      p_opening_float_sen: 10000,
    });
    expect(JSON.stringify(await response.clone().json().catch(() => null))).not.toContain('terminal-secret');
  });

  it('records cash movement through server authority and maps shift conflicts', async () => {
    const movement = {
      movement: { id: 'movement-1', shiftId: shift.id, type: 'cash_out', amountSen: 500, reason: 'Safe drop' },
      shift: { ...shift, cashOutSen: 500, expectedCashSen: 9500 },
    };
    const { deps, calls } = depsWith([...sessionResponses(), jsonResponse(movement)]);
    const response = await handleCashMovement(
      request('/api/v1/shifts/cash-movement', {
        method: 'POST',
        body: JSON.stringify({ shiftId: shift.id, type: 'cash_out', amountSen: 500, reason: 'Safe drop' }),
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data.shift.expectedCashSen).toBe(9500);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/record_cash_movement');
    expect(JSON.parse(String(calls[3]?.init?.body))).toMatchObject({
      p_shift_id: shift.id,
      p_movement_type: 'cash_out',
      p_amount_sen: 500,
      p_reason: 'Safe drop',
    });
  });

  it('maps non-zero staff variance approval denial without weakening backend enforcement', async () => {
    const { deps } = depsWith([
      ...sessionResponses(),
      jsonResponse({
        code: '42501',
        message: 'non-zero cash variance requires Admin or Owner approval',
        details: 'SHIFT_VARIANCE_APPROVAL_REQUIRED',
      }, 403),
    ]);
    const response = await handleCloseShift(
      request('/api/v1/shifts/close', {
        method: 'POST',
        body: JSON.stringify({
          shiftId: shift.id,
          actualCashSen: 9000,
          expectedVersion: 1,
          notes: null,
          handoverNotes: null,
        }),
      }),
      deps,
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'non-zero cash variance requires Admin or Owner approval',
      code: 'SHIFT_VARIANCE_APPROVAL_REQUIRED',
    });
  });
});
