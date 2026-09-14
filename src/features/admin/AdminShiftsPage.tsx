import { useEffect, useMemo, useState } from 'react';
import type { ShiftSummary } from '../../auth/types';
import { PREVIEW_SHIFT_ROWS, PREVIEW_VARIANCE_THRESHOLD_SEN } from '../../preview/fixtures/catalog';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import { formatKlDateTime } from '../../shared/formatting/datetime';
import { formatRmFromSen } from '../../shared/formatting/money';
import { fetchAdminShifts } from '../shifts/shiftClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

type ShiftFilter = 'all' | 'open' | 'locked' | 'closed';
type Tab = 'shifts' | 'variance';

type ShiftRow = {
  id: string;
  staff: string;
  terminal: string;
  salesPoint: string;
  status: 'open' | 'locked' | 'closed';
  openedAt: string;
  openingFloatSen: number;
  cashSalesSen: number;
  expectedSen: number | null;
  actualSen: number | null;
  varianceSen: number | null;
};

function compactAuthority(label: string, id: string): string {
  return `${label} ${id.slice(0, 8)}`;
}

function liveRow(shift: ShiftSummary): ShiftRow {
  return {
    id: shift.id,
    staff: compactAuthority('User', shift.operatorUserId),
    terminal: compactAuthority('Terminal', shift.terminalId),
    salesPoint: compactAuthority('Sales point', shift.salesPointId),
    status: shift.status,
    openedAt: shift.openedAt ? formatKlDateTime(shift.openedAt) : '—',
    openingFloatSen: shift.openingFloatSen,
    cashSalesSen: shift.cashSalesSen,
    expectedSen: shift.expectedCashSen,
    actualSen: shift.closingActualCashSen,
    varianceSen: shift.cashVarianceSen,
  };
}

/** Shift/cash history is authoritative in live Admin mode. Preview fixtures are
 * only used when the explicit UI preview mode is active. */
export function AdminShiftsPage() {
  const preview = isUiPreviewMode();
  const [tab, setTab] = useState<Tab>('shifts');
  const [filter, setFilter] = useState<ShiftFilter>('all');
  const [liveShifts, setLiveShifts] = useState<ShiftSummary[]>([]);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchAdminShifts(100)
      .then((rows) => {
        if (!cancelled) setLiveShifts(rows);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLiveShifts([]);
          setError(reason instanceof Error ? reason.message : 'Shift history is unavailable.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview, refreshKey]);

  const allRows = useMemo<ShiftRow[]>(
    () => preview
      ? PREVIEW_SHIFT_ROWS.map((row) => ({ ...row }))
      : liveShifts.map(liveRow),
    [liveShifts, preview],
  );
  const rows = allRows.filter((row) => filter === 'all' || row.status === filter);

  return (
    <AdminPageShell pageId="admin-shifts" title="Shifts" hint="Operational shift list — variance on closed shifts.">
      {!preview && loading && <p className="form-hint">Loading authoritative shift history…</p>}
      {!preview && error && (
        <div className="empty-state" role="alert">
          <h2 className="admin-section-title">Shift history unavailable</h2>
          <p>{error}</p>
          <button type="button" className="menu-tab" onClick={() => setRefreshKey((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}
      {preview && (
        <p className="form-hint">Preview mode — shift and cash rows below are sample data only.</p>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="shifts">Shift list</TabsTrigger>
          <TabsTrigger value="variance">Cash variance</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts">
          <div className="admin-filters">
            {(['all', 'open', 'locked', 'closed'] as ShiftFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`menu-tab ${filter === f ? 'menu-tab--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {!loading && !error && rows.length === 0 ? (
            <div className="empty-state">
              <h2 className="admin-section-title">No shifts for filter</h2>
            </div>
          ) : !error && rows.length > 0 ? (
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Terminal</th>
                  <th>Sales point</th>
                  <th>Status</th>
                  <th>Opened</th>
                  <th>Float</th>
                  <th>Cash sales</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.staff}</td>
                    <td>{row.terminal}</td>
                    <td>{row.salesPoint}</td>
                    <td>
                      <span
                        className={`status-pill status-pill--${row.status === 'open' ? 'ok' : row.status === 'locked' ? 'warn' : 'info'}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{row.openedAt}</td>
                    <td>{formatRmFromSen(row.openingFloatSen)}</td>
                    <td>{formatRmFromSen(row.cashSalesSen)}</td>
                    <td>
                      {row.varianceSen !== null ? (
                        <span className={row.varianceSen < 0 ? 'variance-neg' : 'variance-pos'}>
                          {formatRmFromSen(row.varianceSen)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </TabsContent>

        <TabsContent value="variance">
          <p className="form-hint">
            {preview
              ? `Variance threshold sample: ${formatRmFromSen(PREVIEW_VARIANCE_THRESHOLD_SEN)}`
              : 'Expected cash, actual cash and variance are server-derived. Non-zero variance closure requires Admin/Owner authority.'}
          </p>
          {!loading && !error && allRows.length === 0 ? (
            <div className="empty-state">
              <h2 className="admin-section-title">No shift history</h2>
            </div>
          ) : !error && allRows.length > 0 ? (
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Terminal</th>
                  <th>Sales point</th>
                  <th>Status</th>
                  <th>Float</th>
                  <th>Cash sales</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                {allRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.staff}</td>
                    <td>{row.terminal}</td>
                    <td>{row.salesPoint}</td>
                    <td>{row.status}</td>
                    <td>{formatRmFromSen(row.openingFloatSen)}</td>
                    <td>{formatRmFromSen(row.cashSalesSen)}</td>
                    <td>{row.expectedSen !== null ? formatRmFromSen(row.expectedSen) : '—'}</td>
                    <td>{row.actualSen !== null ? formatRmFromSen(row.actualSen) : '—'}</td>
                    <td>
                      {row.varianceSen !== null ? (
                        <span className={row.varianceSen < 0 ? 'variance-neg' : 'variance-pos'}>
                          {formatRmFromSen(row.varianceSen)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  );
}
