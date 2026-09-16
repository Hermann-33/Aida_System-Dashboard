import { useEffect, useMemo, useState } from 'react';
import { Banknote, Receipt, ShoppingBag, Tag } from 'lucide-react';
import { PREVIEW_TRANSACTIONS } from '../../preview/fixtures/catalog';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import { MetricCard } from '../../shared/components/MetricCard';
import { formatRmFromSen } from '../../shared/formatting/money';
import { loadReportingSummary, type ReportingSummary } from '../reporting/reportingClient';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

type Period = 'today' | 'week' | 'month';

function dateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rangeFor(period: Period): { fromDate: string; toDate: string } {
  const to = new Date();
  const from = new Date(to);
  if (period === 'week') from.setDate(from.getDate() - 6);
  if (period === 'month') from.setDate(from.getDate() - 29);
  return { fromDate: dateString(from), toDate: dateString(to) };
}

function previewMetrics() {
  const completed = PREVIEW_TRANSACTIONS.filter((row) => row.status === 'Completed');
  const acceptedOrderValueSen = completed.reduce((sum, row) => sum + row.totalSen, 0);
  const discountSen = completed.reduce((sum, row) => sum + row.discountSen, 0);
  return {
    acceptedOrderValueSen,
    acceptedOrderCount: completed.length,
    averageAcceptedOrderValueSen: completed.length ? Math.floor(acceptedOrderValueSen / completed.length) : 0,
    paidPosCashSen: completed.filter((row) => row.method === 'Cash').reduce((sum, row) => sum + row.totalSen, 0),
    voucherDiscountSen: discountSen,
    promotionDiscountSen: 0,
    discountSen,
    unpaidAcceptedOrderValueSen: 0,
    cancelledOrderCount: PREVIEW_TRANSACTIONS.filter((row) => row.status !== 'Completed').length,
    cashVarianceSen: 0,
    openOrLockedShiftCount: 1,
  };
}

export function AdminOverviewPage() {
  const preview = isUiPreviewMode();
  const [period, setPeriod] = useState<Period>('today');
  const [summary, setSummary] = useState<ReportingSummary | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState<string | null>(null);
  const range = useMemo(() => rangeFor(period), [period]);

  useEffect(() => {
    if (preview) return;
    let active = true;
    setLoading(true);
    setError(null);
    loadReportingSummary(range)
      .then((data) => { if (active) setSummary(data); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Reporting summary failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [preview, range]);

  const sample = useMemo(previewMetrics, []);
  const metrics = preview ? sample : summary ? {
    acceptedOrderValueSen: summary.orders.acceptedOrderValueSen,
    acceptedOrderCount: summary.orders.acceptedOrderCount,
    averageAcceptedOrderValueSen: summary.orders.averageAcceptedOrderValueSen,
    paidPosCashSen: summary.orders.paidPosCashSen,
    voucherDiscountSen: summary.orders.voucherDiscountSen,
    promotionDiscountSen: summary.orders.promotionDiscountSen,
    discountSen: summary.orders.discountSen,
    unpaidAcceptedOrderValueSen: summary.orders.unpaidAcceptedOrderValueSen,
    cancelledOrderCount: summary.orders.cancelledOrderCount,
    cashVarianceSen: summary.shifts.cashVarianceSen,
    openOrLockedShiftCount: summary.shifts.openOrLockedShiftCount,
  } : null;

  return (
    <AdminPageShell
      pageId="admin-overview"
      title="Executive dashboard"
      hint={preview
        ? 'UI preview sample metrics — not production authority.'
        : 'Operational reporting from trusted order, shift and cash facts. Accepted value is not processor settlement.'}
      actions={
        <select aria-label="Reporting period" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
      }
    >
      <p className="form-hint">Range: {range.fromDate} to {range.toDate}</p>
      {loading && <p className="form-hint">Loading authoritative reporting summary…</p>}
      {error && <div className="form-error" role="alert">{error}</div>}

      {metrics && (
        <>
          <div className="metric-grid">
            <MetricCard label="Accepted order value" value={formatRmFromSen(metrics.acceptedOrderValueSen)} hint="Cancelled orders excluded; not processor settlement" icon={Receipt} />
            <MetricCard label="Accepted orders" value={String(metrics.acceptedOrderCount)} hint="Orders not in cancelled state" icon={ShoppingBag} />
            <MetricCard label="Average accepted value" value={formatRmFromSen(metrics.averageAcceptedOrderValueSen)} hint="Accepted order value ÷ accepted order count" icon={Tag} />
            <MetricCard label="Paid POS cash" value={formatRmFromSen(metrics.paidPosCashSen)} hint="Persisted POS cash orders with payment_state=paid" icon={Banknote} />
          </div>

          <section className="admin-section">
            <h2 className="admin-section-title">Reconciliation</h2>
            <div className="metric-grid">
              <MetricCard label="Total discount" value={formatRmFromSen(metrics.discountSen)} hint={`Voucher ${formatRmFromSen(metrics.voucherDiscountSen)} · Promotion ${formatRmFromSen(metrics.promotionDiscountSen)}`} />
              <MetricCard label="Unpaid accepted value" value={formatRmFromSen(metrics.unpaidAcceptedOrderValueSen)} hint="Commercial value awaiting a trusted payment fact" />
              <MetricCard label="Cancelled orders" value={String(metrics.cancelledOrderCount)} hint="Excluded from commercial totals" />
              <MetricCard label="Shift cash variance" value={formatRmFromSen(metrics.cashVarianceSen)} hint={`${metrics.openOrLockedShiftCount} open or locked shifts in range`} />
            </div>
          </section>
        </>
      )}

      {!preview && summary && (
        <>
          <section className="admin-section">
            <h2 className="admin-section-title">By branch</h2>
            {summary.byBranch.length === 0 ? <p className="form-hint">No accepted orders in this range.</p> : (
              <table className="data-table admin-table">
                <thead><tr><th>Branch</th><th>Orders</th><th>Accepted value</th><th>Discount</th></tr></thead>
                <tbody>
                  {summary.byBranch.map((row) => (
                    <tr key={row.branchId}>
                      <td>{row.branchName} ({row.branchCode})</td>
                      <td>{row.orderCount}</td>
                      <td>{formatRmFromSen(row.acceptedOrderValueSen)}</td>
                      <td>{formatRmFromSen(row.discountSen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="admin-section">
            <h2 className="admin-section-title">By sales point</h2>
            {summary.bySalesPoint.length === 0 ? <p className="form-hint">No sales-point-attributed orders in this range.</p> : (
              <table className="data-table admin-table">
                <thead><tr><th>Sales point</th><th>Orders</th><th>Accepted value</th></tr></thead>
                <tbody>
                  {summary.bySalesPoint.map((row, index) => (
                    <tr key={row.salesPointId ?? `none-${index}`}>
                      <td>{row.salesPointName ?? 'No POS sales point'}</td>
                      <td>{row.orderCount}</td>
                      <td>{formatRmFromSen(row.acceptedOrderValueSen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </AdminPageShell>
  );
}
