import { describe, expect, it } from 'vitest';
import {
  handleAdminPromotions,
  handleAdminSavePromotion,
} from './promotionBff.js';
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

describe('promotion BFF', () => {
  it('loads promotion authority with caller JWT and publishable key', async () => {
    const { deps, calls } = depsWith(jsonResponse([]));
    const response = await handleAdminPromotions(request('/api/v1/admin/promotions'), deps);
    expect(response.status).toBe(200);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/get_promotion_admin_state');
    const headers = new Headers(calls[3]?.init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer admin-access');
    expect(headers.get('apikey')).toBe('sb_publishable_test');
  });

  it('rejects cross-origin promotion mutations before authentication', async () => {
    let called = false;
    const deps = { env, fetchImpl: (async () => { called = true; return jsonResponse({}); }) as typeof fetch };
    const response = await handleAdminSavePromotion(new Request('https://dashboard.example/api/v1/admin/promotions/save', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'P7_TEST', name: 'Test', discountType: 'fixed', fixedAmountSen: 100 }),
    }), deps);
    expect(response.status).toBe(403);
    expect(called).toBe(false);
  });

  it('passes only promotion intent to the caller-bound save RPC', async () => {
    const payload = {
      id: 'promotion-1',
      code: 'P7_TEST',
      name: 'Test offer',
      description: null,
      discountType: 'fixed',
      fixedAmountSen: 100,
      percentBasisPoints: null,
      minimumSubtotalSen: 500,
      maximumDiscountSen: null,
      startsAt: null,
      endsAt: null,
      priority: 10,
      stackingMode: 'exclusive',
      allowWithVoucher: false,
      requiresMember: false,
      globalUsageLimit: null,
      perMemberUsageLimit: null,
      isActive: true,
      branchIds: [],
      itemIds: [],
      variantIds: [],
      addonItemIds: [],
      actorUserId: 'attacker',
    };
    const returned = { ...payload, createdAt: '2026-09-15T00:00:00Z', updatedAt: '2026-09-15T00:00:00Z' };
    const { deps, calls } = depsWith(jsonResponse([returned]));
    const response = await handleAdminSavePromotion(request('/api/v1/admin/promotions/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }), deps);
    expect(response.status).toBe(200);
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ p_payload: payload });
  });

  it('fails closed on malformed promotion RPC responses', async () => {
    const { deps } = depsWith(jsonResponse({ promotions: [] }));
    const response = await handleAdminPromotions(request('/api/v1/admin/promotions'), deps);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: 'PROMOTION_RESPONSE_INVALID' });
  });
});
