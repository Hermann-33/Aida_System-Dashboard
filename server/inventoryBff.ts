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

function cfg(deps: EmployeeBffDependencies) {
  const env = deps.env ?? process.env;
  const url = env.AIDA_SUPABASE_URL?.replace(/\/$/, '');
  const key = env.AIDA_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key, fetchImpl: deps.fetchImpl ?? fetch };
}

function headers(key: string, token: string): Headers {
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
  const h = response.headers as Headers & { getSetCookie?: () => string[] };
  const values = h.getSetCookie?.();
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
  if (!accessToken) return json({ error: 'Employee session required', code: 'EMPLOYEE_SESSION_REQUIRED' }, 401, cookies);
  return { accessToken, responseCookies: cookies };
}

async function rpc(name: string, body: unknown, token: string, deps: EmployeeBffDependencies): Promise<Response> {
  const config = cfg(deps);
  if (!config) return json({ error: 'Backend configuration is unavailable', code: 'BACKEND_CONFIGURATION_MISSING' }, 503);
  return config.fetchImpl(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: headers(config.key, token),
    body: JSON.stringify(body),
  });
}

async function objectBody(request: Request): Promise<Record<string, unknown> | Response> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Request body must be a JSON object', code: 'INVALID_JSON' }, 400);
  return body as Record<string, unknown>;
}

async function failure(upstream: Response, cookies: string[], fallback: string): Promise<Response> {
  const detail = await upstream.json().catch(() => ({})) as Record<string, unknown>;
  const message = typeof detail.message === 'string' ? detail.message : fallback;
  const pgCode = typeof detail.code === 'string' ? detail.code : '';
  if (upstream.status === 401 || upstream.status === 403 || pgCode === '42501') return json({ error: message, code: 'ADMIN_REQUIRED' }, 403, cookies);
  if (upstream.status >= 500) return json({ error: fallback, code: 'INVENTORY_UPSTREAM_UNAVAILABLE' }, 502, cookies);
  return json({ error: message, code: 'INVENTORY_VALIDATION_FAILED' }, 400, cookies);
}

export async function handleAdminInventoryState(request: Request, deps: EmployeeBffDependencies = {}): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;
  const branchId = new URL(request.url).searchParams.get('branchId')?.trim();
  if (!branchId) return json({ error: 'branchId is required', code: 'BRANCH_ID_REQUIRED' }, 400, auth.responseCookies);
  const upstream = await rpc('list_inventory_state', { p_branch_id: branchId }, auth.accessToken, deps);
  if (!upstream.ok) return failure(upstream, auth.responseCookies, 'Inventory state is unavailable');
  const data = await upstream.json().catch(() => null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'Inventory response is invalid', code: 'INVENTORY_RESPONSE_INVALID' }, 502, auth.responseCookies);
  return json({ data }, 200, auth.responseCookies);
}

async function mutate(request: Request, rpcName: string, rpcBody: (body: Record<string, unknown>) => unknown, fallback: string, deps: EmployeeBffDependencies): Promise<Response> {
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

export function handleAdminSaveInventoryItem(request: Request, deps: EmployeeBffDependencies = {}): Promise<Response> {
  return mutate(request, 'save_inventory_item', body => ({ p_payload: body }), 'Inventory item update failed', deps);
}

export function handleAdminSaveRecipe(request: Request, deps: EmployeeBffDependencies = {}): Promise<Response> {
  return mutate(request, 'save_recipe', body => ({ p_payload: body }), 'Recipe update failed', deps);
}

export function handleAdminInventoryMovement(request: Request, deps: EmployeeBffDependencies = {}): Promise<Response> {
  return mutate(request, 'record_inventory_movement', body => ({
    p_branch_id: body.branchId,
    p_inventory_item_id: body.inventoryItemId,
    p_delta_milli: body.deltaMilli,
    p_movement_kind: body.movementKind,
    p_note: body.note ?? null,
  }), 'Inventory movement failed', deps);
}
