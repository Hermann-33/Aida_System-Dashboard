import {
  handleEmployeeSession,
  type EmployeeBffDependencies,
} from './employeeBff.js';

type SessionBody = {
  data?: { employee?: { role?: 'staff' | 'admin' } };
};

type AdminSession = { accessToken: string; responseCookies: string[] };
const ACCESS_COOKIE = 'aida_employee_access';

function json(body: unknown, status = 200, cookies: string[] = []): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function cfg(deps: EmployeeBffDependencies) {
  const env = deps.env ?? process.env;
  const url = env.AIDA_SUPABASE_URL?.replace(/\/$/, '');
  const key = env.AIDA_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key, fetchImpl: deps.fetchImpl ?? fetch };
}

function upstreamHeaders(key: string, accessToken: string): Headers {
  return new Headers({
    apikey: key,
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
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
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = headers.getSetCookie?.();
  if (values?.length) return values;
  const raw = response.headers.get('set-cookie');
  return raw ? [raw] : [];
}

function accessFromSetCookie(cookies: string[]): string | null {
  for (const cookie of cookies) {
    const match = cookie.match(/(?:^|[, ]+)aida_employee_access=([^;,]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    return requestUrl.protocol === originUrl.protocol && requestUrl.host === originUrl.host;
  } catch {
    return false;
  }
}

async function requireAdmin(
  request: Request,
  deps: EmployeeBffDependencies,
): Promise<AdminSession | Response> {
  const sessionRequest = new Request(new URL('/api/v1/auth/employee/session', request.url), {
    method: 'GET',
    headers: request.headers,
  });
  const sessionResponse = await handleEmployeeSession(sessionRequest, deps);
  if (!sessionResponse.ok) return sessionResponse;

  const body = await sessionResponse.clone().json().catch(() => ({})) as SessionBody;
  if (body.data?.employee?.role !== 'admin') {
    return json({ error: 'Administrator access required', code: 'ADMIN_REQUIRED' }, 403, responseCookies(sessionResponse));
  }

  const cookies = responseCookies(sessionResponse);
  const accessToken = accessFromSetCookie(cookies) ?? parseCookie(request, ACCESS_COOKIE);
  if (!accessToken) {
    return json({ error: 'Employee session required', code: 'EMPLOYEE_SESSION_REQUIRED' }, 401, cookies);
  }
  return { accessToken, responseCookies: cookies };
}

async function rpc(
  functionName: string,
  body: unknown,
  accessToken: string,
  deps: EmployeeBffDependencies,
): Promise<Response> {
  const config = cfg(deps);
  if (!config) {
    return json({ error: 'Backend configuration is unavailable', code: 'BACKEND_CONFIGURATION_MISSING' }, 503);
  }
  return config.fetchImpl(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: upstreamHeaders(config.key, accessToken),
    body: JSON.stringify(body),
  });
}

async function objectBody(request: Request): Promise<Record<string, unknown> | Response> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Request body must be a JSON object', code: 'INVALID_JSON' }, 400);
  }
  return body as Record<string, unknown>;
}

async function failure(upstream: Response, cookies: string[], fallback: string): Promise<Response> {
  const detail = await upstream.json().catch(() => ({})) as Record<string, unknown>;
  const message = typeof detail.message === 'string' ? detail.message : fallback;
  const postgresCode = typeof detail.code === 'string' ? detail.code : '';
  if (upstream.status === 401 || upstream.status === 403 || postgresCode === '42501') {
    return json({ error: message, code: 'ADMIN_REQUIRED' }, 403, cookies);
  }
  if (postgresCode === 'P0002') return json({ error: message, code: 'BRANCH_NOT_FOUND' }, 404, cookies);
  if (upstream.status >= 500) return json({ error: fallback, code: 'PICKUP_UPSTREAM_UNAVAILABLE' }, 502, cookies);
  return json({ error: message, code: 'PICKUP_VALIDATION_FAILED' }, 400, cookies);
}

export async function handleAdminPickupConfiguration(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;
  const branchId = new URL(request.url).searchParams.get('branchId')?.trim();
  if (!branchId) return json({ error: 'branchId is required', code: 'BRANCH_ID_REQUIRED' }, 400, auth.responseCookies);
  const upstream = await rpc('get_admin_branch_pickup_configuration', { p_branch_id: branchId }, auth.accessToken, deps);
  if (!upstream.ok) return failure(upstream, auth.responseCookies, 'Pickup configuration is unavailable');
  const data = await upstream.json().catch(() => null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return json({ error: 'Pickup configuration response is invalid', code: 'PICKUP_RESPONSE_INVALID' }, 502, auth.responseCookies);
  }
  return json({ data }, 200, auth.responseCookies);
}

export async function handleAdminSavePickupConfiguration(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  if (!sameOrigin(request)) return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;
  const payload = await objectBody(request);
  if (payload instanceof Response) return payload;
  const upstream = await rpc('save_branch_pickup_configuration', { p_payload: payload }, auth.accessToken, deps);
  if (!upstream.ok) return failure(upstream, auth.responseCookies, 'Pickup configuration update failed');
  const data = await upstream.json().catch(() => null);
  return json({ data }, 200, auth.responseCookies);
}

export async function handleAdminSavePickupException(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  if (!sameOrigin(request)) return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;
  const payload = await objectBody(request);
  if (payload instanceof Response) return payload;
  const upstream = await rpc('save_branch_service_exception', { p_payload: payload }, auth.accessToken, deps);
  if (!upstream.ok) return failure(upstream, auth.responseCookies, 'Service exception update failed');
  const data = await upstream.json().catch(() => null);
  return json({ data }, 200, auth.responseCookies);
}

export async function handleAdminDeletePickupException(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  if (!sameOrigin(request)) return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;
  const body = await objectBody(request);
  if (body instanceof Response) return body;
  const branchId = typeof body.branchId === 'string' ? body.branchId.trim() : '';
  const serviceDate = typeof body.serviceDate === 'string' ? body.serviceDate.trim() : '';
  if (!branchId || !serviceDate) {
    return json({ error: 'branchId and serviceDate are required', code: 'PICKUP_EXCEPTION_INPUT_REQUIRED' }, 400, auth.responseCookies);
  }
  const upstream = await rpc(
    'delete_branch_service_exception',
    { p_branch_id: branchId, p_service_date: serviceDate },
    auth.accessToken,
    deps,
  );
  if (!upstream.ok) return failure(upstream, auth.responseCookies, 'Service exception deletion failed');
  const data = await upstream.json().catch(() => null);
  return json({ data }, 200, auth.responseCookies);
}
