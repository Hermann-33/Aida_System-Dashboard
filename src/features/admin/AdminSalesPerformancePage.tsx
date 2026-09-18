import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PREVIEW_MENU, PREVIEW_TRANSACTIONS } from '../../preview/fixtures/catalog';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import { MetricCard } from '../../shared/components/MetricCard';
import { formatRmFromSen } from '../../shared/formatting/money';
import { loadReportingSummary, type ReportingSummary } from '../reporting/reportingClient';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

type Tab = 'overview' | 'products' | 'payments' | 'voids' | 'staff' | 'branch';

function dateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previewSummary() {
  const completed = PREVIEW_TRANSACTIONS.filter((row) => row.status === 'Completed');
  const acceptedOrderValueSen = completed.reduce((sum, row) => sum + row.totalSen, 0);
  const discountSen = completed.reduce((sum, row) => sum + row.discountSen, 0);
  return {
    acceptedOrderValueSen,
    acceptedOrderCount: completed.length,
    averageAcceptedOrderValueSen: completed.length ? Math.floor(acceptedOrderValueSen / completed.length) : 0,
    discountSen,
    voucherDiscountSen: discountSen,
    promotionDiscountSen: 0,
    paidPosCashSen: completed.filter((row) => row.method === 'Cash').reduce((sum, row) => sum + row.totalSen, 0),
    unpaidAcceptedOrderValueSen: 0,
    cancelledOrderCount: PREVIEW_TRANSACTIONS.filter((row) => row.status !== 'Completed').length,
  };
}

export function AdminSalesPerformancePage() {
  const preview = isUiPreviewMode();
  const today = useMemo(() => dateString(new Date()), []);
  const [tab, setTab] = useState<Tab>('overview');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState<ReportingSummary | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState<string | null>(null);
  const sample = useMemo(previewSummary, []);

  useEffect(() => {
    if (preview) return;
    let active = true;
    setLoading(true);
    setError(null);
    loadReportingSummary({ fromDate: from, toDate: to })
      .then((data) => { if (active) setSummary(data); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Sales report failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [preview, from, to]);

  const metrics = preview ? sample : summary ? {
    acceptedOrderValueSen: summary.orders.acceptedOrderValueSen,
    acceptedOrderCount: summary.orders.acceptedOrderCount,
    averageAcceptedOrderValueSen: summary.orders.averageAcceptedOrderValueSen,
    discountSen: summary.orders.discountSen,
    voucherDiscountSen: summary.orders.voucherDiscountSen,
    promotionDiscountSen: summary.orders.promotionDiscountSen,
    paidPosCashSen: summary.orders.paidPosCashSen,
    unpaidAcceptedOrderValueSen: summary.orders.unpaidAcceptedOrderValueSen,
    cancelledOrderCount: summary.orders.cancelledOrderCount,
  } : null;

  const paymentMetrics = preview ? {
    capturedOrderCount: sample.acceptedOrderCount,
    grossCapturedSen: sample.acceptedOrderValueSen,
    cashCapturedSen: sample.paidPosCashSen,
    externalCapturedSen: Math.max(0, sample.acceptedOrderValueSen - sample.paidPosCashSen),
    pendingExternalSen: 0,
    succeededRefundSen: 0,
    cashRefundedSen: 0,
    externalRefundedSen: 0,
    netCapturedAfterRefundSen: sample.acceptedOrderValueSen,
    refundReconciled: true,
    externalSettlement: { settledSen: 0, pendingSen: 0, failedSen: 0, notReportedSen: 0 },
  } : summary?.payments ?? null;

  const productRows = preview
    ? PREVIEW_MENU.slice(0, 6).map((item, index) => ({
        itemId: item.id,
        sku: item.sku,
        name: item.name,
        quantity: 6 - index,
        lineValueSen: item.priceSen * (6 - index),
      }))
    : summary?.byProduct ?? [];

  return (
    <AdminPageShell
      pageId="admin-sales-performance"
      title="Sales & Performance"
      hint={preview
        ? 'UI preview sample reporting — not production authority.'
        : 'Accepted order value, payment capture and refunds are separate source-backed facts. Statutory accounting remains outside this report.'}
    >
      <div className="admin-filters">
        <label>
          From
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>

      {loading && <p className="form-hint">Loading authoritative sales reporting…</p>}
      {error && <div className="form-error" role="alert">{error}</div>}

      {!loading && !error && metrics && (
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">By product</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="voids">Voids &amp; refunds</TabsTrigger>
            <TabsTrigger value="staff">By staff</TabsTrigger>
            <TabsTrigger value="branch">By branch</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="metric-grid">
              <MetricCard label="Accepted order value" value={formatRmFromSen(metrics.acceptedOrderValueSen)} hint="Cancelled orders excluded; not settlement" />
              <MetricCard label="Accepted orders" value={String(metrics.acceptedOrderCount)} />
              <MetricCard label="Average accepted value" value={formatRmFromSen(metrics.averageAcceptedOrderValueSen)} />
              <MetricCard label="Total discount" value={formatRmFromSen(metrics.discountSen)} hint={`Voucher ${formatRmFromSen(metrics.voucherDiscountSen)} · Promotion ${formatRmFromSen(metrics.promotionDiscountSen)}`} />
            </div>
            {!preview && summary && (
              <section className="admin-section">
                <h2 className="admin-section-title">Sales point attribution</h2>
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
            )}
          </TabsContent>

          <TabsContent value="products">
            {productRows.length === 0 ? <p className="form-hint">No accepted product lines in this range.</p> : (
              <table className="data-table admin-table">
                <thead><tr><th>Product</th><th>SKU</th><th>Quantity</th><th>Accepted line value</th></tr></thead>
                <tbody>
                  {productRows.map((row) => (
                    <tr key={row.itemId}>
                      <td>{row.name}</td><td>{row.sku}</td><td>{row.quantity}</td><td>{formatRmFromSen(row.lineValueSen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>

          <TabsContent value="payments">
            {paymentMetrics && (
              <>
                <div className="metric-grid">
                  <MetricCard label="Gross captured" value={formatRmFromSen(paymentMetrics.grossCapturedSen)} hint="Capture/paid fact, not settlement" />
                  <MetricCard label="Cash captured" value={formatRmFromSen(paymentMetrics.cashCapturedSen)} />
                  <MetricCard label="External captured" value={formatRmFromSen(paymentMetrics.externalCapturedSen)} />
                  <MetricCard label="Pending external" value={formatRmFromSen(paymentMetrics.pendingExternalSen)} hint="Not captured or settled" />
                  <MetricCard label="Net captured after refunds" value={formatRmFromSen(paymentMetrics.netCapturedAfterRefundSen)} />
                  <MetricCard label="Unpaid accepted value" value={formatRmFromSen(metrics.unpaidAcceptedOrderValueSen)} hint="Accepted value without captured payment" />
                </div>
                {!preview && (
                  <section className="admin-section">
                    <h2 className="admin-section-title">External settlement state</h2>
                    <div className="metric-grid">
                      <MetricCard label="Settled" value={formatRmFromSen(paymentMetrics.externalSettlement.settledSen)} />
                      <MetricCard label="Settlement pending" value={formatRmFromSen(paymentMetrics.externalSettlement.pendingSen)} />
                      <MetricCard label="Settlement failed" value={formatRmFromSen(paymentMetrics.externalSettlement.failedSen)} />
                      <MetricCard label="Settlement not reported" value={formatRmFromSen(paymentMetrics.externalSettlement.notReportedSen)} />
                    </div>
                    <p className="form-hint">Capture is not treated as settlement. These buckets reflect only persisted provider settlement-state facts.</p>
                  </section>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="voids">
            <div className="metric-grid">
              <MetricCard label="Cancelled orders" value={String(metrics.cancelledOrderCount)} hint="Excluded from accepted commercial totals" />
              {paymentMetrics && <MetricCard label="Succeeded refunds" value={formatRmFromSen(paymentMetrics.succeededRefundSen)} hint="Compensation against captured/paid value" />}
              {paymentMetrics && <MetricCard label="Cash refunds" value={formatRmFromSen(paymentMetrics.cashRefundedSen)} />}
              {paymentMetrics && <MetricCard label="External refunds" value={formatRmFromSen(paymentMetrics.externalRefundedSen)} />}
            </div>
            {!preview && paymentMetrics && (
              <div className="empty-state">
                <h2 className="admin-section-title">Refund reconciliation</h2>
                <p>{paymentMetrics.refundReconciled ? 'Succeeded refund totals reconcile to protected order refund projections.' : 'Refund reconciliation mismatch detected; investigate before relying on net payment figures.'}</p>
                <p>Accepted order value remains immutable and is not reduced by refund reporting.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="staff">
            <div className="empty-state">
              <h2 className="admin-section-title">Staff aggregate not projected by this report</h2>
              <p>Order transaction detail retains trusted creator attribution where available. Phase 8 does not manufacture a staff leaderboard from incomplete attribution.</p>
            </div>
          </TabsContent>

          <TabsContent value="branch">
            {preview ? (
              <div className="empty-state"><p>Branch comparison is sample-only in UI preview mode.</p></div>
            ) : summary && summary.byBranch.length > 0 ? (
              <table className="data-table admin-table">
                <thead><tr><th>Branch</th><th>Orders</th><th>Subtotal</th><th>Voucher</th><th>Promotion</th><th>Accepted value</th></tr></thead>
                <tbody>
                  {summary.byBranch.map((row) => (
                    <tr key={row.branchId}>
                      <td>{row.branchName} ({row.branchCode})</td>
                      <td>{row.orderCount}</td>
                      <td>{formatRmFromSen(row.subtotalSen)}</td>
                      <td>{formatRmFromSen(row.voucherDiscountSen)}</td>
                      <td>{formatRmFromSen(row.promotionDiscountSen)}</td>
                      <td>{formatRmFromSen(row.acceptedOrderValueSen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="form-hint">No branch-level accepted orders in this range.</p>}
          </TabsContent>
        </Tabs>
      )}
    </AdminPageShell>
  );
}
