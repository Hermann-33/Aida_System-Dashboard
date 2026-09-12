import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ConnectionState } from '../preview/fixtures/catalog';
import type { EmployeeIdentity, ShiftSummary, TerminalLocation } from '../auth/types';
import { formatKlTime } from '../shared/formatting/datetime';

interface Props {
  employee: EmployeeIdentity | null;
  location: TerminalLocation | null;
  shift: ShiftSummary | null;
  connection?: ConnectionState;
  operationalMode?: 'preview' | 'live';
}

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  online: 'Online',
  degraded: 'Degraded',
  offline: 'Offline',
  syncing: 'Syncing',
};

const CONNECTION_CLASS: Record<ConnectionState, string> = {
  online: 'status-pill--ok',
  degraded: 'status-pill--warn',
  offline: 'status-pill--err',
  syncing: 'status-pill--info',
};

const SHIFT_CLASS: Record<string, string> = {
  open: 'status-pill--ok',
  locked: 'status-pill--warn',
  closed: 'status-pill--info',
};

export function PosContextBar({ employee, location, shift, connection = 'online', operationalMode = 'preview' }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const shiftStarted = shift?.openedAt ? formatKlTime(shift.openedAt) : null;

  return (
    <aside
      aria-label="POS context"
      className="flex flex-wrap items-center gap-3 bg-[var(--aida-espresso)] px-4 py-2.5 text-sm text-[var(--aida-cream)]"
    >
      {employee?.fullName && (
        <span
          aria-hidden="true"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--aida-blush)] text-sm font-bold text-[var(--aida-burgundy)]"
        >
          {employee.fullName.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-white">{employee?.fullName || '—'}</span>
        <span className="text-xs capitalize text-white/60">{employee?.role || '—'}</span>
      </div>

      <span aria-hidden="true" className="h-6 w-px bg-white/15" />

      <span className={`status-pill ${SHIFT_CLASS[shift?.status ?? ''] ?? 'status-pill--info'}`}>
        Shift {shift?.status || 'none'}
      </span>
      {operationalMode === 'preview' ? (
        <span className={`status-pill ${CONNECTION_CLASS[connection]}`}>{CONNECTION_LABEL[connection]}</span>
      ) : (
        <span className="status-pill status-pill--ok">Live authority</span>
      )}

      <button
        type="button"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((v) => !v)}
        className="ml-auto inline-flex h-8 items-center gap-1 rounded-md border border-[var(--aida-gold)] px-3 font-semibold text-[var(--aida-cream)] transition-colors hover:bg-white/10"
      >
        {detailsOpen ? 'Hide details' : 'Details'}
        {detailsOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>

      {detailsOpen && (
        <div className="mt-1 flex w-full flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-2 text-xs">
          <span className="font-brand text-base text-[var(--aida-blush)]">
            <strong className="font-bold text-[var(--aida-gold)]">Product</strong> Aida Counter
          </span>
          <span>
            <strong className="font-bold text-[var(--aida-gold)]">Employee ID</strong> {employee?.username || '—'}
          </span>
          {employee?.isGlobalManager && (
            <span>
              <strong className="font-bold text-[var(--aida-gold)]">Access</strong> Global manager
            </span>
          )}
          <span><strong className="font-bold text-[var(--aida-gold)]">Branch</strong>{' '}{location?.branchName || location?.branchCode || '—'}</span>
          <span><strong className="font-bold text-[var(--aida-gold)]">Sales point</strong>{' '}{location?.salesPointName || location?.salesPointCode || '—'}</span>
          <span><strong className="font-bold text-[var(--aida-gold)]">Terminal</strong> {location?.terminalCode || '—'}</span>
          {shiftStarted && (
            <span>
              <strong className="font-bold text-[var(--aida-gold)]">Shift started</strong> {shiftStarted}
            </span>
          )}
          {shift?.id && (
            <span>
              <strong className="font-bold text-[var(--aida-gold)]">Shift ID</strong> {shift.id}
            </span>
          )}
          {operationalMode === 'live' && shift?.statusVersion && (
            <span>
              <strong className="font-bold text-[var(--aida-gold)]">Shift version</strong> {shift.statusVersion}
            </span>
          )}
        </div>
      )}
    </aside>
  );
}
