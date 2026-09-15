import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { PREVIEW_ORG } from '../../preview/fixtures/catalog';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import {
  fetchOperationalLocations,
  saveOperationalBranch,
  saveOperationalSalesPoint,
  type OperationalBranch,
} from '../locations/operationalLocationClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

type Tab = 'overview' | 'directory';

type SalesPointState = {
  id: string;
  name: string;
  code: string;
  terminals: string[];
  active: boolean;
  inventory?: string;
};

type BranchState = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  isDefault: boolean;
  timezone: string;
  hours?: string;
  orderTypes: string[];
  salesPoints: SalesPointState[];
};

const ORDER_TYPE_OPTIONS = ['Dine-in', 'Takeaway', 'Pickup'];

const INITIAL_BRANCHES: BranchState[] = PREVIEW_ORG.branches.map((branch) => ({
  id: branch.id,
  name: branch.name,
  code: branch.code,
  active: branch.status === 'open',
  isDefault: branch.id === PREVIEW_ORG.branches[0]?.id,
  timezone: 'Asia/Kuala_Lumpur',
  hours: branch.hours,
  orderTypes: branch.orderTypes,
  salesPoints: branch.salesPoints.map((salesPoint) => ({
    id: salesPoint.id,
    name: salesPoint.name,
    code: salesPoint.code,
    terminals: salesPoint.terminals,
    active: true,
    inventory: salesPoint.inventory,
  })),
}));

function mapLiveBranches(branches: OperationalBranch[]): BranchState[] {
  return branches.map((branch) => ({
    id: branch.id,
    name: branch.name,
    code: branch.code,
    active: branch.isActive,
    isDefault: branch.isDefault,
    timezone: branch.timezone,
    orderTypes: [],
    salesPoints: branch.salesPoints.map((salesPoint) => ({
      id: salesPoint.id,
      name: salesPoint.name,
      code: salesPoint.code,
      terminals: salesPoint.terminals.map((terminal) => terminal.code),
      active: salesPoint.isActive,
    })),
  }));
}

type BranchForm = {
  id: string | null;
  name: string;
  code: string;
  timezone: string;
  hours: string;
  orderTypes: string[];
};

const EMPTY_BRANCH_FORM: BranchForm = {
  id: null,
  name: '',
  code: '',
  timezone: 'Asia/Kuala_Lumpur',
  hours: '',
  orderTypes: ['Dine-in'],
};

type SalesPointForm = {
  name: string;
  code: string;
  terminals: string;
  inventory: string;
};

const emptySalesPointForm = (): SalesPointForm => ({
  name: '',
  code: '',
  terminals: '',
  inventory: PREVIEW_ORG.inventoryCode,
});

export function AdminLocationsPage() {
  const preview = isUiPreviewMode();
  const [tab, setTab] = useState<Tab>('overview');
  const [branches, setBranches] = useState<BranchState[]>(
    preview ? INITIAL_BRANCHES : [],
  );
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchForm, setBranchForm] = useState<BranchForm>(EMPTY_BRANCH_FORM);
  const [spBranchId, setSpBranchId] = useState<string | null>(null);
  const [spForm, setSpForm] = useState<SalesPointForm>(emptySalesPointForm());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadLive() {
    if (preview) return;
    setError('');
    try {
      setBranches(mapLiveBranches(await fetchOperationalLocations()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load locations');
    }
  }

  useEffect(() => {
    void loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  const directoryRows = branches.flatMap((branch) =>
    branch.salesPoints.map((salesPoint) => ({
      branch: branch.name,
      branchCode: branch.code,
      ...salesPoint,
    })),
  );

  function openAddBranch() {
    setBranchForm(EMPTY_BRANCH_FORM);
    setBranchDialogOpen(true);
  }

  function openEditBranch(branch: BranchState) {
    setBranchForm({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      timezone: branch.timezone,
      hours: branch.hours ?? '',
      orderTypes: branch.orderTypes,
    });
    setBranchDialogOpen(true);
  }

  function closeBranchDialog() {
    setBranchDialogOpen(false);
  }

  function toggleOrderType(value: string) {
    setBranchForm((form) => ({
      ...form,
      orderTypes: form.orderTypes.includes(value)
        ? form.orderTypes.filter((item) => item !== value)
        : [...form.orderTypes, value],
    }));
  }

  async function toggleBranchStatus(branch: BranchState) {
    if (preview) {
      setBranches((previous) =>
        previous.map((item) =>
          item.id === branch.id ? { ...item, active: !item.active } : item,
        ),
      );
      return;
    }

    if (branch.isDefault && branch.active) {
      setError('The default branch cannot be deactivated. Set another active branch as default first.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await saveOperationalBranch({
        id: branch.id,
        name: branch.name,
        code: branch.code,
        timezone: branch.timezone,
        isActive: !branch.active,
        isDefault: branch.isDefault,
      });
      await loadLive();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update branch');
    } finally {
      setBusy(false);
    }
  }

  async function handleBranchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = branchForm.name.trim();
    const code = branchForm.code.trim().toUpperCase();
    if (!name || !code) return;

    if (preview) {
      if (branchForm.id) {
        const id = branchForm.id;
        setBranches((previous) =>
          previous.map((branch) =>
            branch.id === id
              ? {
                  ...branch,
                  name,
                  code,
                  timezone: branchForm.timezone,
                  hours: branchForm.hours.trim(),
                  orderTypes: branchForm.orderTypes,
                }
              : branch,
          ),
        );
      } else {
        setBranches((previous) => [
          ...previous,
          {
            id: `custom-${code.toLowerCase()}-${previous.length}`,
            name,
            code,
            active: true,
            isDefault: false,
            timezone: branchForm.timezone,
            hours: branchForm.hours.trim() || '07:00–22:00 MYT',
            orderTypes: branchForm.orderTypes,
            salesPoints: [],
          },
        ]);
      }
      closeBranchDialog();
      return;
    }

    setBusy(true);
    setError('');
    try {
      const existing = branchForm.id
        ? branches.find((branch) => branch.id === branchForm.id)
        : null;
      await saveOperationalBranch({
        ...(branchForm.id ? { id: branchForm.id } : {}),
        name,
        code,
        timezone: branchForm.timezone.trim() || 'Asia/Kuala_Lumpur',
        isActive: existing?.active ?? true,
        isDefault: existing?.isDefault ?? false,
      });
      closeBranchDialog();
      await loadLive();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save branch');
    } finally {
      setBusy(false);
    }
  }

  function openAddSalesPoint(branchId: string) {
    setSpForm(emptySalesPointForm());
    setSpBranchId(branchId);
  }

  function closeSalesPointDialog() {
    setSpBranchId(null);
  }

  async function handleSalesPointSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = spForm.name.trim();
    const code = spForm.code.trim().toUpperCase();
    if (!name || !code || !spBranchId) return;

    if (preview) {
      const newSalesPoint: SalesPointState = {
        id: `custom-sp-${code.toLowerCase()}`,
        name,
        code,
        terminals: spForm.terminals
          .split(',')
          .map((terminal) => terminal.trim())
          .filter(Boolean),
        active: true,
        inventory: spForm.inventory.trim() || PREVIEW_ORG.inventoryCode,
      };
      setBranches((previous) =>
        previous.map((branch) =>
          branch.id === spBranchId
            ? { ...branch, salesPoints: [...branch.salesPoints, newSalesPoint] }
            : branch,
        ),
      );
      closeSalesPointDialog();
      return;
    }

    setBusy(true);
    setError('');
    try {
      await saveOperationalSalesPoint({
        branchId: spBranchId,
        name,
        code,
        isActive: true,
      });
      closeSalesPointDialog();
      await loadLive();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save sales point');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      pageId="admin-locations"
      title="Locations"
      hint={
        preview
          ? `Organisation ${PREVIEW_ORG.organisation} · inventory code ${PREVIEW_ORG.inventoryCode} shared.`
          : 'Trusted branches and sales points. Hours/capacity are Phase 4; inventory pools are Phase 5.'
      }
      actions={
        <button type="button" className="btn-primary" onClick={openAddBranch} disabled={busy}>
          <Plus size={16} aria-hidden="true" />
          Add branch
        </button>
      }
    >
      {error && <p className="form-hint" role="alert">{error}</p>}

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="directory">Sales point directory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {preview && (
            <article className="org-card">
              <h2 className="admin-section-title">{PREVIEW_ORG.organisation}</h2>
              <p className="form-hint">
                Master inventory relationship: {PREVIEW_ORG.inventoryCode}
              </p>
            </article>
          )}

          {branches.map((branch) => (
            <article key={branch.id} className="branch-card">
              <header>
                <h2 className="admin-section-title">
                  {branch.name} <span className="branch-code">{branch.code}</span>
                </h2>
                <span className={`status-pill status-pill--${branch.active ? 'ok' : 'info'}`}>
                  {preview ? (branch.active ? 'open' : 'closed') : (branch.active ? 'active' : 'inactive')}
                </span>
              </header>

              {preview ? (
                <>
                  <p>Hours {branch.hours}</p>
                  <p>Order types: {branch.orderTypes.length ? branch.orderTypes.join(', ') : '—'}</p>
                </>
              ) : (
                <p>Timezone {branch.timezone}{branch.isDefault ? ' · default branch' : ''}</p>
              )}

              <table className="data-table admin-table">
                <thead>
                  <tr>
                    <th>Sales point</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Terminals</th>
                    {preview && <th>Inventory</th>}
                  </tr>
                </thead>
                <tbody>
                  {branch.salesPoints.map((salesPoint) => (
                    <tr key={salesPoint.id}>
                      <td>{salesPoint.name}</td>
                      <td>{salesPoint.code}</td>
                      <td>{salesPoint.active ? 'Active' : 'Inactive'}</td>
                      <td>{salesPoint.terminals.length ? salesPoint.terminals.join(', ') : '—'}</td>
                      {preview && <td>{salesPoint.inventory}</td>}
                    </tr>
                  ))}
                  {branch.salesPoints.length === 0 && (
                    <tr>
                      <td colSpan={preview ? 5 : 4} className="empty-state">
                        No sales points yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="admin-row-actions branch-card__actions">
                <button type="button" className="btn-secondary btn-sm" onClick={() => openEditBranch(branch)}>
                  Edit branch
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => void toggleBranchStatus(branch)}
                  disabled={busy || (!preview && branch.isDefault && branch.active)}
                >
                  {branch.active ? (preview ? 'Close branch' : 'Deactivate') : (preview ? 'Reopen branch' : 'Reactivate')}
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => openAddSalesPoint(branch.id)}
                  disabled={busy || !branch.active}
                >
                  Add sales point
                </button>
              </div>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="directory">
          <table className="data-table admin-table">
            <caption className="visually-hidden">Sales points by branch</caption>
            <thead>
              <tr>
                <th>Branch</th>
                <th>Sales point</th>
                <th>Code</th>
                <th>Status</th>
                <th>Terminals</th>
                {preview && <th>Inventory pool</th>}
              </tr>
            </thead>
            <tbody>
              {directoryRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.branch} <span className="branch-code">{row.branchCode}</span>
                  </td>
                  <td>{row.name}</td>
                  <td>{row.code}</td>
                  <td>{row.active ? 'Active' : 'Inactive'}</td>
                  <td>{row.terminals.length ? row.terminals.join(', ') : '—'}</td>
                  {preview && <td>{row.inventory}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {!preview && (
            <p className="form-hint" role="note">
              Opening hours, closures, capacity and inventory relationships are intentionally not inferred here.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {branchDialogOpen && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={closeBranchDialog}>
          <div
            className="confirm-dialog confirm-dialog--wide"
            role="dialog"
            aria-labelledby="branch-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="branch-dialog-title" className="admin-section-title">
              {branchForm.id ? 'Edit branch' : 'Add branch'}
            </h2>
            <form className="admin-form" onSubmit={handleBranchSubmit}>
              <label>
                Branch name
                <input
                  value={branchForm.name}
                  onChange={(event) => setBranchForm((form) => ({ ...form, name: event.target.value }))}
                  required
                  autoFocus
                />
              </label>
              <label>
                Branch code
                <input
                  value={branchForm.code}
                  onChange={(event) => setBranchForm((form) => ({ ...form, code: event.target.value }))}
                  placeholder="BR-XXXX"
                  required
                />
              </label>

              {preview ? (
                <>
                  <label>
                    Hours
                    <input
                      value={branchForm.hours}
                      onChange={(event) => setBranchForm((form) => ({ ...form, hours: event.target.value }))}
                      placeholder="07:00–22:00 MYT"
                    />
                  </label>
                  <div>
                    <span className="form-hint" id="order-types-label">Order types</span>
                    <div className="admin-row-actions" role="group" aria-labelledby="order-types-label">
                      {ORDER_TYPE_OPTIONS.map((option) => (
                        <label key={option} className="admin-checkbox">
                          <input
                            type="checkbox"
                            checked={branchForm.orderTypes.includes(option)}
                            onChange={() => toggleOrderType(option)}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <label>
                  IANA timezone
                  <input
                    value={branchForm.timezone}
                    onChange={(event) => setBranchForm((form) => ({ ...form, timezone: event.target.value }))}
                    placeholder="Asia/Kuala_Lumpur"
                    required
                  />
                </label>
              )}

              <div className="confirm-dialog__actions">
                <button type="button" className="btn-secondary" onClick={closeBranchDialog}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {branchForm.id ? 'Save changes' : 'Add branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {spBranchId && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={closeSalesPointDialog}>
          <div
            className="confirm-dialog"
            role="dialog"
            aria-labelledby="sp-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="sp-dialog-title" className="admin-section-title">Add sales point</h2>
            <form className="admin-form" onSubmit={handleSalesPointSubmit}>
              <label>
                Name
                <input
                  value={spForm.name}
                  onChange={(event) => setSpForm((form) => ({ ...form, name: event.target.value }))}
                  required
                  autoFocus
                />
              </label>
              <label>
                Code
                <input
                  value={spForm.code}
                  onChange={(event) => setSpForm((form) => ({ ...form, code: event.target.value }))}
                  placeholder="SP-XXXX"
                  required
                />
              </label>
              {preview && (
                <>
                  <label>
                    Terminals (comma-separated)
                    <input
                      value={spForm.terminals}
                      onChange={(event) => setSpForm((form) => ({ ...form, terminals: event.target.value }))}
                      placeholder="POS-XXXX-01"
                    />
                  </label>
                  <label>
                    Inventory pool
                    <input
                      value={spForm.inventory}
                      onChange={(event) => setSpForm((form) => ({ ...form, inventory: event.target.value }))}
                    />
                  </label>
                </>
              )}
              <div className="confirm-dialog__actions">
                <button type="button" className="btn-secondary" onClick={closeSalesPointDialog}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  Add sales point
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
