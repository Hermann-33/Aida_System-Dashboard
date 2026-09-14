import { describe, expect, it } from 'vitest';
import {
  handleAdminBranches,
  handleAdminSaveBranch,
  handleAdminSaveEmployeeBranches,
  handlePublicBranches,
} from './locationBff.js';
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

const staffProfile = {
  ...adminProfile,
  user_id: 'staff-user',
  email: 'staff@example.test',
  display_name: 'Aida Staff',
  app_role: 'staff',
};

const mainBranch = {
  id: 'branch-main',
  code: 'BR-MAIN',
  name: 'Main Café',
  timezone: 'Asia/Kuala_Lumpur',
  addressText: null,
  phone: null,
  isActive: true,
  isDefault: true,
};

describe('location BFF', () => {
  it('serves the public active branch directory without employee credentials', async () => {
    const { deps, calls } = depsWith([jsonResponse([mainBranch])]);

    const response = await handlePublicBranches(request('/api/v1/branches'), deps);

    expect(response.status).toBe(200);
    expect((await response.json())[0].code).toBe('BR-MAIN');
    expect(calls[0]?.url).toContain('/rest/v1/rpc/list_branches');
    expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toBe(
      'Bearer sb_publishable_test',
    );
  });

  it('lists all branches for an authenticated admin using the caller JWT', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
      jsonResponse([mainBranch]),
    ]);

    const response = await handleAdminBranches(request('/api/v1/admin/branches', {
      headers: {
        cookie: 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh',
      },
    }), deps);

    expect(response.status).toBe(200);
    expect((await response.json())[0].id).toBe('branch-main');
    expect(calls[3]?.url).toContain('/rest/v1/rpc/list_admin_branches');
    expect(new Headers(calls[3]?.init?.headers).get('Authorization')).toBe(
      'Bearer admin-access',
    );
  });

  it('rejects branch mutation before authentication when the request is cross-origin', async () => {
    const { deps, calls } = depsWith([]);
    const response = await handleAdminSaveBranch(new Request(
      'https://dashboard.example/api/v1/admin/branches/save',
      {
        method: 'POST',
        headers: {
          origin: 'https://evil.example',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ code: 'BR-2', name: 'Second Branch' }),
      },
    ), deps);

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ORIGIN_FORBIDDEN');
    expect(calls).toHaveLength(0);
  });

  it('saves branch data through the admin caller JWT', async () => {
    const saved = { ...mainBranch, id: 'branch-2', code: 'BR-2', isDefault: false };
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
      jsonResponse(saved),
    ]);

    const response = await handleAdminSaveBranch(request('/api/v1/admin/branches/save', {
      method: 'POST',
      headers: {
        cookie: 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh',
      },
      body: JSON.stringify({ code: 'BR-2', name: 'Second Branch' }),
    }), deps);

    expect(response.status).toBe(200);
    expect((await response.json()).branch.id).toBe('branch-2');
    expect(calls[3]?.url).toContain('/rest/v1/rpc/save_branch');
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
      p_payload: { code: 'BR-2', name: 'Second Branch' },
    });
  });

  it('denies ordinary staff from the admin branch directory', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'staff-user', email: 'staff@example.test' }),
      jsonResponse([staffProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
    ]);

    const response = await handleAdminBranches(request('/api/v1/admin/branches', {
      headers: {
        cookie: 'aida_employee_access=staff-access; aida_employee_refresh=staff-refresh',
      },
    }), deps);

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ADMIN_REQUIRED');
    expect(calls).toHaveLength(3);
  });

  it('updates employee branch assignments through the trusted admin RPC', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
      jsonResponse(['branch-main', 'branch-2']),
    ]);

    const response = await handleAdminSaveEmployeeBranches(
      request('/api/v1/admin/employees/branches', {
        method: 'POST',
        headers: {
          cookie: 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh',
        },
        body: JSON.stringify({
          userId: 'staff-user',
          branchIds: ['branch-main', 'branch-2'],
        }),
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).branchIds).toEqual(['branch-main', 'branch-2']);
    expect(calls[3]?.url).toContain('/rest/v1/rpc/save_employee_branch_assignments');
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
      p_user_id: 'staff-user',
      p_branch_ids: ['branch-main', 'branch-2'],
    });
  });
});
