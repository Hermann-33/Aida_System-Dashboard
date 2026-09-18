import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminPageShell } from './AdminPageShell';
import { fetchAdminCatalogue, type CatalogueSnapshot } from '../catalogue/catalogueClient';
import { fetchOperationalLocations, type OperationalBranch } from '../locations/operationalLocationClient';
import {
  loadPromotions,
  savePromotion,
  type Promotion,
  type PromotionDiscountType,
  type PromotionStackingMode,
  type SavePromotionPayload,
} from '../promotions/promotionClient';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import './admin.css';

type Tab = 'campaigns' | 'ads';

type PromotionDraft = {
  id?: string;
  code: string;
  name: string;
  description: string;
  discountType: PromotionDiscountType;
  fixedAmountSen: string;
  percentBasisPoints: string;
  minimumSubtotalSen: string;
  maximumDiscountSen: string;
  startsAt: string;
  endsAt: string;
  priority: string;
  stackingMode: PromotionStackingMode;
  allowWithVoucher: boolean;
  requiresMember: boolean;
  globalUsageLimit: string;
  perMemberUsageLimit: string;
  isActive: boolean;
  branchIds: string[];
  itemIds: string[];
  variantIds: string[];
  addonItemIds: string[];
};

const EMPTY_PROMOTION: PromotionDraft = {
  code: '',
  name: '',
  description: '',
  discountType: 'fixed',
  fixedAmountSen: '100',
  percentBasisPoints: '1000',
  minimumSubtotalSen: '0',
  maximumDiscountSen: '',
  startsAt: '',
  endsAt: '',
  priority: '100',
  stackingMode: 'exclusive',
  allowWithVoucher: false,
  requiresMember: false,
  globalUsageLimit: '',
  perMemberUsageLimit: '',
  isActive: true,
  branchIds: [],
  itemIds: [],
  variantIds: [],
  addonItemIds: [],
};

const PREVIEW_PROMOTION: Promotion = {
  id: 'preview-promotion',
  code: 'CAMPUS10',
  name: 'Campus 10% off',
  description: 'Sample campaign shown only in UI preview mode.',
  discountType: 'percent',
  fixedAmountSen: null,
  percentBasisPoints: 1000,
  minimumSubtotalSen: 1200,
  maximumDiscountSen: 500,
  startsAt: null,
  endsAt: null,
  priority: 20,
  stackingMode: 'exclusive',
  allowWithVoucher: false,
  requiresMember: true,
  globalUsageLimit: null,
  perMemberUsageLimit: 1,
  isActive: true,
  branchIds: [],
  itemIds: [],
  variantIds: [],
  addonItemIds: [],
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
};

function draftFromPromotion(promotion: Promotion): PromotionDraft {
  return {
    id: promotion.id,
    code: promotion.code,
    name: promotion.name,
    description: promotion.description ?? '',
    discountType: promotion.discountType,
    fixedAmountSen: promotion.fixedAmountSen == null ? '' : String(promotion.fixedAmountSen),
    percentBasisPoints: promotion.percentBasisPoints == null ? '' : String(promotion.percentBasisPoints),
    minimumSubtotalSen: String(promotion.minimumSubtotalSen),
    maximumDiscountSen: promotion.maximumDiscountSen == null ? '' : String(promotion.maximumDiscountSen),
    startsAt: promotion.startsAt ?? '',
    endsAt: promotion.endsAt ?? '',
    priority: String(promotion.priority),
    stackingMode: promotion.stackingMode,
    allowWithVoucher: promotion.allowWithVoucher,
    requiresMember: promotion.requiresMember,
    globalUsageLimit: promotion.globalUsageLimit == null ? '' : String(promotion.globalUsageLimit),
    perMemberUsageLimit: promotion.perMemberUsageLimit == null ? '' : String(promotion.perMemberUsageLimit),
    isActive: promotion.isActive,
    branchIds: [...promotion.branchIds],
    itemIds: [...promotion.itemIds],
    variantIds: [...promotion.variantIds],
    addonItemIds: [...promotion.addonItemIds],
  };
}

function integer(value: string, label: string, minimum = 0): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new Error(`${label} must be an integer of at least ${minimum}.`);
  return parsed;
}

function optionalInteger(value: string, label: string, minimum = 1): number | null {
  if (!value.trim()) return null;
  return integer(value, label, minimum);
}

function isoOrNull(value: string, label: string): string | null {
  if (!value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid ISO-8601 date/time.`);
  return new Date(parsed).toISOString();
}

function selectedValues(target: HTMLSelectElement): string[] {
  return Array.from(target.selectedOptions, (option) => option.value);
}

function savePayload(draft: PromotionDraft): SavePromotionPayload {
  const startsAt = isoOrNull(draft.startsAt, 'Start time');
  const endsAt = isoOrNull(draft.endsAt, 'End time');
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new Error('End time must be later than start time.');
  }
  const fixedAmountSen = draft.discountType === 'fixed'
    ? integer(draft.fixedAmountSen, 'Fixed discount', 1)
    : null;
  const percentBasisPoints = draft.discountType === 'percent'
    ? integer(draft.percentBasisPoints, 'Percentage discount', 1)
    : null;
  if (percentBasisPoints !== null && percentBasisPoints > 10_000) {
    throw new Error('Percentage discount cannot exceed 100%.');
  }
  const perMemberUsageLimit = optionalInteger(draft.perMemberUsageLimit, 'Per-member usage limit');
  if (perMemberUsageLimit !== null && !draft.requiresMember) {
    throw new Error('Per-member usage limits require member-only eligibility.');
  }
  return {
    id: draft.id ?? '',
    code: draft.code.trim().toUpperCase(),
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    discountType: draft.discountType,
    fixedAmountSen,
    percentBasisPoints,
    minimumSubtotalSen: integer(draft.minimumSubtotalSen, 'Minimum subtotal'),
    maximumDiscountSen: optionalInteger(draft.maximumDiscountSen, 'Maximum discount'),
    startsAt,
    endsAt,
    priority: integer(draft.priority, 'Priority'),
    stackingMode: draft.stackingMode,
    allowWithVoucher: draft.allowWithVoucher,
    requiresMember: draft.requiresMember,
    globalUsageLimit: optionalInteger(draft.globalUsageLimit, 'Global usage limit'),
    perMemberUsageLimit,
    isActive: draft.isActive,
    branchIds: draft.branchIds,
    itemIds: draft.itemIds,
    variantIds: draft.variantIds,
    addonItemIds: draft.addonItemIds,
  };
}

function promotionPayload(promotion: Promotion, isActive = promotion.isActive): SavePromotionPayload {
  return {
    id: promotion.id,
    code: promotion.code,
    name: promotion.name,
    description: promotion.description,
    discountType: promotion.discountType,
    fixedAmountSen: promotion.fixedAmountSen,
    percentBasisPoints: promotion.percentBasisPoints,
    minimumSubtotalSen: promotion.minimumSubtotalSen,
    maximumDiscountSen: promotion.maximumDiscountSen,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    priority: promotion.priority,
    stackingMode: promotion.stackingMode,
    allowWithVoucher: promotion.allowWithVoucher,
    requiresMember: promotion.requiresMember,
    globalUsageLimit: promotion.globalUsageLimit,
    perMemberUsageLimit: promotion.perMemberUsageLimit,
    isActive,
    branchIds: promotion.branchIds,
    itemIds: promotion.itemIds,
    variantIds: promotion.variantIds,
    addonItemIds: promotion.addonItemIds,
  };
}

function discountLabel(promotion: Promotion): string {
  if (promotion.discountType === 'fixed') return `RM ${((promotion.fixedAmountSen ?? 0) / 100).toFixed(2)}`;
  return `${((promotion.percentBasisPoints ?? 0) / 100).toFixed(2).replace(/\.00$/, '')}%`;
}

export function AdminMarketingPage() {
  const preview = isUiPreviewMode();
  const [tab, setTab] = useState<Tab>('campaigns');
  const [promotions, setPromotions] = useState<Promotion[]>(preview ? [PREVIEW_PROMOTION] : []);
  const [locations, setLocations] = useState<OperationalBranch[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueSnapshot | null>(null);
  const [draft, setDraft] = useState<PromotionDraft>(EMPTY_PROMOTION);
  const [loading, setLoading] = useState(!preview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [headline, setHeadline] = useState('Welcome back, City U');
  const [cta, setCta] = useState('Order ahead · earn stamps');
  const [slot, setSlot] = useState<'home-hero' | 'offers-rail'>('home-hero');
  const [live, setLive] = useState(false);

  async function refresh() {
    if (preview) return;
    setLoading(true);
    setError(null);
    try {
      const [promotionState, branchState, catalogueState] = await Promise.all([
        loadPromotions(),
        fetchOperationalLocations(),
        fetchAdminCatalogue(),
      ]);
      setPromotions(promotionState);
      setLocations(branchState);
      setCatalogue(catalogueState);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Promotion authority is unavailable.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, [preview]);

  const products = useMemo(() => catalogue?.items.filter((item) => item.kind === 'product') ?? [], [catalogue]);
  const addOns = useMemo(() => catalogue?.items.filter((item) => item.kind === 'addon') ?? [], [catalogue]);
  const variants = useMemo(() => products.flatMap((item) => item.variants.map((variant) => ({
    id: variant.id,
    label: `${item.name} · ${variant.label}`,
  }))), [products]);

  async function submitPromotion(event: React.FormEvent) {
    event.preventDefault();
    if (preview) return;
    setBusy(true);
    setError(null);
    try {
      await savePromotion(savePayload(draft));
      setDraft(EMPTY_PROMOTION);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Promotion update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function togglePromotion(promotion: Promotion) {
    if (preview) return;
    setBusy(true);
    setError(null);
    try {
      await savePromotion(promotionPayload(promotion, !promotion.isActive));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Promotion update failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      pageId="admin-marketing"
      title="Marketing"
      hint="Campaign discounts use live server-authoritative Phase 7 pricing; ad creatives remain preview-only."
    >
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="ads">Ads &amp; banners</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          {preview && <p className="form-hint">UI preview uses sample campaigns and performs no privileged backend requests.</p>}
          {error && <p className="form-hint" role="alert">{error}</p>}
          {loading ? <p className="form-hint">Loading promotion authority…</p> : (
            <>
              {!preview && (
                <form className="admin-form-grid" onSubmit={submitPromotion}>
                  <div><label htmlFor="promotion-code">Code</label><input id="promotion-code" value={draft.code} onChange={(event) => setDraft((value) => ({ ...value, code: event.target.value }))} placeholder="CAMPUS10" required /></div>
                  <div><label htmlFor="promotion-name">Name</label><input id="promotion-name" value={draft.name} onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} required /></div>
                  <div><label htmlFor="promotion-description">Description</label><input id="promotion-description" value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} /></div>
                  <div>
                    <label htmlFor="promotion-type">Discount type</label>
                    <select id="promotion-type" value={draft.discountType} onChange={(event) => setDraft((value) => ({ ...value, discountType: event.target.value as PromotionDiscountType }))}>
                      <option value="fixed">Fixed amount</option><option value="percent">Percentage</option>
                    </select>
                  </div>
                  {draft.discountType === 'fixed' ? (
                    <div><label htmlFor="promotion-fixed">Discount (sen)</label><input id="promotion-fixed" type="number" min="1" value={draft.fixedAmountSen} onChange={(event) => setDraft((value) => ({ ...value, fixedAmountSen: event.target.value }))} required /></div>
                  ) : (
                    <div><label htmlFor="promotion-percent">Percentage (basis points)</label><input id="promotion-percent" type="number" min="1" max="10000" value={draft.percentBasisPoints} onChange={(event) => setDraft((value) => ({ ...value, percentBasisPoints: event.target.value }))} required /></div>
                  )}
                  <div><label htmlFor="promotion-minimum">Minimum subtotal (sen)</label><input id="promotion-minimum" type="number" min="0" value={draft.minimumSubtotalSen} onChange={(event) => setDraft((value) => ({ ...value, minimumSubtotalSen: event.target.value }))} required /></div>
                  <div><label htmlFor="promotion-maximum">Maximum discount (sen)</label><input id="promotion-maximum" type="number" min="1" value={draft.maximumDiscountSen} onChange={(event) => setDraft((value) => ({ ...value, maximumDiscountSen: event.target.value }))} placeholder="No cap" /></div>
                  <div><label htmlFor="promotion-start">Starts at (ISO-8601)</label><input id="promotion-start" value={draft.startsAt} onChange={(event) => setDraft((value) => ({ ...value, startsAt: event.target.value }))} placeholder="2026-09-20T00:00:00+08:00" /></div>
                  <div><label htmlFor="promotion-end">Ends at (ISO-8601)</label><input id="promotion-end" value={draft.endsAt} onChange={(event) => setDraft((value) => ({ ...value, endsAt: event.target.value }))} placeholder="2026-09-30T23:59:59+08:00" /></div>
                  <div><label htmlFor="promotion-priority">Priority</label><input id="promotion-priority" type="number" min="0" value={draft.priority} onChange={(event) => setDraft((value) => ({ ...value, priority: event.target.value }))} required /></div>
                  <div>
                    <label htmlFor="promotion-stacking">Stacking</label>
                    <select id="promotion-stacking" value={draft.stackingMode} onChange={(event) => setDraft((value) => ({ ...value, stackingMode: event.target.value as PromotionStackingMode }))}>
                      <option value="exclusive">Exclusive</option><option value="stackable">Stackable</option>
                    </select>
                  </div>
                  <div><label htmlFor="promotion-global-limit">Global usage limit</label><input id="promotion-global-limit" type="number" min="1" value={draft.globalUsageLimit} onChange={(event) => setDraft((value) => ({ ...value, globalUsageLimit: event.target.value }))} placeholder="Unlimited" /></div>
                  <div><label htmlFor="promotion-member-limit">Per-member usage limit</label><input id="promotion-member-limit" type="number" min="1" value={draft.perMemberUsageLimit} onChange={(event) => setDraft((value) => ({ ...value, perMemberUsageLimit: event.target.value }))} placeholder="Unlimited" /></div>
                  <div>
                    <label htmlFor="promotion-branches">Branches (none = all)</label>
                    <select id="promotion-branches" multiple size={Math.min(5, Math.max(2, locations.length))} value={draft.branchIds} onChange={(event) => setDraft((value) => ({ ...value, branchIds: selectedValues(event.currentTarget) }))}>
                      {locations.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="promotion-items">Products</label>
                    <select id="promotion-items" multiple size={5} value={draft.itemIds} onChange={(event) => setDraft((value) => ({ ...value, itemIds: selectedValues(event.currentTarget) }))}>
                      {products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="promotion-variants">Variants</label>
                    <select id="promotion-variants" multiple size={5} value={draft.variantIds} onChange={(event) => setDraft((value) => ({ ...value, variantIds: selectedValues(event.currentTarget) }))}>
                      {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="promotion-addons">Add-ons</label>
                    <select id="promotion-addons" multiple size={5} value={draft.addonItemIds} onChange={(event) => setDraft((value) => ({ ...value, addonItemIds: selectedValues(event.currentTarget) }))}>
                      {addOns.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}
                    </select>
                  </div>
                  <label className="admin-checkbox"><input type="checkbox" checked={draft.allowWithVoucher} onChange={(event) => setDraft((value) => ({ ...value, allowWithVoucher: event.target.checked }))} /> Allow with voucher</label>
                  <label className="admin-checkbox"><input type="checkbox" checked={draft.requiresMember} onChange={(event) => setDraft((value) => ({ ...value, requiresMember: event.target.checked, perMemberUsageLimit: event.target.checked ? value.perMemberUsageLimit : '' }))} /> Member only</label>
                  <label className="admin-checkbox"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((value) => ({ ...value, isActive: event.target.checked }))} /> Active</label>
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary" disabled={busy}>{draft.id ? 'Save campaign' : 'Create campaign'}</button>
                    {draft.id && <button type="button" className="btn-secondary" disabled={busy} onClick={() => setDraft(EMPTY_PROMOTION)}>Cancel edit</button>}
                  </div>
                </form>
              )}

              <table className="data-table admin-table mt-6">
                <thead><tr><th>Campaign</th><th>Discount</th><th>Rules</th><th>Scope</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {promotions.map((promotion) => (
                    <tr key={promotion.id}>
                      <td><strong>{promotion.name}</strong><br /><span className="form-hint">{promotion.code}</span></td>
                      <td>{discountLabel(promotion)}{promotion.maximumDiscountSen != null ? ` · cap RM ${(promotion.maximumDiscountSen / 100).toFixed(2)}` : ''}</td>
                      <td>{promotion.stackingMode} · priority {promotion.priority}{promotion.requiresMember ? ' · member only' : ''}{promotion.allowWithVoucher ? ' · voucher compatible' : ''}</td>
                      <td>{promotion.branchIds.length || promotion.itemIds.length || promotion.variantIds.length || promotion.addonItemIds.length ? `${promotion.branchIds.length} branches · ${promotion.itemIds.length} products · ${promotion.variantIds.length} variants · ${promotion.addonItemIds.length} add-ons` : 'All eligible catalogue / branches'}</td>
                      <td>{promotion.isActive ? 'Active' : 'Inactive'}</td>
                      <td className="flex gap-2">
                        <button type="button" className="btn-secondary" disabled={busy || preview} onClick={() => setDraft(draftFromPromotion(promotion))}>Edit</button>
                        <button type="button" className="btn-primary" disabled={busy || preview} onClick={() => void togglePromotion(promotion)}>{promotion.isActive ? 'Disable' : 'Enable'}</button>
                      </td>
                    </tr>
                  ))}
                  {promotions.length === 0 && <tr><td colSpan={6}>No campaigns configured.</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </TabsContent>

        <TabsContent value="ads">
          <p className="form-hint">Ad/banner publishing remains a UI-only preview and is not part of Phase 7 pricing authority.</p>
          <div className="admin-page--split admin-page--split-inline">
            <form
              className="admin-form"
              onSubmit={(event) => {
                event.preventDefault();
                setLive(true);
              }}
            >
              <label>
                Placement
                <select value={slot} onChange={(event) => setSlot(event.target.value as typeof slot)}>
                  <option value="home-hero">Home hero</option>
                  <option value="offers-rail">Offers rail</option>
                </select>
              </label>
              <label>
                Headline
                <input value={headline} onChange={(event) => setHeadline(event.target.value)} />
              </label>
              <label>
                Call to action
                <input value={cta} onChange={(event) => setCta(event.target.value)} />
              </label>
              <button type="submit" className="btn-primary">Simulate publish</button>
              <p className="form-hint" role="status">{live ? 'Simulated publish recorded in UI only — customer app not contacted.' : 'Draft creative — not live on any device.'}</p>
            </form>

            <aside className="mobile-preview" aria-label="Ad placement preview">
              <h2 className="admin-section-title">Placement preview ({slot})</h2>
              <div className="mobile-preview__frame">
                <div className="mobile-preview__status" />
                <div className={`mobile-preview__banner ${live ? '' : 'mobile-preview__banner--inactive'}`}>
                  <strong>{headline}</strong>
                  <p>{cta}</p>
                </div>
                <div className="mobile-preview__content" />
              </div>
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  );
}
