export type AppRole = 'customer' | 'staff' | 'admin' | 'owner';

export type ServerEmployeeIdentity = {
  id: string;
  username: string;
  role: 'staff' | 'admin';
  fullName: string;
  isGlobalManager: boolean;
  dualRolePosEnabled: boolean;
  selectedProduct: 'pos' | 'admin';
  assignedBranchIds: string[];
  requiresProductSelection: false;
  authMethod: 'password';
};

type ServerEnv = Record<string, string | undefined>;
type FetchLike = typeof fetch;

export type EmployeeBffDependencies = {
  fetchImpl?: FetchLike;
  env?: ServerEnv;
};

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  user?: { id?: string; email?: string | null };
};

type SupabaseUser = {
  id: string;
  email?: string | null;
};

type ProfileRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  app_role: AppRole;
  disabled_at: string | null;
};

type AuthenticatedEmployee = {
  accessToken: string;
  employee: ServerEmployeeIdentity;
  appRole: AppRole;
  cookies: string[];
};

type AdminMemberRow = {
  member_id: string;
  user_id: string;
  member_code: string;
  display_name: string | null;
  email: string;
  member_type: string;
  student_status: string;
  is_active: boolean;
  created_at: string;
};

const ACCESS_COOKIE = 'aida_employee_access';
const REFRESH_COOKIE = 'aida_employee_refresh';
const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

class HttpFailure extends Error {
  readonly status: number;
  readonly code: string;
  readonly clearSession: boolean;

  constructor(status: number, code: string, message: string, clearSession = false) {
    super(message);
    this.status = status;
    this.code = code;
    this.clearSession = clearSession;
  }
}

function getConfig(deps: EmployeeBffDependencies) {
  const env = deps.env ?? process.env;
  const url = env.AIDA_SUPABASE_URL?.replace(/\/$/, '');
  const key = env.AIDA_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new HttpFailure(503, 'BACKEND_CONFIGURATION_MISSING', 'Backend configuration is unavailable');
  }
  return { url, key, fetchImpl: deps.fetchImpl ?? fetch };
}

function json(body: unknown, status = 200, extraHeaders?: ConstructorParameters<typeof Headers>[0]): Response {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(error: unknown, request?: Request): Response {
  if (error instanceof HttpFailure) {
    const response = json({ error: error.message, code: error.code }, error.status);
    if (error.clearSession) {
      appendClearedSessionCookies(response.headers, request ? isSecureRequest(request) : true);
    }
    return response;
  }
  return json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
}

function parseCookies(request: Request): Map<string, string> {
  const cookies = new Map<string, string>();
  const raw = request.headers.get('cookie');
  if (!raw) return cookies;
  for (const pair of raw.split(';')) {
    const index = pair.indexOf('=');
    if (index < 0) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (name) cookies.set(name, decodeURIComponent(value));
  }
  return cookies;
}

function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (forwarded) return forwarded === 'https';
  return new URL(request.url).protocol === 'https:';
}

function serializeCookie(name: string, value: string, maxAge: number, secure: boolean): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function sessionCookies(session: SupabaseSession, secure: boolean): string[] {
  return [
    serializeCookie(ACCESS_COOKIE, session.access_token, session.expires_in, secure),
    serializeCookie(REFRESH_COOKIE, session.refresh_token, REFRESH_COOKIE_MAX_AGE_SECONDS, secure),
  ];
}

function appendSessionCookies(headers: Headers, cookies: string[]) {
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
}

function appendClearedSessionCookies(headers: Headers, secure: boolean) {
  headers.append('Set-Cookie', serializeCookie(ACCESS_COOKIE, '', 0, secure));
  headers.append('Set-Cookie', serializeCookie(REFRESH_COOKIE, '', 0, secure));
}

function requireMethod(request: Request, method: 'GET' | 'POST') {
  if (request.method !== method) throw new HttpFailure(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
}

function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) throw new HttpFailure(403, 'ORIGIN_REQUIRED', 'Same-origin request required');
  const requestUrl = new URL(request.url);
  const originUrl = new URL(origin);
  if (requestUrl.host !== originUrl.host || requestUrl.protocol !== originUrl.protocol) {
    throw new HttpFailure(403, 'ORIGIN_FORBIDDEN', 'Cross-origin request rejected');
  }
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid');
    return body as Record<string, unknown>;
  } catch {
    throw new HttpFailure(400, 'INVALID_JSON', 'Request body must be a JSON object');
  }
}

function upstreamHeaders(key: string, accessToken?: string): Headers {
  const headers = new Headers({
    apikey: key,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  headers.set('Authorization', `Bearer ${accessToken ?? key}`);
  return headers;
}

async function parseUpstreamJson(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json().catch(() => ({}));
  return body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
}

function asSession(body: Record<string, unknown>): SupabaseSession | null {
  if (
    typeof body.access_token !== 'string'
    || typeof body.refresh_token !== 'string'
    || typeof body.expires_in !== 'number'
  ) return null;
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_in: body.expires_in,
    token_type: typeof body.token_type === 'string' ? body.token_type : undefined,
    user: body.user && typeof body.user === 'object'
      ? body.user as SupabaseSession['user']
      : undefined,
  };
}

async function signInWithPassword(
  email: string,
  password: string,
  deps: EmployeeBffDependencies,
): Promise<SupabaseSession> {
  const { url, key, fetchImpl } = getConfig(deps);
  const response = await fetchImpl(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: upstreamHeaders(key),
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      throw new HttpFailure(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    }
    throw new HttpFailure(502, 'AUTH_UPSTREAM_UNAVAILABLE', 'Authentication service unavailable');
  }
  const session = asSession(await parseUpstreamJson(response));
  if (!session) {
    throw new HttpFailure(502, 'AUTH_UPSTREAM_INVALID', 'Authentication service returned an invalid session');
  }
  return session;
}

async function refreshSession(
  refreshToken: string,
  deps: EmployeeBffDependencies,
): Promise<SupabaseSession> {
  const { url, key, fetchImpl } = getConfig(deps);
  const response = await fetchImpl(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: upstreamHeaders(key),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) {
    throw new HttpFailure(401, 'EMPLOYEE_SESSION_EXPIRED', 'Employee session expired', true);
  }
  const session = asSession(await parseUpstreamJson(response));
  if (!session) {
    throw new HttpFailure(401, 'EMPLOYEE_SESSION_EXPIRED', 'Employee session expired', true);
  }
  return session;
}

async function fetchAuthUser(
  accessToken: string,
  deps: EmployeeBffDependencies,
): Promise<SupabaseUser | null> {
  const { url, key, fetchImpl } = getConfig(deps);
  const response = await fetchImpl(`${url}/auth/v1/user`, {
    method: 'GET',
    headers: upstreamHeaders(key, accessToken),
  });
  if (!response.ok) return null;
  const body = await parseUpstreamJson(response);
  if (typeof body.id !== 'string') return null;
  return { id: body.id, email: typeof body.email === 'string' ? body.email : null };
}

async function fetchProfile(
  userId: string,
  accessToken: string,
  deps: EmployeeBffDependencies,
): Promise<ProfileRow> {
  const { url, key, fetchImpl } = getConfig(deps);
  const query = new URLSearchParams({
    select: 'user_id,email,display_name,app_role,disabled_at',
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const response = await fetchImpl(`${url}/rest/v1/user_profiles?${query}`, {
    method: 'GET',
    headers: upstreamHeaders(key, accessToken),
  });
  if (!response.ok) {
    throw new HttpFailure(403, 'EMPLOYEE_ACCESS_FORBIDDEN', 'Employee access denied', true);
  }
  const rows = await response.json().catch(() => []);
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new HttpFailure(403, 'EMPLOYEE_ACCESS_FORBIDDEN', 'Employee access denied', true);
  }
  const raw = rows[0] as Partial<ProfileRow>;
  if (
    typeof raw.user_id !== 'string'
    || typeof raw.email !== 'string'
    || !['customer', 'staff', 'admin', 'owner'].includes(String(raw.app_role))
  ) {
    throw new HttpFailure(403, 'EMPLOYEE_ACCESS_FORBIDDEN', 'Employee access denied', true);
  }
  return raw as ProfileRow;
}

function toEmployee(profile: ProfileRow): ServerEmployeeIdentity {
  if (profile.disabled_at) {
    throw new HttpFailure(403, 'EMPLOYEE_DISABLED', 'Employee account is disabled', true);
  }
  if (profile.app_role === 'customer') {
    throw new HttpFailure(403, 'EMPLOYEE_ACCESS_FORBIDDEN', 'Employee access denied', true);
  }
  const isAdmin = profile.app_role === 'admin' || profile.app_role === 'owner';
  return {
    id: profile.user_id,
    username: profile.email,
    role: isAdmin ? 'admin' : 'staff',
    fullName: profile.display_name?.trim() || profile.email.split('@')[0] || 'Employee',
    isGlobalManager: profile.app_role === 'owner',
    dualRolePosEnabled: false,
    selectedProduct: isAdmin ? 'admin' : 'pos',
    assignedBranchIds: [],
    requiresProductSelection: false,
    authMethod: 'password',
  };
}

async function validateEmployeeAccess(
  accessToken: string,
  deps: EmployeeBffDependencies,
): Promise<{ employee: ServerEmployeeIdentity; appRole: AppRole }> {
  const user = await fetchAuthUser(accessToken, deps);
  if (!user) throw new HttpFailure(401, 'EMPLOYEE_SESSION_EXPIRED', 'Employee session expired', true);
  const profile = await fetchProfile(user.id, accessToken, deps);
  if (user.email && profile.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new HttpFailure(403, 'EMPLOYEE_ACCESS_FORBIDDEN', 'Employee access denied', true);
  }
  return { employee: toEmployee(profile), appRole: profile.app_role };
}

async function revokeSession(accessToken: string, deps: EmployeeBffDependencies): Promise<void> {
  const { url, key, fetchImpl } = getConfig(deps);
  await fetchImpl(`${url}/auth/v1/logout?scope=local`, {
    method: 'POST',
    headers: upstreamHeaders(key, accessToken),
  }).catch(() => undefined);
}

async function authenticateRequest(
  request: Request,
  deps: EmployeeBffDependencies,
): Promise<AuthenticatedEmployee> {
  const cookies = parseCookies(request);
  let accessToken = cookies.get(ACCESS_COOKIE) ?? '';
  const refreshToken = cookies.get(REFRESH_COOKIE) ?? '';
  if (!accessToken && !refreshToken) {
    throw new HttpFailure(401, 'EMPLOYEE_SESSION_REQUIRED', 'Employee session required', true);
  }

  let rotatedCookies: string[] = [];
  let user = accessToken ? await fetchAuthUser(accessToken, deps) : null;
  if (!user) {
    if (!refreshToken) {
      throw new HttpFailure(401, 'EMPLOYEE_SESSION_EXPIRED', 'Employee session expired', true);
    }
    const refreshed = await refreshSession(refreshToken, deps);
    accessToken = refreshed.access_token;
    rotatedCookies = sessionCookies(refreshed, isSecureRequest(request));
    user = await fetchAuthUser(accessToken, deps);
    if (!user) {
      throw new HttpFailure(401, 'EMPLOYEE_SESSION_EXPIRED', 'Employee session expired', true);
    }
  }

  const profile = await fetchProfile(user.id, accessToken, deps);
  if (user.email && profile.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new HttpFailure(403, 'EMPLOYEE_ACCESS_FORBIDDEN', 'Employee access denied', true);
  }
  return {
    accessToken,
    employee: toEmployee(profile),
    appRole: profile.app_role,
    cookies: rotatedCookies,
  };
}

function employeePayload(employee: ServerEmployeeIdentity) {
  return {
    id: employee.id,
    username: employee.username,
    role: employee.role,
    fullName: employee.fullName,
    isGlobalManager: employee.isGlobalManager,
    dualRolePosEnabled: employee.dualRolePosEnabled,
    selectedProduct: employee.selectedProduct,
    assignedBranchIds: employee.assignedBranchIds,
    requiresProductSelection: employee.requiresProductSelection,
    authMethod: employee.authMethod,
  };
}

export async function handleEmployeeLogin(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  try {
    requireMethod(request, 'POST');
    requireSameOrigin(request);
    const body = await readJsonObject(request);
    const email = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !email.includes('@') || !password) {
      throw new HttpFailure(400, 'INVALID_LOGIN_INPUT', 'Email and password are required');
    }

    const session = await signInWithPassword(email, password, deps);
    try {
      const { employee } = await validateEmployeeAccess(session.access_token, deps);
      const response = json({
        data: {
          employee: employeePayload(employee),
          session: { expiresIn: session.expires_in },
        },
      });
      appendSessionCookies(response.headers, sessionCookies(session, isSecureRequest(request)));
      return response;
    } catch (error) {
      await revokeSession(session.access_token, deps);
      throw error;
    }
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function handleEmployeeSession(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  try {
    requireMethod(request, 'GET');
    const auth = await authenticateRequest(request, deps);
    const response = json({ data: { employee: employeePayload(auth.employee) } });
    appendSessionCookies(response.headers, auth.cookies);
    return response;
  } catch (error) {
    return errorResponse(error, request);
  }
}

export async function handleEmployeeLogout(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  try {
    requireMethod(request, 'POST');
    requireSameOrigin(request);
    const cookies = parseCookies(request);
    const accessToken = cookies.get(ACCESS_COOKIE);
    if (accessToken) await revokeSession(accessToken, deps);
    const response = json({ data: { signedOut: true } });
    appendClearedSessionCookies(response.headers, isSecureRequest(request));
    return response;
  } catch (error) {
    const response = errorResponse(error, request);
    appendClearedSessionCookies(response.headers, isSecureRequest(request));
    return response;
  }
}

export async function handleAdminMembers(
  request: Request,
  deps: EmployeeBffDependencies = {},
): Promise<Response> {
  try {
    requireMethod(request, 'GET');
    const auth = await authenticateRequest(request, deps);
    if (auth.appRole !== 'admin' && auth.appRole !== 'owner') {
      throw new HttpFailure(403, 'ADMIN_REQUIRED', 'Administrator access required');
    }

    const { url, key, fetchImpl } = getConfig(deps);
    const upstream = await fetchImpl(`${url}/rest/v1/rpc/list_admin_members`, {
      method: 'POST',
      headers: upstreamHeaders(key, auth.accessToken),
      body: '{}',
    });
    if (!upstream.ok) {
      if (upstream.status === 401 || upstream.status === 403) {
        throw new HttpFailure(403, 'ADMIN_REQUIRED', 'Administrator access required');
      }
      throw new HttpFailure(502, 'MEMBER_DIRECTORY_UNAVAILABLE', 'Member directory is unavailable');
    }
    const rows = await upstream.json().catch(() => []);
    if (!Array.isArray(rows)) {
      throw new HttpFailure(502, 'MEMBER_DIRECTORY_INVALID', 'Member directory returned invalid data');
    }
    const members = rows.map((row) => {
      const item = row as AdminMemberRow;
      return {
        memberId: String(item.member_id),
        userId: String(item.user_id),
        memberCode: String(item.member_code),
        displayName: item.display_name == null ? null : String(item.display_name),
        email: String(item.email),
        memberType: String(item.member_type),
        studentStatus: String(item.student_status),
        isActive: Boolean(item.is_active),
        createdAt: String(item.created_at),
      };
    });
    const response = json({ members });
    appendSessionCookies(response.headers, auth.cookies);
    return response;
  } catch (error) {
    return errorResponse(error, request);
  }
}
