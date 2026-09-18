import { describe, expect, it } from 'vitest';
import { handleAdminPaymentState, handleAdminProviderState, handleAdminRefund } from './paymentBff.js';
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

const payment = {
  tenderType: 'cash', paymentState: 'paid', paidAt: '2026-09-18T01:00:00Z',
  refundedSen: 0, refundableSen: 1000, providerAvailable: false, latestIntent: null, refunds: [],
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
  headers.set('cookie', 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh; aida_terminal_credential=terminal-secret');
  if ((init.method ?? 'GET') !== 'GET' && !headers.has('origin')) headers.set('origin', 'https://dashboard.example');
  return new Request(`https://dashboard.example${path}`, { ...init, headers });
}

describe('payment BFF', () => {
  it('loads non-secret provider capability state with caller JWT', async () => {
    const providers = [{
      providerKey: 'test_provider',
      displayName: 'Test Provider',
      environment: 'test',
      isActive: false,
      customerEnabled: false,
      posEnabled: false,
      supportsRefunds: true,
      createdAt: '2026-09-18T01:00:00Z',
      updatedAt: '2026-09-18T01:00:00Z',
    }];
    const { deps, calls } = depsWith(jsonResponse(providers));
    const response = await handleAdminProviderState(request('/api/v1/admin/payments/providers'), deps);
    expect(response.status).toBe(200);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/get_payment_provider_admin_state');
    expect(String(calls[3]?.init?.body)).toBe('{}');
    expect(await response.text()).not.toContain('service_role');
  });

  it('loads protected payment state with caller JWT and publishable key', async () => {
    const { deps, calls } = depsWith(jsonResponse(payment));
    const response = await handleAdminPaymentState(request('/api/v1/admin/payments/state?orderId=order-1'), deps);
    expect(response.status).toBe(200);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/get_order_payment_state');
    const headers = new Headers(calls[3]?.init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer admin-access');
    expect(headers.get('apikey')).toBe('sb_publishable_test');
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ p_order_id: 'order-1' });
  });

  it('rejects cross-origin refund mutation before authentication', async () => {
    let called = false;
    const deps = { env, fetchImpl: (async () => { called = true; return jsonResponse({}); }) as typeof fetch };
    const response = await handleAdminRefund(new Request('https://dashboard.example/api/v1/admin/payments/refund', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ orderId: 'order-1', tenderType: 'cash', amountSen: 100, reason: 'test', idempotencyKey: 'key' }),
    }), deps);
    expect(response.status).toBe(403);
    expect(called).toBe(false);
  });

  it('keeps terminal credential server-side for cash refunds', async () => {
    const refunded = { ...payment, paymentState: 'partially_refunded', refundedSen: 100, refundableSen: 900 };
    const { deps, calls } = depsWith(jsonResponse(refunded));
    const response = await handleAdminRefund(request('/api/v1/admin/payments/refund', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderId: 'order-1', tenderType: 'cash', amountSen: 100, reason: 'Cash refund',
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      }),
    }), deps);
    expect(response.status).toBe(200);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/refund_cash_order');
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
      p_payload: {
        orderId: 'order-1', amountSen: 100, reason: 'Cash refund',
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
      },
      p_terminal_credential: 'terminal-secret',
    });
    expect(await response.text()).not.toContain('terminal-secret');
  });

  it('requests external refunds without service-role or terminal authority', async () => {
    const external = { ...payment, tenderType: 'external', latestIntent: { id: 'intent-1' } };
    const { deps, calls } = depsWith(jsonResponse(external));
    const response = await handleAdminRefund(request('/api/v1/admin/payments/refund', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderId: 'order-1', tenderType: 'external', amountSen: 100, reason: 'External refund',
        idempotencyKey: '00000000-0000-4000-8000-000000000002',
      }),
    }), deps);
    expect(response.status).toBe(200);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/request_external_refund');
    const headers = new Headers(calls[3]?.init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer admin-access');
    expect(headers.get('apikey')).toBe('sb_publishable_test');
    expect(String(calls[3]?.init?.body)).not.toContain('terminal-secret');
  });
});
