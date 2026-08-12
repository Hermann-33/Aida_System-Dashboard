import { useMemo, useState } from 'react';
import {
  FIXTURE_TODAY,
  PREVIEW_MENU,
  PREVIEW_SALES_BY_POINT,
  PREVIEW_SALES_BY_STAFF,
  PREVIEW_SALES_ROWS,
  PREVIEW_TRANSACTIONS,
} from '../../preview/fixtures/catalog';
import { MetricCard } from '../../shared/components/MetricCard';
import { formatRmFromSen } from '../../shared/formatting/money';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

/** Sample product mix — revenue estimated from menu list prices × synthetic qty. */
const PRODUCT_ROWS = PREVIEW_MENU.map((item, i) => ({
  ...item,
  qty: 12 - i,
  revenueSen: item.priceSen * (12 - i),
}));

type Tab = 'overview' | 'products' | 'payments' | 'voids' | 'staff' | 'branch';

/** Sales, Products, Payments, Voids/Refunds, and Branch comparison used to
 * be 5 separate top-level report pages — they're all just the same
 * transaction fixture sliced by a different dimension, so they're tabs of
 * one page now instead of 5 sidebar entries. */
export function AdminSalesPerformancePage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [from, setFrom] = useState('2026-07-21');
  const [to, setTo] = useState('2026-07-21');
  const [point, setPoint] = useState('all');
  const pointLabel =
    point === 'main' ? 'Main Counter' : point === 'snack' ? 'Snack Station' : 'All sales points';

  const categoryTotals = PREVIEW_MENU.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + item.priceSen;
    return acc;
  }, {});

  const byMethod = useMemo(() => {
    const methods = ['Cash', 'Card', 'E-wallet'] as const;
    return methods.map((method) => {
      const rows = PREVIEW_TRANSACTIONS.filter((t) => t.status === 'Completed' && t.method === method);
      const totalSen = rows.reduce((s, t) => s + t.totalSen, 0);
      return { method, count: rows.length, totalSen };
    });
  }, []);
  const refunded = PREVIEW_TRANSACTIONS.filter((t) => t.refundSen > 0);
  const voidRows = PREVIEW_TRANSACTIONS.filter(
    (t) => t.status === 'Refunded' || t.status === 'Voided' || t.refundSen > 0,
  );

  const branchTotalSen = PREVIEW_SALES_BY_POINT.reduce((s, p) => s + p.sen, 0);
  const staffTotalSen = PREVIEW_SALES_BY_STAFF.reduce((s, row) => s + row.sen, 0);

  return (
    <AdminPageShell
      pageId="admin-sales-performance"
      title="Sales & Performance"
      hint="Sample transaction fixture — export API pending."
      actions={
        <button type="button" className="btn-secondary" disabled title="Team 2 API pending">
          Export CSV
        </button>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">By product</TabsTrigger>
          <TabsTrigger value="payments">By payment</TabsTrigger>
          <TabsTrigger value="voids">Voids &amp; refunds</TabsTrigger>
          <TabsTrigger value="staff">By staff</TabsTrigger>
          <TabsTrigger value="branch">By branch</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="admin-filters">
            <label>
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label>
              Sales point
              <select value={point} onChange={(e) => setPoint(e.target.value)}>
                <option value="all">All</option>
                <option value="main">Main Counter</option>
                <option value="snack">Snack Station</option>
              </select>
            </label>
          </div>
          <p className="form-hint">
            {from} → {to} · {pointLabel}
          </p>

          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>When</th>
                <th>Staff</th>
                <th>Sales point</th>
                <th>Method</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW_SALES_ROWS.map((row) => (
                <tr key={row.order}>
                  <td>{row.order}</td>
                  <td>{row.when}</td>
                  <td>{row.staff}</td>
                  <td>{row.salesPoint}</td>
                  <td>{row.method}</td>
                  <td>{formatRmFromSen(row.totalSen)}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="products">
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>SKU</th>
                <th>Qty (sample)</th>
                <th>Revenue (sample)</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCT_ROWS.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.category}</td>
                  <td>{row.sku}</td>
                  <td>{row.qty}</td>
                  <td>{formatRmFromSen(row.revenueSen)}</td>
                  <td>{row.available ? 'Yes' : 'Sold out'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="admin-section-title admin-section-title--spaced">Category mix (list price basis)</h2>
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Sample value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(categoryTotals).map(([cat, sen]) => (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td>{formatRmFromSen(sen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="payments">
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Completed orders</th>
                <th>Net captured</th>
              </tr>
            </thead>
            <tbody>
              {byMethod.map((row) => (
                <tr key={row.method}>
                  <td>{row.method}</td>
                  <td>{row.count}</td>
                  <td>{formatRmFromSen(row.totalSen)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="admin-section-title admin-section-title--spaced">Refunds pending settlement</h2>
          {refunded.length === 0 ? (
            <p className="empty-state">No refunds in sample period.</p>
          ) : (
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Method</th>
                  <th>Refund amount</th>
                </tr>
              </thead>
              <tbody>
                {refunded.map((t) => (
                  <tr key={t.order}>
                    <td>{t.order}</td>
                    <td>{t.method}</td>
                    <td>{formatRmFromSen(t.refundSen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>

        <TabsContent value="voids">
          <p className="form-hint">Sensitive actions require approver audit when API is connected.</p>
          {voidRows.length === 0 ? (
            <div className="empty-state">
              <h2 className="admin-section-title">No voids in sample</h2>
              <p>Try widening the date filter when live data is available.</p>
            </div>
          ) : (
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>When</th>
                  <th>Staff</th>
                  <th>Status</th>
                  <th>Refund</th>
                  <th>Reason (preview)</th>
                </tr>
              </thead>
              <tbody>
                {voidRows.map((t) => (
                  <tr key={t.order}>
                    <td>{t.order}</td>
                    <td>{t.when}</td>
                    <td>{t.staff}</td>
                    <td>{t.status}</td>
                    <td>{formatRmFromSen(t.refundSen)}</td>
                    <td>Customer changed mind — sample</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>

        <TabsContent value="staff">
          <p className="form-hint">Permission-limited in production — a branch-scoped manager would only see their own staff.</p>
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Orders</th>
                <th>Net sales</th>
                <th>AOV</th>
                <th>Share of sample</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW_SALES_BY_STAFF.map((row) => (
                <tr key={row.staff}>
                  <td>{row.staff}</td>
                  <td>{row.orders}</td>
                  <td>{formatRmFromSen(row.sen)}</td>
                  <td>{formatRmFromSen(row.orders ? Math.round(row.sen / row.orders) : 0)}</td>
                  <td>{staffTotalSen ? `${Math.round((row.sen / staffTotalSen) * 100)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="branch">
          <p className="form-hint">Single branch sample — sales-point split for Main Café today.</p>
          <div className="metric-grid metric-grid--compact">
            <MetricCard label="Net sales (today)" value={formatRmFromSen(FIXTURE_TODAY.netSalesSen)} />
            <MetricCard label="Orders" value={String(FIXTURE_TODAY.orders)} />
            <MetricCard label="AOV" value={formatRmFromSen(FIXTURE_TODAY.aovSen)} />
          </div>

          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Branch</th>
                <th>Sales point</th>
                <th>Net sales</th>
                <th>Share</th>
                <th>Orders (sample)</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW_SALES_BY_POINT.map((row) => (
                <tr key={row.point}>
                  <td>Main Café</td>
                  <td>{row.point}</td>
                  <td>{formatRmFromSen(row.sen)}</td>
                  <td>{branchTotalSen ? `${Math.round((row.sen / branchTotalSen) * 100)}%` : '—'}</td>
                  <td>{row.point === 'Main Counter' ? 8 : 5}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  );
}
