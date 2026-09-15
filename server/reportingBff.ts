import { handleEmployeeSession, type EmployeeBffDependencies } from './employeeBff.js';

type SessionBody = { data?: { employee?: { role?: 'staff' | 'admin' } } };
type AdminSession = { accessToken: string; responseCookies: string[] };
const ACCESS_COOKIE = 'aida_employee_access';

function json(body: unknown, status = 200, cookies: string[] = []): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function config(deps: EmployeeBffDependencies) {
  const env = deps.env ?? process.env;
  const url = env.AIDA_SUPABASE_URL?.replace(/\/$/, '');
  const key = env.AIDA_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key, fetchImpl: deps.fetchImpl ?? fetch };
}

function parseCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie');
  if (!raw) return null;
  for (const pair of raw.split(';')) {
    const [key, ...parts] = pair.trim().split('=');
    if (key === name) return decodeURIComponent(parts.join('='));
  }
  return null;
}

function responseCookies(response: Response): string[] {
  const bag = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = bag.getSetCookie?.();
  if (values?.length) return values;
  const raw = response.headers.get('set-cookie');
  return raw ? [raw] : [];
}

function accessFromSetCookie(cookies: string[]): string | null {
  for (const cookie of cookies) {
    const match = cookie.match(/(?:^|[, ]+)aida_employee_access=([^;,]+)/);
    const encodedToken = match?.[1];
    if (encodedToken) return decodeURIComponent(encodedToken);
  }
  return null;
}

async function requireAdmin(request: Request, deps: EmployeeBffDependencies): Promise<AdminSession | Response> {
  const sessionRequest = new Request(new URL('/api/v1/auth/employee/session', request.url), { method: 'GET', headers: request.headers });
  const sessionResponse = await handleEmployeeSession(sessionRequest, deps);
  if (!sessionResponse.ok) return sessionResponse;
  const body = await sessionResponse.clone().json().catch(() => ({})) as SessionBody;
  if (body.data?.employee?.role !== 'admin') {
    return json({ error: 'Administrator access required', code: 'ADMIN_REQUIRED' }, 403, responseCookies(sessionResponse));
  }
  const cookies = responseCookies(sessionResponse);
  const accessToken = accessFromSetCookie(cookies) ?? parseCookie(request, ACCESS_COOKIE);
  if (!accessToken) return json({ error: 'Employee session required', code: 'EMPLOYEE_SESSION_REQUIRED' }, 401, cookies);
  return { accessToken, responseCookies: cookies };
}

function reportFilter(request: Request): Record<string, unknown> {
  const params = new URL(request.url).searchParams;
  const filter: Record<string, unknown> = {
    fromDate: params.get('fromDate') ?? '',
    toDate: params.get('toDate') ?? '',
  };
  for (const [queryKey, filterKey] of [['branchId', 'branchId'], ['salesPointId', 'salesPointId']] as const) {
    const value = params.get(queryKey);
    if (value) filter[filterKey] = value;
  }
  for (const [queryKey, filterKey] of [['pageSize', 'pageSize'], ['offset', 'offset']] as const) {
    const value = params.get(queryKey);
    if (value !== null && value !== '') {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed) && parsed >= 0) filter[filterKey] = parsed;
    }
  }
  return filter;
}

async function rpc(name: string, filter: Record<string, unknown>, token: string, deps: EmployeeBffDependencies): Promise<Response> {
  const cfg = config(deps);
  if (!cfg) return json({ error: 'Backend configuration is unavailable', code: 'BACKEND_CONFIGURATION_MISSING' }, 503);
  return cfg.fetchImpl(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: new Headers({ apikey: cfg.key, Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' }),
    body: JSON.stringify({ p_filter: filter }),
  });
}

async function failure(upstream: Response, cookies: string[]): Promise<Response> {
  const detail = await upstream.json().catch(() => ({})) as Record<string, unknown>;
  const message = typeof detail.message === 'string' ? detail.message : 'Reporting request failed';
  const pgCode = typeof detail.code === 'string' ? detail.code : '';
  const pgDetail = typeof detail.details === 'string' ? detail.details : '';
  if (upstream.status === 401 || upstream.status === 403 || pgCode === '42501') return json({ error: message, code: 'ADMIN_REQUIRED' }, 403, cookies);
  if (upstream.status >= 500) return json({ error: 'Reporting service is unavailable', code: 'REPORTING_UPSTREAM_UNAVAILABLE' }, 502, cookies);
  return json({ error: message, code: pgDetail || 'REPORTING_VALIDATION_FAILED' }, 400, cookies);
}

async function handleReport(request: Request, rpcName: string, deps: EmployeeBffDependencies): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;
  const upstream = await rpc(rpcName, reportFilter(request), auth.accessToken, deps);
  if (!upstream.ok) return failure(upstream, auth.responseCookies);
  const data = await upstream.json().catch(() => null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'Reporting response is invalid', code: 'REPORTING_RESPONSE_INVALID' }, 502, auth.responseCookies);
  return json({ data }, 200, auth.responseCookies);
}

export function handleAdminReportingSummary(request: Request, deps: EmployeeBffDependencies = {}) {
  return handleReport(request, 'get_admin_reporting_summary', deps);
}

export function handleAdminTransactionReport(request: Request, deps: EmployeeBffDependencies = {}) {
  return handleReport(request, 'get_admin_transaction_report', deps);
}

export function handleAdminAuditEvents(request: Request, deps: EmployeeBffDependencies = {}) {
  return handleReport(request, 'get_admin_audit_events', deps);
}
