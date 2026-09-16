import { employeeFetch } from '../../auth/employeeSession';

type JsonRecord = Record<string, unknown>;

export type BranchPickupPolicy = {
  asapEnabled: boolean;
  scheduleEnabled: boolean;
  minimumLeadMinutes: number;
  preparationLeadMinutes: number;
  slotIntervalMinutes: number;
  maximumAdvanceDays: number;
  slotCapacityOrders: number | null;
};

export type BranchServiceWindow = {
  id?: string;
  weekday: number;
  isAllDay: boolean;
  opensAt: string | null;
  closesAt: string | null;
  isActive: boolean;
};

export type BranchServiceException = {
  serviceDate: string;
  isClosed: boolean;
  isAllDay: boolean;
  opensAt: string | null;
  closesAt: string | null;
  slotCapacityOrders: number | null;
};

export type BranchPickupConfiguration = {
  branch: {
    id: string;
    code: string;
    name: string;
    timezone: string;
    isActive: boolean;
    isDefault: boolean;
  };
  policy: BranchPickupPolicy;
  windows: BranchServiceWindow[];
  exceptions: BranchServiceException[];
};

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value as JsonRecord;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Invalid ${label}`);
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function nullableInteger(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  return integer(value, label);
}

function parseConfiguration(value: unknown): BranchPickupConfiguration {
  const root = record(value, 'pickup configuration');
  const branch = record(root.branch, 'pickup branch');
  const policy = record(root.policy, 'pickup policy');
  if (!Array.isArray(root.windows) || !Array.isArray(root.exceptions)) {
    throw new Error('Invalid pickup calendar');
  }
  return {
    branch: {
      id: requiredString(branch.id, 'branch.id'),
      code: requiredString(branch.code, 'branch.code'),
      name: requiredString(branch.name, 'branch.name'),
      timezone: requiredString(branch.timezone, 'branch.timezone'),
      isActive: Boolean(branch.isActive),
      isDefault: Boolean(branch.isDefault),
    },
    policy: {
      asapEnabled: Boolean(policy.asapEnabled),
      scheduleEnabled: Boolean(policy.scheduleEnabled),
      minimumLeadMinutes: integer(policy.minimumLeadMinutes, 'policy.minimumLeadMinutes'),
      preparationLeadMinutes: integer(policy.preparationLeadMinutes, 'policy.preparationLeadMinutes'),
      slotIntervalMinutes: integer(policy.slotIntervalMinutes, 'policy.slotIntervalMinutes'),
      maximumAdvanceDays: integer(policy.maximumAdvanceDays, 'policy.maximumAdvanceDays'),
      slotCapacityOrders: nullableInteger(policy.slotCapacityOrders, 'policy.slotCapacityOrders'),
    },
    windows: root.windows.map((value) => {
      const row = record(value, 'service window');
      return {
        id: typeof row.id === 'string' ? row.id : undefined,
        weekday: integer(row.weekday, 'window.weekday'),
        isAllDay: Boolean(row.isAllDay),
        opensAt: nullableString(row.opensAt),
        closesAt: nullableString(row.closesAt),
        isActive: Boolean(row.isActive),
      };
    }),
    exceptions: root.exceptions.map((value) => {
      const row = record(value, 'service exception');
      return {
        serviceDate: requiredString(row.serviceDate, 'exception.serviceDate'),
        isClosed: Boolean(row.isClosed),
        isAllDay: Boolean(row.isAllDay),
        opensAt: nullableString(row.opensAt),
        closesAt: nullableString(row.closesAt),
        slotCapacityOrders: nullableInteger(row.slotCapacityOrders, 'exception.slotCapacityOrders'),
      };
    }),
  };
}

async function responseObject(response: Response): Promise<JsonRecord> {
  const body = await response.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Backend returned invalid JSON');
  }
  const row = body as JsonRecord;
  if (!response.ok) {
    throw new Error(typeof row.error === 'string' ? row.error : 'Pickup configuration request failed');
  }
  return row;
}

export async function fetchBranchPickupConfiguration(branchId: string): Promise<BranchPickupConfiguration> {
  const response = await employeeFetch(`/api/v1/admin/branches/pickup?branchId=${encodeURIComponent(branchId)}`);
  const body = await responseObject(response);
  return parseConfiguration(body.data);
}

export async function saveBranchPickupConfiguration(payload: {
  branchId: string;
  asapEnabled: boolean;
  scheduleEnabled: boolean;
  minimumLeadMinutes: number;
  preparationLeadMinutes: number;
  slotIntervalMinutes: number;
  maximumAdvanceDays: number;
  slotCapacityOrders: number | null;
  windows: BranchServiceWindow[];
}): Promise<BranchPickupConfiguration> {
  const response = await employeeFetch('/api/v1/admin/branches/pickup-save', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await responseObject(response);
  return parseConfiguration(body.data);
}

export async function saveBranchServiceException(payload: {
  branchId: string;
  serviceDate: string;
  isClosed: boolean;
  isAllDay: boolean;
  opensAt: string | null;
  closesAt: string | null;
  slotCapacityOrders: number | null;
}): Promise<BranchPickupConfiguration> {
  const response = await employeeFetch('/api/v1/admin/branches/pickup-exception', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await responseObject(response);
  return parseConfiguration(body.data);
}

export async function deleteBranchServiceException(
  branchId: string,
  serviceDate: string,
): Promise<BranchPickupConfiguration> {
  const response = await employeeFetch('/api/v1/admin/branches/pickup-exception-delete', {
    method: 'POST',
    body: JSON.stringify({ branchId, serviceDate }),
  });
  const body = await responseObject(response);
  return parseConfiguration(body.data);
}
