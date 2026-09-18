import { useEffect, useMemo, useState } from 'react';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import {
  loadAuditReport,
  loadPaymentAuditReport,
  type AuditItem,
  type AuditReport,
  type PaymentAuditReport,
} from '../reporting/reportingClient';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

const PREVIEW_EVENTS = [
  { eventKey: 'preview-a1', occurredAt: '2026-07-21T09:12:00+08:00', localDate: '2026-07-21', localTime: '09:12:00', timezone: 'Asia/Kuala_Lumpur', category: 'shift', action: 'variance_approved', actorUserId: 'preview-manager', branchId: 'preview-branch', salesPointId: 'preview-point', entityType: 'shift', entityId: 'preview-shift', entityLabel: 'Preview shift', details: {} },
  { eventKey: 'preview-a2', occurredAt: '2026-07-21T08:05:00+08:00', localDate: '2026-07-21', localTime: '08:05:00', timezone: 'Asia/Kuala_Lumpur', category: 'discount', action: 'voucher_applied', actorUserId: null, branchId: 'preview-branch', salesPointId: null, entityType: 'order', entityId: 'preview-order', entityLabel: 'Preview order', details: {} },
] satisfies AuditItem[];

const PAGE_SIZE = 25;

function localDateToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function actorLabel(actorUserId: string | null): string {
  return actorUserId ? `${actorUserId.slice(0, 8)}…` : 'System / provider evidence';
}

function matchesSearch(event: AuditItem, query: string): boolean {
  if (!query) return true;
  return `${event.category} ${event.action} ${event.entityLabel} ${event.actorUserId ?? ''}`
    .toLowerCase()
    .includes(query);
}

function AuditTable({ rows, empty }: { rows: AuditItem[]; empty: string }) {
  if (rows.length === 0) return <p className="form-hint">{empty}</p>;
  return (
    <table className="data-table admin-table">
      <thead>
        <tr>
          <th>When</th>
          <th>Category</th>
          <th>Actor</th>
          <th>Action</th>
          <th>Entity</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((event) => (
          <tr key={event.eventKey}>
            <td>{event.localDate} {event.localTime}</td>
            <td>{event.category}</td>
            <td>{actorLabel(event.actorUserId)}</td>
            <td>{event.action}</td>
            <td>{event.entityLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AdminAuditPage() {
  const preview = isUiPreviewMode();
  const today = useMemo(localDateToday, []);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(preview ? '' : today);
  const [to, setTo] = useState(preview ? '' : today);
  const [page, setPage] = useState(0);
  const [paymentPage, setPaymentPage] = useState(0);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [paymentReport, setPaymentReport] = useState<PaymentAuditReport | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [paymentLoading, setPaymentLoading] = useState(!preview);
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (preview) return;
    let active = true;
    setLoading(true);
    setError(null);
    loadAuditReport({ fromDate: from, toDate: to, pageSize: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((data) => { if (active) setReport(data); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Audit report failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [preview, from, to, page]);

  useEffect(() => {
    if (preview) return;
    let active = true;
    setPaymentLoading(true);
    setPaymentError(null);
    loadPaymentAuditReport({ fromDate: from, toDate: to, pageSize: PAGE_SIZE, offset: paymentPage * PAGE_SIZE })
      .then((data) => { if (active) setPaymentReport(data); })
      .catch((cause: unknown) => {
        if (active) setPaymentError(cause instanceof Error ? cause.message : 'Payment audit report failed');
      })
      .finally(() => { if (active) setPaymentLoading(false); });
    return () => { active = false; };
  }, [preview, from, to, paymentPage]);

  const query = search.trim().toLowerCase();
  const sourceRows = useMemo(() => preview ? PREVIEW_EVENTS : report?.items ?? [], [preview, report]);
  const rows = useMemo(() => sourceRows.filter((event) => matchesSearch(event, query)), [sourceRows, query]);
  const paymentRows = useMemo(
    () => (paymentReport?.items ?? []).filter((event) => matchesSearch(event, query)),
    [paymentReport, query],
  );

  const totalCount = preview ? rows.length : report?.totalCount ?? 0;
  const start = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = preview ? rows.length : Math.min((page + 1) * PAGE_SIZE, totalCount);
  const paymentTotal = paymentReport?.totalCount ?? 0;
  const paymentStart = paymentTotal === 0 ? 0 : paymentPage * PAGE_SIZE + 1;
  const paymentEnd = Math.min((paymentPage + 1) * PAGE_SIZE, paymentTotal);

  function updateDate(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(0);
    setPaymentPage(0);
  }

  return (
    <AdminPageShell
      pageId="admin-audit"
      title="Audit log"
      hint={preview
        ? 'UI preview sample events — no privileged reporting request is made.'
        : 'General operational events and payment/refund events are separate source-backed feeds with independent pagination.'}
    >
      <div className="admin-filters">
        <label>
          Search current pages
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Category, action, actor or entity" />
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(event) => updateDate(setFrom, event.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from || undefined} onChange={(event) => updateDate(setTo, event.target.value)} />
        </label>
      </div>

      <section className="admin-section" aria-labelledby="general-audit-heading">
        <h2 id="general-audit-heading" className="admin-section-title">General operational audit</h2>
        {!preview && report && (
          <div className="empty-state">
            {report.coverage.notes.map((note) => <p key={note}>{note}</p>)}
            {!report.coverage.completeGeneralAuditLog && <p>General configuration history is not claimed to be complete.</p>}
          </div>
        )}
        {loading && <p className="form-hint">Loading source-backed operational events…</p>}
        {error && <div className="form-error" role="alert">{error}</div>}
        {!loading && !error && <AuditTable rows={rows} empty="No matching general events on this page." />}
        {!preview && !loading && !error && totalCount > 0 && (
          <div className="admin-row-actions admin-pagination">
            <p className="form-hint">{start}–{end} of {totalCount} general source events</p>
            <div className="admin-row-actions">
              <button type="button" className="btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button>
              <button type="button" className="btn-secondary btn-sm" disabled={(page + 1) * PAGE_SIZE >= totalCount} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          </div>
        )}
      </section>

      {!preview && (
        <section className="admin-section" aria-labelledby="payment-audit-heading">
          <h2 id="payment-audit-heading" className="admin-section-title">Payment & refund audit</h2>
          {paymentReport && (
            <div className="empty-state">
              {paymentReport.coverage.notes.map((note) => <p key={note}>{note}</p>)}
              {!paymentReport.coverage.rawProviderPayloadIncluded && (
                <p>Raw provider payloads and provider secrets are not included; persisted event identifiers/digests are reconciliation evidence only.</p>
              )}
            </div>
          )}
          {paymentLoading && <p className="form-hint">Loading payment/refund lifecycle events…</p>}
          {paymentError && <div className="form-error" role="alert">{paymentError}</div>}
          {!paymentLoading && !paymentError && <AuditTable rows={paymentRows} empty="No matching payment/refund events on this page." />}
          {!paymentLoading && !paymentError && paymentTotal > 0 && (
            <div className="admin-row-actions admin-pagination">
              <p className="form-hint">{paymentStart}–{paymentEnd} of {paymentTotal} payment/refund events</p>
              <div className="admin-row-actions">
                <button type="button" className="btn-secondary btn-sm" disabled={paymentPage === 0} onClick={() => setPaymentPage((value) => Math.max(0, value - 1))}>Previous payment page</button>
                <button type="button" className="btn-secondary btn-sm" disabled={(paymentPage + 1) * PAGE_SIZE >= paymentTotal} onClick={() => setPaymentPage((value) => value + 1)}>Next payment page</button>
              </div>
            </div>
          )}
        </section>
      )}
    </AdminPageShell>
  );
}
