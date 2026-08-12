import {
  handleEmployeeSession,
  type EmployeeBffDependencies,
} from './employeeBff.js';

type SessionIdentity = {
  role?: string;
};

type SessionBody = {
  data?: {
    employee?: SessionIdentity;
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
  const sessionResponse = await handleEmployeeSession(request, deps);
  if (!sessionResponse.ok) return sessionResponse;

  const body = await sessionResponse.clone().json().catch(() => ({})) as SessionBody;
  if (body.data?.employee?.role !== 'admin') {
    return json({ error: 'Administrator access required', code: 'ADMIN_REQUIRED' }, 403);
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
  accessToken: string | undefined,
  deps: EmployeeBffDependencies,
): Promise<Response> {
  const cfg = config(deps);
  if (!cfg) {
    return json({ error: 'Backend configuration is unavailable', code: 'BACKEND_CONFIGURATION_MISSING' }, 503);
  }

  const response = await cfg.fetchImpl(`${cfg.url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: upstreamHeaders(cfg.key, accessToken),
    body: JSON.stringify(body),
  });
  return response;
}

export async function handlePublicCatalogue(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const upstream = await rpc('get_catalogue', {}, undefined, deps);
  if (!upstream.ok) {
    return json({ error: 'Catalogue is unavailable', code: 'CATALOGUE_UNAVAILABLE' }, 502);
  }
  const snapshot = await upstream.json().catch(() => null);
  if (!snapshot || typeof snapshot !== 'object') {
    return json({ error: 'Catalogue response is invalid', code: 'CATALOGUE_INVALID' }, 502);
  }
  return json(snapshot);
}

export async function handleAdminCatalogue(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;

  const upstream = await rpc('get_catalogue', {}, auth.accessToken, deps);
  if (!upstream.ok) {
    if (upstream.status === 401 || upstream.status === 403) {
      return json({ error: 'Administrator access required', code: 'ADMIN_REQUIRED' }, 403, auth.responseCookies);
    }
    return json({ error: 'Catalogue is unavailable', code: 'CATALOGUE_UNAVAILABLE' }, 502, auth.responseCookies);
  }
  const snapshot = await upstream.json().catch(() => null);
  if (!snapshot || typeof snapshot !== 'object') {
    return json({ error: 'Catalogue response is invalid', code: 'CATALOGUE_INVALID' }, 502, auth.responseCookies);
  }
  return json(snapshot, 200, auth.responseCookies);
}

async function handleAdminSave(
  request: Request,
  functionName: 'save_catalogue_category' | 'save_catalogue_item',
  deps: EmployeeBffDependencies,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
  }
  if (!sameOrigin(request)) {
    return json({ error: 'Same-origin request required', code: 'ORIGIN_FORBIDDEN' }, 403);
  }

  const auth = await requireAdmin(request, deps);
  if (auth instanceof Response) return auth;

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json({ error: 'Request body must be a JSON object', code: 'INVALID_JSON' }, 400, auth.responseCookies);
  }

  const upstream = await rpc(functionName, { p_payload: payload }, auth.accessToken, deps);
  if (!upstream.ok) {
    const detail = await upstream.json().catch(() => ({})) as Record<string, unknown>;
    const message = typeof detail.message === 'string' ? detail.message : 'Catalogue update failed';
    const status = upstream.status === 401 || upstream.status === 403 ? 403 : 400;
    return json(
      { error: message, code: status === 403 ? 'ADMIN_REQUIRED' : 'CATALOGUE_VALIDATION_FAILED' },
      status,
      auth.responseCookies,
    );
  }

  const id = await upstream.json().catch(() => null);
  return json({ id }, 200, auth.responseCookies);
}

export function handleAdminSaveCategory(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  return handleAdminSave(request, 'save_catalogue_category', deps);
}

export function handleAdminSaveItem(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  return handleAdminSave(request, 'save_catalogue_item', deps);
}
