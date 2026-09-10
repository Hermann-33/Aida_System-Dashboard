import { describe, expect, it } from 'vitest';
import type { EmployeeBffDependencies } from './employeeBff.js';
import {
  handleAdminIssueTerminalCode,
  handleAdminOperationalLocations,
  handleTerminalClearCredential,
  handleTerminalEnrol,
  handleTerminalStatus,
} from './terminalBff.js';

const env = {
  AIDA_SUPABASE_URL: 'https://example.supabase.co',
  AIDA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};

const staffProfile = {
  user_id: 'staff-user',
  email: 'staff@example.test',
  display_name: 'Aida Staff',
  app_role: 'staff',
  disabled_at: null,
};

const adminProfile = {
  ...staffProfile,
  user_id: 'admin-user',
  email: 'admin@example.test',
  display_name: 'Aida Admin',
  app_role: 'admin',
};

const location = {
  terminalId: 'terminal-main',
  terminalCode: 'POS-MAIN-01',
  branchId: 'branch-main',
  branchCode: 'BR-MAIN',
  branchName: 'Main Café',
  salesPointId: 'sales-main',
  salesPointCode: 'SP-MAIN',
  salesPointName: 'Main Counter',
  timezone: 'Asia/Kuala_Lumpur',
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

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set(
    'cookie',
    'aida_employee_access=employee-access; aida_employee_refresh=refresh-token',
  );
  if ((init.method ?? 'GET') !== 'GET' && !headers.has('origin')) {
    headers.set('origin', 'https://dashboard.example');
  }
  return new Request(`https://dashboard.example${path}`, { ...init, headers });
}

describe('terminal BFF', () => {
  it('reports unenrolled after validating the employee session when no terminal cookie exists', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'staff-user', email: 'staff@example.test' }),
      jsonResponse([staffProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
    ]);

    const response = await handleTerminalStatus(
      request('/api/v1/terminals/status'),
      deps,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { enrolled: false, code: 'TERMINAL_UNENROLLED' },
    });
    expect(calls).toHaveLength(3);
  });

  it('resolves a terminal credential only with the employee caller JWT', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'staff-user', email: 'staff@example.test' }),
      jsonResponse([staffProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
      jsonResponse({ ...location, credentialExpiresAt: '2027-03-09T00:00:00Z' }),
    ]);

    const response = await handleTerminalStatus(
      request('/api/v1/terminals/status', {
        headers: {
          cookie:
            'aida_employee_access=employee-access; aida_employee_refresh=refresh-token; aida_terminal_credential=terminal-secret-abcdefghijklmnopqrstuvwxyz-1234567890',
        },
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data.location.terminalCode).toBe('POS-MAIN-01');
    expect(calls[3]?.url).toContain('/rest/v1/rpc/resolve_terminal_credential');
    expect(new Headers(calls[3]?.init?.headers).get('Authorization')).toBe(
      'Bearer employee-access',
    );
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
      p_credential: 'terminal-secret-abcdefghijklmnopqrstuvwxyz-1234567890',
    });
  });

  it('exchanges a one-time code for an HttpOnly cookie without returning the credential to JavaScript', async () => {
    const credential = 'terminal-secret-abcdefghijklmnopqrstuvwxyz-1234567890';
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'staff-user', email: 'staff@example.test' }),
      jsonResponse([staffProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
      jsonResponse({
        credential,
        credentialExpiresAt: '2027-03-09T00:00:00Z',
        location,
      }),
    ]);

    const response = await handleTerminalEnrol(
      request('/api/v1/terminals/enrol', {
        method: 'POST',
        body: JSON.stringify({ code: 'AIDA-ABC123DEF456' }),
      }),
      deps,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.enrolled).toBe(true);
    expect(body.data.location.terminalCode).toBe('POS-MAIN-01');
    expect(JSON.stringify(body)).not.toContain(credential);

    const cookies = response.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('aida_terminal_credential=');
    expect(cookies).toContain('HttpOnly');
    expect(cookies).toContain('SameSite=Lax');
    expect(cookies).toContain('Secure');

    expect(calls[3]?.url).toContain('/rest/v1/rpc/enrol_terminal');
    expect(new Headers(calls[3]?.init?.headers).get('Authorization')).toBe(
      'Bearer employee-access',
    );
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
      p_code: 'AIDA-ABC123DEF456',
    });
  });

  it('clears an invalid terminal cookie when the backend rejects it', async () => {
    const { deps } = depsWith([
      jsonResponse({ id: 'staff-user', email: 'staff@example.test' }),
      jsonResponse([staffProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
      jsonResponse({ code: '42501', message: 'terminal credential is invalid or expired' }, 403),
    ]);

    const response = await handleTerminalStatus(
      request('/api/v1/terminals/status', {
        headers: {
          cookie:
            'aida_employee_access=employee-access; aida_employee_refresh=refresh-token; aida_terminal_credential=revoked-secret-abcdefghijklmnopqrstuvwxyz-1234567890',
        },
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data.code).toBe('TERMINAL_CREDENTIAL_INVALID');
    const cookies = response.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('aida_terminal_credential=');
    expect(cookies).toContain('Max-Age=0');
  });

  it('rejects cross-origin enrolment before reading employee or terminal authority', async () => {
    const { deps, calls } = depsWith([]);
    const response = await handleTerminalEnrol(
      new Request('https://dashboard.example/api/v1/terminals/enrol', {
        method: 'POST',
        headers: {
          origin: 'https://evil.example',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ code: 'AIDA-ABC123DEF456' }),
      }),
      deps,
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('ORIGIN_FORBIDDEN');
    expect(calls).toHaveLength(0);
  });

  it('expires the terminal cookie on local clear without exposing its old value', async () => {
    const response = await handleTerminalClearCredential(
      new Request('https://dashboard.example/api/v1/terminals/clear-credential', {
        method: 'POST',
        headers: { origin: 'https://dashboard.example' },
        body: '{}',
      }),
    );

    expect(response.status).toBe(200);
    expect(JSON.stringify(await response.json())).not.toContain('terminal-secret');
    const cookies = response.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('aida_terminal_credential=');
    expect(cookies).toContain('Max-Age=0');
    expect(cookies).toContain('HttpOnly');
  });

  it('allows an admin to inspect operational topology using the caller JWT', async () => {
    const topology = [{
      id: 'branch-main',
      code: 'BR-MAIN',
      name: 'Main Café',
      salesPoints: [{
        id: 'sales-main',
        code: 'SP-MAIN',
        name: 'Main Counter',
        terminals: [{
          id: 'terminal-main',
          code: 'POS-MAIN-01',
          name: 'Main Counter POS 1',
          status: 'pending',
        }],
      }],
    }];
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
      jsonResponse(topology),
    ]);

    const response = await handleAdminOperationalLocations(
      request('/api/v1/admin/locations'),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data[0].salesPoints[0].terminals[0].code)
      .toBe('POS-MAIN-01');
    expect(calls[3]?.url).toContain('/rest/v1/rpc/list_admin_operational_locations');
    expect(new Headers(calls[3]?.init?.headers).get('Authorization')).toBe(
      'Bearer employee-access',
    );
  });

  it('issues a manager-controlled one-time terminal code without generating it in the browser', async () => {
    const { deps, calls } = depsWith([
      jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
      jsonResponse([adminProfile]),
      jsonResponse([{ branch_id: 'branch-main' }]),
      jsonResponse({
        terminalId: 'terminal-main',
        code: 'AIDA-ABC123DEF456',
        expiresAt: '2026-09-10T03:00:00Z',
      }),
    ]);

    const response = await handleAdminIssueTerminalCode(
      request('/api/v1/admin/terminals/enrolment-code', {
        method: 'POST',
        body: JSON.stringify({ terminalId: 'terminal-main' }),
      }),
      deps,
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data.code).toBe('AIDA-ABC123DEF456');
    expect(calls[3]?.url).toContain('/rest/v1/rpc/issue_terminal_enrolment_code');
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
      p_terminal_id: 'terminal-main',
    });
  });
});
