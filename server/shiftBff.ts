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

async function requireEmployee(
  request: Request,
  deps: EmployeeBffDependencies,
  adminOnly = false,
): Promise<EmployeeSession | Response> {
  const sessionRequest = new Request(
    new URL('/api/v1/auth/employee/session', request.url),
    { method: 'GET', headers: request.headers },
  );
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
  auth: EmployeeSession,
  deps: EmployeeBffDependencies,
): Promise<Response> {
  const cfg = config(deps);
  if (!cfg) {
    return json(
      { error: 'Backend configuration is unavailable', code: 'BACKEND_CONFIGURATION_MISSING' },
      503,
      auth.responseCookies,
    );
  }
  return cfg.fetchImpl(`${cfg.url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: upstreamHeaders(cfg.key, auth.accessToken),
    body: JSON.stringify(body),
  });
}

async function upstreamFailure(
  upstream: Response,
  auth: EmployeeSession,
  fallback: string,
): Promise<Response> {
  const detail = await upstream.json().catch(() => ({})) as Record<string, unknown>;
  const pgCode = typeof detail.code === 'string' ? detail.code : '';
  const detailCode = typeof detail.details === 'string' ? detail.details : '';
  const message = typeof detail.message === 'string' ? detail.message : fallback;
  const code = detailCode || 'SHIFT_REQUEST_FAILED';

  if (pgCode === '40001' || pgCode === '23505') {
    return json({ error: message, code }, 409, auth.responseCookies);
  }
  if (pgCode === 'P0002') {
    return json({ error: message, code: detailCode || 'SHIFT_NOT_FOUND' }, 404, auth.responseCookies);
  }
  if (pgCode === '42501' || upstream.status === 401 || upstream.status === 403) {
    const status = detailCode === 'SHIFT_OPEN_REQUIRED' || detailCode === 'SHIFT_LOCKED'
      ? 409
      : 403;
    return json({ error: message, code }, status, auth.responseCookies);
  }
  if (pgCode === '22023') {
    return json({ error: message, code }, 400, auth.responseCookies);
  }
  return json({ error: fallback, code: 'SHIFT_BACKEND_UNAVAILABLE' }, 502, auth.responseCookies);
}

async function requireTerminalCredential(
  request: Request,
  auth: EmployeeSession,
): Promise<string | Response> {
  const credential = parseCookie(request, TERMINAL_COOKIE);
  if (!credential) {
    return json(
      { error: 'Activate this terminal before managing a shift', code: 'TERMINAL_ENROLMENT_REQUIRED' },
      403,
      auth.responseCookies,
    );
  }
  return credential;
}

async function readObject(
  request: Request,
  auth: EmployeeSession,
): Promise<Record<string, unknown> | Response> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(
      { error: 'Request body must be a JSON object', code: 'INVALID_JSON' },
      400,
      auth.responseCookies,
    );
  }
  return body as Record<string, unknown>;
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

export async function handleCurrentShift(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  const auth = await requireEmployee(request, deps);
  if (auth instanceof Response) return auth;
  const credential = await requireTerminalCredential(request, auth);
  if (credential instanceof Response) return credential;

  const upstream = await rpc(
    'get_current_shift',
    { p_terminal_credential: credential },
    auth,
    deps,
  );
  if (!upstream.ok) return upstreamFailure(upstream, auth, 'Current shift is unavailable');
  const data = await upstream.json().catch(() => undefined);
  if (data === undefined) {
    return json({ error: 'Current shift returned invalid data', code: 'SHIFT_RESPONSE_INVALID' }, 502, auth.responseCookies);
  }
  return json({ data }, 200, auth.responseCookies);
}

export async function handleOpenShift(
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
  const credential = await requireTerminalCredential(request, auth);
  if (credential instanceof Response) return credential;
  const body = await readObject(request, auth);
  if (body instanceof Response) return body;
  const openingFloatSen = integer(body.openingFloatSen);
  if (openingFloatSen === null || openingFloatSen < 0) {
    return json({ error: 'openingFloatSen must be a non-negative integer', code: 'SHIFT_OPENING_FLOAT_INVALID' }, 400, auth.responseCookies);
  }
  const upstream = await rpc(
    'open_shift',
    { p_terminal_credential: credential, p_opening_float_sen: openingFloatSen },
    auth,
    deps,
  );
  if (!upstream.ok) return upstreamFailure(upstream, auth, 'Shift could not be opened');
  return json({ data: await upstream.json() }, 200, auth.responseCookies);
}

async function transitionShift(
  request: Request,
  rpcName: 'lock_shift' | 'resume_shift',
  deps: EmployeeBffDependencies,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  if (!sameOrigin(request)) {
    return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  }
  const auth = await requireEmployee(request, deps);
  if (auth instanceof Response) return auth;
  const credential = await requireTerminalCredential(request, auth);
  if (credential instanceof Response) return credential;
  const body = await readObject(request, auth);
  if (body instanceof Response) return body;
  const shiftId = typeof body.shiftId === 'string' ? body.shiftId : '';
  const expectedVersion = integer(body.expectedVersion);
  if (!shiftId || expectedVersion === null || expectedVersion < 1) {
    return json({ error: 'shiftId and expectedVersion are required', code: 'SHIFT_TRANSITION_INVALID' }, 400, auth.responseCookies);
  }
  const upstream = await rpc(
    rpcName,
    {
      p_shift_id: shiftId,
      p_terminal_credential: credential,
      p_expected_version: expectedVersion,
    },
    auth,
    deps,
  );
  if (!upstream.ok) return upstreamFailure(upstream, auth, 'Shift transition failed');
  return json({ data: await upstream.json() }, 200, auth.responseCookies);
}

export function handleLockShift(
  request: Request,
  deps: EmployeeBffDependencies = {},
) {
  return transitionShift(request, 'lock_shift', deps);
}

export function handleResumeShift(
  request: Request,
  deps: EmployeeBffDependencies = {},
) {
  return transitionShift(request, 'resume_shift', deps);
}

export async function handleCashMovement(
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
  const credential = await requireTerminalCredential(request, auth);
  if (credential instanceof Response) return credential;
  const body = await readObject(request, auth);
  if (body instanceof Response) return body;
  const shiftId = typeof body.shiftId === 'string' ? body.shiftId : '';
  const movementType = body.type === 'cash_in' || body.type === 'cash_out' ? body.type : null;
  const amountSen = integer(body.amountSen);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!shiftId || !movementType || amountSen === null || amountSen < 1 || reason.length < 3) {
    return json({ error: 'Valid shift, type, amountSen and reason are required', code: 'CASH_MOVEMENT_INVALID' }, 400, auth.responseCookies);
  }
  const upstream = await rpc(
    'record_cash_movement',
    {
      p_shift_id: shiftId,
      p_terminal_credential: credential,
      p_movement_type: movementType,
      p_amount_sen: amountSen,
      p_reason: reason,
    },
    auth,
    deps,
  );
  if (!upstream.ok) return upstreamFailure(upstream, auth, 'Cash movement failed');
  return json({ data: await upstream.json() }, 200, auth.responseCookies);
}

export async function handleShiftReconciliation(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  const auth = await requireEmployee(request, deps);
  if (auth instanceof Response) return auth;
  const credential = await requireTerminalCredential(request, auth);
  if (credential instanceof Response) return credential;
  const shiftId = new URL(request.url).searchParams.get('shiftId') ?? '';
  if (!shiftId) {
    return json({ error: 'shiftId is required', code: 'SHIFT_ID_REQUIRED' }, 400, auth.responseCookies);
  }
  const upstream = await rpc(
    'get_shift_reconciliation',
    { p_shift_id: shiftId, p_terminal_credential: credential },
    auth,
    deps,
  );
  if (!upstream.ok) return upstreamFailure(upstream, auth, 'Shift reconciliation is unavailable');
  return json({ data: await upstream.json() }, 200, auth.responseCookies);
}

export async function handleCloseShift(
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
  const credential = await requireTerminalCredential(request, auth);
  if (credential instanceof Response) return credential;
  const body = await readObject(request, auth);
  if (body instanceof Response) return body;
  const shiftId = typeof body.shiftId === 'string' ? body.shiftId : '';
  const actualCashSen = integer(body.actualCashSen);
  const expectedVersion = integer(body.expectedVersion);
  const notes = typeof body.notes === 'string' ? body.notes : null;
  const handoverNotes = typeof body.handoverNotes === 'string' ? body.handoverNotes : null;
  if (!shiftId || actualCashSen === null || actualCashSen < 0 || expectedVersion === null || expectedVersion < 1) {
    return json({ error: 'Valid shiftId, actualCashSen and expectedVersion are required', code: 'SHIFT_CLOSE_INVALID' }, 400, auth.responseCookies);
  }
  const upstream = await rpc(
    'close_shift',
    {
      p_shift_id: shiftId,
      p_terminal_credential: credential,
      p_actual_cash_sen: actualCashSen,
      p_notes: notes,
      p_handover_notes: handoverNotes,
      p_expected_version: expectedVersion,
    },
    auth,
    deps,
  );
  if (!upstream.ok) return upstreamFailure(upstream, auth, 'Shift could not be closed');
  return json({ data: await upstream.json() }, 200, auth.responseCookies);
}

export async function handleAdminShifts(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  const auth = await requireEmployee(request, deps, true);
  if (auth instanceof Response) return auth;
  const rawLimit = Number(new URL(request.url).searchParams.get('limit') ?? '100');
  const limit = Number.isSafeInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 250 ? rawLimit : 100;
  const upstream = await rpc('list_admin_shifts', { p_limit: limit }, auth, deps);
  if (!upstream.ok) return upstreamFailure(upstream, auth, 'Shift history is unavailable');
  const data = await upstream.json().catch(() => null);
  if (!Array.isArray(data)) {
    return json({ error: 'Shift history returned invalid data', code: 'SHIFT_RESPONSE_INVALID' }, 502, auth.responseCookies);
  }
  return json({ data }, 200, auth.responseCookies);
}
