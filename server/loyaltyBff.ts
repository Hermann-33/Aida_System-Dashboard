import {
  handleEmployeeSession,
  type EmployeeBffDependencies,
} from './employeeBff.js';

type SessionBody = { data?: { employee?: { role?: 'staff' | 'admin' } } };
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

function config(deps: EmployeeBffDependencies) {
  const env = deps.env ?? process.env;
  const url = env.AIDA_SUPABASE_URL?.replace(/\/$/, '');
  const key = env.AIDA_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key, fetchImpl: deps.fetchImpl ?? fetch };
}

function rpcHeaders(key: string, token: string): Headers {
  return new Headers({
    apikey: key,
    Authorization: `Bearer ${token}`,
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
  const bag = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = bag.getSetCookie?.();
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

async function requireAdmin(request: Request, deps: EmployeeBffDependencies): Promise<AdminSession | Response> {
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

async function rpc(name: string, body: unknown, token: string, deps: EmployeeBffDependencies): Promise<Response> {
  const cfg = config(deps);
  if (!cfg) return json({ error: 'Backend configuration is unavailable', code: 'BACKEND_CONFIGURATION_MISSING' }, 503);
  return cfg.fetchImpl(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: rpcHeaders(cfg.key, token),
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
  const pgCode = typeof detail.code === 'string' ? detail.code : '';
  const pgDetail = typeof detail.details === 'string' ? detail.details : '';
  if (upstream.status === 401 || upstream.status === 403 || pgCode === '42501') {
    return json({ error: message, code: 'ADMIN_REQUIRED' }, 403, cookies);
  }
  if (upstream.status >= 500) {
    return json({ error: fallback, code: 'LOYALTY_UPSTREAM_UNAVAILABLE' }, 502, cookies);
  }
  return json({ error: message, code: pgDetail || 'LOYALTY_VALIDATION_FAILED' }, 400, cookies);
}

async function mutate(
  request: Request,
  rpcName: string,
  rpcBody: (body: Record<string, unknown>) => unknown,
  fallback: string,
  deps: EmployeeBffDependencies,
): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  if (!sameOrigin(request)) return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;
  const body = await objectBody(request);
  if (body instanceof Response) return body;
  const upstream = await rpc(rpcName, rpcBody(body), auth.accessToken, deps);
  if (!upstream.ok) return failure(upstream, auth.responseCookies, fallback);
  const data = await upstream.json().catch(() => null);
  return json({ data }, 200, auth.responseCookies);
}

export async function handleAdminLoyaltyState(request: Request, deps: EmployeeBffDependencies = {}): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;
  const upstream = await rpc('get_loyalty_admin_state', {}, auth.accessToken, deps);
  if (!upstream.ok) return failure(upstream, auth.responseCookies, 'Loyalty configuration is unavailable');
  const data = await upstream.json().catch(() => null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return json({ error: 'Loyalty response is invalid', code: 'LOYALTY_RESPONSE_INVALID' }, 502, auth.responseCookies);
  }
  return json({ data }, 200, auth.responseCookies);
}

export async function handleAdminMemberLoyalty(request: Request, deps: EmployeeBffDependencies = {}): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;
  const memberCode = new URL(request.url).searchParams.get('memberCode')?.trim();
  if (!memberCode) return json({ error: 'memberCode is required', code: 'MEMBER_CODE_REQUIRED' }, 400, auth.responseCookies);
  const upstream = await rpc('get_member_loyalty_by_code', { p_member_code: memberCode }, auth.accessToken, deps);
  if (!upstream.ok) return failure(upstream, auth.responseCookies, 'Member loyalty state is unavailable');
  const data = await upstream.json().catch(() => null);
  return json({ data }, 200, auth.responseCookies);
}

export function handleAdminSaveLoyaltyProgram(request: Request, deps: EmployeeBffDependencies = {}): Promise<Response> {
  return mutate(request, 'save_loyalty_program_config', body => ({
    p_points_per_ringgit: body.pointsPerRinggit,
    p_stamp_goal: body.stampGoal,
    p_stamp_reward_id: body.stampRewardId,
  }), 'Loyalty program update failed', deps);
}

export function handleAdminSaveLoyaltyReward(request: Request, deps: EmployeeBffDependencies = {}): Promise<Response> {
  return mutate(request, 'save_loyalty_reward', body => ({ p_reward: body }), 'Reward update failed', deps);
}

export function handleAdminAdjustMemberLoyalty(request: Request, deps: EmployeeBffDependencies = {}): Promise<Response> {
  return mutate(request, 'adjust_member_loyalty', body => ({
    p_member_code: body.memberCode,
    p_points_delta: body.pointsDelta ?? 0,
    p_stamps_delta: body.stampsDelta ?? 0,
    p_reason: body.reason,
  }), 'Member loyalty adjustment failed', deps);
}
