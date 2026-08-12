import { Link } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { Coffee, Croissant, CupSoda, Leaf, Plus, Sandwich, Star } from 'lucide-react';
import {
  PREVIEW_CATEGORIES,
  PREVIEW_MENU,
  PREVIEW_MODIFIER_GROUPS,
  type PreviewCategory,
  type PreviewMenuItem,
} from '../../preview/fixtures/catalog';
import { formatRmFromSen } from '../../shared/formatting/money';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

type Tab = 'items' | 'categories' | 'variants';

/** No real photo pipeline exists yet (catalogue API pending) — a solid
 * tone plus a category glyph stands in for a photo without pretending one
 * exists, matching the same swatch-as-photo convention the POS product
 * cards already use. */
const CATEGORY_ICON: Record<PreviewCategory, typeof Coffee> = {
  All: Star,
  Coffee: Coffee,
  'Iced Drinks': CupSoda,
  Tea: Leaf,
  Food: Sandwich,
  Pastries: Croissant,
  Favourites: Star,
};

const TONE_PRESETS = [
  '#C92F50',
  '#541A28',
  '#2C171B',
  '#9A7F7A',
  '#6B3A2A',
  '#5B7C99',
  '#DE8D9D',
  '#C8A345',
  '#36735B',
  '#B7782F',
];

const ADD_ITEM_CATEGORIES = PREVIEW_CATEGORIES.filter((c) => c !== 'All');

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Categories and Variants used to be their own top-level pages, but
 * they're both supporting data *for* the menu, not destinations in their
 * own right — they're tabs here now, next to the item list they describe. */
export function AdminMenuPage() {
  const [tab, setTab] = useState<Tab>('items');
  const [items, setItems] = useState(PREVIEW_MENU);
  const categoryCounts = PREVIEW_CATEGORIES.filter((c) => c !== 'All').map((cat) => ({
    category: cat,
    count: PREVIEW_MENU.filter((m) => m.category === cat).length,
  }));

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PreviewCategory>('Coffee');
  const [priceRm, setPriceRm] = useState('0.00');
  const [route, setRoute] = useState<'bar' | 'kitchen'>('bar');
  const [tone, setTone] = useState(TONE_PRESETS[0] ?? '#541A28');

  function closeAddDialog() {
    setAddOpen(false);
    setName('');
    setCategory('Coffee');
    setPriceRm('0.00');
    setRoute('bar');
    setTone(TONE_PRESETS[0] ?? '#541A28');
  }

  function handleAddItem(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const slug = slugify(trimmed) || `item-${items.length + 1}`;
    const newItem: PreviewMenuItem = {
      id: `custom-${slug}`,
      name: trimmed,
      category,
      priceSen: Math.max(0, Math.round(Number(priceRm) * 100) || 0),
      available: true,
      sku: `NEW-${slug.slice(0, 3).toUpperCase() || 'ITM'}`,
      route,
      imageTone: tone,
      compactLabel: trimmed.slice(0, 3).toUpperCase(),
    };
    setItems((prev) => [...prev, newItem]);
    closeAddDialog();
  }

  return (
    <AdminPageShell
      pageId="admin-menu"
      title="Menu management"
      hint="Open an item to edit base price and availability."
      actions={
        <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} aria-hidden="true" />
          Add item
        </button>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>Route</th>
                <th>Available</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const Icon = CATEGORY_ICON[item.category];
                return (
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
                        <span
                          className="menu-item-thumb"
                          style={{ backgroundColor: item.imageTone }}
                          aria-hidden="true"
                          title="No photo yet — added this session, preview only"
                        >
                          <Icon size={18} />
                        </span>
                      )}
                    </td>
                    <td>{item.name}</td>
                    <td>{item.sku}</td>
                    <td>{item.category}</td>
                    <td>{formatRmFromSen(item.priceSen)}</td>
                    <td>{item.route}</td>
                    <td>{item.available ? 'Yes' : 'No'}</td>
                    <td>
                      <Link to={`/admin/catalogue/menu/${item.id}`} className="btn-secondary btn-sm">
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {items.length === 0 && (
            <div className="empty-state">
              <h2 className="admin-section-title">No menu items</h2>
              <p>Publish a menu when catalogue API is ready.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories">
          <p className="form-hint">POS category rail order — preview only.</p>
          <table className="data-table admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Items</th>
                <th>Visible on POS</th>
              </tr>
            </thead>
            <tbody>
              {categoryCounts.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td>{row.count}</td>
                  <td>Yes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="variants">
          <p className="form-hint">Master PRD modifier contract — editing pending Team 2 catalogue API.</p>
          {PREVIEW_MODIFIER_GROUPS.map((group) => (
            <article key={group.id} className="modifier-group-card">
              <header>
                <h2 className="admin-section-title">{group.name}</h2>
                <span className="form-hint">
                  {group.required ? 'Required' : 'Optional'} · min {group.min} · max {group.max}
                </span>
              </header>
              {group.help ? <p className="form-hint">{group.help}</p> : null}
              <table className="data-table admin-table">
                <thead>
                  <tr>
                    <th>Option</th>
                    <th>Price delta</th>
                    <th>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {group.options.map((opt) => (
                    <tr key={opt.id}>
                      <td>{opt.label}</td>
                      <td>
                        {formatRmFromSen(Math.abs(opt.priceDeltaSen))}
                        {opt.priceDeltaSen < 0 ? ' (discount)' : opt.priceDeltaSen > 0 ? ' (add)' : ''}
                      </td>
                      <td>{opt.available === false ? 'No' : 'Yes'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </TabsContent>
      </Tabs>

      {addOpen && (
        <div className="confirm-dialog-overlay" role="presentation" onClick={closeAddDialog}>
          <div
            className="confirm-dialog confirm-dialog--wide"
            role="dialog"
            aria-labelledby="add-item-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-item-title" className="admin-section-title">
              Add menu item
            </h2>
            <p className="form-hint">Added to this preview session only — no catalogue API yet.</p>
            <form className="admin-form" onSubmit={handleAddItem}>
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              </label>
              <label>
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value as PreviewCategory)}>
                  {ADD_ITEM_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Base price (RM)
                <input
                  type="number"
                  min="0"
                  step="0.10"
                  value={priceRm}
                  onChange={(e) => setPriceRm(e.target.value)}
                />
              </label>
              <label>
                Route
                <select value={route} onChange={(e) => setRoute(e.target.value as 'bar' | 'kitchen')}>
                  <option value="bar">Bar</option>
                  <option value="kitchen">Kitchen</option>
                </select>
              </label>
              <div>
                <span className="form-hint" id="tone-label">
                  Placeholder photo tone
                </span>
                <div className="menu-item-thumb-picker" role="group" aria-labelledby="tone-label">
                  {TONE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={
                        preset === tone
                          ? 'menu-item-thumb-picker__swatch menu-item-thumb-picker__swatch--active'
                          : 'menu-item-thumb-picker__swatch'
                      }
                      style={{ backgroundColor: preset }}
                      aria-label={`Tone ${preset}`}
                      aria-pressed={preset === tone}
                      onClick={() => setTone(preset)}
                    />
                  ))}
                </div>
              </div>
              <div className="confirm-dialog__actions">
                <button type="button" className="btn-secondary" onClick={closeAddDialog}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}

export function findPreviewMenuItem(id: string): PreviewMenuItem | undefined {
  return PREVIEW_MENU.find((i) => i.id === id);
}
