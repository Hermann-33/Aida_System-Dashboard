import { describe, expect, it } from 'vitest';
import {
  handleAdminInventoryMovement,
  handleAdminInventoryState,
  handleAdminSaveInventoryItem,
  handleAdminSaveRecipe,
} from './inventoryBff.js';
import type { EmployeeBffDependencies } from './employeeBff.js';

const env = {
  AIDA_SUPABASE_URL: 'https://example.supabase.co',
  AIDA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if ((init.method ?? 'GET') !== 'GET' && !headers.has('origin')) headers.set('origin', 'https://dashboard.example');
  return new Request(`https://dashboard.example${path}`, { ...init, headers });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
  user_id: 'admin-user', email: 'admin@example.test', display_name: 'Aida Admin', app_role: 'admin', disabled_at: null,
};
const staffProfile = { ...adminProfile, user_id: 'staff-user', app_role: 'staff' };

function adminSessionResponses(final: Response): Response[] {
  return [
    jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
    jsonResponse([adminProfile]),
    jsonResponse([{ branch_id: 'branch-main' }]),
    final,
  ];
}

describe('inventory BFF', () => {
  it('loads authoritative inventory using caller JWT and publishable key', async () => {
    const { deps, calls } = depsWith(adminSessionResponses(jsonResponse({ branchId: 'branch-main', items: [], recipes: [] })));
    const response = await handleAdminInventoryState(request('/api/v1/admin/inventory?branchId=branch-main', {
      headers: { cookie: 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh' },
    }), deps);
    expect(response.status).toBe(200);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/list_inventory_state');
    const headers = new Headers(calls[3]?.init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer admin-access');
    expect(headers.get('apikey')).toBe('sb_publishable_test');
  });

  it('rejects cross-origin stock mutations before authentication', async () => {
    const { deps, calls } = depsWith([]);
    const response = await handleAdminInventoryMovement(new Request('https://dashboard.example/api/v1/admin/inventory/movement', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ branchId: 'branch-main', inventoryItemId: 'item', deltaMilli: 1000, movementKind: 'receiving' }),
    }), deps);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ORIGIN_FORBIDDEN');
    expect(calls).toHaveLength(0);
  });

  it('denies ordinary staff inventory administration at the employee-session boundary', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'staff-user', email: 'staff@example.test' }),
      jsonResponse([staffProfile]),
    ]);
    const response = await handleAdminInventoryState(request('/api/v1/admin/inventory?branchId=branch-main', {
      headers: { cookie: 'aida_employee_access=staff-access; aida_employee_refresh=staff-refresh' },
    }), deps);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('EMPLOYEE_ACCESS_FORBIDDEN');
    expect(calls).toHaveLength(2);
  });

  it('forwards inventory-item intent only to the trusted RPC', async () => {
    const payload = { sku: 'MILK', name: 'Milk', baseUnit: 'ml', isActive: true };
    const { deps, calls } = depsWith(adminSessionResponses(jsonResponse({ id: 'inv-1', ...payload })));
    const response = await handleAdminSaveInventoryItem(request('/api/v1/admin/inventory/item', {
      method: 'POST',
      headers: { cookie: 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh' },
      body: JSON.stringify(payload),
    }), deps);
    expect(response.status).toBe(200);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/save_inventory_item');
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ p_payload: payload });
  });

  it('maps stock movement fields to the authoritative RPC contract', async () => {
    const payload = { branchId: 'branch-main', inventoryItemId: 'inv-1', deltaMilli: -2500, movementKind: 'waste', note: 'spill' };
    const { deps, calls } = depsWith(adminSessionResponses(jsonResponse({ movementId: 9, onHandMilli: 10000 })));
    const response = await handleAdminInventoryMovement(request('/api/v1/admin/inventory/movement', {
      method: 'POST',
      headers: { cookie: 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh' },
      body: JSON.stringify(payload),
    }), deps);
    expect(response.status).toBe(200);
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
      p_branch_id: 'branch-main', p_inventory_item_id: 'inv-1', p_delta_milli: -2500, p_movement_kind: 'waste', p_note: 'spill',
    });
  });

  it('forwards recipe component intent without introducing browser authority', async () => {
    const payload = { itemId: 'catalogue-1', variantId: null, name: 'Latte', isActive: true, components: [{ inventoryItemId: 'inv-1', quantityMilli: 18000 }] };
    const { deps, calls } = depsWith(adminSessionResponses(jsonResponse({ id: 'recipe-1' })));
    const response = await handleAdminSaveRecipe(request('/api/v1/admin/inventory/recipe', {
      method: 'POST',
      headers: { cookie: 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh' },
      body: JSON.stringify(payload),
    }), deps);
    expect(response.status).toBe(200);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/save_recipe');
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ p_payload: payload });
  });
});
