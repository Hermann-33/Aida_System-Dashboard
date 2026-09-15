import { describe, expect, it } from 'vitest';
import {
  handleAdminAdjustMemberLoyalty,
  handleAdminLoyaltyState,
  handleAdminSaveLoyaltyProgram,
  handleAdminSaveLoyaltyReward,
} from './loyaltyBff.js';
import type { EmployeeBffDependencies } from './employeeBff.js';

const env = {
  AIDA_SUPABASE_URL: 'https://example.supabase.co',
  AIDA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const adminProfile = {
  user_id: 'admin-user', email: 'admin@example.test', display_name: 'Aida Admin', app_role: 'admin', disabled_at: null,
};

function depsWith(final: Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [
    jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
    jsonResponse([adminProfile]),
    jsonResponse([{ branch_id: 'branch-main' }]),
    final,
  ];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected request ${String(input)}`);
    return next;
  }) as typeof fetch;
  return { deps: { env, fetchImpl } satisfies EmployeeBffDependencies, calls };
}

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('cookie', 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh');
  if ((init.method ?? 'GET') !== 'GET' && !headers.has('origin')) headers.set('origin', 'https://dashboard.example');
  return new Request(`https://dashboard.example${path}`, { ...init, headers });
}

describe('loyalty BFF', () => {
  it('loads loyalty state with caller JWT and publishable key', async () => {
    const { deps, calls } = depsWith(jsonResponse({ program: {}, rewards: [] }));
    const response = await handleAdminLoyaltyState(request('/api/v1/admin/loyalty'), deps);
    expect(response.status).toBe(200);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/get_loyalty_admin_state');
    const headers = new Headers(calls[3]?.init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer admin-access');
    expect(headers.get('apikey')).toBe('sb_publishable_test');
  });

  it('rejects cross-origin loyalty mutations before authentication', async () => {
    let called = false;
    const deps = { env, fetchImpl: (async () => { called = true; return jsonResponse({}); }) as typeof fetch };
    const response = await handleAdminSaveLoyaltyProgram(new Request('https://dashboard.example/api/v1/admin/loyalty/program', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ pointsPerRinggit: 1, stampGoal: 10, stampRewardId: 'reward' }),
    }), deps);
    expect(response.status).toBe(403);
    expect(called).toBe(false);
  });

  it('maps program intent without browser-supplied actor authority', async () => {
    const { deps, calls } = depsWith(jsonResponse({ pointsPerRinggit: 2, stampGoal: 12 }));
    const response = await handleAdminSaveLoyaltyProgram(request('/api/v1/admin/loyalty/program', {
      method: 'POST', body: JSON.stringify({ pointsPerRinggit: 2, stampGoal: 12, stampRewardId: 'reward-1', actorUserId: 'attacker' }),
      headers: { 'content-type': 'application/json' },
    }), deps);
    expect(response.status).toBe(200);
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ p_points_per_ringgit: 2, p_stamp_goal: 12, p_stamp_reward_id: 'reward-1' });
  });

  it('maps reward intent to the trusted RPC', async () => {
    const payload = { id: 'reward-1', code: 'POINTS_RM5', name: 'RM5 Voucher', rewardType: 'fixed_amount', pointsCost: 100, fixedAmountSen: 500, eligibleCategorySlugs: [], eligibleItemSkus: [], expiryDays: 30, isPointsRedeemable: true, isActive: true };
    const { deps, calls } = depsWith(jsonResponse(payload));
    const response = await handleAdminSaveLoyaltyReward(request('/api/v1/admin/loyalty/reward', { method: 'POST', body: JSON.stringify(payload), headers: { 'content-type': 'application/json' } }), deps);
    expect(response.status).toBe(200);
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ p_reward: payload });
  });

  it('maps support adjustments while actor identity remains server-derived', async () => {
    const { deps, calls } = depsWith(jsonResponse({ pointsBalance: 120, stampBalance: 4 }));
    const response = await handleAdminAdjustMemberLoyalty(request('/api/v1/admin/loyalty/adjust', {
      method: 'POST', body: JSON.stringify({ memberCode: 'AIDA-001', pointsDelta: 10, stampsDelta: -1, reason: 'Support correction', actorUserId: 'attacker' }),
      headers: { 'content-type': 'application/json' },
    }), deps);
    expect(response.status).toBe(200);
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ p_member_code: 'AIDA-001', p_points_delta: 10, p_stamps_delta: -1, p_reason: 'Support correction' });
  });
});
