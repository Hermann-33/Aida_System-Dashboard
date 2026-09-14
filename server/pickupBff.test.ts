import { describe, expect, it } from 'vitest';
import {
  handleAdminPickupConfiguration,
  handleAdminSavePickupConfiguration,
} from './pickupBff.js';
import type { EmployeeBffDependencies } from './employeeBff.js';

const env = {
  AIDA_SUPABASE_URL: 'https://example.supabase.co',
  AIDA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if ((init.method ?? 'GET') !== 'GET' && !headers.has('origin')) {
    headers.set('origin', 'https://dashboard.example');
  }
  return new Request(`https://dashboard.example${path}`, { ...init, headers });
}

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

const adminProfile = {
  user_id: 'admin-user',
  email: 'admin@example.test',
  display_name: 'Aida Admin',
  app_role: 'admin',
  disabled_at: null,
};

const staffProfile = { ...adminProfile, user_id: 'staff-user', app_role: 'staff' };

const configuration = {
  branch: {
    id: 'branch-main', code: 'BR-MAIN', name: 'Main Café', timezone: 'Asia/Kuala_Lumpur',
    isActive: true, isDefault: true,
  },
  policy: {
    asapEnabled: true, scheduleEnabled: true, minimumLeadMinutes: 15,
    preparationLeadMinutes: 10, slotIntervalMinutes: 15, maximumAdvanceDays: 7,
    slotCapacityOrders: 4,
  },
  windows: [],
  exceptions: [],
};

describe('pickup BFF', () => {
  it('loads branch pickup authority using the caller JWT, never a service credential', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
      jsonResponse(configuration),
    ]);

    const response = await handleAdminPickupConfiguration(request(
      '/api/v1/admin/branches/pickup?branchId=branch-main',
      { headers: { cookie: 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh' } },
    ), deps);

    expect(response.status).toBe(200);
    expect((await response.json()).data.policy.slotCapacityOrders).toBe(4);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/get_admin_branch_pickup_configuration');
    const headers = new Headers(calls[3]?.init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer admin-access');
    expect(headers.get('apikey')).toBe('sb_publishable_test');
  });

  it('rejects cross-origin pickup mutations before authentication or RPC execution', async () => {
    const { deps, calls } = depsWith([]);
    const response = await handleAdminSavePickupConfiguration(new Request(
      'https://dashboard.example/api/v1/admin/branches/pickup-save',
      {
        method: 'POST',
        headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
        body: JSON.stringify({ branchId: 'branch-main' }),
      },
    ), deps);

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ORIGIN_FORBIDDEN');
    expect(calls).toHaveLength(0);
  });

  it('denies ordinary staff from branch pickup administration', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'staff-user', email: 'staff@example.test' }),
      jsonResponse([staffProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
    ]);

    const response = await handleAdminPickupConfiguration(request(
      '/api/v1/admin/branches/pickup?branchId=branch-main',
      { headers: { cookie: 'aida_employee_access=staff-access; aida_employee_refresh=staff-refresh' } },
    ), deps);

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ADMIN_REQUIRED');
    expect(calls).toHaveLength(3);
  });

  it('forwards only the submitted pickup intent through the trusted admin RPC', async () => {
    const payload = {
      branchId: 'branch-main',
      asapEnabled: true,
      scheduleEnabled: true,
      minimumLeadMinutes: 20,
      preparationLeadMinutes: 10,
      slotIntervalMinutes: 15,
      maximumAdvanceDays: 7,
      slotCapacityOrders: 5,
      windows: [],
    };
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
      jsonResponse(configuration),
    ]);

    const response = await handleAdminSavePickupConfiguration(request(
      '/api/v1/admin/branches/pickup-save',
      {
        method: 'POST',
        headers: { cookie: 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh' },
        body: JSON.stringify(payload),
      },
    ), deps);

    expect(response.status).toBe(200);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/save_branch_pickup_configuration');
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ p_payload: payload });
    expect(new Headers(calls[3]?.init?.headers).get('Authorization')).toBe('Bearer admin-access');
  });
});
