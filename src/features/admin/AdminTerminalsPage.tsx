import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PREVIEW_SAMPLE_ENROLMENT_CODE } from '../../preview/demoAccounts';
import { PREVIEW_TERMINALS } from '../../preview/fixtures/catalog';
import { previewTerminalRepository } from '../../preview/repositories/previewTerminalRepository';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import {
  fetchOperationalLocations,
  issueTerminalEnrolmentCode,
  revokeOperationalTerminal,
  saveOperationalTerminal,
  type OperationalBranch,
} from '../locations/operationalLocationClient';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

type TerminalRow = {
  id: string;
  code: string;
  name: string;
  branch: string;
  salesPoint: string;
  salesPointId: string | null;
  status: 'active' | 'revoked' | 'pending';
  lastSeen?: string | null;
};

function liveRows(branches: OperationalBranch[]): TerminalRow[] {
  return branches.flatMap((branch) =>
    branch.salesPoints.flatMap((salesPoint) =>
      salesPoint.terminals.map((terminal) => ({
        id: terminal.id,
        code: terminal.code,
        name: terminal.name,
        branch: branch.name,
        salesPoint: salesPoint.name,
        salesPointId: salesPoint.id,
        status: terminal.status,
        lastSeen: terminal.lastSeenAt,
      })),
    ),
  );
}

export function AdminTerminalsPage() {
  const preview = isUiPreviewMode();
  const [branches, setBranches] = useState<OperationalBranch[]>([]);
  const [terminals, setTerminals] = useState<TerminalRow[]>(
    preview
      ? PREVIEW_TERMINALS.map((terminal) => ({
          id: terminal.id,
          code: terminal.code,
          name: terminal.code,
          branch: terminal.branch,
          salesPoint: terminal.salesPoint,
          salesPointId: null,
          status: terminal.status,
          lastSeen: terminal.lastSeen,
        }))
      : [],
  );
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [enrolCode, setEnrolCode] = useState<string | null>(null);
  const [enrolExpiresAt, setEnrolExpiresAt] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [terminalName, setTerminalName] = useState('');
  const [terminalCode, setTerminalCode] = useState('');
  const [salesPointId, setSalesPointId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const salesPoints = useMemo(
    () => branches.flatMap((branch) =>
      branch.salesPoints
        .filter((salesPoint) => salesPoint.isActive)
        .map((salesPoint) => ({
          id: salesPoint.id,
          label: `${branch.name} · ${salesPoint.name} (${salesPoint.code})`,
        })),
    ),
    [branches],
  );

  async function loadLive() {
    if (preview) return;
    setError('');
    try {
      const next = await fetchOperationalLocations();
      setBranches(next);
      setTerminals(liveRows(next));
      if (!salesPointId) {
        const first = next.flatMap((branch) => branch.salesPoints).find((item) => item.isActive);
        if (first) setSalesPointId(first.id);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load terminals');
    }
  }

  useEffect(() => {
    void loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  async function issueCode(terminalId?: string) {
    setError('');
    setBusy(true);
    try {
      if (preview) {
        previewTerminalRepository.clearLocalPreview();
        setEnrolCode(PREVIEW_SAMPLE_ENROLMENT_CODE);
        setEnrolExpiresAt(null);
      } else {
        if (!terminalId) return;
        const issued = await issueTerminalEnrolmentCode(terminalId);
        setEnrolCode(issued.code);
        setEnrolExpiresAt(issued.expiresAt);
        await loadLive();
      }
      setEnrolOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to issue activation code');
    } finally {
      setBusy(false);
    }
  }

  async function confirmRevoke() {
    if (!revokeId) return;
    setError('');
    setBusy(true);
    try {
      if (preview) {
        setTerminals((prev) =>
          prev.map((terminal) =>
            terminal.id === revokeId
              ? { ...terminal, status: 'revoked' as const }
              : terminal,
          ),
        );
      } else {
        await revokeOperationalTerminal(revokeId);
        await loadLive();
      }
      setRevokeId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to revoke terminal');
    } finally {
      setBusy(false);
    }
  }

  async function addTerminal(e: FormEvent) {
    e.preventDefault();
    if (preview) return;
    setError('');
    setBusy(true);
    try {
      await saveOperationalTerminal({
        salesPointId,
        code: terminalCode.trim().toUpperCase(),
        name: terminalName.trim(),
      });
      setTerminalName('');
      setTerminalCode('');
      setAddOpen(false);
      await loadLive();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create terminal');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      pageId="admin-terminals"
      title="Terminals"
      hint={
        preview
          ? `Preview enrolment sample ${PREVIEW_SAMPLE_ENROLMENT_CODE} for POS-MAIN-01.`
          : 'Trusted terminal identity. Printer, KDS and payment-device health are not integrated in Phase 1.'
      }
      actions={
        preview ? (
          <button type="button" className="btn-primary" onClick={() => void issueCode()} disabled={busy}>
            Issue sample code
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={() => setAddOpen(true)}
            disabled={busy || salesPoints.length === 0}
          >
            Add terminal
          </button>
        )
      }
    >
      {error && <p role="alert" className="form-hint">{error}</p>}

      <table className="data-table admin-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Branch</th>
            <th>Sales point</th>
            <th>Status</th>
            <th>Last seen</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {terminals.map((terminal) => (
            <tr key={terminal.id}>
              <td>{terminal.code}</td>
              <td>{terminal.name}</td>
              <td>{terminal.branch}</td>
              <td>{terminal.salesPoint}</td>
              <td>
                <span
                  className={`status-pill status-pill--${
                    terminal.status === 'active'
                      ? 'ok'
                      : terminal.status === 'pending'
                        ? 'info'
                        : 'err'
                  }`}
                >
                  {terminal.status}
                </span>
              </td>
              <td>{terminal.lastSeen ?? '—'}</td>
              <td>
                <div className="admin-row-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => void issueCode(terminal.id)}
                    disabled={busy}
                  >
                    Issue code
                  </button>
                  {terminal.status !== 'revoked' && (
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => setRevokeId(terminal.id)}
                      disabled={busy}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {terminals.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-state">
                No terminals configured.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {enrolOpen && enrolCode && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={() => setEnrolOpen(false)}>
          <div className="confirm-dialog" role="dialog" onClick={(event) => event.stopPropagation()}>
            <h2 className="admin-section-title">Terminal activation code</h2>
            <p className="enrol-code">{enrolCode}</p>
            <p className="form-hint">
              {preview
                ? 'Preview only.'
                : `Single-use code. Expires ${
                    enrolExpiresAt ? new Date(enrolExpiresAt).toLocaleString('en-MY') : 'soon'
                  }.`}
            </p>
            <p className="form-hint">Copy it now. The stored backend record contains only a hash.</p>
            <button type="button" className="btn-primary" onClick={() => setEnrolOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      {!preview && addOpen && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={() => setAddOpen(false)}>
          <div
            className="confirm-dialog confirm-dialog--wide"
            role="dialog"
            aria-labelledby="add-terminal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="add-terminal-title" className="admin-section-title">Add terminal</h2>
            <form className="admin-form" onSubmit={addTerminal}>
              <label>
                Terminal name
                <input
                  value={terminalName}
                  onChange={(event) => setTerminalName(event.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label>
                Terminal code
                <input
                  value={terminalCode}
                  onChange={(event) => setTerminalCode(event.target.value)}
                  placeholder="POS-MAIN-02"
                  required
                />
              </label>
              <label>
                Sales point
                <select
                  value={salesPointId}
                  onChange={(event) => setSalesPointId(event.target.value)}
                  required
                >
                  {salesPoints.map((salesPoint) => (
                    <option key={salesPoint.id} value={salesPoint.id}>
                      {salesPoint.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="confirm-dialog__actions">
                <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  Add terminal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={revokeId !== null}
        title="Revoke terminal"
        message="This immediately invalidates the terminal credential. Continue?"
        confirmLabel="Revoke"
        onConfirm={() => void confirmRevoke()}
        onCancel={() => setRevokeId(null)}
      />
    </AdminPageShell>
  );
}
