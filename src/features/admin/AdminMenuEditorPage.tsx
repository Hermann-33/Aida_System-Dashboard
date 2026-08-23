import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatRmFromSen } from '../../shared/formatting/money';
import {
  fetchAdminCatalogue,
  fetchPublishedCatalogue,
  saveCatalogueItem,
  type CatalogueItem,
  type CatalogueSnapshot,
  type CatalogueVariant,
  type SaveCustomizationOptionPayload,
} from '../catalogue/catalogueClient';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';

const ADMIN_CATALOGUE_QUERY = ['admin-catalogue'] as const;

type DraftVariant = Omit<CatalogueVariant, 'id'> & { id?: string };
type DraftOption = SaveCustomizationOptionPayload & { groupId: string; groupName: string };

export function AdminMenuEditorPage() {
  const preview = isUiPreviewMode();
  const { id = '' } = useParams();
  const catalogue = useQuery<CatalogueSnapshot>({
    queryKey: preview ? ['public-catalogue'] : ADMIN_CATALOGUE_QUERY,
    queryFn: () => preview ? fetchPublishedCatalogue() : fetchAdminCatalogue(),
  });

  if (catalogue.isPending) {
    return <AdminPageShell pageId="admin-menu-editor" title="Menu item editor" hint="Loading shared catalogue…">{null}</AdminPageShell>;
  }
  if (catalogue.isError || !catalogue.data) {
    return (
      <AdminPageShell pageId="admin-menu-editor" title="Menu item editor" hint="Unable to load catalogue.">
        <div className="empty-state" role="alert">
          <p>{catalogue.error instanceof Error ? catalogue.error.message : 'Catalogue unavailable.'}</p>
          <button type="button" className="btn-secondary" onClick={() => void catalogue.refetch()}>Retry</button>
        </div>
      </AdminPageShell>
    );
  }

  const item = catalogue.data.items.find((candidate) => candidate.id === id);
  if (!item) {
    return (
      <AdminPageShell pageId="admin-menu-editor" title="Menu item editor" hint="Item not found in the shared catalogue.">
        <div className="empty-state">
          <p>Unknown item id: {id}</p>
          <Link to="/admin/catalogue/menu" className="btn-secondary">Back to menu</Link>
        </div>
      </AdminPageShell>
    );
  }

  return <LoadedMenuEditor key={`${item.id}:${catalogue.data.revision}`} item={item} catalogue={catalogue.data} readOnly={preview} />;
}

function LoadedMenuEditor({ item, catalogue, readOnly }: { item: CatalogueItem; catalogue: CatalogueSnapshot; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(item.name);
  const [sku, setSku] = useState(item.sku);
  const [description, setDescription] = useState(item.description);
  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [kind, setKind] = useState<'product' | 'addon'>(item.kind);
  const [priceSen, setPriceSen] = useState(item.basePriceSen);
  const [available, setAvailable] = useState(item.isAvailable);
  const [published, setPublished] = useState(item.isPublished);
  const [featured, setFeatured] = useState(item.isFeatured);
  const [bestSeller, setBestSeller] = useState(item.isBestSeller);
  const [studentEligible, setStudentEligible] = useState(item.isStudentEligible);
  const [isDrink, setIsDrink] = useState(item.isDrink);
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? '');
  const [volumeMl, setVolumeMl] = useState(item.volumeMl?.toString() ?? '');
  const [prepRoute, setPrepRoute] = useState<'bar' | 'kitchen'>(item.prepRoute);
  const [sortOrder, setSortOrder] = useState(item.sortOrder);
  const [variants, setVariants] = useState<DraftVariant[]>(item.variants.map((variant) => ({ ...variant })));
  const [compatibleAddOnIds, setCompatibleAddOnIds] = useState<string[]>([...item.compatibleAddOnIds]);
  const [customizationOptions, setCustomizationOptions] = useState<DraftOption[]>(
    item.customizationGroups.flatMap((group) => group.options.map((option) => ({
      groupId: group.id,
      groupName: group.name,
      optionValueId: option.id,
      label: option.label,
      priceDeltaSen: option.priceDeltaSen,
      isAvailable: option.isAvailable,
      isDefault: option.isDefault,
      sortOrder: option.sortOrder,
    }))),
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: saveCatalogueItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_CATALOGUE_QUERY });
      setError('');
      setMessage('Saved. Customer/POS catalogue revision has been updated.');
    },
    onError: (cause) => {
      setMessage('');
      setError(cause instanceof Error ? cause.message : 'Unable to save catalogue item.');
    },
  });

  const addOns = catalogue.items.filter((candidate) => candidate.kind === 'addon' && candidate.id !== item.id);

  function updateVariant(index: number, update: Partial<DraftVariant>) {
    setVariants((current) => current.map((variant, i) => {
      if (i !== index) return update.isDefault === true ? { ...variant, isDefault: false } : variant;
      return { ...variant, ...update };
    }));
  }

  function addVariant() {
    setVariants((current) => [
      ...current,
      {
        code: '',
        label: '',
        priceDeltaSen: 0,
        isDefault: current.length === 0,
        isAvailable: true,
        sortOrder: current.length * 10 + 10,
      },
    ]);
  }

  function removeVariant(index: number) {
    setVariants((current) => {
      const next = current.filter((_, i) => i !== index);
      const first = next[0];
      if (first && !next.some((variant) => variant.isDefault)) next[0] = { ...first, isDefault: true };
      return next;
    });
  }

  function toggleAddOn(id: string) {
    setCompatibleAddOnIds((current) => current.includes(id)
      ? current.filter((candidate) => candidate !== id)
      : [...current, id]);
  }

  function updateCustomization(optionValueId: string, update: Partial<DraftOption>) {
    setCustomizationOptions((current) => {
      const selected = current.find((option) => option.optionValueId === optionValueId);
      if (!selected) return current;
      let next = current.map((option) => {
        if (update.isDefault === true && option.groupId === selected.groupId) {
          return option.optionValueId === optionValueId
            ? { ...option, ...update, isAvailable: true, isDefault: true }
            : { ...option, isDefault: false };
        }
        return option.optionValueId === optionValueId ? { ...option, ...update } : option;
      });

      if (update.isAvailable === false && selected.isDefault) {
        const replacement = next.find((option) => option.groupId === selected.groupId && option.optionValueId !== optionValueId && option.isAvailable);
        if (replacement) {
          next = next.map((option) => option.groupId === selected.groupId
            ? { ...option, isDefault: option.optionValueId === replacement.optionValueId }
            : option);
        }
      }
      return next;
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!name.trim() || !categoryId || priceSen < 0) {
      setError('Name, category and a valid non-negative price are required.');
      return;
    }
    if (variants.length > 0) {
      const availableVariants = variants.filter((variant) => variant.isAvailable);
      const availableDefaults = availableVariants.filter((variant) => variant.isDefault);
      if (availableVariants.length === 0 || availableDefaults.length !== 1) {
        setError('Items with variants require at least one available variant and exactly one available default.');
        return;
      }
    }

    if (isDrink && customizationOptions.length > 0) {
      const groupIds = [...new Set(customizationOptions.map((option) => option.groupId))];
      for (const groupId of groupIds) {
        const availableOptions = customizationOptions.filter((option) => option.groupId === groupId && option.isAvailable);
        const defaults = availableOptions.filter((option) => option.isDefault);
        if (availableOptions.length === 0 || defaults.length !== 1) {
          setError('Each drink option group needs at least one available option and exactly one available default.');
          return;
        }
      }
    }

    save.mutate({
      id: item.id,
      categoryId,
      name: name.trim(),
      sku: sku.trim(),
      kind,
      description,
      basePriceSen: priceSen,
      isAvailable: available,
      isPublished: published,
      isFeatured: featured,
      isBestSeller: bestSeller,
      isStudentEligible: studentEligible,
      isDrink: kind === 'product' && isDrink,
      imageUrl: imageUrl.trim() || null,
      volumeMl: volumeMl.trim() ? Number(volumeMl) : null,
      prepRoute,
      sortOrder,
      variants: variants.map((variant, index) => ({
        code: variant.code.trim() || undefined,
        label: variant.label.trim(),
        priceDeltaSen: variant.priceDeltaSen,
        isDefault: variant.isDefault,
        isAvailable: variant.isAvailable,
        sortOrder: variant.sortOrder || index * 10 + 10,
      })),
      compatibleAddOnIds: kind === 'product' ? compatibleAddOnIds : [],
      ...(kind === 'product' && isDrink && customizationOptions.length > 0
        ? { customizationOptions: customizationOptions.map(({ groupId: _groupId, groupName: _groupName, ...option }) => option) }
        : {}),
    });
  }

  const optionGroups = item.customizationGroups.map((group) => ({
    ...group,
    options: customizationOptions.filter((option) => option.groupId === group.id),
  }));

  return (
    <AdminPageShell
      pageId="admin-menu-editor"
      title="Menu item editor"
      hint={`Editing ${item.name} (${item.sku}) · catalogue revision ${catalogue.revision}`}
      actions={<Link to="/admin/catalogue/menu" className="btn-secondary">Back to list</Link>}
    >
      {readOnly && <div className="empty-state" role="status"><p>UI Preview can inspect the live published catalogue only. A real AIDA Admin session is required to edit menu data.</p></div>}
      <form className="admin-form admin-form--menu-editor" onSubmit={onSubmit}>
        <fieldset disabled={readOnly} className="contents">
          <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>SKU<input value={sku} onChange={(event) => setSku(event.target.value.toUpperCase())} required /></label>
          <label>
            Category
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
              {catalogue.categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.isActive ? '' : ' (inactive)'}</option>)}
            </select>
          </label>
          <label>
            Type
            <select value={kind} onChange={(event) => {
              const next = event.target.value as 'product' | 'addon';
              setKind(next);
              if (next === 'addon') setIsDrink(false);
            }}>
              <option value="product">Product</option>
              <option value="addon">Add-on</option>
            </select>
          </label>
          <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={1000} /></label>
          <label>Base price (sen)<input type="number" min="0" value={priceSen} onChange={(event) => setPriceSen(Number(event.target.value))} required /></label>
          <p className="form-hint">Customer base price: {formatRmFromSen(priceSen)}</p>
          <label>Image URL<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" /></label>
          <label>Volume (ml)<input type="number" min="1" value={volumeMl} onChange={(event) => setVolumeMl(event.target.value)} /></label>
          <label>
            Preparation route
            <select value={prepRoute} onChange={(event) => setPrepRoute(event.target.value as 'bar' | 'kitchen')}>
              <option value="bar">Bar</option><option value="kitchen">Kitchen</option>
            </select>
          </label>
          <label>Sort order<input type="number" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} /></label>

          <div className="admin-check-grid">
            <label className="admin-checkbox"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} />Available</label>
            <label className="admin-checkbox"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />Published to customer/POS</label>
            <label className="admin-checkbox"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />Featured item</label>
            <label className="admin-checkbox"><input type="checkbox" checked={bestSeller} onChange={(event) => setBestSeller(event.target.checked)} />Best seller</label>
            <label className="admin-checkbox"><input type="checkbox" checked={studentEligible} onChange={(event) => setStudentEligible(event.target.checked)} />Student-offer eligible</label>
            {kind === 'product' && <label className="admin-checkbox"><input type="checkbox" checked={isDrink} onChange={(event) => setIsDrink(event.target.checked)} />Drink customization</label>}
          </div>

          <div className="admin-section-heading-row admin-section-title--spaced">
            <div><h2 className="admin-section-title">Variants / sizes</h2><p className="form-hint">Price deltas are stored in sen and shared with customer/POS.</p></div>
            {!readOnly && <button type="button" className="btn-secondary" onClick={addVariant}><Plus size={15} aria-hidden="true" /> Add variant</button>}
          </div>
          {variants.map((variant, index) => (
            <div key={variant.id ?? `new-${index}`} className="modifier-group-card">
              <div className="admin-form-row">
                <label>Label<input value={variant.label} onChange={(event) => updateVariant(index, { label: event.target.value })} required /></label>
                <label>Code<input value={variant.code} onChange={(event) => updateVariant(index, { code: event.target.value.toLowerCase() })} placeholder="auto from label" /></label>
                <label>Price delta (sen)<input type="number" value={variant.priceDeltaSen} onChange={(event) => updateVariant(index, { priceDeltaSen: Number(event.target.value) })} /></label>
              </div>
              <div className="admin-section-heading-row">
                <div className="admin-check-grid">
                  <label className="admin-checkbox"><input type="radio" name="default-variant" checked={variant.isDefault} onChange={() => updateVariant(index, { isDefault: true })} />Default</label>
                  <label className="admin-checkbox"><input type="checkbox" checked={variant.isAvailable} onChange={(event) => updateVariant(index, { isAvailable: event.target.checked })} />Available</label>
                </div>
                {!readOnly && <button type="button" className="btn-secondary" onClick={() => removeVariant(index)} aria-label={`Remove ${variant.label || 'variant'}`}><Trash2 size={15} /></button>}
              </div>
            </div>
          ))}

          {kind === 'product' && isDrink && (
            <div className="admin-section-title--spaced">
              <h2 className="admin-section-title">Drink options</h2>
              <p className="form-hint">Temperature and Sweetness are required single-choice groups. Edit the customer label, price delta, availability and default per drink.</p>
              {optionGroups.length === 0 && <div className="empty-state"><p>Save this item once to initialize the standard drink option groups.</p></div>}
              {optionGroups.map((group) => (
                <div key={group.id} className="modifier-group-card">
                  <h3 className="admin-section-title">{group.name}</h3>
                  {group.options.map((option) => (
                    <div key={option.optionValueId} className="admin-form-row">
                      <label>Customer label<input value={option.label} onChange={(event) => updateCustomization(option.optionValueId, { label: event.target.value })} required /></label>
                      <label>Price delta (sen)<input type="number" value={option.priceDeltaSen} onChange={(event) => updateCustomization(option.optionValueId, { priceDeltaSen: Number(event.target.value) })} /></label>
                      <label className="admin-checkbox"><input type="checkbox" checked={option.isAvailable} onChange={(event) => updateCustomization(option.optionValueId, { isAvailable: event.target.checked })} />Available</label>
                      <label className="admin-checkbox"><input type="radio" name={`default-${group.id}`} checked={option.isDefault} disabled={!option.isAvailable} onChange={() => updateCustomization(option.optionValueId, { isDefault: true })} />Default</label>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {kind === 'product' && addOns.length > 0 && (
            <div className="admin-section-title--spaced">
              <h2 className="admin-section-title">Compatible add-ons</h2>
              <p className="form-hint">Checked extras appear in this product's Customize section. Each cart line keeps its own selections, so Boba can be added to one drink without affecting another.</p>
              <div className="admin-check-grid">
                {addOns.map((addOn) => (
                  <label key={addOn.id} className="admin-checkbox">
                    <input type="checkbox" checked={compatibleAddOnIds.includes(addOn.id)} onChange={() => toggleAddOn(addOn.id)} />
                    {addOn.name} ({formatRmFromSen(addOn.basePriceSen)})
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p role="alert" className="form-error">{error}</p>}
          {message && <p role="status" className="form-hint">{message}</p>}
          {!readOnly && <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save catalogue item'}</button>}
        </fieldset>
      </form>
    </AdminPageShell>
  );
}
