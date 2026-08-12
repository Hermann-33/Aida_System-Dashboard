import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import {
  handleAdminCatalogue,
  handleAdminSaveCategory,
  handleAdminSaveItem,
  handlePublicCatalogue,
} from './catalogueBff.js';
import {
  handleAdminMembers,
  handleEmployeeLogin,
  handleEmployeeLogout,
  handleEmployeeSession,
  type EmployeeBffDependencies,
} from './employeeBff.js';

type Handler = (
  request: Request,
  deps?: EmployeeBffDependencies,
) => Promise<Response>;

type ConnectServer = ViteDevServer | PreviewServer;

const handlers = new Map<string, Handler>([
  ['/api/v1/auth/employee/login', handleEmployeeLogin],
  ['/api/v1/auth/employee/session', handleEmployeeSession],
  ['/api/v1/auth/employee/logout', handleEmployeeLogout],
  ['/api/v1/admin/members', handleAdminMembers],
  ['/api/v1/catalogue', handlePublicCatalogue],
  ['/api/v1/admin/catalogue', handleAdminCatalogue],
  ['/api/v1/admin/catalogue/category', handleAdminSaveCategory],
  ['/api/v1/admin/catalogue/item', handleAdminSaveItem],
]);

function requestUrl(request: IncomingMessage): string {
  const forwardedProto = request.headers['x-forwarded-proto'];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto?.split(',')[0]?.trim() || 'http';
  const host = request.headers.host || 'localhost';
  return `${protocol}://${host}${request.url || '/'}`;
}

async function readBody(request: IncomingMessage): Promise<string | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined;
}

async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  const body = await readBody(request);
  return new Request(requestUrl(request), {
    method: request.method || 'GET',
    headers,
    body,
  });
}

async function writeWebResponse(response: Response, target: ServerResponse) {
  target.statusCode = response.status;
  const headerBag = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = headerBag.getSetCookie?.() ?? [];
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() !== 'set-cookie') target.setHeader(name, value);
  });
  if (setCookies.length) target.setHeader('Set-Cookie', setCookies);
  const body = Buffer.from(await response.arrayBuffer());
  target.end(body);
}

function mount(server: ConnectServer, env: Record<string, string | undefined>) {
  server.middlewares.use(async (incoming, outgoing, next) => {
    const pathname = new URL(requestUrl(incoming)).pathname;
    const handler = handlers.get(pathname);
    if (!handler) {
      next();
      return;
    }
    try {
      const request = await toWebRequest(incoming);
      const response = await handler(request, { env });
      await writeWebResponse(response, outgoing);
    } catch {
      outgoing.statusCode = 500;
      outgoing.setHeader('Content-Type', 'application/json; charset=utf-8');
      outgoing.setHeader('Cache-Control', 'no-store');
      outgoing.end(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR' }));
    }
  });
}

/**
 * Serves employee/admin and catalogue BFF handlers during Vite dev/preview.
 * Production serverless deployments use the same root `/api` handlers.
 */
export function aidaBffPlugin(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'aida-bff',
    configureServer(server) {
      mount(server, env);
    },
    configurePreviewServer(server) {
      mount(server, env);
    },
  };
}
