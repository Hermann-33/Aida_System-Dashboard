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
        : 'Operational order-value reporting. Processor settlement, refunds and statutory accounting are outside Phase 8.'}
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
            <div className="metric-grid">
              <MetricCard label="Paid POS cash" value={formatRmFromSen(metrics.paidPosCashSen)} hint="Trusted paid cash fact" />
              <MetricCard label="Unpaid accepted value" value={formatRmFromSen(metrics.unpaidAcceptedOrderValueSen)} hint="Not treated as processor settlement" />
            </div>
            <div className="empty-state">
              <h2 className="admin-section-title">Processor payment reporting is not available yet</h2>
              <p>Card/e-wallet authorization, capture, settlement and provider reconciliation belong to Phase 9. Phase 8 does not infer those states.</p>
            </div>
          </TabsContent>

          <TabsContent value="voids">
            <div className="metric-grid">
              <MetricCard label="Cancelled orders" value={String(metrics.cancelledOrderCount)} hint="Excluded from accepted commercial totals" />
            </div>
            <div className="empty-state">
              <h2 className="admin-section-title">Refund facts are unavailable in Phase 8</h2>
              <p>Refund amounts and processor refund states will appear only after Phase 9 establishes trusted refund authority. No sample refund values are shown as production facts.</p>
            </div>
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
