import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { PREVIEW_MENU, PREVIEW_ORG } from '../../preview/fixtures/catalog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

const RECIPES = [
  { id: 'r1', item: 'Salted Caramel Latte', yield: '1 drink', ingredients: 'Espresso 18g, milk 180ml, caramel 15ml' },
  { id: 'r2', item: 'Butter Croissant', yield: '1 unit', ingredients: 'Frozen croissant 1 pc, bake 12 min' },
  { id: 'r3', item: 'Chicken Wrap', yield: '1 wrap', ingredients: 'Tortilla, chicken 80g, veg 40g' },
];

const WASTAGE = [
  { id: 'w1', when: '20 Jul 2026', item: 'Oat milk', qty: '0.5 L', reason: 'Expired', staff: 'Nadia' },
  { id: 'w2', when: '19 Jul 2026', item: 'Butter Croissant', qty: '3 pc', reason: 'End of day', staff: 'Hafiz' },
];

const STOCK_ROWS = PREVIEW_MENU.map((item) => ({
  sku: item.sku,
  name: item.name,
  onHand: item.available ? 24 - item.id.length : 0,
  par: 12,
  inventory: PREVIEW_ORG.inventoryCode,
}));

const SALES_POINT_NAMES = PREVIEW_ORG.branches.flatMap((b) => b.salesPoints.map((sp) => sp.name));

type TransferRow = {
  id: string;
  when: string;
  item: string;
  qty: string;
  from: string;
  to: string;
  note: string;
};

const INITIAL_TRANSFERS: TransferRow[] = [
  { id: 't1', when: '20 Jul 2026 15:30', item: 'Butter Croissant', qty: '12 pc', from: 'Main Counter', to: 'Snack Station', note: 'Afternoon restock' },
  { id: 't2', when: '19 Jul 2026 08:10', item: 'Oat milk', qty: '2 L', from: 'Main Counter', to: 'Snack Station', note: 'Opening prep' },
];

type TransferForm = { item: string; qty: string; from: string; to: string; note: string };

const emptyTransferForm = (): TransferForm => ({
  item: STOCK_ROWS[0]?.name ?? '',
  qty: '',
  from: SALES_POINT_NAMES[0] ?? '',
  to: SALES_POINT_NAMES[1] ?? SALES_POINT_NAMES[0] ?? '',
  note: '',
});

type Tab = 'stock' | 'recipes' | 'wastage' | 'transfers';

/** Stock, Recipes, Wastage, and the old Reports > Inventory low-stock view
 * used to be 4 separate pages over the same small ingredient list — one
 * page, tabbed, until there's enough real inventory data to justify
 * splitting them apart again. */
export function AdminInventoryPage() {
  const [tab, setTab] = useState<Tab>('stock');
  const low = STOCK_ROWS.filter((r) => r.onHand > 0 && r.onHand <= r.par);

  const [transfers, setTransfers] = useState<TransferRow[]>(INITIAL_TRANSFERS);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferForm>(emptyTransferForm);

  function openTransferDialog() {
    setTransferForm(emptyTransferForm());
    setTransferDialogOpen(true);
  }

  function closeTransferDialog() {
    setTransferDialogOpen(false);
  }

  function handleTransferSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const qty = transferForm.qty.trim();
    if (!transferForm.item || !qty || !transferForm.from || !transferForm.to) return;
    if (transferForm.from === transferForm.to) return;

    const newTransfer: TransferRow = {
      id: `custom-${transfers.length}`,
      when: 'Just now (preview)',
      item: transferForm.item,
      qty,
      from: transferForm.from,
      to: transferForm.to,
      note: transferForm.note.trim(),
    };
    setTransfers((prev) => [newTransfer, ...prev]);
    closeTransferDialog();
  }

  return (
    <AdminPageShell
      pageId="admin-inventory"
      title="Inventory"
      hint={`Pool ${PREVIEW_ORG.inventoryCode} — shared across sales points.`}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="stock">Stock on hand</TabsTrigger>
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
          <TabsTrigger value="wastage">Wastage</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th>On hand</th>
                <th>Par</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {STOCK_ROWS.map((row) => (
                <tr key={row.sku}>
                  <td>{row.sku}</td>
                  <td>{row.name}</td>
                  <td>{row.onHand}</td>
                  <td>{row.par}</td>
                  <td>
                    {row.onHand === 0 ? (
                      <span className="status-pill status-pill--warn">Sold out</span>
                    ) : row.onHand <= row.par ? (
                      <span className="status-pill status-pill--warn">Low</span>
                    ) : (
                      <span className="status-pill status-pill--ok">In stock</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="admin-section-title admin-section-title--spaced">Low stock alerts</h2>
          {low.length === 0 ? (
            <p className="form-hint">No low-stock rows in sample.</p>
          ) : (
            <ul className="admin-alerts admin-alerts--inline">
              {low.map((r) => (
                <li key={r.sku}>
                  {r.name} ({r.onHand} left)
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="recipes">
          <p className="form-hint">COGS and yield tracking — future inventory API.</p>
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Menu item</th>
                <th>Yield</th>
                <th>Ingredients (sample)</th>
              </tr>
            </thead>
            <tbody>
              {RECIPES.map((r) => (
                <tr key={r.id}>
                  <td>{r.item}</td>
                  <td>{r.yield}</td>
                  <td>{r.ingredients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="wastage">
          <p className="form-hint">Adjustments post to inventory when API connects.</p>
          {WASTAGE.length === 0 ? (
            <div className="empty-state">
              <h2 className="admin-section-title">No wastage logged</h2>
            </div>
          ) : (
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Reason</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {WASTAGE.map((row) => (
                  <tr key={row.id}>
                    <td>{row.when}</td>
                    <td>{row.item}</td>
                    <td>{row.qty}</td>
                    <td>{row.reason}</td>
                    <td>{row.staff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>

        <TabsContent value="transfers">
          <div className="admin-row-actions admin-row-actions--spaced">
            <button type="button" className="btn-primary" onClick={openTransferDialog}>
              <Plus size={16} aria-hidden="true" />
              New transfer
            </button>
          </div>
          {transfers.length === 0 ? (
            <div className="empty-state">
              <h2 className="admin-section-title">No transfers logged</h2>
            </div>
          ) : (
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((row) => (
                  <tr key={row.id}>
                    <td>{row.when}</td>
                    <td>{row.item}</td>
                    <td>{row.qty}</td>
                    <td>{row.from}</td>
                    <td>{row.to}</td>
                    <td>{row.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>
      </Tabs>

      {transferDialogOpen && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={closeTransferDialog}>
          <div
            className="confirm-dialog"
            role="dialog"
            aria-labelledby="transfer-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="transfer-dialog-title" className="admin-section-title">
              New stock transfer
            </h2>
            <p className="form-hint">Session preview only — no inventory API yet.</p>
            <form className="admin-form" onSubmit={handleTransferSubmit}>
              <label>
                Item
                <select
                  value={transferForm.item}
                  onChange={(e) => setTransferForm((f) => ({ ...f, item: e.target.value }))}
                >
                  {STOCK_ROWS.map((row) => (
                    <option key={row.sku} value={row.name}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantity
                <input
                  value={transferForm.qty}
                  onChange={(e) => setTransferForm((f) => ({ ...f, qty: e.target.value }))}
                  placeholder="e.g. 6 pc, 2 L"
                  required
                  autoFocus
                />
              </label>
              <label>
                From
                <select
                  value={transferForm.from}
                  onChange={(e) => setTransferForm((f) => ({ ...f, from: e.target.value }))}
                >
                  {SALES_POINT_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                To
                <select
                  value={transferForm.to}
                  onChange={(e) => setTransferForm((f) => ({ ...f, to: e.target.value }))}
                >
                  {SALES_POINT_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              {transferForm.from === transferForm.to && (
                <p className="form-error">From and To must be different sales points.</p>
              )}
              <label>
                Note (optional)
                <input
                  value={transferForm.note}
                  onChange={(e) => setTransferForm((f) => ({ ...f, note: e.target.value }))}
                />
              </label>
              <div className="confirm-dialog__actions">
                <button type="button" className="btn-secondary" onClick={closeTransferDialog}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={transferForm.from === transferForm.to}>
                  Log transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
