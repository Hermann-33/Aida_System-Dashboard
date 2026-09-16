import { useEffect, useMemo, useState } from 'react';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import { loadAuditReport, type AuditItem, type AuditReport } from '../reporting/reportingClient';
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
  return actorUserId ? `${actorUserId.slice(0, 8)}…` : 'System / derived fact';
}

export function AdminAuditPage() {
  const preview = isUiPreviewMode();
  const today = useMemo(localDateToday, []);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(preview ? '' : today);
  const [to, setTo] = useState(preview ? '' : today);
  const [page, setPage] = useState(0);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState<string | null>(null);

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

  const sourceRows = preview ? PREVIEW_EVENTS : report?.items ?? [];
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sourceRows;
    return sourceRows.filter((event) => (
      `${event.category} ${event.action} ${event.entityLabel} ${event.actorUserId ?? ''}`.toLowerCase().includes(query)
    ));
  }, [sourceRows, search]);

  const totalCount = preview ? rows.length : report?.totalCount ?? 0;
  const start = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = preview ? rows.length : Math.min((page + 1) * PAGE_SIZE, totalCount);

  function updateDate(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(0);
  }

  return (
    <AdminPageShell
      pageId="admin-audit"
      title="Audit log"
      hint={preview
        ? 'UI preview sample events — no privileged reporting request is made.'
        : 'Source-backed operational events only. Coverage gaps are disclosed rather than fabricated.'}
    >
      <div className="admin-filters">
        <label>
          Search current page
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

      {!preview && report && (
        <div className="empty-state">
          <h2 className="admin-section-title">Audit coverage</h2>
          {report.coverage.notes.map((note) => <p key={note}>{note}</p>)}
          {!report.coverage.completeGeneralAuditLog && <p>General configuration history is not claimed to be complete.</p>}
        </div>
      )}

      {loading && <p className="form-hint">Loading source-backed audit events…</p>}
      {error && <div className="form-error" role="alert">{error}</div>}

      {!loading && !error && rows.length === 0 ? (
        <div className="empty-state">
          <h2 className="admin-section-title">No matching events</h2>
          <p>Try widening the date range or clearing the page search.</p>
        </div>
      ) : (
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
      )}

      {!preview && !loading && !error && totalCount > 0 && (
        <div className="admin-row-actions admin-pagination">
          <p className="form-hint">{start}–{end} of {totalCount} source events</p>
          <div className="admin-row-actions">
            <button type="button" className="btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</button>
            <button type="button" className="btn-secondary btn-sm" disabled={(page + 1) * PAGE_SIZE >= totalCount} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
