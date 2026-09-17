import {
  handleEmployeeSession,
  type EmployeeBffDependencies,
} from './employeeBff.js';

type SessionBody = { data?: { employee?: { role?: 'staff' | 'admin' } } };
type AdminSession = { accessToken: string; responseCookies: string[] };

const ACCESS_COOKIE = 'aida_employee_access';
const TERMINAL_COOKIE = 'aida_terminal_credential';

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

async function requireAdmin(
  request: Request,
  deps: EmployeeBffDependencies,
): Promise<AdminSession | Response> {
  const sessionRequest = new Request(
    new URL('/api/v1/auth/employee/session', request.url),
    { method: 'GET', headers: request.headers },
  );
  const sessionResponse = await handleEmployeeSession(sessionRequest, deps);
  if (!sessionResponse.ok) return sessionResponse;
  const body = await sessionResponse.clone().json().catch(() => ({})) as SessionBody;
  if (body.data?.employee?.role !== 'admin') {
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
  return { accessToken, responseCookies: cookies };
}

async function rpc(
  name: string,
  body: unknown,
  token: string,
  deps: EmployeeBffDependencies,
): Promise<Response> {
  const cfg = config(deps);
  if (!cfg) {
    return json(
      { error: 'Backend configuration is unavailable', code: 'BACKEND_CONFIGURATION_MISSING' },
      503,
    );
  }
  return cfg.fetchImpl(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: new Headers({
      apikey: cfg.key,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
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

async function failure(upstream: Response, cookies: string[]): Promise<Response> {
  const detail = await upstream.json().catch(() => ({})) as Record<string, unknown>;
  const message = typeof detail.message === 'string' ? detail.message : 'Payment request failed';
  const pgCode = typeof detail.code === 'string' ? detail.code : '';
  const pgDetail = typeof detail.details === 'string' ? detail.details : '';
  if (upstream.status === 401 || upstream.status === 403 || pgCode === '42501') {
    return json({ error: message, code: 'ADMIN_REQUIRED' }, 403, cookies);
  }
  if (pgDetail === 'PAYMENT_PROVIDER_UNAVAILABLE') {
    return json({ error: 'External payment provider is not configured', code: pgDetail }, 409, cookies);
  }
  if (pgDetail === 'REFUND_AMOUNT_EXCEEDED' || message.toLowerCase().includes('exceeds refundable')) {
    return json({ error: message, code: 'REFUND_AMOUNT_EXCEEDED' }, 409, cookies);
  }
  if (upstream.status >= 500) {
    return json({ error: 'Payment service is unavailable', code: 'PAYMENT_UPSTREAM_UNAVAILABLE' }, 502, cookies);
  }
  return json({ error: message, code: pgDetail || 'PAYMENT_VALIDATION_FAILED' }, 400, cookies);
}

function validPaymentSnapshot(data: unknown): data is Record<string, unknown> {
  return !!data && typeof data === 'object' && !Array.isArray(data);
}

export async function handleAdminPaymentState(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;
  const orderId = new URL(request.url).searchParams.get('orderId')?.trim() ?? '';
  if (!orderId) {
    return json({ error: 'orderId is required', code: 'ORDER_ID_REQUIRED' }, 400, auth.responseCookies);
  }
  const upstream = await rpc(
    'get_order_payment_state',
    { p_order_id: orderId },
    auth.accessToken,
    deps,
  );
  if (!upstream.ok) return failure(upstream, auth.responseCookies);
  const data = await upstream.json().catch(() => null);
  if (!validPaymentSnapshot(data)) {
    return json({ error: 'Payment response is invalid', code: 'PAYMENT_RESPONSE_INVALID' }, 502, auth.responseCookies);
  }
  return json({ data }, 200, auth.responseCookies);
}

export async function handleAdminRefund(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  if (!sameOrigin(request)) {
    return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  }
  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;
  const body = await objectBody(request);
  if (body instanceof Response) return body;

  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  const amountSen = typeof body.amountSen === 'number' ? body.amountSen : Number.NaN;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const tenderType = body.tenderType;
  if (!orderId || !idempotencyKey || !Number.isSafeInteger(amountSen) || amountSen <= 0 || !reason) {
    return json({ error: 'Valid orderId, idempotencyKey, amountSen and reason are required', code: 'INVALID_REFUND_REQUEST' }, 400, auth.responseCookies);
  }
  if (tenderType !== 'cash' && tenderType !== 'external') {
    return json({ error: 'Refund tenderType must be cash or external', code: 'INVALID_REFUND_TENDER' }, 400, auth.responseCookies);
  }

  const payload = { orderId, idempotencyKey, amountSen, reason };
  let upstream: Response;
  if (tenderType === 'cash') {
    const terminalCredential = parseCookie(request, TERMINAL_COOKIE);
    if (!terminalCredential) {
      return json(
        { error: 'Activate this terminal before refunding cash', code: 'TERMINAL_ENROLMENT_REQUIRED' },
        403,
        auth.responseCookies,
      );
    }
    upstream = await rpc(
      'refund_cash_order',
      { p_payload: payload, p_terminal_credential: terminalCredential },
      auth.accessToken,
      deps,
    );
  } else {
    upstream = await rpc(
      'request_external_refund',
      { p_payload: payload },
      auth.accessToken,
      deps,
    );
  }

  if (!upstream.ok) return failure(upstream, auth.responseCookies);
  const data = await upstream.json().catch(() => null);
  if (!validPaymentSnapshot(data)) {
    return json({ error: 'Refund response is invalid', code: 'PAYMENT_RESPONSE_INVALID' }, 502, auth.responseCookies);
  }
  return json({ data }, 200, auth.responseCookies);
}
