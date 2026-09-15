import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAuditReport, loadReportingSummary, loadTransactionReport } from './reportingClient';

afterEach(() => vi.unstubAllGlobals());

function response(data: unknown, ok = true) {
  return Promise.resolve(new Response(JSON.stringify(ok ? { data } : { error: 'denied' }), { status: ok ? 200 : 403, headers: { 'Content-Type': 'application/json' } }));
}

describe('Phase 8 reporting client', () => {
  it('loads summary through the same-origin BFF with bounded filter intent', async () => {
    const fetchMock = vi.fn(() => response({ filter: { fromDate: '2026-09-16', toDate: '2026-09-16' }, orders: {} }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await loadReportingSummary({ fromDate: '2026-09-16', toDate: '2026-09-16', branchId: 'branch-1' });
    expect(result.filter).toBeTruthy();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/admin/reporting/summary?');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('branchId=branch-1');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include', cache: 'no-store' });
  });

  it('fails closed on malformed transaction pagination', async () => {
    vi.stubGlobal('fetch', vi.fn(() => response({ filter: {}, totalCount: '1', items: [] })));
    await expect(loadTransactionReport({ fromDate: '2026-09-16', toDate: '2026-09-16' })).rejects.toThrow('Invalid transaction report totalCount');
  });

  it('requires declared audit coverage and item pagination', async () => {
    vi.stubGlobal('fetch', vi.fn(() => response({ filter: {}, totalCount: 0, items: [] })));
    await expect(loadAuditReport({ fromDate: '2026-09-16', toDate: '2026-09-16' })).rejects.toThrow('Invalid audit report coverage');
  });
});
