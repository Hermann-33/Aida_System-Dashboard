import { expect, it } from 'vitest';
import { handleAdminPaymentAuditEvents } from './reportingBff.js';
import type { EmployeeBffDependencies } from './employeeBff.js';

const env = {
  AIDA_SUPABASE_URL: 'https://example.supabase.co',
  AIDA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

it('forwards payment-audit filters through the caller-bound Admin BFF', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const responses = [
    jsonResponse({ id: 'admin-user', email: 'admin@example.test' }),
    jsonResponse([{ user_id: 'admin-user', email: 'admin@example.test', display_name: 'Admin', app_role: 'admin', disabled_at: null }]),
    jsonResponse([{ branch_id: 'branch-main' }]),
    jsonResponse({ coverage: { sourceBackedOnly: true, rawProviderPayloadIncluded: false, notes: [] }, filter: {}, totalCount: 0, items: [] }),
  ];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    if (!next) throw new Error('Unexpected request');
    return next;
  }) as typeof fetch;
  const deps = { env, fetchImpl } satisfies EmployeeBffDependencies;
  const request = new Request(
    'https://dashboard.example/api/v1/admin/reporting/payment-audit?fromDate=2026-09-18&toDate=2026-09-18&pageSize=25&offset=0',
    { headers: { cookie: 'aida_employee_access=admin-access; aida_employee_refresh=admin-refresh' } },
  );

  const response = await handleAdminPaymentAuditEvents(request, deps);
  expect(response.status).toBe(200);
  expect(calls[3]?.url).toContain('/rest/v1/rpc/get_admin_payment_audit_events');
  expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
    p_filter: { fromDate: '2026-09-18', toDate: '2026-09-18', pageSize: 25, offset: 0 },
  });
  const headers = new Headers(calls[3]?.init?.headers);
  expect(headers.get('Authorization')).toBe('Bearer admin-access');
  expect(headers.get('apikey')).toBe('sb_publishable_test');
});
