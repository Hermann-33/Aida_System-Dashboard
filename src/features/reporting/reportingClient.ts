export type ReportFilter = {
  fromDate: string;
  toDate: string;
  branchId?: string;
  salesPointId?: string;
  pageSize?: number;
  offset?: number;
};

export type ReportingSummary = Record<string, unknown> & { filter: Record<string, unknown> };
export type TransactionReport = Record<string, unknown> & { filter: Record<string, unknown>; totalCount: number; items: unknown[] };
export type AuditReport = Record<string, unknown> & { filter: Record<string, unknown>; totalCount: number; items: unknown[]; coverage: Record<string, unknown> };

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as JsonRecord;
}

function safeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${label}`);
  return value;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function parseSummary(value: unknown): ReportingSummary {
  const row = record(value, 'reporting summary');
  return { ...row, filter: record(row.filter, 'reporting summary filter') };
}

function parseTransactionReport(value: unknown): TransactionReport {
  const row = record(value, 'transaction report');
  return {
    ...row,
    filter: record(row.filter, 'transaction report filter'),
    totalCount: safeInteger(row.totalCount, 'transaction report totalCount'),
    items: array(row.items, 'transaction report items'),
  };
}

function parseAuditReport(value: unknown): AuditReport {
  const row = record(value, 'audit report');
  return {
    ...row,
    filter: record(row.filter, 'audit report filter'),
    totalCount: safeInteger(row.totalCount, 'audit report totalCount'),
    items: array(row.items, 'audit report items'),
    coverage: record(row.coverage, 'audit report coverage'),
  };
}

function query(filter: ReportFilter): string {
  const params = new URLSearchParams({ fromDate: filter.fromDate, toDate: filter.toDate });
  if (filter.branchId) params.set('branchId', filter.branchId);
  if (filter.salesPointId) params.set('salesPointId', filter.salesPointId);
  if (filter.pageSize !== undefined) params.set('pageSize', String(filter.pageSize));
  if (filter.offset !== undefined) params.set('offset', String(filter.offset));
  return params.toString();
}

async function request<T>(path: string, filter: ReportFilter, parser: (value: unknown) => T): Promise<T> {
  const response = await fetch(`${path}?${query(filter)}`, { credentials: 'include', cache: 'no-store' });
  const body = await response.json().catch(() => ({})) as { data?: unknown; error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  if (body.data === undefined) throw new Error('Backend response is missing data');
  return parser(body.data);
}

export function loadReportingSummary(filter: ReportFilter): Promise<ReportingSummary> {
  return request('/api/v1/admin/reporting/summary', filter, parseSummary);
}

export function loadTransactionReport(filter: ReportFilter): Promise<TransactionReport> {
  return request('/api/v1/admin/reporting/transactions', filter, parseTransactionReport);
}

export function loadAuditReport(filter: ReportFilter): Promise<AuditReport> {
  return request('/api/v1/admin/reporting/audit', filter, parseAuditReport);
}
