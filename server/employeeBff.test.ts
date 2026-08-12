import { describe, expect, it } from 'vitest';
import {
  handleAdminMembers,
  handleEmployeeLogin,
  handleEmployeeLogout,
  handleEmployeeSession,
  type EmployeeBffDependencies,
} from './employeeBff.js';

const env = {
  AIDA_SUPABASE_URL: 'https://example.supabase.co',
  AIDA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};

function request(path: string, init: RequestInit = {}) {
  const url = `https://dashboard.example${path}`;
  const headers = new Headers(init.headers);
  if ((init.method ?? 'GET') !== 'GET' && !headers.has('origin')) {
    headers.set('origin', 'https://dashboard.example');
  }
  return new Request(url, { ...init, headers });
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

describe('employee BFF', () => {
  it('logs an admin in without exposing tokens to browser JSON', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({
        access_token: 'admin-access',
        refresh_token: 'admin-refresh',
        expires_in: 3600,
        user: { id: 'admin-user', email: 'admin@example.test' },
      }),
      jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile]),
    ]);

    const response = await handleEmployeeLogin(request('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin@example.test', password: 'correct horse' }),
    }), deps);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.employee.role).toBe('admin');
    expect(JSON.stringify(body)).not.toContain('admin-access');
    expect(JSON.stringify(body)).not.toContain('admin-refresh');
    const cookies = response.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('aida_employee_access=admin-access');
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('Secure');
    expect(calls[0]?.url).toContain('/auth/v1/token?grant_type=password');
  });

  it('rejects customer identities and revokes the just-created auth session', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ access_token: 'customer-access', refresh_token: 'r', expires_in: 3600 }),
      jsonResponse({ id: 'customer-user', email: 'customer@example.test' }),
      jsonResponse([{
        ...adminProfile,
        user_id: 'customer-user',
        email: 'customer@example.test',
        app_role: 'customer',
      }]),
      new Response(null, { status: 204 }),
    ]);

    const response = await handleEmployeeLogin(request('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'customer@example.test', password: 'password' }),
    }), deps);

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('EMPLOYEE_ACCESS_FORBIDDEN');
    expect(calls.at(-1)?.url).toContain('/auth/v1/logout?scope=local');
  });

  it('rejects disabled employees', async () => {
    const { deps } = depsWith([
      jsonResponse({ access_token: 'disabled-access', refresh_token: 'r', expires_in: 3600 }),
      jsonResponse({ id: 'disabled-user', email: 'disabled@example.test' }),
      jsonResponse([{
        ...adminProfile,
        user_id: 'disabled-user',
        email: 'disabled@example.test',
        disabled_at: '2026-08-12T00:00:00Z',
      }]),
      new Response(null, { status: 204 }),
    ]);

    const response = await handleEmployeeLogin(request('/api/v1/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'disabled@example.test', password: 'password' }),
    }), deps);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('EMPLOYEE_DISABLED');
  });

  it('refreshes an expired cookie session and rotates HttpOnly cookies', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({}, 401),
      jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 }),
      jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile]),
    ]);

    const response = await handleEmployeeSession(request('/api/v1/auth/employee/session', {
      headers: { cookie: 'aida_employee_access=expired; aida_employee_refresh=old-refresh' },
    }), deps);

    expect(response.status).toBe(200);
    expect((await response.json()).data.employee.username).toBe('admin@example.test');
    const cookies = response.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('new-access');
    expect(cookies).toContain('new-refresh');
    expect(calls[1]?.url).toContain('grant_type=refresh_token');
  });

  it('allows admin member listing with the caller JWT and maps trusted rows', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile]),
      jsonResponse([{
        member_id: 'member-1',
        user_id: 'customer-1',
        member_code: 'AIDA-1234-5678',
        display_name: 'Member One',
        email: 'member@example.test',
        member_type: 'standard',
        student_status: 'not_submitted',
        is_active: true,
        created_at: '2026-08-12T01:00:00Z',
      }]),
    ]);

    const response = await handleAdminMembers(request('/api/v1/admin/members', {
      headers: { cookie: 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh' },
    }), deps);

    expect(response.status).toBe(200);
    expect((await response.json()).members[0].memberCode).toBe('AIDA-1234-5678');
    const rpcCall = calls[2];
    expect(rpcCall?.url).toContain('/rest/v1/rpc/list_admin_members');
    expect(new Headers(rpcCall?.init?.headers).get('Authorization')).toBe('Bearer admin-access');
    expect(new Headers(rpcCall?.init?.headers).get('Authorization')).not.toContain('sb_publishable_test');
  });

  it('denies ordinary staff before the member RPC is called', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'staff-user', email: 'staff@example.test' }),
      jsonResponse([staffProfile]),
    ]);

    const response = await handleAdminMembers(request('/api/v1/admin/members', {
      headers: { cookie: 'aida_employee_access=staff-access; aida_employee_refresh=staff-refresh' },
    }), deps);

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ADMIN_REQUIRED');
    expect(calls).toHaveLength(2);
  });

  it('rejects cross-origin login requests', async () => {
    const { deps, calls } = depsWith([]);
    const response = await handleEmployeeLogin(new Request(
      'https://dashboard.example/api/v1/auth/employee/login',
      {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
        body: JSON.stringify({ username: 'admin@example.test', password: 'password' }),
      },
    ), deps);
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('logs out locally and always expires both browser cookies', async () => {
    const { deps } = depsWith([new Response(null, { status: 204 })]);
    const response = await handleEmployeeLogout(request('/api/v1/auth/employee/logout', {
      method: 'POST',
      headers: { cookie: 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh' },
      body: '{}',
    }), deps);
    expect(response.status).toBe(200);
    const cookies = response.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('aida_employee_access=');
    expect(cookies).toContain('aida_employee_refresh=');
    expect(cookies).toContain('Max-Age=0');
  });
});
