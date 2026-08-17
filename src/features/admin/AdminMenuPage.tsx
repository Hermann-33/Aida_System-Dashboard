import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageOff, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatRmFromSen } from '../../shared/formatting/money';
import {
  fetchAdminCatalogue,
  fetchPublishedCatalogue,
  saveCatalogueCategory,
  saveCatalogueItem,
  type CatalogueSnapshot,
} from '../catalogue/catalogueClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';

type Tab = 'items' | 'categories' | 'variants';

const ADMIN_CATALOGUE_QUERY = ['admin-catalogue'] as const;

export function AdminMenuPage() {
  const preview = isUiPreviewMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('items');
  const [addOpen, setAddOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priceRm, setPriceRm] = useState('0.00');
  const [route, setRoute] = useState<'bar' | 'kitchen'>('bar');
  const [kind, setKind] = useState<'product' | 'addon'>('product');
  const [categoryName, setCategoryName] = useState('');
  const [error, setError] = useState('');

  const catalogue = useQuery<CatalogueSnapshot>({
    queryKey: preview ? ['public-catalogue'] : ADMIN_CATALOGUE_QUERY,
    queryFn: () => preview ? fetchPublishedCatalogue() : fetchAdminCatalogue(),
  });

  const items = catalogue.data?.items ?? [];
  const categories = catalogue.data?.categories ?? [];

  const addItem = useMutation({
    mutationFn: saveCatalogueItem,
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_CATALOGUE_QUERY });
      closeAddDialog();
      navigate(`/admin/catalogue/menu/${id}`);
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Unable to add item.'),
  });

  const addCategory = useMutation({
    mutationFn: saveCatalogueCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_CATALOGUE_QUERY });
      setCategoryOpen(false);
      setCategoryName('');
      setError('');
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Unable to add category.'),
  });

  function closeAddDialog() {
    setAddOpen(false);
    setName('');
    setCategoryId('');
    setPriceRm('0.00');
    setRoute('bar');
    setKind('product');
    setError('');
  }

  function openAddDialog() {
    setCategoryId(categories[0]?.id ?? '');
    setError('');
    setAddOpen(true);
  }

  function handleAddItem(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    const priceSen = Math.round(Number(priceRm) * 100);
    if (!trimmed || !categoryId || !Number.isFinite(priceSen) || priceSen < 0) {
      setError('Name, category and a valid non-negative price are required.');
      return;
    }
    addItem.mutate({
      categoryId,
      name: trimmed,
      kind,
      description: '',
      basePriceSen: priceSen,
      isAvailable: true,
      isPublished: true,
      isFeatured: false,
      isBestSeller: false,
      isStudentEligible: false,
      prepRoute: route,
      sortOrder: items.filter((item) => item.categoryId === categoryId).length * 10 + 10,
      variants: [],
      compatibleAddOnIds: [],
    });
  }

  function handleAddCategory(event: FormEvent) {
    event.preventDefault();
    const trimmed = categoryName.trim();
    if (!trimmed) {
      setError('Category name is required.');
      return;
    }
    addCategory.mutate({
      name: trimmed,
      sortOrder: categories.length * 10 + 10,
      isActive: true,
    });
  }

  return (
    <AdminPageShell
      pageId="admin-menu"
      title="Menu management"
      hint="This catalogue is shared with the customer app. Published changes invalidate the app catalogue revision automatically."
      actions={
        preview ? undefined : <button type="button" className="btn-primary" onClick={openAddDialog} disabled={!categories.length}>
          <Plus size={16} aria-hidden="true" />
          Add item
        </button>
      }
    >
      {preview && (
        <div className="empty-state" role="status">
          <p>UI Preview is showing the live published catalogue in read-only mode. A real AIDA Admin session is required to change menu data.</p>
        </div>
      )}
      {catalogue.isPending && <p className="form-hint">Loading shared catalogue…</p>}
      {catalogue.isError && (
        <div className="empty-state" role="alert">
          <p>{catalogue.error instanceof Error ? catalogue.error.message : 'Unable to load catalogue.'}</p>
          <button type="button" className="btn-secondary" onClick={() => void catalogue.refetch()}>
            Retry
          </button>
        </div>
      )}

      {catalogue.data && (
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="variants">Variants</TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <p className="form-hint">Catalogue revision {catalogue.data.revision}</p>
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th />
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Route</th>
                  <th>Published</th>
                  <th>Available</th>
                  {!preview && <th />}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="menu-item-thumb menu-item-thumb--photo"
                          width={40}
                          height={40}
                          loading="lazy"
                        />
                      ) : (
                        <span className="menu-item-thumb" aria-hidden="true">
                          <ImageOff size={18} />
                        </span>
                      )}
                    </td>
                    <td>{item.name}</td>
                    <td>{item.sku}</td>
                    <td>{item.categoryName}</td>
                    <td>{formatRmFromSen(item.basePriceSen)}</td>
                    <td>{item.prepRoute}</td>
                    <td>{item.isPublished ? 'Yes' : 'No'}</td>
                    <td>{item.isAvailable ? 'Yes' : 'No'}</td>
                    {!preview && <td>
                      <Link to={`/admin/catalogue/menu/${item.id}`} className="btn-secondary btn-sm">
                        Edit
                      </Link>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <div className="empty-state"><p>No catalogue items.</p></div>}
          </TabsContent>

          <TabsContent value="categories">
            <div className="admin-section-heading-row">
              <p className="form-hint">Category order and visibility are shared with the customer app.</p>
              {!preview && <button type="button" className="btn-secondary" onClick={() => { setError(''); setCategoryOpen(true); }}>
                <Plus size={15} aria-hidden="true" /> Add category
              </button>}
            </div>
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Items</th>
                  <th>Active</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{category.itemCount}</td>
                    <td>{category.isActive ? 'Yes' : 'No'}</td>
                    <td>{category.sortOrder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="variants">
            <p className="form-hint">Variants are item-specific. Open an item to edit labels, price deltas and availability.</p>
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Variant</th>
                  <th>Delta</th>
                  <th>Default</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {items.flatMap((item) => item.variants.map((variant) => (
                  <tr key={variant.id}>
                    <td>{item.name}</td>
                    <td>{variant.label}</td>
                    <td>{variant.priceDeltaSen === 0 ? '—' : formatRmFromSen(variant.priceDeltaSen)}</td>
                    <td>{variant.isDefault ? 'Yes' : 'No'}</td>
                    <td>{variant.isAvailable ? 'Yes' : 'No'}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </TabsContent>
        </Tabs>
      )}

      {!preview && addOpen && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={closeAddDialog}>
          <div className="confirm-dialog confirm-dialog--wide" role="dialog" aria-labelledby="add-item-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="add-item-title" className="admin-section-title">Add menu item</h2>
            <p className="form-hint">The database creates the item ID, slug and default SKU when you save.</p>
            <form className="admin-form" onSubmit={handleAddItem}>
              <label>
                Name
                <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
              </label>
              <label>
                Category
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                  {categories.filter((category) => category.isActive).map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select value={kind} onChange={(event) => setKind(event.target.value as 'product' | 'addon')}>
                  <option value="product">Product</option>
                  <option value="addon">Add-on</option>
                </select>
              </label>
              <label>
                Base price (RM)
                <input type="number" min="0" step="0.01" value={priceRm} onChange={(event) => setPriceRm(event.target.value)} required />
              </label>
              <label>
                Preparation route
                <select value={route} onChange={(event) => setRoute(event.target.value as 'bar' | 'kitchen')}>
                  <option value="bar">Bar</option>
                  <option value="kitchen">Kitchen</option>
                </select>
              </label>
              {error && <p role="alert" className="form-error">{error}</p>}
              <div className="confirm-dialog__actions">
                <button type="button" className="btn-secondary" onClick={closeAddDialog}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={addItem.isPending}>
                  {addItem.isPending ? 'Saving…' : 'Add item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!preview && categoryOpen && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={() => setCategoryOpen(false)}>
          <div className="confirm-dialog" role="dialog" aria-labelledby="add-category-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="add-category-title" className="admin-section-title">Add category</h2>
            <form className="admin-form" onSubmit={handleAddCategory}>
              <label>
                Name
                <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required autoFocus />
              </label>
              {error && <p role="alert" className="form-error">{error}</p>}
              <div className="confirm-dialog__actions">
                <button type="button" className="btn-secondary" onClick={() => setCategoryOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={addCategory.isPending}>
                  {addCategory.isPending ? 'Saving…' : 'Add category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
