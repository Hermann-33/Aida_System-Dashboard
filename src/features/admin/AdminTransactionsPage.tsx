import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { PREVIEW_TRANSACTIONS } from '../../preview/fixtures/catalog';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import {
  loadTransactionReport,
  type TransactionItem,
  type TransactionReport,
} from '../reporting/reportingClient';
import {
  loadAdminPaymentState,
  requestAdminRefund,
  requestableRefundSen,
  type PaymentSnapshot,
} from '../payments/paymentClient';
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
    ? 'Unpaid'
    : item.tenderType === 'cash'
      ? `Cash · ${item.paymentState.replaceAll('_', ' ')}`
      : item.tenderType === 'external'
        ? `External · ${item.paymentState.replaceAll('_', ' ')}`
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

function parseRmToSen(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.');
  const sen = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(sen) && sen > 0 ? sen : null;
}

function stateLabel(value: string): string {
  return value.replaceAll('_', ' ');
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
  const [payment, setPayment] = useState<PaymentSnapshot | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundStatus, setRefundStatus] = useState<string | null>(null);

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

  useEffect(() => {
    setPayment(null);
    setPaymentError(null);
    setRefundAmount('');
    setRefundReason('');
    setRefundStatus(null);
    if (preview || !selected) {
      setPaymentLoading(false);
      return;
    }

    let active = true;
    setPaymentLoading(true);
    loadAdminPaymentState(selected.key, selected.totalSen, 'MYR')
      .then((data) => { if (active) setPayment(data); })
      .catch((cause: unknown) => {
        if (active) setPaymentError(cause instanceof Error ? cause.message : 'Payment state failed');
      })
      .finally(() => { if (active) setPaymentLoading(false); });
    return () => { active = false; };
  }, [preview, selected]);

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
  const requestableSen = selected && payment ? requestableRefundSen(payment, selected.totalSen) : 0;
  const canRefund = !!payment
    && (payment.tenderType === 'cash' || payment.tenderType === 'external')
    && (payment.paymentState === 'paid' || payment.paymentState === 'partially_refunded')
    && requestableSen > 0;

  function updateRange(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(0);
    setSelected(null);
  }

  async function submitRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !payment || !canRefund) return;
    const amountSen = parseRmToSen(refundAmount);
    if (amountSen === null || amountSen > requestableSen) {
      setPaymentError(`Enter a refund amount from RM0.01 to ${formatRmFromSen(requestableSen)}.`);
      return;
    }
    const reason = refundReason.trim();
    if (!reason) {
      setPaymentError('Refund reason is required.');
      return;
    }

    setRefundSubmitting(true);
    setPaymentError(null);
    setRefundStatus(null);
    try {
      const next = await requestAdminRefund({
        orderId: selected.key,
        tenderType: payment.tenderType,
        amountSen,
        reason,
        idempotencyKey: crypto.randomUUID(),
      }, selected.totalSen, 'MYR');
      setPayment(next);
      setRefundAmount('');
      setRefundReason('');
      setRefundStatus(payment.tenderType === 'cash'
        ? 'Cash refund succeeded and the trusted shift cash-out was recorded.'
        : 'External refund requested. Refunded value changes only after provider success evidence.');
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : 'Refund request failed');
    } finally {
      setRefundSubmitting(false);
    }
  }

  return (
    <AdminPageShell
      pageId="admin-transactions-report"
      title="Transaction report"
      hint={preview
        ? 'UI preview sample transactions — not production authority.'
        : 'Accepted order value is source-backed. Open a transaction for current payment/refund authority; processor settlement remains distinct.'}
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
          Report totals remain accepted commercial value. Current refunds are loaded separately from the protected payment authority when detail is opened.
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
              <dt>Reported payment state</dt><dd>{selected.paymentState}</dd>
              <dt>Subtotal</dt><dd>{formatRmFromSen(selected.subtotalSen)}</dd>
              <dt>Voucher discount</dt><dd>{formatRmFromSen(selected.voucherDiscountSen)}</dd>
              <dt>Promotion discount</dt><dd>{formatRmFromSen(selected.promotionDiscountSen)}</dd>
              <dt>Total discount</dt><dd>{formatRmFromSen(selected.discountSen)}</dd>
              <dt>Accepted order value</dt><dd>{formatRmFromSen(selected.totalSen)}</dd>
              {preview && <><dt>Preview refund</dt><dd>{selected.refundSen === null ? 'None' : formatRmFromSen(selected.refundSen)}</dd></>}
              <dt>Status</dt><dd>{selected.status}</dd>
            </dl>

            {!preview && (
              <section aria-label="Payment and refund authority">
                <h3 className="admin-section-title">Payment & refund authority</h3>
                {paymentLoading && <p className="form-hint">Loading protected payment state…</p>}
                {paymentError && <div className="form-error" role="alert">{paymentError}</div>}
                {refundStatus && <p className="form-hint" role="status">{refundStatus}</p>}
                {payment && (
                  <>
                    <dl className="admin-dl">
                      <dt>Tender</dt><dd>{stateLabel(payment.tenderType)}</dd>
                      <dt>Payment state</dt><dd>{stateLabel(payment.paymentState)}</dd>
                      <dt>Paid at</dt><dd>{payment.paidAt ? new Date(payment.paidAt).toLocaleString('en-MY') : 'Not captured/paid'}</dd>
                      <dt>Refunded</dt><dd>{formatRmFromSen(payment.refundedSen)}</dd>
                      <dt>Requestable balance</dt><dd>{formatRmFromSen(requestableSen)}</dd>
                      <dt>Provider available</dt><dd>{payment.providerAvailable ? 'Configured' : 'Not configured'}</dd>
                      {payment.latestIntent && (
                        <>
                          <dt>Latest provider state</dt><dd>{stateLabel(payment.latestIntent.state)}</dd>
                          <dt>Settlement state</dt><dd>{stateLabel(payment.latestIntent.settlementState)}</dd>
                        </>
                      )}
                    </dl>

                    {payment.refunds.length > 0 && (
                      <div>
                        <p className="form-hint">Refund history</p>
                        <ul>
                          {payment.refunds.map((refund) => (
                            <li key={refund.id}>
                              {formatRmFromSen(refund.amountSen)} · {stateLabel(refund.state)}
                              {refund.reason ? ` · ${refund.reason}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {canRefund ? (
                      <form onSubmit={submitRefund}>
                        <label>
                          Refund amount (RM)
                          <input
                            aria-label="Refund amount (RM)"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={refundAmount}
                            onChange={(event) => setRefundAmount(event.target.value)}
                            disabled={refundSubmitting}
                          />
                        </label>
                        <label>
                          Refund reason
                          <input
                            aria-label="Refund reason"
                            maxLength={300}
                            value={refundReason}
                            onChange={(event) => setRefundReason(event.target.value)}
                            disabled={refundSubmitting}
                          />
                        </label>
                        <p className="form-hint">
                          {payment.tenderType === 'cash'
                            ? 'Cash refunds require this Admin session, the enrolled terminal and its open shift. The server records the matching cash-out.'
                            : 'External refunds are requests only until provider evidence marks them succeeded.'}
                        </p>
                        <button type="submit" className="btn-primary" disabled={refundSubmitting}>
                          {refundSubmitting ? 'Submitting refund…' : `Refund up to ${formatRmFromSen(requestableSen)}`}
                        </button>
                      </form>
                    ) : (
                      <p className="form-hint">
                        {payment.paymentState === 'refunded'
                          ? 'This order is fully refunded.'
                          : payment.paymentState === 'pending'
                            ? 'Refunds are unavailable until payment capture succeeds.'
                            : requestableSen === 0
                              ? 'The full refundable balance is already reserved or refunded.'
                              : 'This payment state is not refundable.'}
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

            <div className="admin-drawer__actions">
              <button type="button" className="btn-primary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </aside>
        </>
      )}
    </AdminPageShell>
  );
}
