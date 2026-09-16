import { employeeFetch } from '../../auth/employeeSession';

export type OperationalTerminal = {
  id: string;
  salesPointId: string;
  code: string;
  name: string;
  status: 'pending' | 'active' | 'revoked';
  enrolledAt: string | null;
  revokedAt: string | null;
  lastSeenAt: string | null;
};

export type OperationalSalesPoint = {
  id: string;
  branchId: string;
  code: string;
  name: string;
  isActive: boolean;
  terminals: OperationalTerminal[];
};

export type OperationalBranch = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  addressText: string | null;
  phone: string | null;
  isActive: boolean;
  isDefault: boolean;
  salesPoints: OperationalSalesPoint[];
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid operational location response');
  }
  return value as JsonRecord;
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`Invalid operational location field: ${field}`);
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function terminal(value: unknown): OperationalTerminal {
  const row = record(value);
  const status = string(row.status, 'terminal.status');
  if (status !== 'pending' && status !== 'active' && status !== 'revoked') {
    throw new Error('Invalid terminal status');
  }
  return {
    id: string(row.id, 'terminal.id'),
    salesPointId: string(row.salesPointId, 'terminal.salesPointId'),
    code: string(row.code, 'terminal.code'),
    name: string(row.name, 'terminal.name'),
    status,
    enrolledAt: nullableString(row.enrolledAt),
    revokedAt: nullableString(row.revokedAt),
    lastSeenAt: nullableString(row.lastSeenAt),
  };
}

function salesPoint(value: unknown): OperationalSalesPoint {
  const row = record(value);
  if (!Array.isArray(row.terminals)) {
    throw new Error('Invalid sales point terminal list');
  }
  return {
    id: string(row.id, 'salesPoint.id'),
    branchId: string(row.branchId, 'salesPoint.branchId'),
    code: string(row.code, 'salesPoint.code'),
    name: string(row.name, 'salesPoint.name'),
    isActive: Boolean(row.isActive),
    terminals: row.terminals.map(terminal),
  };
}

function branch(value: unknown): OperationalBranch {
  const row = record(value);
  if (!Array.isArray(row.salesPoints)) {
    throw new Error('Invalid branch sales point list');
  }
  return {
    id: string(row.id, 'branch.id'),
    code: string(row.code, 'branch.code'),
    name: string(row.name, 'branch.name'),
    timezone: string(row.timezone, 'branch.timezone'),
    addressText: nullableString(row.addressText),
    phone: nullableString(row.phone),
    isActive: Boolean(row.isActive),
    isDefault: Boolean(row.isDefault),
    salesPoints: row.salesPoints.map(salesPoint),
  };
}

async function responseBody(res: Response): Promise<JsonRecord> {
  const body = await res.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Backend returned invalid JSON');
  }
  if (!res.ok) {
    const row = body as JsonRecord;
    throw new Error(typeof row.error === 'string' ? row.error : 'Operational request failed');
  }
  return body as JsonRecord;
}

export async function fetchOperationalLocations(): Promise<OperationalBranch[]> {
  const res = await employeeFetch('/api/v1/admin/locations');
  const body = await responseBody(res);
  if (!Array.isArray(body.data)) {
    throw new Error('Operational location directory is invalid');
  }
  return body.data.map(branch);
}

export async function saveOperationalBranch(payload: {
  id?: string;
  code: string;
  name: string;
  timezone?: string;
  addressText?: string | null;
  phone?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
}): Promise<void> {
  const res = await employeeFetch('/api/v1/admin/branches/save', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  await responseBody(res);
}

export async function saveOperationalSalesPoint(payload: {
  id?: string;
  branchId: string;
  code: string;
  name: string;
  isActive?: boolean;
}): Promise<OperationalSalesPoint> {
  const res = await employeeFetch('/api/v1/admin/sales-points/save', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await responseBody(res);
  return salesPoint({ ...record(body.data), terminals: [] });
}

export async function saveOperationalTerminal(payload: {
  id?: string;
  salesPointId: string;
  code: string;
  name: string;
}): Promise<OperationalTerminal> {
  const res = await employeeFetch('/api/v1/admin/terminals/save', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await responseBody(res);
  return terminal(body.data);
}

export async function issueTerminalEnrolmentCode(
  terminalId: string,
): Promise<{ terminalId: string; code: string; expiresAt: string }> {
  const res = await employeeFetch('/api/v1/admin/terminals/enrolment-code', {
    method: 'POST',
    body: JSON.stringify({ terminalId }),
  });
  const body = await responseBody(res);
  const row = record(body.data);
  return {
    terminalId: string(row.terminalId, 'enrolment.terminalId'),
    code: string(row.code, 'enrolment.code'),
    expiresAt: string(row.expiresAt, 'enrolment.expiresAt'),
  };
}

export async function revokeOperationalTerminal(
  terminalId: string,
): Promise<OperationalTerminal> {
  const res = await employeeFetch('/api/v1/admin/terminals/revoke', {
    method: 'POST',
    body: JSON.stringify({ terminalId }),
  });
  const body = await responseBody(res);
  return terminal(body.data);
}


export type AdminEmployee = {
  userId: string;
  email: string;
  displayName: string | null;
  appRole: 'staff' | 'admin' | 'owner';
  disabledAt: string | null;
  branchIds: string[];
};

function adminEmployee(value: unknown): AdminEmployee {
  const row = record(value);
  const appRole = string(row.appRole, 'employee.appRole');
  if (appRole !== 'staff' && appRole !== 'admin' && appRole !== 'owner') {
    throw new Error('Invalid employee role');
  }
  if (!Array.isArray(row.branchIds)) {
    throw new Error('Invalid employee branch assignments');
  }
  return {
    userId: string(row.userId, 'employee.userId'),
    email: string(row.email, 'employee.email'),
    displayName: nullableString(row.displayName),
    appRole,
    disabledAt: nullableString(row.disabledAt),
    branchIds: row.branchIds.map((value) => string(value, 'employee.branchId')),
  };
}

export async function fetchAdminEmployees(): Promise<AdminEmployee[]> {
  const res = await employeeFetch('/api/v1/admin/employees');
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const row = body && typeof body === 'object' && !Array.isArray(body)
      ? body as JsonRecord
      : {};
    throw new Error(typeof row.error === 'string' ? row.error : 'Employee directory request failed');
  }
  if (!Array.isArray(body)) {
    throw new Error('Employee directory is invalid');
  }
  return body.map(adminEmployee);
}

export async function saveEmployeeBranchAssignments(
  userId: string,
  branchIds: string[],
): Promise<string[]> {
  const res = await employeeFetch('/api/v1/admin/employees/branches', {
    method: 'POST',
    body: JSON.stringify({ userId, branchIds }),
  });
  const body = await responseBody(res);
  if (!Array.isArray(body.branchIds)) {
    throw new Error('Employee branch assignment response is invalid');
  }
  return body.branchIds.map((value) => string(value, 'employee.branchId'));
}
