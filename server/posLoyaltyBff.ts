import { handleEmployeeSession, type EmployeeBffDependencies } from './employeeBff.js';

type SessionBody = { data?: { employee?: { role?: 'staff' | 'admin' } } };
const ACCESS_COOKIE = 'aida_employee_access';
const TERMINAL_COOKIE = 'aida_terminal_credential';

function json(body: unknown, status = 200, cookies: string[] = []): Response {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
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
  return bag.getSetCookie?.() ?? (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')!] : []);
}

function accessFromCookies(cookies: string[]): string | null {
  for (const cookie of cookies) {
    const match = cookie.match(/(?:^|[, ]+)aida_employee_access=([^;,]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

export async function handlePosMemberLoyalty(request: Request, deps: EmployeeBffDependencies = {}): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);

  const sessionRequest = new Request(new URL('/api/v1/auth/employee/session', request.url), { method: 'GET', headers: request.headers });
  const sessionResponse = await handleEmployeeSession(sessionRequest, deps);
  if (!sessionResponse.ok) return sessionResponse;
  const session = await sessionResponse.clone().json().catch(() => ({})) as SessionBody;
  if (session.data?.employee?.role !== 'staff' && session.data?.employee?.role !== 'admin') {
    return json({ error: 'Employee access required', code: 'EMPLOYEE_REQUIRED' }, 403, responseCookies(sessionResponse));
  }

  const cookies = responseCookies(sessionResponse);
  const accessToken = accessFromCookies(cookies) ?? parseCookie(request, ACCESS_COOKIE);
  const terminalCredential = parseCookie(request, TERMINAL_COOKIE);
  const memberCode = new URL(request.url).searchParams.get('memberCode')?.trim();
  if (!accessToken) return json({ error: 'Employee session required', code: 'EMPLOYEE_SESSION_REQUIRED' }, 401, cookies);
  if (!terminalCredential) return json({ error: 'Activate this terminal before member lookup', code: 'TERMINAL_ENROLMENT_REQUIRED' }, 403, cookies);
  if (!memberCode) return json({ error: 'memberCode is required', code: 'MEMBER_CODE_REQUIRED' }, 400, cookies);

  const env = deps.env ?? process.env;
  const url = env.AIDA_SUPABASE_URL?.replace(/\/$/, '');
  const key = env.AIDA_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return json({ error: 'Backend configuration is unavailable', code: 'BACKEND_CONFIGURATION_MISSING' }, 503, cookies);

  const fetchImpl = deps.fetchImpl ?? fetch;
  const upstream = await fetchImpl(`${url}/rest/v1/rpc/get_pos_member_loyalty`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_member_code: memberCode, p_terminal_credential: terminalCredential }),
  });
  if (!upstream.ok) {
    const detail = await upstream.json().catch(() => ({})) as Record<string, unknown>;
    const pgCode = typeof detail.code === 'string' ? detail.code : '';
    const code = typeof detail.details === 'string' ? detail.details : 'POS_LOYALTY_LOOKUP_FAILED';
    const message = typeof detail.message === 'string' ? detail.message : 'Member loyalty lookup failed';
    const status = pgCode === '22023' ? 404 : pgCode === '42501' || upstream.status === 401 || upstream.status === 403 ? 403 : 502;
    return json({ error: message, code }, status, cookies);
  }
  const data = await upstream.json().catch(() => null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return json({ error: 'Member loyalty response is invalid', code: 'POS_LOYALTY_RESPONSE_INVALID' }, 502, cookies);
  }
  return json({ data }, 200, cookies);
}
