import { useEffect, useMemo, useState } from 'react';
import { PREVIEW_TRANSACTIONS } from '../../preview/fixtures/catalog';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import {
  loadTransactionReport,
  type TransactionItem,
  type TransactionReport,
} from '../reporting/reportingClient';
import { formatRmFromSen } from '../../shared/formatting/money';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

const PAGE_SIZE = 25;

function localDateToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

type DisplayTransaction = {
  key: string;
  orderLabel: string;
  when: string;
  staff: string;
  salesPoint: string;
  payment: string;
  totalSen: number;
  status: string;
  member: string;
  subtotalSen: number;
  voucherDiscountSen: number;
  promotionDiscountSen: number;
  discountSen: number;
  refundSen: number | null;
  source: string;
  paymentState: string;
};

function shortUserId(value: string): string {
  return `${value.slice(0, 8)}…`;
}

function liveRow(item: TransactionItem): DisplayTransaction {
  const payment = item.paymentState === 'unpaid'
    ? 'Unpaid / not settled'
    : item.tenderType === 'cash'
      ? 'Cash'
      : item.tenderType;
  return {
    key: item.orderId,
    orderLabel: `#${item.orderNumber}`,
    when: `${item.localDate} ${item.localTime}`,
    staff: item.createdByUserId ? shortUserId(item.createdByUserId) : item.source === 'customer' ? 'Customer app' : 'System',
    salesPoint: item.salesPoint?.name ?? 'No POS sales point',
    payment,
    totalSen: item.totalSen,
    status: item.status,
    member: item.memberAttached ? 'Member attached' : 'Guest / none',
    subtotalSen: item.subtotalSen,
    voucherDiscountSen: item.voucherDiscountSen,
    promotionDiscountSen: item.promotionDiscountSen,
    discountSen: item.discountSen,
    refundSen: null,
    source: item.source,
    paymentState: item.paymentState,
  };
}

export function AdminTransactionsPage() {
  const preview = isUiPreviewMode();
  const today = useMemo(localDateToday, []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(0);
  const [report, setReport] = useState<TransactionReport | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DisplayTransaction | null>(null);

  useEffect(() => {
    if (preview) return;
    let active = true;
    setLoading(true);
    setError(null);
    loadTransactionReport({ fromDate: from, toDate: to, pageSize: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((data) => { if (active) setReport(data); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Transaction report failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [preview, from, to, page]);

  const rows = useMemo<DisplayTransaction[]>(() => {
    if (preview) {
      return PREVIEW_TRANSACTIONS.map((row) => ({
        key: row.order,
        orderLabel: row.order,
        when: row.when,
        staff: row.staff,
        salesPoint: row.salesPoint,
        payment: row.method,
        totalSen: row.totalSen,
        status: row.status,
        member: row.member ?? 'Guest',
        subtotalSen: row.totalSen + row.discountSen,
        voucherDiscountSen: row.discountSen,
        promotionDiscountSen: 0,
        discountSen: row.discountSen,
        refundSen: row.refundSen,
        source: 'preview',
        paymentState: row.status === 'Completed' ? 'sample-paid' : 'sample',
      }));
    }
    return report?.items.map(liveRow) ?? [];
  }, [preview, report]);

  const totalCount = preview ? rows.length : report?.totalCount ?? 0;
  const start = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = preview ? rows.length : Math.min((page + 1) * PAGE_SIZE, totalCount);

  function updateRange(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(0);
    setSelected(null);
  }

  return (
    <AdminPageShell
      pageId="admin-transactions-report"
      title="Transaction report"
      hint={preview
        ? 'UI preview sample transactions — not production authority.'
        : 'Source-backed order detail. Total is accepted order value, not processor settlement.'}
    >
      <div className="admin-filters">
        <label>
          From
          <input type="date" value={from} onChange={(event) => updateRange(setFrom, event.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from} onChange={(event) => updateRange(setTo, event.target.value)} />
        </label>
      </div>

      {!preview && report && (
        <p className="form-hint">
          Refund data and processor settlement are intentionally unavailable until Phase 9.
        </p>
      )}
      {loading && <p className="form-hint">Loading authoritative transactions…</p>}
      {error && <div className="form-error" role="alert">{error}</div>}

      {!loading && !error && rows.length === 0 ? (
        <div className="empty-state">
          <h2 className="admin-section-title">No transactions in this range</h2>
          <p>Try a wider date range.</p>
        </div>
      ) : (
        <table className="data-table admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>When</th>
              <th>Actor/source</th>
              <th>Sales point</th>
              <th>Payment state</th>
              <th>Accepted value</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.orderLabel}</td>
                <td>{row.when}</td>
                <td>{row.staff}</td>
                <td>{row.salesPoint}</td>
                <td>{row.payment}</td>
                <td>{formatRmFromSen(row.totalSen)}</td>
                <td>{row.status}</td>
                <td>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setSelected(row)}>
                    Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!preview && !loading && !error && totalCount > 0 && (
        <div className="admin-row-actions admin-pagination">
          <p className="form-hint">{start}–{end} of {totalCount} orders</p>
          <div className="admin-row-actions">
            <button type="button" className="btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button>
            <button type="button" className="btn-secondary btn-sm" disabled={(page + 1) * PAGE_SIZE >= totalCount} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>
      )}

      {selected && (
        <>
          <button type="button" className="admin-drawer-backdrop" aria-label="Close detail" onClick={() => setSelected(null)} />
          <aside className="admin-drawer" aria-labelledby="txn-detail-title">
            <h2 id="txn-detail-title" className="admin-section-title">Order {selected.orderLabel}</h2>
            <dl className="admin-dl">
              <dt>When</dt><dd>{selected.when}</dd>
              <dt>Source</dt><dd>{selected.source}</dd>
              <dt>Actor</dt><dd>{selected.staff}</dd>
              <dt>Member</dt><dd>{selected.member}</dd>
              <dt>Payment state</dt><dd>{selected.paymentState}</dd>
              <dt>Subtotal</dt><dd>{formatRmFromSen(selected.subtotalSen)}</dd>
              <dt>Voucher discount</dt><dd>{formatRmFromSen(selected.voucherDiscountSen)}</dd>
              <dt>Promotion discount</dt><dd>{formatRmFromSen(selected.promotionDiscountSen)}</dd>
              <dt>Total discount</dt><dd>{formatRmFromSen(selected.discountSen)}</dd>
              <dt>Accepted order value</dt><dd>{formatRmFromSen(selected.totalSen)}</dd>
              <dt>Refund</dt><dd>{selected.refundSen === null ? 'Unavailable until Phase 9' : formatRmFromSen(selected.refundSen)}</dd>
              <dt>Status</dt><dd>{selected.status}</dd>
            </dl>
            <div className="admin-drawer__actions">
              <button type="button" className="btn-primary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </aside>
        </>
      )}
    </AdminPageShell>
  );
}
