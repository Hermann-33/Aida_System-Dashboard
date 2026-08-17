import { describe, expect, it } from 'vitest';
import type { EmployeeBffDependencies } from './employeeBff.js';
import {
  handleAdminSaveOrderingPolicy,
  handleEmployeeOrders,
  handleEmployeePlaceOrder,
  handleEmployeeQuoteOrder,
  handleEmployeeTransitionOrder,
  handleOrderingPolicy,
} from './orderBff.js';

const env = {
  AIDA_SUPABASE_URL: 'https://example.supabase.co',
  AIDA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
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

function employeeProfile(role: 'staff' | 'admin' | 'owner' = 'staff') {
  return {
    user_id: 'employee-user',
    email: 'employee@example.test',
    display_name: 'Aida Employee',
    app_role: role,
    disabled_at: null,
  };
}

function dashboardRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('cookie', 'aida_employee_access=employee-access; aida_employee_refresh=refresh-token');
  if (init.method && init.method !== 'GET') {
    headers.set('origin', 'https://dashboard.example');
  }
  return new Request(`https://dashboard.example${path}`, {
    ...init,
    headers,
  });
}

const quote = {
  pricingVersion: 1,
  currency: 'MYR',
  subtotalSen: 1540,
  totalSen: 1540,
  fulfillmentType: 'asap',
  requestedPickupAt: null,
  lines: [{ itemId: 'item-1', quantity: 1, unitPriceSen: 1540 }],
};

const order = {
  id: 'order-1',
  orderNumber: 100001,
  source: 'pos',
  status: 'confirmed',
  statusVersion: 1,
  totalSen: 1540,
  lines: quote.lines,
};

describe('order BFF', () => {
  it('serves public ordering policy with only the publishable credential', async () => {
    const policy = {
      timezone: 'Asia/Kuala_Lumpur',
      scheduleEnabled: true,
      minimumLeadMinutes: 15,
      slotIntervalMinutes: 15,
      maximumAdvanceDays: 7,
    };
    const { deps, calls } = depsWith([jsonResponse(policy)]);

    const response = await handleOrderingPolicy(
      new Request('https://dashboard.example/api/v1/orders/policy'),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).minimumLeadMinutes).toBe(15);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('/rest/v1/rpc/get_ordering_policy');
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('apikey')).toBe('sb_publishable_test');
    expect(headers.get('Authorization')).toBe('Bearer sb_publishable_test');
  });

  it('allows staff to list orders with the validated caller JWT', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'employee-user', email: 'employee@example.test' }),
      jsonResponse([employeeProfile('staff')]),
      jsonResponse([order]),
    ]);

    const response = await handleEmployeeOrders(
      dashboardRequest('/api/v1/orders?status=scheduled&status=preparing&limit=50'),
      deps,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([order]);
    const rpc = calls[2];
    expect(rpc?.url).toContain('/rest/v1/rpc/list_orders');
    expect(new Headers(rpc?.init?.headers).get('Authorization')).toBe('Bearer employee-access');
    expect(JSON.parse(String(rpc?.init?.body))).toEqual({
      p_statuses: ['scheduled', 'preparing'],
      p_limit: 50,
    });
  });

  it('quotes a POS cart through the authoritative quote RPC', async () => {
    const payload = {
      fulfillmentType: 'asap',
      items: [{ itemId: 'item-1', variantId: 'variant-1', addOnIds: [], quantity: 1 }],
    };
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'employee-user', email: 'employee@example.test' }),
      jsonResponse([employeeProfile('staff')]),
      jsonResponse(quote),
    ]);

    const response = await handleEmployeeQuoteOrder(
      dashboardRequest('/api/v1/orders/quote', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).totalSen).toBe(1540);
    expect(calls[2]?.url).toContain('/rest/v1/rpc/quote_order');
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({ p_payload: payload });
  });

  it('places a POS order through caller-JWT place_pos_order without trusting browser totals', async () => {
    const payload = {
      clientRequestId: 'request-1',
      fulfillmentType: 'scheduled',
      requestedPickupAt: '2026-08-13T08:00:00.000Z',
      totalSen: 1,
      items: [{ itemId: 'item-1', variantId: 'variant-1', addOnIds: [], quantity: 1 }],
    };
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'employee-user', email: 'employee@example.test' }),
      jsonResponse([employeeProfile('staff')]),
      jsonResponse({ ...order, status: 'scheduled', totalSen: 1540 }),
    ]);

    const response = await handleEmployeePlaceOrder(
      dashboardRequest('/api/v1/orders/place', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
      deps,
    );

    expect(response.status).toBe(201);
    expect((await response.json()).totalSen).toBe(1540);
    const rpc = calls[2];
    expect(rpc?.url).toContain('/rest/v1/rpc/place_pos_order');
    expect(new Headers(rpc?.init?.headers).get('Authorization')).toBe('Bearer employee-access');
    expect(JSON.parse(String(rpc?.init?.body))).toEqual({ p_payload: payload });
  });

  it('maps optimistic status-version conflicts to HTTP 409', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'employee-user', email: 'employee@example.test' }),
      jsonResponse([employeeProfile('staff')]),
      jsonResponse({ code: '40001', message: 'order status changed; refresh before retrying' }, 400),
    ]);

    const response = await handleEmployeeTransitionOrder(
      dashboardRequest('/api/v1/orders/status', {
        method: 'POST',
        body: JSON.stringify({ orderId: 'order-1', toStatus: 'ready', expectedVersion: 1 }),
      }),
      deps,
    );

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('ORDER_VERSION_CONFLICT');
    expect(calls[2]?.url).toContain('/rest/v1/rpc/transition_order_status');
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({
      p_order_id: 'order-1',
      p_to_status: 'ready',
      p_expected_version: 1,
      p_reason: null,
    });
  });

  it('rejects cross-origin order placement before employee authentication', async () => {
    const { deps, calls } = depsWith([]);
    const response = await handleEmployeePlaceOrder(
      new Request('https://dashboard.example/api/v1/orders/place', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
        body: '{}',
      }),
      deps,
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ORIGIN_FORBIDDEN');
    expect(calls).toHaveLength(0);
  });

  it('denies staff ordering-policy mutation before the policy RPC', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'employee-user', email: 'employee@example.test' }),
      jsonResponse([employeeProfile('staff')]),
    ]);

    const response = await handleAdminSaveOrderingPolicy(
      dashboardRequest('/api/v1/admin/orders/policy', {
        method: 'POST',
        body: JSON.stringify({ minimumLeadMinutes: 20 }),
      }),
      deps,
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ADMIN_REQUIRED');
    expect(calls).toHaveLength(2);
  });

  it('lets admin update schedule policy with the admin caller JWT', async () => {
    const updated = {
      timezone: 'Asia/Kuala_Lumpur',
      scheduleEnabled: true,
      minimumLeadMinutes: 20,
      slotIntervalMinutes: 15,
      maximumAdvanceDays: 7,
    };
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'employee-user', email: 'employee@example.test' }),
      jsonResponse([employeeProfile('admin')]),
      jsonResponse(updated),
    ]);

    const response = await handleAdminSaveOrderingPolicy(
      dashboardRequest('/api/v1/admin/orders/policy', {
        method: 'POST',
        body: JSON.stringify({ minimumLeadMinutes: 20 }),
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).minimumLeadMinutes).toBe(20);
    expect(calls[2]?.url).toContain('/rest/v1/rpc/save_ordering_policy');
    expect(new Headers(calls[2]?.init?.headers).get('Authorization')).toBe('Bearer employee-access');
  });
});
