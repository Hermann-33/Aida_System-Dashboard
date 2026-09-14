import { describe, expect, it } from 'vitest';
import { handlePosMemberLoyalty } from './posLoyaltyBff.js';
import type { EmployeeBffDependencies } from './employeeBff.js';

const env = {
  AIDA_SUPABASE_URL: 'https://example.supabase.co',
  AIDA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const profile = { user_id: 'staff-user', email: 'staff@example.test', display_name: 'Staff', app_role: 'staff', disabled_at: null };

function request(cookie = 'aida_employee_access=staff-access; aida_employee_refresh=staff-refresh; aida_terminal_credential=terminal-secret') {
  return new Request('https://dashboard.example/api/v1/pos/member-loyalty?memberCode=AIDA-001', { headers: { cookie } });
}

describe('POS loyalty BFF', () => {
  it('forwards employee JWT and terminal credential only server-to-Supabase', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const responses = [
      jsonResponse({ id: 'staff-user', email: 'staff@example.test' }),
      jsonResponse([profile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
      jsonResponse({ memberCode: 'AIDA-001', pointsBalance: 25, stampBalance: 2, program: {}, vouchers: [], shiftId: 'shift-1' }),
    ];
    const deps = {
      env,
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        const next = responses.shift();
        if (!next) throw new Error('Unexpected request');
        return next;
      }) as typeof fetch,
    } satisfies EmployeeBffDependencies;

    const response = await handlePosMemberLoyalty(request(), deps);
    expect(response.status).toBe(200);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/get_pos_member_loyalty');
    const headers = new Headers(calls[3]?.init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer staff-access');
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
      p_member_code: 'AIDA-001',
      p_terminal_credential: 'terminal-secret',
    });
    expect(JSON.stringify(await response.json())).not.toContain('terminal-secret');
  });

  it('fails closed when the HttpOnly terminal credential is absent', async () => {
    let rpcCalled = false;
    const responses = [jsonResponse({ id: 'staff-user' }), jsonResponse([profile]), jsonResponse([{ branch_id: 'branch-main' }])];
    const deps = {
      env,
      fetchImpl: (async () => {
        if (responses.length) return responses.shift()!;
        rpcCalled = true;
        return jsonResponse({});
      }) as typeof fetch,
    } satisfies EmployeeBffDependencies;
    const response = await handlePosMemberLoyalty(request('aida_employee_access=staff-access; aida_employee_refresh=staff-refresh'), deps);
    expect(response.status).toBe(403);
    expect(rpcCalled).toBe(false);
  });
});
