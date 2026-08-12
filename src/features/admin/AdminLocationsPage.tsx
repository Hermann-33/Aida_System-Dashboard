import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { PREVIEW_ORG } from '../../preview/fixtures/catalog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

type Tab = 'overview' | 'directory';

type SalesPointState = {
  id: string;
  name: string;
  code: string;
  terminals: string[];
  inventory: string;
};

type BranchState = {
  id: string;
  name: string;
  code: string;
  status: 'open' | 'closed';
  hours: string;
  orderTypes: string[];
  salesPoints: SalesPointState[];
};

const ORDER_TYPE_OPTIONS = ['Dine-in', 'Takeaway', 'Pickup'];

const INITIAL_BRANCHES: BranchState[] = PREVIEW_ORG.branches.map((b) => ({ ...b }));

type BranchForm = {
  id: string | null;
  name: string;
  code: string;
  hours: string;
  orderTypes: string[];
};

const EMPTY_BRANCH_FORM: BranchForm = { id: null, name: '', code: '', hours: '', orderTypes: ['Dine-in'] };

type SalesPointForm = { name: string; code: string; terminals: string; inventory: string };

const emptySalesPointForm = (): SalesPointForm => ({
  name: '',
  code: '',
  terminals: '',
  inventory: PREVIEW_ORG.inventoryCode,
});

/** Branches and Sales Points used to be two separate pages showing
 * overlapping information (every branch card already lists its own sales
 * points) — merged into one page: a per-branch overview, and a flat
 * cross-branch directory for quick scanning once there's more than one
 * branch to compare. */
export function AdminLocationsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [branches, setBranches] = useState<BranchState[]>(INITIAL_BRANCHES);

  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [branchForm, setBranchForm] = useState<BranchForm>(EMPTY_BRANCH_FORM);

  const [spBranchId, setSpBranchId] = useState<string | null>(null);
  const [spForm, setSpForm] = useState<SalesPointForm>(emptySalesPointForm());

  const directoryRows = branches.flatMap((b) =>
    b.salesPoints.map((sp) => ({
      branch: b.name,
      branchCode: b.code,
      ...sp,
    })),
  );

  function openAddBranch() {
    setBranchForm(EMPTY_BRANCH_FORM);
    setBranchDialogOpen(true);
  }

  function openEditBranch(b: BranchState) {
    setBranchForm({ id: b.id, name: b.name, code: b.code, hours: b.hours, orderTypes: b.orderTypes });
    setBranchDialogOpen(true);
  }

  function closeBranchDialog() {
    setBranchDialogOpen(false);
  }

  function toggleOrderType(value: string) {
    setBranchForm((f) => ({
      ...f,
      orderTypes: f.orderTypes.includes(value)
        ? f.orderTypes.filter((v) => v !== value)
        : [...f.orderTypes, value],
    }));
  }

  function toggleBranchStatus(id: string) {
    setBranches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: b.status === 'open' ? 'closed' : 'open' } : b)),
    );
  }

  function handleBranchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = branchForm.name.trim();
    const code = branchForm.code.trim().toUpperCase();
    if (!name || !code) return;

    if (branchForm.id) {
      const id = branchForm.id;
      setBranches((prev) =>
        prev.map((b) =>
          b.id === id
            ? { ...b, name, code, hours: branchForm.hours.trim(), orderTypes: branchForm.orderTypes }
            : b,
        ),
      );
    } else {
      const newBranch: BranchState = {
        id: `custom-${code.toLowerCase()}-${branches.length}`,
        name,
        code,
        status: 'open',
        hours: branchForm.hours.trim() || '07:00–22:00 MYT',
        orderTypes: branchForm.orderTypes,
        salesPoints: [],
      };
      setBranches((prev) => [...prev, newBranch]);
    }
    closeBranchDialog();
  }

  function openAddSalesPoint(branchId: string) {
    setSpForm(emptySalesPointForm());
    setSpBranchId(branchId);
  }

  function closeSalesPointDialog() {
    setSpBranchId(null);
  }

  function handleSalesPointSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = spForm.name.trim();
    const code = spForm.code.trim().toUpperCase();
    if (!name || !code || !spBranchId) return;

    const newSalesPoint: SalesPointState = {
      id: `custom-sp-${code.toLowerCase()}`,
      name,
      code,
      terminals: spForm.terminals
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      inventory: spForm.inventory.trim() || PREVIEW_ORG.inventoryCode,
    };
    setBranches((prev) =>
      prev.map((b) => (b.id === spBranchId ? { ...b, salesPoints: [...b.salesPoints, newSalesPoint] } : b)),
    );
    closeSalesPointDialog();
  }

  return (
    <AdminPageShell
      pageId="admin-locations"
      title="Locations"
      hint={`Organisation ${PREVIEW_ORG.organisation} · inventory code ${PREVIEW_ORG.inventoryCode} shared.`}
      actions={
        <button type="button" className="btn-primary" onClick={openAddBranch}>
          <Plus size={16} aria-hidden="true" />
          Add branch
        </button>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="directory">Sales point directory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <article className="org-card">
            <h2 className="admin-section-title">{PREVIEW_ORG.organisation}</h2>
            <p className="form-hint">Master inventory relationship: {PREVIEW_ORG.inventoryCode}</p>
          </article>

          {branches.map((b) => (
            <article key={b.id} className="branch-card">
              <header>
                <h2 className="admin-section-title">
                  {b.name} <span className="branch-code">{b.code}</span>
                </h2>
                <span className={`status-pill status-pill--${b.status === 'open' ? 'ok' : 'info'}`}>{b.status}</span>
              </header>
              <p>Hours {b.hours}</p>
              <p>Order types: {b.orderTypes.length ? b.orderTypes.join(', ') : '—'}</p>
              <table className="data-table admin-table">
                <thead>
                  <tr>
                    <th>Sales point</th>
                    <th>Code</th>
                    <th>Terminals</th>
                    <th>Inventory</th>
                  </tr>
                </thead>
                <tbody>
                  {b.salesPoints.map((sp) => (
                    <tr key={sp.id}>
                      <td>{sp.name}</td>
                      <td>{sp.code}</td>
                      <td>{sp.terminals.length ? sp.terminals.join(', ') : '—'}</td>
                      <td>{sp.inventory}</td>
                    </tr>
                  ))}
                  {b.salesPoints.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty-state">
                        No sales points yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="admin-row-actions branch-card__actions">
                <button type="button" className="btn-secondary btn-sm" onClick={() => openEditBranch(b)}>
                  Edit branch
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => toggleBranchStatus(b.id)}>
                  {b.status === 'open' ? 'Close branch' : 'Reopen branch'}
                </button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => openAddSalesPoint(b.id)}>
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
                <th>Terminals</th>
                <th>Inventory pool</th>
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
                  <td>{row.terminals.length ? row.terminals.join(', ') : '—'}</td>
                  <td>{row.inventory}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="form-hint" role="note">
            Branches and sales points added here exist in this browser session only — no location API yet.
          </p>
        </TabsContent>
      </Tabs>

      {branchDialogOpen && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={closeBranchDialog}>
          <div
            className="confirm-dialog confirm-dialog--wide"
            role="dialog"
            aria-labelledby="branch-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="branch-dialog-title" className="admin-section-title">
              {branchForm.id ? 'Edit branch' : 'Add branch'}
            </h2>
            <p className="form-hint">Session preview only — no location API yet.</p>
            <form className="admin-form" onSubmit={handleBranchSubmit}>
              <label>
                Branch name
                <input
                  value={branchForm.name}
                  onChange={(e) => setBranchForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                />
              </label>
              <label>
                Branch code
                <input
                  value={branchForm.code}
                  onChange={(e) => setBranchForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="BR-XXXX"
                  required
                />
              </label>
              <label>
                Hours
                <input
                  value={branchForm.hours}
                  onChange={(e) => setBranchForm((f) => ({ ...f, hours: e.target.value }))}
                  placeholder="07:00–22:00 MYT"
                />
              </label>
              <div>
                <span className="form-hint" id="order-types-label">
                  Order types
                </span>
                <div className="admin-row-actions" role="group" aria-labelledby="order-types-label">
                  {ORDER_TYPE_OPTIONS.map((opt) => (
                    <label key={opt} className="admin-checkbox">
                      <input
                        type="checkbox"
                        checked={branchForm.orderTypes.includes(opt)}
                        onChange={() => toggleOrderType(opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
              <div className="confirm-dialog__actions">
                <button type="button" className="btn-secondary" onClick={closeBranchDialog}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
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
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="sp-dialog-title" className="admin-section-title">
              Add sales point
            </h2>
            <p className="form-hint">Session preview only — no location API yet.</p>
            <form className="admin-form" onSubmit={handleSalesPointSubmit}>
              <label>
                Name
                <input
                  value={spForm.name}
                  onChange={(e) => setSpForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                />
              </label>
              <label>
                Code
                <input
                  value={spForm.code}
                  onChange={(e) => setSpForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="SP-XXXX"
                  required
                />
              </label>
              <label>
                Terminals (comma-separated)
                <input
                  value={spForm.terminals}
                  onChange={(e) => setSpForm((f) => ({ ...f, terminals: e.target.value }))}
                  placeholder="POS-XXXX-01"
                />
              </label>
              <label>
                Inventory pool
                <input
                  value={spForm.inventory}
                  onChange={(e) => setSpForm((f) => ({ ...f, inventory: e.target.value }))}
                />
              </label>
              <div className="confirm-dialog__actions">
                <button type="button" className="btn-secondary" onClick={closeSalesPointDialog}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
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
