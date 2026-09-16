import {
  handleEmployeeSession,
  type EmployeeBffDependencies,
} from './employeeBff.js';

type SessionBody = {
  data?: {
    employee?: {
      role?: 'staff' | 'admin';
    };
  };
};

type EmployeeSession = {
  accessToken: string;
  role: 'staff' | 'admin';
  responseCookies: string[];
};

const ACCESS_COOKIE = 'aida_employee_access';
const TERMINAL_COOKIE = 'aida_terminal_credential';
const ORDER_STATUSES = new Set([
  'confirmed',
  'scheduled',
  'preparing',
  'ready',
  'completed',
  'cancelled',
]);

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

function upstreamHeaders(key: string, accessToken?: string): Headers {
  return new Headers({
    apikey: key,
    Authorization: `Bearer ${accessToken ?? key}`,
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

async function requireEmployee(
  request: Request,
  deps: EmployeeBffDependencies,
  adminOnly = false,
): Promise<EmployeeSession | Response> {
  const sessionUrl = new URL('/api/v1/auth/employee/session', request.url);
  const sessionRequest = new Request(sessionUrl, {
    method: 'GET',
    headers: request.headers,
  });
  const sessionResponse = await handleEmployeeSession(sessionRequest, deps);
  if (!sessionResponse.ok) return sessionResponse;

  const body = await sessionResponse.clone().json().catch(() => ({})) as SessionBody;
  const role = body.data?.employee?.role;
  if (role !== 'staff' && role !== 'admin') {
    return json(
      { error: 'Employee access required', code: 'EMPLOYEE_REQUIRED' },
      403,
      responseCookies(sessionResponse),
    );
  }
  if (adminOnly && role !== 'admin') {
    return json(
      { error: 'Administrator access required', code: 'ADMIN_REQUIRED' },
      403,
      responseCookies(sessionResponse),
    );
  }

  const cookies = responseCookies(sessionResponse);
  const accessToken = accessFromSetCookie(cookies) ?? parseCookie(request, ACCESS_COOKIE);
  if (!accessToken) {
    return json(
      { error: 'Employee session required', code: 'EMPLOYEE_SESSION_REQUIRED' },
      401,
      cookies,
    );
  }

  return { accessToken, role, responseCookies: cookies };
}

async function rpc(
  functionName: string,
  body: unknown,
  accessToken: string | undefined,
  deps: EmployeeBffDependencies,
): Promise<Response> {
  const cfg = config(deps);
  if (!cfg) {
    return json(
      { error: 'Backend configuration is unavailable', code: 'BACKEND_CONFIGURATION_MISSING' },
      503,
    );
  }

  return cfg.fetchImpl(`${cfg.url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: upstreamHeaders(cfg.key, accessToken),
    body: JSON.stringify(body),
  });
}

async function readObject(request: Request): Promise<Record<string, unknown> | Response> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Request body must be a JSON object', code: 'INVALID_JSON' }, 400);
  }
  return body as Record<string, unknown>;
}

async function upstreamFailure(
  upstream: Response,
  cookies: string[],
  fallbackMessage: string,
): Promise<Response> {
  const detail = await upstream.json().catch(() => ({})) as Record<string, unknown>;
  const message = typeof detail.message === 'string' ? detail.message : fallbackMessage;
  const postgresCode = typeof detail.code === 'string' ? detail.code : '';

  if (upstream.status === 401 || upstream.status === 403 || postgresCode === '42501') {
    return json({ error: message, code: 'EMPLOYEE_FORBIDDEN' }, 403, cookies);
  }
  if (postgresCode === '23505') {
    return json({ error: message, code: 'ORDER_IDEMPOTENCY_CONFLICT' }, 409, cookies);
  }
  if (postgresCode === '40001') {
    return json({ error: message, code: 'ORDER_VERSION_CONFLICT' }, 409, cookies);
  }
  if (upstream.status >= 500) {
    return json({ error: fallbackMessage, code: 'ORDER_UPSTREAM_UNAVAILABLE' }, 502, cookies);
  }
  return json({ error: message, code: 'ORDER_VALIDATION_FAILED' }, 400, cookies);
}

export async function handleOrderingPolicy(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const upstream = await rpc('get_ordering_policy', {}, undefined, deps);
  if (!upstream.ok) {
    return upstreamFailure(upstream, [], 'Ordering policy is unavailable');
  }
  const policy = await upstream.json().catch(() => null);
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return json({ error: 'Ordering policy response is invalid', code: 'ORDER_POLICY_INVALID' }, 502);
  }
  return json(policy);
}

export async function handleEmployeeOrders(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const auth = await requireEmployee(request, deps);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const statuses = url.searchParams.getAll('status').filter(Boolean);
  if (statuses.some((status) => !ORDER_STATUSES.has(status))) {
    return json({ error: 'Invalid order status filter', code: 'INVALID_ORDER_STATUS' }, 400, auth.responseCookies);
  }

  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? 100 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
    return json({ error: 'Order limit must be between 1 and 250', code: 'INVALID_ORDER_LIMIT' }, 400, auth.responseCookies);
  }

  const upstream = await rpc(
    'list_orders',
    { p_statuses: statuses.length ? statuses : null, p_limit: limit },
    auth.accessToken,
    deps,
  );
  if (!upstream.ok) {
    return upstreamFailure(upstream, auth.responseCookies, 'Orders are unavailable');
  }
  const orders = await upstream.json().catch(() => null);
  if (!Array.isArray(orders)) {
    return json({ error: 'Orders response is invalid', code: 'ORDERS_INVALID' }, 502, auth.responseCookies);
  }
  return json(orders, 200, auth.responseCookies);
}

export async function handleEmployeeOrder(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const auth = await requireEmployee(request, deps);
  if (auth instanceof Response) return auth;

  const orderId = new URL(request.url).searchParams.get('id')?.trim() ?? '';
  if (!orderId) {
    return json({ error: 'Order id is required', code: 'ORDER_ID_REQUIRED' }, 400, auth.responseCookies);
  }

  const upstream = await rpc('get_order', { p_order_id: orderId }, auth.accessToken, deps);
  if (!upstream.ok) {
    return upstreamFailure(upstream, auth.responseCookies, 'Order is unavailable');
  }
  const order = await upstream.json().catch(() => null);
  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    return json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' }, 404, auth.responseCookies);
  }
  return json(order, 200, auth.responseCookies);
}

export async function handleEmployeeQuoteOrder(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  if (!sameOrigin(request)) {
    return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  }

  const auth = await requireEmployee(request, deps);
  if (auth instanceof Response) return auth;
  const payload = await readObject(request);
  if (payload instanceof Response) return payload;

  const upstream = await rpc('quote_order', { p_payload: payload }, auth.accessToken, deps);
  if (!upstream.ok) {
    return upstreamFailure(upstream, auth.responseCookies, 'Order quote failed');
  }
  const quote = await upstream.json().catch(() => null);
  if (!quote || typeof quote !== 'object' || Array.isArray(quote)) {
    return json({ error: 'Order quote response is invalid', code: 'ORDER_QUOTE_INVALID' }, 502, auth.responseCookies);
  }
  return json(quote, 200, auth.responseCookies);
}

export async function handleEmployeePlaceOrder(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  if (!sameOrigin(request)) {
    return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  }

  const auth = await requireEmployee(request, deps);
  if (auth instanceof Response) return auth;

  const terminalCredential = parseCookie(request, TERMINAL_COOKIE);
  if (!terminalCredential) {
    return json(
      { error: 'Activate this terminal before placing POS orders', code: 'TERMINAL_ENROLMENT_REQUIRED' },
      403,
      auth.responseCookies,
    );
  }

  const payload = await readObject(request);
  if (payload instanceof Response) return payload;

  const upstream = await rpc(
    'place_pos_order',
    {
      p_payload: payload,
      p_terminal_credential: terminalCredential,
    },
    auth.accessToken,
    deps,
  );
  if (!upstream.ok) {
    return upstreamFailure(upstream, auth.responseCookies, 'Order placement failed');
  }
  const order = await upstream.json().catch(() => null);
  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    return json({ error: 'Order placement response is invalid', code: 'ORDER_RESPONSE_INVALID' }, 502, auth.responseCookies);
  }
  return json(order, 201, auth.responseCookies);
}

export async function handleEmployeeTransitionOrder(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  if (!sameOrigin(request)) {
    return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  }

  const auth = await requireEmployee(request, deps);
  if (auth instanceof Response) return auth;
  const body = await readObject(request);
  if (body instanceof Response) return body;

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  const toStatus = typeof body.toStatus === 'string' ? body.toStatus.trim() : '';
  const expectedVersion = typeof body.expectedVersion === 'number' ? body.expectedVersion : Number.NaN;
  const reason = typeof body.reason === 'string' ? body.reason : null;
  if (!orderId || !ORDER_STATUSES.has(toStatus) || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return json({ error: 'Valid orderId, toStatus and expectedVersion are required', code: 'INVALID_STATUS_TRANSITION' }, 400, auth.responseCookies);
  }

  const upstream = await rpc(
    'transition_order_status',
    {
      p_order_id: orderId,
      p_to_status: toStatus,
      p_expected_version: expectedVersion,
      p_reason: reason,
    },
    auth.accessToken,
    deps,
  );
  if (!upstream.ok) {
    return upstreamFailure(upstream, auth.responseCookies, 'Order status update failed');
  }
  const order = await upstream.json().catch(() => null);
  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    return json({ error: 'Order status response is invalid', code: 'ORDER_RESPONSE_INVALID' }, 502, auth.responseCookies);
  }
  return json(order, 200, auth.responseCookies);
}

export async function handleAdminSaveOrderingPolicy(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  if (!sameOrigin(request)) {
    return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  }

  const auth = await requireEmployee(request, deps, true);
  if (auth instanceof Response) return auth;
  const payload = await readObject(request);
  if (payload instanceof Response) return payload;

  const upstream = await rpc('save_ordering_policy', { p_payload: payload }, auth.accessToken, deps);
  if (!upstream.ok) {
    return upstreamFailure(upstream, auth.responseCookies, 'Ordering policy update failed');
  }
  const policy = await upstream.json().catch(() => null);
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return json({ error: 'Ordering policy response is invalid', code: 'ORDER_POLICY_INVALID' }, 502, auth.responseCookies);
  }
  return json(policy, 200, auth.responseCookies);
}
