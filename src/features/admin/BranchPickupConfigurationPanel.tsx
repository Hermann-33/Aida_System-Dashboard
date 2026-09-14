import { useState, type FormEvent } from 'react';
import {
  deleteBranchServiceException,
  fetchBranchPickupConfiguration,
  saveBranchPickupConfiguration,
  saveBranchServiceException,
  type BranchPickupConfiguration,
  type BranchServiceWindow,
} from '../locations/pickupSchedulingClient';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function timeValue(value: string | null): string {
  return value ? value.slice(0, 5) : '';
}

function normalizedWindows(config: BranchPickupConfiguration): BranchServiceWindow[] {
  return DAYS.map((_, weekday) => {
    const existing = config.windows.find((window) => window.weekday === weekday);
    return existing ?? {
      weekday,
      isAllDay: false,
      opensAt: '07:00',
      closesAt: '22:00',
      isActive: false,
    };
  });
}

export function BranchPickupConfigurationPanel({ branchId }: { branchId: string }) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<BranchPickupConfiguration | null>(null);
  const [windows, setWindows] = useState<BranchServiceWindow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionClosed, setExceptionClosed] = useState(true);
  const [exceptionAllDay, setExceptionAllDay] = useState(false);
  const [exceptionOpensAt, setExceptionOpensAt] = useState('07:00');
  const [exceptionClosesAt, setExceptionClosesAt] = useState('22:00');
  const [exceptionCapacity, setExceptionCapacity] = useState('');

  async function load() {
    setBusy(true);
    setError('');
    try {
      const next = await fetchBranchPickupConfiguration(branchId);
      setConfig(next);
      setWindows(normalizedWindows(next));
      setOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load pickup configuration');
    } finally {
      setBusy(false);
    }
  }

  function updatePolicy<Key extends keyof BranchPickupConfiguration['policy']>(
    key: Key,
    value: BranchPickupConfiguration['policy'][Key],
  ) {
    setConfig((current) => current
      ? { ...current, policy: { ...current.policy, [key]: value } }
      : current);
  }

  function updateWindow(weekday: number, patch: Partial<BranchServiceWindow>) {
    setWindows((current) => current.map((window) =>
      window.weekday === weekday ? { ...window, ...patch } : window));
  }

  async function savePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config) return;
    setBusy(true);
    setError('');
    try {
      const saved = await saveBranchPickupConfiguration({
        branchId,
        ...config.policy,
        windows: windows.map((window) => ({
          weekday: window.weekday,
          isAllDay: window.isAllDay,
          opensAt: window.isActive && !window.isAllDay ? timeValue(window.opensAt) || null : null,
          closesAt: window.isActive && !window.isAllDay ? timeValue(window.closesAt) || null : null,
          isActive: window.isActive,
        })),
      });
      setConfig(saved);
      setWindows(normalizedWindows(saved));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save pickup configuration');
    } finally {
      setBusy(false);
    }
  }

  async function saveException(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exceptionDate) return;
    setBusy(true);
    setError('');
    try {
      const saved = await saveBranchServiceException({
        branchId,
        serviceDate: exceptionDate,
        isClosed: exceptionClosed,
        isAllDay: !exceptionClosed && exceptionAllDay,
        opensAt: !exceptionClosed && !exceptionAllDay ? exceptionOpensAt : null,
        closesAt: !exceptionClosed && !exceptionAllDay ? exceptionClosesAt : null,
        slotCapacityOrders: exceptionCapacity.trim() ? Number(exceptionCapacity) : null,
      });
      setConfig(saved);
      setWindows(normalizedWindows(saved));
      setExceptionDate('');
      setExceptionCapacity('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save service exception');
    } finally {
      setBusy(false);
    }
  }

  async function removeException(serviceDate: string) {
    setBusy(true);
    setError('');
    try {
      const saved = await deleteBranchServiceException(branchId, serviceDate);
      setConfig(saved);
      setWindows(normalizedWindows(saved));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete service exception');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-secondary btn-sm" onClick={() => void load()} disabled={busy}>
        Scheduling & pickup
      </button>
      {error && !open && <span className="form-hint" role="alert">{error}</span>}

      {open && config && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="confirm-dialog confirm-dialog--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`pickup-config-${branchId}`}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={`pickup-config-${branchId}`} className="admin-section-title">
              {config.branch.name} pickup authority
            </h2>
            <p className="form-hint">Timezone: {config.branch.timezone}. Times below are branch-local.</p>
            {error && <p className="form-hint" role="alert">{error}</p>}

            <form className="admin-form" onSubmit={savePolicy}>
              <div className="admin-row-actions">
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={config.policy.asapEnabled}
                    onChange={(event) => updatePolicy('asapEnabled', event.target.checked)}
                  />
                  ASAP pickup
                </label>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={config.policy.scheduleEnabled}
                    onChange={(event) => updatePolicy('scheduleEnabled', event.target.checked)}
                  />
                  Scheduled pickup
                </label>
              </div>

              <div className="admin-form-grid">
                <label>
                  Minimum lead (min)
                  <input type="number" min="0" max="1440" value={config.policy.minimumLeadMinutes}
                    onChange={(event) => updatePolicy('minimumLeadMinutes', Number(event.target.value))} />
                </label>
                <label>
                  Preparation lead (min)
                  <input type="number" min="0" max="1440" value={config.policy.preparationLeadMinutes}
                    onChange={(event) => updatePolicy('preparationLeadMinutes', Number(event.target.value))} />
                </label>
                <label>
                  Slot interval (min)
                  <input type="number" min="5" max="240" value={config.policy.slotIntervalMinutes}
                    onChange={(event) => updatePolicy('slotIntervalMinutes', Number(event.target.value))} />
                </label>
                <label>
                  Maximum advance (days)
                  <input type="number" min="1" max="31" value={config.policy.maximumAdvanceDays}
                    onChange={(event) => updatePolicy('maximumAdvanceDays', Number(event.target.value))} />
                </label>
                <label>
                  Orders per slot
                  <input type="number" min="1" placeholder="Unlimited"
                    value={config.policy.slotCapacityOrders ?? ''}
                    onChange={(event) => updatePolicy('slotCapacityOrders', event.target.value ? Number(event.target.value) : null)} />
                </label>
              </div>

              <h3 className="admin-section-title">Weekly service windows</h3>
              <table className="data-table admin-table">
                <thead><tr><th>Day</th><th>Open</th><th>All day</th><th>Opens</th><th>Closes</th></tr></thead>
                <tbody>
                  {windows.map((window) => (
                    <tr key={window.weekday}>
                      <td>{DAYS[window.weekday]}</td>
                      <td><input aria-label={`${DAYS[window.weekday]} open`} type="checkbox" checked={window.isActive}
                        onChange={(event) => updateWindow(window.weekday, { isActive: event.target.checked })} /></td>
                      <td><input aria-label={`${DAYS[window.weekday]} all day`} type="checkbox" checked={window.isAllDay}
                        disabled={!window.isActive}
                        onChange={(event) => updateWindow(window.weekday, { isAllDay: event.target.checked })} /></td>
                      <td><input aria-label={`${DAYS[window.weekday]} opens`} type="time" value={timeValue(window.opensAt)}
                        disabled={!window.isActive || window.isAllDay}
                        onChange={(event) => updateWindow(window.weekday, { opensAt: event.target.value || null })} /></td>
                      <td><input aria-label={`${DAYS[window.weekday]} closes`} type="time" value={timeValue(window.closesAt)}
                        disabled={!window.isActive || window.isAllDay}
                        onChange={(event) => updateWindow(window.weekday, { closesAt: event.target.value || null })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="admin-row-actions">
                <button type="submit" className="btn-primary" disabled={busy}>Save pickup policy</button>
              </div>
            </form>

            <hr />
            <h3 className="admin-section-title">Dated exceptions</h3>
            <form className="admin-form" onSubmit={saveException}>
              <div className="admin-form-grid">
                <label>Date<input type="date" value={exceptionDate} onChange={(event) => setExceptionDate(event.target.value)} required /></label>
                <label className="admin-checkbox"><input type="checkbox" checked={exceptionClosed} onChange={(event) => setExceptionClosed(event.target.checked)} />Closed</label>
                <label className="admin-checkbox"><input type="checkbox" checked={exceptionAllDay} disabled={exceptionClosed} onChange={(event) => setExceptionAllDay(event.target.checked)} />All day override</label>
                <label>Opens<input type="time" value={exceptionOpensAt} disabled={exceptionClosed || exceptionAllDay} onChange={(event) => setExceptionOpensAt(event.target.value)} /></label>
                <label>Closes<input type="time" value={exceptionClosesAt} disabled={exceptionClosed || exceptionAllDay} onChange={(event) => setExceptionClosesAt(event.target.value)} /></label>
                <label>Slot capacity<input type="number" min="1" placeholder="Use branch policy" value={exceptionCapacity} onChange={(event) => setExceptionCapacity(event.target.value)} /></label>
              </div>
              <button type="submit" className="btn-secondary" disabled={busy}>Save dated exception</button>
            </form>

            {config.exceptions.length > 0 && (
              <table className="data-table admin-table">
                <thead><tr><th>Date</th><th>Override</th><th>Capacity</th><th>Action</th></tr></thead>
                <tbody>
                  {config.exceptions.map((exception) => (
                    <tr key={exception.serviceDate}>
                      <td>{exception.serviceDate}</td>
                      <td>{exception.isClosed ? 'Closed' : exception.isAllDay ? 'Open all day' : `${timeValue(exception.opensAt)}–${timeValue(exception.closesAt)}`}</td>
                      <td>{exception.slotCapacityOrders ?? 'Branch policy'}</td>
                      <td><button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void removeException(exception.serviceDate)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="confirm-dialog__actions">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
