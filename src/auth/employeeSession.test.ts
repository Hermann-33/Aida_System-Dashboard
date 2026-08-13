import { afterEach, describe, expect, it, vi } from 'vitest';
import * as session from './employeeSession';
import * as terminal from './terminalCredential';

describe('React employee session safety (Phase 1A + 2B)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    session.clearEmployeeSession();
  });

  it('session module exports cookie-based helpers without storage APIs in runtime', () => {
    expect(typeof session.employeeFetch).toBe('function');
    expect(typeof session.loginWithPassword).toBe('function');
    expect(typeof session.refreshEmployeeSessionFromServer).toBe('function');
    session.clearEmployeeSession();
    expect(session.getEmployeeSession().identity).toBeNull();
  });

  it('employeeFetch always uses credentials include (no terminal secret header API)', async () => {
    const calls: RequestInit[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init || {});
      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;
    try {
      await session.employeeFetch('/api/v1/auth/employee/session');
      expect(calls[0]?.credentials).toBe('include');
      const headers = new Headers(calls[0]?.headers);
      expect(headers.has('X-Terminal-Credential')).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('does not clear a preview Manager identity when a live BFF returns 401', async () => {
    vi.stubEnv('VITE_UI_PREVIEW_MODE', 'true');
    await session.loginWithBadge('siti', '4821');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      code: 'EMPLOYEE_SESSION_REQUIRED',
    }), { status: 401, headers: { 'content-type': 'application/json' } }));

    await session.employeeFetch('/api/v1/admin/members');

    expect(session.getEmployeeSession()).toMatchObject({
      status: 'authenticated',
      identity: { username: 'siti', role: 'admin' },
    });
  });

  it('still clears a live employee identity when the BFF session expires', async () => {
    vi.stubEnv('VITE_UI_PREVIEW_MODE', 'false');
    session.setEmployeeIdentity({
      id: 'employee-1',
      username: 'admin@example.com',
      role: 'admin',
      fullName: 'Live Admin',
      isGlobalManager: true,
      dualRolePosEnabled: false,
      selectedProduct: 'admin',
      assignedBranchIds: [],
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      code: 'EMPLOYEE_SESSION_EXPIRED',
    }), { status: 401, headers: { 'content-type': 'application/json' } }));

    await session.employeeFetch('/api/v1/admin/members');

    expect(session.getEmployeeSession()).toMatchObject({
      status: 'anonymous',
      identity: null,
      lastErrorCode: 'EMPLOYEE_SESSION_EXPIRED',
    });
  });

  it('terminal module exposes status probe only (no get/set secret)', () => {
    expect(typeof terminal.fetchTerminalStatus).toBe('function');
    expect(typeof terminal.clearTerminalEnrolment).toBe('function');
    expect('getTerminalCredential' in terminal).toBe(false);
    expect('setTerminalCredential' in terminal).toBe(false);
  });
});
