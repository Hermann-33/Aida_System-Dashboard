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

type AdminSession = {
  accessToken: string;
  responseCookies: string[];
};

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

async function requireAdmin(
  request: Request,
  deps: EmployeeBffDependencies,
): Promise<AdminSession | Response> {
  const sessionUrl = new URL('/api/v1/auth/employee/session', request.url);
  const sessionRequest = new Request(sessionUrl, {
    method: 'GET',
    headers: request.headers,
  });
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

async function adminFailure(
  upstream: Response,
  cookies: string[],
  fallback: string,
): Promise<Response> {
  const detail = await upstream.json().catch(() => ({})) as Record<string, unknown>;
  const message = typeof detail.message === 'string' ? detail.message : fallback;
  const postgresCode = typeof detail.code === 'string' ? detail.code : '';

  if (upstream.status === 401 || upstream.status === 403 || postgresCode === '42501') {
    return json({ error: message, code: 'ADMIN_REQUIRED' }, 403, cookies);
  }
  if (postgresCode === 'P0002') {
    return json({ error: message, code: 'BRANCH_NOT_FOUND' }, 404, cookies);
  }
  if (upstream.status >= 500) {
    return json({ error: fallback, code: 'BRANCH_UPSTREAM_UNAVAILABLE' }, 502, cookies);
  }
  return json({ error: message, code: 'BRANCH_VALIDATION_FAILED' }, 400, cookies);
}

export async function handlePublicBranches(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const upstream = await rpc('list_branches', {}, undefined, deps);
  if (!upstream.ok) {
    return json({ error: 'Branch directory is unavailable', code: 'BRANCHES_UNAVAILABLE' }, 502);
  }
  const branches = await upstream.json().catch(() => null);
  if (!Array.isArray(branches)) {
    return json({ error: 'Branch directory response is invalid', code: 'BRANCHES_INVALID' }, 502);
  }
  return json(branches);
}

export async function handleAdminBranches(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;

  const upstream = await rpc('list_admin_branches', {}, auth.accessToken, deps);
  if (!upstream.ok) {
    return adminFailure(upstream, auth.responseCookies, 'Branch directory is unavailable');
  }
  const branches = await upstream.json().catch(() => null);
  if (!Array.isArray(branches)) {
    return json(
      { error: 'Branch directory response is invalid', code: 'BRANCHES_INVALID' },
      502,
      auth.responseCookies,
    );
  }
  return json(branches, 200, auth.responseCookies);
}

export async function handleAdminSaveBranch(
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

  const payload = await readObject(request);
  if (payload instanceof Response) return payload;

  const upstream = await rpc('save_branch', { p_payload: payload }, auth.accessToken, deps);
  if (!upstream.ok) {
    return adminFailure(upstream, auth.responseCookies, 'Branch update failed');
  }
  const branch = await upstream.json().catch(() => null);
  if (!branch || typeof branch !== 'object' || Array.isArray(branch)) {
    return json(
      { error: 'Branch update returned invalid data', code: 'BRANCH_RESPONSE_INVALID' },
      502,
      auth.responseCookies,
    );
  }
  return json({ branch }, 200, auth.responseCookies);
}

export async function handleAdminEmployees(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;

  const upstream = await rpc('list_admin_employees', {}, auth.accessToken, deps);
  if (!upstream.ok) {
    return adminFailure(upstream, auth.responseCookies, 'Employee directory is unavailable');
  }
  const employees = await upstream.json().catch(() => null);
  if (!Array.isArray(employees)) {
    return json(
      { error: 'Employee directory response is invalid', code: 'EMPLOYEES_INVALID' },
      502,
      auth.responseCookies,
    );
  }
  return json(employees, 200, auth.responseCookies);
}

export async function handleAdminSaveEmployeeBranches(
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

  const body = await readObject(request);
  if (body instanceof Response) return body;

  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const branchIds = Array.isArray(body.branchIds)
    ? body.branchIds.filter((value): value is string => typeof value === 'string').map((value) => value.trim())
    : null;

  if (!userId || branchIds === null || branchIds.some((value) => !value)) {
    return json(
      { error: 'userId and branchIds are required', code: 'INVALID_BRANCH_ASSIGNMENT_INPUT' },
      400,
      auth.responseCookies,
    );
  }

  const upstream = await rpc(
    'save_employee_branch_assignments',
    { p_user_id: userId, p_branch_ids: branchIds },
    auth.accessToken,
    deps,
  );
  if (!upstream.ok) {
    return adminFailure(upstream, auth.responseCookies, 'Employee branch update failed');
  }
  const saved = await upstream.json().catch(() => null);
  if (!Array.isArray(saved)) {
    return json(
      { error: 'Employee branch update returned invalid data', code: 'BRANCH_ASSIGNMENT_INVALID' },
      502,
      auth.responseCookies,
    );
  }
  return json({ branchIds: saved }, 200, auth.responseCookies);
}
