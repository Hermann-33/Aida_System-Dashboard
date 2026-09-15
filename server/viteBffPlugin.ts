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
import {
  handleAdminSaveOrderingPolicy,
  handleEmployeeOrder,
  handleEmployeeOrders,
  handleEmployeePlaceOrder,
  handleEmployeeQuoteOrder,
  handleEmployeeTransitionOrder,
  handleOrderingPolicy,
} from './orderBff.js';
import {
  handleAdminBranches,
  handleAdminEmployees,
  handleAdminSaveBranch,
  handleAdminSaveEmployeeBranches,
  handlePublicBranches,
} from './locationBff.js';
import {
  handleAdminDeletePickupException,
  handleAdminPickupConfiguration,
  handleAdminSavePickupConfiguration,
  handleAdminSavePickupException,
} from './pickupBff.js';
import {
  handleAdminIssueTerminalCode,
  handleAdminOperationalLocations,
  handleAdminRevokeTerminal,
  handleAdminSaveSalesPoint,
  handleAdminSaveTerminal,
  handleTerminalClearCredential,
  handleTerminalEnrol,
  handleTerminalStatus,
} from './terminalBff.js';
import {
  handleAdminShifts,
  handleCashMovement,
  handleCloseShift,
  handleCurrentShift,
  handleLockShift,
  handleOpenShift,
  handleResumeShift,
  handleShiftReconciliation,
} from './shiftBff.js';
import {
  handleAdminAdjustMemberLoyalty,
  handleAdminLoyaltyState,
  handleAdminMemberLoyalty,
  handleAdminSaveLoyaltyProgram,
  handleAdminSaveLoyaltyReward,
} from './loyaltyBff.js';
import {
  handleAdminPromotions,
  handleAdminSavePromotion,
} from './promotionBff.js';
import { handlePosMemberLoyalty } from './posLoyaltyBff.js';

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
  ['/api/v1/orders/policy', handleOrderingPolicy],
  ['/api/v1/orders', handleEmployeeOrders],
  ['/api/v1/orders/detail', handleEmployeeOrder],
  ['/api/v1/orders/quote', handleEmployeeQuoteOrder],
  ['/api/v1/orders/place', handleEmployeePlaceOrder],
  ['/api/v1/orders/status', handleEmployeeTransitionOrder],
  ['/api/v1/admin/orders/policy', handleAdminSaveOrderingPolicy],
  ['/api/v1/branches', handlePublicBranches],
  ['/api/v1/admin/branches', handleAdminBranches],
  ['/api/v1/admin/branches/save', handleAdminSaveBranch],
  ['/api/v1/admin/branches/pickup', handleAdminPickupConfiguration],
  ['/api/v1/admin/branches/pickup-save', handleAdminSavePickupConfiguration],
  ['/api/v1/admin/branches/pickup-exception', handleAdminSavePickupException],
  ['/api/v1/admin/branches/pickup-exception-delete', handleAdminDeletePickupException],
  ['/api/v1/admin/employees', handleAdminEmployees],
  ['/api/v1/admin/employees/branches', handleAdminSaveEmployeeBranches],
  ['/api/v1/terminals/status', handleTerminalStatus],
  ['/api/v1/terminals/enrol', handleTerminalEnrol],
  ['/api/v1/terminals/clear-credential', handleTerminalClearCredential],
  ['/api/v1/shifts/current', handleCurrentShift],
  ['/api/v1/shifts/open', handleOpenShift],
  ['/api/v1/shifts/lock', handleLockShift],
  ['/api/v1/shifts/resume', handleResumeShift],
  ['/api/v1/shifts/cash-movement', handleCashMovement],
  ['/api/v1/shifts/reconciliation', handleShiftReconciliation],
  ['/api/v1/shifts/close', handleCloseShift],
  ['/api/v1/admin/shifts', handleAdminShifts],
  ['/api/v1/admin/locations', handleAdminOperationalLocations],
  ['/api/v1/admin/sales-points/save', handleAdminSaveSalesPoint],
  ['/api/v1/admin/terminals/save', handleAdminSaveTerminal],
  ['/api/v1/admin/terminals/enrolment-code', handleAdminIssueTerminalCode],
  ['/api/v1/admin/terminals/revoke', handleAdminRevokeTerminal],
  ['/api/v1/admin/loyalty', handleAdminLoyaltyState],
  ['/api/v1/admin/loyalty/program', handleAdminSaveLoyaltyProgram],
  ['/api/v1/admin/loyalty/reward', handleAdminSaveLoyaltyReward],
  ['/api/v1/admin/loyalty/member', handleAdminMemberLoyalty],
  ['/api/v1/admin/loyalty/adjust', handleAdminAdjustMemberLoyalty],
  ['/api/v1/admin/promotions', handleAdminPromotions],
  ['/api/v1/admin/promotions/save', handleAdminSavePromotion],
  ['/api/v1/pos/member-loyalty', handlePosMemberLoyalty],
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
 * Serves employee/admin, catalogue, ordering, terminal, shift, pickup, loyalty
 * and promotion BFF handlers during Vite dev/preview. Production serverless
 * deployments use the same root `/api` handlers.
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
