import { describe, expect, it } from 'vitest';
import {
  handleAdminCatalogue,
  handleAdminSaveCategory,
  handleAdminSaveItem,
  handlePublicCatalogue,
} from './catalogueBff.js';
import type { EmployeeBffDependencies } from './employeeBff.js';

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

function adminProfile(role: 'admin' | 'owner' | 'staff' = 'admin') {
  return {
    user_id: 'employee-user',
    email: 'admin@example.test',
    display_name: 'Aida Admin',
    app_role: role,
    disabled_at: null,
  };
}

function dashboardRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('cookie', 'aida_employee_access=admin-access; aida_employee_refresh=refresh-token');
  if (init.method && init.method !== 'GET') {
    headers.set('origin', 'https://dashboard.example');
  }
  return new Request(`https://dashboard.example${path}`, {
    ...init,
    headers,
  });
}

const snapshot = {
  revision: 7,
  categories: [{ id: 'category-1', name: 'Coffee' }],
  items: [{ id: 'item-1', name: 'Latte', basePriceSen: 1050 }],
};

describe('catalogue BFF', () => {
  it('serves the public catalogue with only the publishable project credential', async () => {
    const { deps, calls } = depsWith([jsonResponse(snapshot)]);
    const response = await handlePublicCatalogue(
      new Request('https://dashboard.example/api/v1/catalogue'),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).revision).toBe(7);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain('/rest/v1/rpc/get_catalogue');
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('apikey')).toBe('sb_publishable_test');
    expect(headers.get('Authorization')).toBe('Bearer sb_publishable_test');
  });

  it('loads the complete admin catalogue using the validated caller JWT', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'employee-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile('admin')]),
      jsonResponse(snapshot),
    ]);

    const response = await handleAdminCatalogue(
      dashboardRequest('/api/v1/admin/catalogue'),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).items).toHaveLength(1);
    const rpc = calls[2];
    expect(rpc?.url).toContain('/rest/v1/rpc/get_catalogue');
    expect(new Headers(rpc?.init?.headers).get('Authorization')).toBe('Bearer admin-access');
  });

  it('denies ordinary staff before the admin catalogue RPC executes', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'employee-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile('staff')]),
    ]);

    const response = await handleAdminCatalogue(
      dashboardRequest('/api/v1/admin/catalogue'),
      deps,
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ADMIN_REQUIRED');
    expect(calls).toHaveLength(2);
  });

  it('saves an item through the invoker RPC with the admin caller token', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'employee-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile('admin')]),
      jsonResponse('item-server-id'),
    ]);

    const response = await handleAdminSaveItem(
      dashboardRequest('/api/v1/admin/catalogue/item', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: 'category-1',
          name: 'Latte',
          basePriceSen: 1100,
        }),
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe('item-server-id');
    const rpc = calls[2];
    expect(rpc?.url).toContain('/rest/v1/rpc/save_catalogue_item');
    expect(new Headers(rpc?.init?.headers).get('Authorization')).toBe('Bearer admin-access');
    expect(JSON.parse(String(rpc?.init?.body))).toEqual({
      p_payload: { categoryId: 'category-1', name: 'Latte', basePriceSen: 1100 },
    });
  });

  it('saves a category with the same trusted admin session', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'employee-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile('owner')]),
      jsonResponse('category-server-id'),
    ]);

    const response = await handleAdminSaveCategory(
      dashboardRequest('/api/v1/admin/catalogue/category', {
        method: 'POST',
        body: JSON.stringify({ name: 'Seasonal', sortOrder: 50, isActive: true }),
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).id).toBe('category-server-id');
    expect(calls[2]?.url).toContain('/rest/v1/rpc/save_catalogue_category');
  });

  it('rejects cross-origin catalogue mutations before authentication', async () => {
    const { deps, calls } = depsWith([]);
    const response = await handleAdminSaveItem(
      new Request('https://dashboard.example/api/v1/admin/catalogue/item', {
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
});
