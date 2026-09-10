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
const TERMINAL_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

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

function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwarded) return forwarded === 'https';
  return new URL(request.url).protocol === 'https:';
}

function serializeTerminalCookie(value: string, maxAge: number, secure: boolean): string {
  const parts = [
    `${TERMINAL_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearedTerminalCookie(secure: boolean): string {
  return serializeTerminalCookie('', 0, secure);
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
  accessToken: string,
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

async function upstreamDetail(upstream: Response): Promise<Record<string, unknown>> {
  const body = await upstream.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
}

function postgresCode(detail: Record<string, unknown>): string {
  return typeof detail.code === 'string' ? detail.code : '';
}

function postgresMessage(detail: Record<string, unknown>, fallback: string): string {
  return typeof detail.message === 'string' ? detail.message : fallback;
}

export async function handleTerminalStatus(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const auth = await requireEmployee(request, deps);
  if (auth instanceof Response) return auth;

  const credential = parseCookie(request, TERMINAL_COOKIE);
  if (!credential) {
    return json(
      { data: { enrolled: false, code: 'TERMINAL_UNENROLLED' } },
      200,
      auth.responseCookies,
    );
  }

  const upstream = await rpc(
    'resolve_terminal_credential',
    { p_credential: credential },
    auth.accessToken,
    deps,
  );

  if (!upstream.ok) {
    const detail = await upstreamDetail(upstream);
    const code = postgresCode(detail);
    if (upstream.status === 401 || upstream.status === 403 || code === '42501') {
      return json(
        { data: { enrolled: false, code: 'TERMINAL_CREDENTIAL_INVALID' } },
        200,
        [...auth.responseCookies, clearedTerminalCookie(isSecureRequest(request))],
      );
    }
    return json(
      { error: 'Terminal status is unavailable', code: 'TERMINAL_STATUS_UNAVAILABLE' },
      502,
      auth.responseCookies,
    );
  }

  const location = await upstream.json().catch(() => null);
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return json(
      { error: 'Terminal status returned invalid data', code: 'TERMINAL_STATUS_INVALID' },
      502,
      auth.responseCookies,
    );
  }

  return json(
    { data: { enrolled: true, location } },
    200,
    auth.responseCookies,
  );
}

export async function handleTerminalEnrol(
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(
      { error: 'Request body must be a JSON object', code: 'INVALID_JSON' },
      400,
      auth.responseCookies,
    );
  }

  const code = typeof (body as Record<string, unknown>).code === 'string'
    ? String((body as Record<string, unknown>).code).trim().toUpperCase()
    : '';
  if (code.length < 8 || code.length > 64) {
    return json(
      { error: 'A valid enrolment code is required', code: 'INVALID_ENROLMENT_CODE' },
      400,
      auth.responseCookies,
    );
  }

  const upstream = await rpc('enrol_terminal', { p_code: code }, auth.accessToken, deps);
  if (!upstream.ok) {
    const detail = await upstreamDetail(upstream);
    const pgCode = postgresCode(detail);
    const message = postgresMessage(detail, 'Terminal enrolment failed');
    if (upstream.status === 401 || upstream.status === 403 || pgCode === '42501') {
      return json(
        { error: message, code: 'TERMINAL_ENROLMENT_FORBIDDEN' },
        403,
        auth.responseCookies,
      );
    }
    return json(
      { error: message, code: 'TERMINAL_ENROLMENT_INVALID' },
      400,
      auth.responseCookies,
    );
  }

  const enrolled = await upstream.json().catch(() => null) as
    | { credential?: unknown; credentialExpiresAt?: unknown; location?: unknown }
    | null;
  if (
    !enrolled
    || typeof enrolled.credential !== 'string'
    || enrolled.credential.length < 40
    || !enrolled.location
    || typeof enrolled.location !== 'object'
    || Array.isArray(enrolled.location)
  ) {
    return json(
      { error: 'Terminal enrolment returned invalid data', code: 'TERMINAL_ENROLMENT_INVALID' },
      502,
      auth.responseCookies,
    );
  }

  const expiresAt = typeof enrolled.credentialExpiresAt === 'string'
    ? Date.parse(enrolled.credentialExpiresAt)
    : Number.NaN;
  const maxAge = Number.isFinite(expiresAt)
    ? Math.min(
        TERMINAL_MAX_AGE_SECONDS,
        Math.max(1, Math.floor((expiresAt - Date.now()) / 1000)),
      )
    : TERMINAL_MAX_AGE_SECONDS;

  const terminalCookie = serializeTerminalCookie(
    enrolled.credential,
    maxAge,
    isSecureRequest(request),
  );

  return json(
    { data: { enrolled: true, location: enrolled.location } },
    200,
    [...auth.responseCookies, terminalCookie],
  );
}

export async function handleTerminalClearCredential(
  request: Request,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  if (!sameOrigin(request)) {
    return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  }

  return json(
    { data: { cleared: true } },
    200,
    [clearedTerminalCookie(isSecureRequest(request))],
  );
}

async function requireAdminAndBody(
  request: Request,
  deps: EmployeeBffDependencies,
): Promise<
  | { auth: EmployeeSession; body: Record<string, unknown> }
  | Response
> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  if (!sameOrigin(request)) {
    return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  }

  const auth = await requireEmployee(request, deps, true);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(
      { error: 'Request body must be a JSON object', code: 'INVALID_JSON' },
      400,
      auth.responseCookies,
    );
  }
  return { auth, body: body as Record<string, unknown> };
}

async function adminRpcResponse(
  functionName: string,
  args: unknown,
  auth: EmployeeSession,
  deps: EmployeeBffDependencies,
  fallback: string,
): Promise<Response> {
  const upstream = await rpc(functionName, args, auth.accessToken, deps);
  if (!upstream.ok) {
    const detail = await upstreamDetail(upstream);
    const pgCode = postgresCode(detail);
    const message = postgresMessage(detail, fallback);
    if (upstream.status === 401 || upstream.status === 403 || pgCode === '42501') {
      return json({ error: message, code: 'ADMIN_REQUIRED' }, 403, auth.responseCookies);
    }
    if (pgCode === 'P0002') {
      return json({ error: message, code: 'OPERATIONAL_ENTITY_NOT_FOUND' }, 404, auth.responseCookies);
    }
    return json({ error: message, code: 'OPERATIONAL_VALIDATION_FAILED' }, 400, auth.responseCookies);
  }

  const data = await upstream.json().catch(() => null);
  return json({ data }, 200, auth.responseCookies);
}

export async function handleAdminOperationalLocations(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  const auth = await requireEmployee(request, deps, true);
  if (auth instanceof Response) return auth;

  const upstream = await rpc('list_admin_operational_locations', {}, auth.accessToken, deps);
  if (!upstream.ok) {
    return adminRpcResponse(
      'list_admin_operational_locations',
      {},
      auth,
      deps,
      'Operational locations are unavailable',
    );
  }

  const data = await upstream.json().catch(() => null);
  if (!Array.isArray(data)) {
    return json(
      { error: 'Operational locations returned invalid data', code: 'OPERATIONAL_LOCATIONS_INVALID' },
      502,
      auth.responseCookies,
    );
  }
  return json({ data }, 200, auth.responseCookies);
}

export async function handleAdminSaveSalesPoint(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  const prepared = await requireAdminAndBody(request, deps);
  if (prepared instanceof Response) return prepared;
  return adminRpcResponse(
    'save_sales_point',
    { p_payload: prepared.body },
    prepared.auth,
    deps,
    'Sales point update failed',
  );
}

export async function handleAdminSaveTerminal(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  const prepared = await requireAdminAndBody(request, deps);
  if (prepared instanceof Response) return prepared;
  return adminRpcResponse(
    'save_terminal',
    { p_payload: prepared.body },
    prepared.auth,
    deps,
    'Terminal update failed',
  );
}

export async function handleAdminIssueTerminalCode(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  const prepared = await requireAdminAndBody(request, deps);
  if (prepared instanceof Response) return prepared;
  const terminalId = typeof prepared.body.terminalId === 'string'
    ? prepared.body.terminalId.trim()
    : '';
  if (!terminalId) {
    return json(
      { error: 'terminalId is required', code: 'TERMINAL_ID_REQUIRED' },
      400,
      prepared.auth.responseCookies,
    );
  }
  return adminRpcResponse(
    'issue_terminal_enrolment_code',
    { p_terminal_id: terminalId },
    prepared.auth,
    deps,
    'Terminal enrolment code issuance failed',
  );
}

export async function handleAdminRevokeTerminal(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  const prepared = await requireAdminAndBody(request, deps);
  if (prepared instanceof Response) return prepared;
  const terminalId = typeof prepared.body.terminalId === 'string'
    ? prepared.body.terminalId.trim()
    : '';
  if (!terminalId) {
    return json(
      { error: 'terminalId is required', code: 'TERMINAL_ID_REQUIRED' },
      400,
      prepared.auth.responseCookies,
    );
  }
  return adminRpcResponse(
    'revoke_terminal',
    { p_terminal_id: terminalId },
    prepared.auth,
    deps,
    'Terminal revocation failed',
  );
}
