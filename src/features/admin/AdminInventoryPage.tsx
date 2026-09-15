import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminPageShell } from './AdminPageShell';
import { fetchOperationalLocations, type OperationalBranch } from '../locations/operationalLocationClient';
import { fetchAdminCatalogue, type CatalogueItem } from '../catalogue/catalogueClient';
import {
  fetchInventoryState,
  recordInventoryMovement,
  saveInventoryItem,
  saveRecipe,
  type InventoryState,
} from '../inventory/inventoryClient';
import './admin.css';

type LoadState = 'loading' | 'ready' | 'error';
type RecipeDraftComponent = { inventoryItemId: string; quantity: string };

function formatMilli(value: number, unit: 'g' | 'ml' | 'unit') {
  const amount = value / 1000;
  return `${Number.isInteger(amount) ? amount : amount.toFixed(3)} ${unit}`;
}

export function AdminInventoryPage() {
  const [branches, setBranches] = useState<OperationalBranch[]>([]);
  const [catalogueItems, setCatalogueItems] = useState<CatalogueItem[]>([]);
  const [branchId, setBranchId] = useState('');
  const [state, setState] = useState<InventoryState | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<'g' | 'ml' | 'unit'>('unit');

  const [movementItemId, setMovementItemId] = useState('');
  const [movementQty, setMovementQty] = useState('');
  const [movementKind, setMovementKind] = useState<'receiving' | 'waste' | 'adjustment'>('receiving');
  const [movementNote, setMovementNote] = useState('');

  const [recipeItemId, setRecipeItemId] = useState('');
  const [recipeVariantId, setRecipeVariantId] = useState('');
  const [recipeName, setRecipeName] = useState('');
  const [recipeComponents, setRecipeComponents] = useState<RecipeDraftComponent[]>([{ inventoryItemId: '', quantity: '' }]);

  async function reload(targetBranchId = branchId) {
    if (!targetBranchId) return;
    setLoadState('loading');
    setError('');
    try {
      const next = await fetchInventoryState(targetBranchId);
      setState(next);
      setMovementItemId((current) => current || next.items[0]?.id || '');
      setRecipeComponents((current) => current.map((component) => ({
        ...component,
        inventoryItemId: component.inventoryItemId || next.items[0]?.id || '',
      })));
      setLoadState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Inventory could not be loaded');
      setLoadState('error');
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([fetchOperationalLocations(), fetchAdminCatalogue()]).then(([rows, catalogue]) => {
      if (!active) return;
      const available = rows.filter((row) => row.isActive);
      setBranches(available);
      setCatalogueItems(catalogue.items);
      setRecipeItemId((current) => current || catalogue.items[0]?.id || '');
      const defaultBranch = available.find((row) => row.isDefault) ?? available[0];
      if (!defaultBranch) {
        setError('No active branch is available');
        setLoadState('error');
        return;
      }
      setBranchId(defaultBranch.id);
      void reload(defaultBranch.id);
    }).catch((cause) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : 'Inventory dependencies could not be loaded');
      setLoadState('error');
    });
    return () => { active = false; };
    // Initial authority load only; branch changes are handled explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedBranch = useMemo(() => branches.find((row) => row.id === branchId), [branches, branchId]);
  const selectedRecipeItem = useMemo(() => catalogueItems.find((item) => item.id === recipeItemId), [catalogueItems, recipeItemId]);

  async function runMutation(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Inventory update failed');
    } finally {
      setBusy(false);
    }
  }

  function submitItem(event: FormEvent) {
    event.preventDefault();
    if (!sku.trim() || !name.trim()) return;
    void runMutation(async () => {
      await saveInventoryItem({ sku: sku.trim(), name: name.trim(), baseUnit: unit, isActive: true });
      setSku(''); setName('');
    });
  }

  function submitMovement(event: FormEvent) {
    event.preventDefault();
    const numeric = Number(movementQty);
    if (!branchId || !movementItemId || !Number.isFinite(numeric) || numeric === 0) return;
    const absoluteMilli = Math.round(Math.abs(numeric) * 1000);
    const deltaMilli = movementKind === 'receiving' ? absoluteMilli : movementKind === 'waste' ? -absoluteMilli : Math.round(numeric * 1000);
    void runMutation(async () => {
      await recordInventoryMovement({ branchId, inventoryItemId: movementItemId, deltaMilli, movementKind, note: movementNote.trim() || undefined });
      setMovementQty(''); setMovementNote('');
    });
  }

  function updateRecipeComponent(index: number, patch: Partial<RecipeDraftComponent>) {
    setRecipeComponents((current) => current.map((component, rowIndex) => rowIndex === index ? { ...component, ...patch } : component));
  }

  function addRecipeComponent() {
    setRecipeComponents((current) => [...current, { inventoryItemId: state?.items[0]?.id || '', quantity: '' }]);
  }

  function removeRecipeComponent(index: number) {
    setRecipeComponents((current) => current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index));
  }

  function submitRecipe(event: FormEvent) {
    event.preventDefault();
    const parsedComponents = recipeComponents.map((component) => ({
      inventoryItemId: component.inventoryItemId,
      quantityMilli: Math.round(Number(component.quantity) * 1000),
    }));
    const uniqueInventoryItems = new Set(parsedComponents.map((component) => component.inventoryItemId));
    const invalidComponent = parsedComponents.some((component) => !component.inventoryItemId || !Number.isSafeInteger(component.quantityMilli) || component.quantityMilli <= 0);
    if (!recipeItemId || !recipeName.trim() || invalidComponent || uniqueInventoryItems.size !== parsedComponents.length) {
      setError('Recipe needs a catalogue item, a name, and unique positive inventory components.');
      return;
    }
    void runMutation(async () => {
      await saveRecipe({
        itemId: recipeItemId,
        variantId: recipeVariantId || null,
        name: recipeName.trim(),
        isActive: true,
        components: parsedComponents,
      });
      setRecipeName('');
      setRecipeComponents([{ inventoryItemId: state?.items[0]?.id || '', quantity: '' }]);
    });
  }

  return (
    <AdminPageShell pageId="admin-inventory" title="Inventory & recipes" hint="Live branch inventory. All balances and recipe consumption are server-authoritative.">
      <div className="admin-form-grid">
        <label>
          Branch
          <select value={branchId} disabled={busy} onChange={(event) => { const id=event.target.value; setBranchId(id); void reload(id); }}>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>)}
          </select>
        </label>
      </div>

      {error && <p role="alert" className="form-error">{error}</p>}
      {loadState === 'loading' && <p className="form-hint">Loading authoritative inventory…</p>}

      {loadState === 'ready' && state && (
        <>
          <h2 className="admin-section-title admin-section-title--spaced">Stock on hand — {selectedBranch?.name ?? 'Branch'}</h2>
          <table className="data-table admin-table">
            <thead><tr><th>SKU</th><th>Item</th><th>On hand</th><th>Status</th></tr></thead>
            <tbody>
              {state.items.length === 0 ? <tr><td colSpan={4}>No inventory items configured.</td></tr> : state.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.sku}</td><td>{item.name}</td><td>{formatMilli(item.onHandMilli,item.baseUnit)}</td>
                  <td>{item.onHandMilli === 0 ? <span className="status-pill status-pill--warn">Out</span> : <span className="status-pill status-pill--ok">Available</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="admin-section-title admin-section-title--spaced">Add inventory item</h2>
          <form className="admin-form-grid" onSubmit={submitItem}>
            <label>SKU<input value={sku} onChange={(event)=>setSku(event.target.value)} required /></label>
            <label>Name<input value={name} onChange={(event)=>setName(event.target.value)} required /></label>
            <label>Base unit<select value={unit} onChange={(event)=>setUnit(event.target.value as 'g'|'ml'|'unit')}><option value="unit">unit</option><option value="g">g</option><option value="ml">ml</option></select></label>
            <button className="btn-primary" type="submit" disabled={busy}>Save item</button>
          </form>

          <h2 className="admin-section-title admin-section-title--spaced">Receive / waste / adjust stock</h2>
          <form className="admin-form-grid" onSubmit={submitMovement}>
            <label>Inventory item<select value={movementItemId} onChange={(event)=>setMovementItemId(event.target.value)} required>{state.items.map((item)=><option key={item.id} value={item.id}>{item.sku} — {item.name}</option>)}</select></label>
            <label>Movement<select value={movementKind} onChange={(event)=>setMovementKind(event.target.value as 'receiving'|'waste'|'adjustment')}><option value="receiving">Receiving</option><option value="waste">Waste</option><option value="adjustment">Adjustment (+/-)</option></select></label>
            <label>Quantity in base units<input type="number" step="0.001" value={movementQty} onChange={(event)=>setMovementQty(event.target.value)} required /></label>
            <label>Note<input value={movementNote} onChange={(event)=>setMovementNote(event.target.value)} /></label>
            <button className="btn-primary" type="submit" disabled={busy || state.items.length===0}>Post movement</button>
          </form>

          <h2 className="admin-section-title admin-section-title--spaced">Recipes</h2>
          <table className="data-table admin-table">
            <thead><tr><th>Name</th><th>Catalogue item</th><th>Variant</th><th>Components</th></tr></thead>
            <tbody>{state.recipes.length===0 ? <tr><td colSpan={4}>No recipes configured.</td></tr> : state.recipes.map((recipe)=>{
              const catalogueItem = catalogueItems.find((item)=>item.id===recipe.itemId);
              const variant = catalogueItem?.variants.find((row)=>row.id===recipe.variantId);
              return <tr key={recipe.id}><td>{recipe.name}</td><td>{catalogueItem ? `${catalogueItem.sku} — ${catalogueItem.name}` : recipe.itemId}</td><td>{variant?.label ?? (recipe.variantId ? recipe.variantId : 'Default')}</td><td>{recipe.components.map((component)=>`${state.items.find((item)=>item.id===component.inventoryItemId)?.name ?? component.inventoryItemId}: ${component.quantityMilli/1000}`).join(', ')}</td></tr>;
            })}</tbody>
          </table>

          <h2 className="admin-section-title admin-section-title--spaced">Create recipe</h2>
          <p className="form-hint">Select the live catalogue product or add-on. Variant-specific recipes override the item's default recipe. Add every ingredient consumed by one catalogue unit.</p>
          <form className="admin-form" onSubmit={submitRecipe}>
            <div className="admin-form-grid">
              <label>Catalogue item<select value={recipeItemId} onChange={(event)=>{setRecipeItemId(event.target.value);setRecipeVariantId('');}} required>{catalogueItems.map((item)=><option key={item.id} value={item.id}>{item.sku} — {item.name}{item.kind==='addon'?' (add-on)':''}</option>)}</select></label>
              <label>Variant<select value={recipeVariantId} onChange={(event)=>setRecipeVariantId(event.target.value)}><option value="">Default recipe</option>{selectedRecipeItem?.variants.map((variant)=><option key={variant.id} value={variant.id}>{variant.label}</option>)}</select></label>
              <label>Recipe name<input value={recipeName} onChange={(event)=>setRecipeName(event.target.value)} required /></label>
            </div>
            {recipeComponents.map((component, index) => (
              <div className="admin-form-grid" key={index}>
                <label>Component {index + 1}<select value={component.inventoryItemId} onChange={(event)=>updateRecipeComponent(index,{ inventoryItemId:event.target.value })} required>{state.items.map((item)=><option key={item.id} value={item.id}>{item.sku} — {item.name}</option>)}</select></label>
                <label>Quantity in base units<input type="number" min="0.001" step="0.001" value={component.quantity} onChange={(event)=>updateRecipeComponent(index,{ quantity:event.target.value })} required /></label>
                {recipeComponents.length > 1 && <button className="btn-secondary" type="button" onClick={()=>removeRecipeComponent(index)} disabled={busy}>Remove component</button>}
              </div>
            ))}
            <div className="confirm-dialog__actions">
              <button className="btn-secondary" type="button" onClick={addRecipeComponent} disabled={busy || state.items.length===0}>Add component</button>
              <button className="btn-primary" type="submit" disabled={busy || state.items.length===0 || catalogueItems.length===0}>Save active recipe</button>
            </div>
          </form>
        </>
      )}
    </AdminPageShell>
  );
}
