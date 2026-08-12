import { useMemo, useState } from 'react';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

const EVENTS = [
  { id: 'a1', date: '2026-07-21', when: '21 Jul 2026 09:12', actor: 'Siti Manager', action: 'Approved variance', entity: 'Shift s3' },
  { id: 'a2', date: '2026-07-21', when: '21 Jul 2026 08:05', actor: 'Nadia Rahman', action: 'Applied reward', entity: 'Order A-10513' },
  { id: 'a3', date: '2026-07-20', when: '20 Jul 2026 22:10', actor: 'Siti Manager', action: 'Revoked terminal', entity: 'POS-LEGACY-01' },
  { id: 'a4', date: '2026-07-20', when: '20 Jul 2026 14:00', actor: 'Hafiz Ali', action: 'Refund issued', entity: 'Order A-10509' },
  { id: 'a5', date: '2026-07-20', when: '20 Jul 2026 11:30', actor: 'Nadia Rahman', action: 'Voided order', entity: 'Order A-10502' },
  { id: 'a6', date: '2026-07-19', when: '19 Jul 2026 18:45', actor: 'Siti Manager', action: 'Deactivated employee', entity: 'Amir Dual' },
  { id: 'a7', date: '2026-07-19', when: '19 Jul 2026 16:20', actor: 'Hafiz Ali', action: 'Closed shift', entity: 'Shift s2' },
  { id: 'a8', date: '2026-07-19', when: '19 Jul 2026 09:00', actor: 'Siti Manager', action: 'Issued enrolment code', entity: 'POS-MAIN-01' },
  { id: 'a9', date: '2026-07-18', when: '18 Jul 2026 21:15', actor: 'Nadia Rahman', action: 'Applied reward', entity: 'Order A-10488' },
  { id: 'a10', date: '2026-07-18', when: '18 Jul 2026 10:05', actor: 'Siti Manager', action: 'Updated settings', entity: 'Cash variance threshold' },
];

const PAGE_SIZE = 5;

export function AdminAuditPage() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EVENTS.filter((e) => {
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      if (q && !`${e.actor} ${e.action} ${e.entity}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, from, to]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  function updateFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(0);
  }

  return (
    <AdminPageShell pageId="admin-audit" title="Audit log" hint="Immutable server audit stream — preview sample rows.">
      <div className="admin-filters">
        <label>
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => updateFilter(setSearch, e.target.value)}
            placeholder="Actor, action, or entity"
          />
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(e) => updateFilter(setFrom, e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => updateFilter(setTo, e.target.value)} />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h2 className="admin-section-title">No matching events</h2>
          <p>Try widening the date range or clearing the search.</p>
        </div>
      ) : (
        <>
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((e) => (
                <tr key={e.id}>
                  <td>{e.when}</td>
                  <td>{e.actor}</td>
                  <td>{e.action}</td>
                  <td>{e.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="admin-row-actions admin-pagination">
            <p className="form-hint">
              {currentPage * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE + PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length} events
            </p>
            <div className="admin-row-actions">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={currentPage >= pageCount - 1}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </AdminPageShell>
  );
}
