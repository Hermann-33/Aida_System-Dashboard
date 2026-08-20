import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  HelpCircle,
  Minus,
  Monitor,
  Plus as PlusIcon,
  Receipt,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import type { EmployeeIdentity, ShiftSummary, TerminalLocation } from '../../auth/types';
import {
  PREVIEW_TERMINALS,
  PREVIEW_VARIANCE_THRESHOLD_SEN,
  type ConnectionState,
  type OrderType,
  type PreviewMember,
  type PreviewRewardOption,
} from '../../preview/fixtures/catalog';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { formatRmFromSen, formatRm } from '../../shared/formatting/money';
import { formatKlDateTime, formatKlTime } from '../../shared/formatting/datetime';
import { EmptyState } from '../../shared/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MemberPanel } from './MemberPanel';
import { ModifierSheet } from './ModifierSheet';
import {
  AuthoritativeOrderReceipt,
  OrderCheckoutPanel,
  type PlacementAttempt,
} from '../orders/OrderCheckoutPanel';
import { OrderBoard } from '../orders/OrderBoard';
import type { OrderSnapshot } from '../orders/orderClient';
import {
  fetchPublishedCatalogue,
  type CatalogueItem,
} from '../catalogue/catalogueClient';
import {
  ALL_POS_CATEGORIES,
  compactCatalogueLabel,
  posCatalogueCategories,
  posCatalogueItems,
  posModifierGroups,
} from './posCatalogue';
import {
  cartTotalSen,
  newCartLineId,
  newTicketId,
  type CartLine,
  type HeldTicket,
} from './cartTypes';
import './pos.css';

type RailId = 'sale' | 'orders' | 'member' | 'shift' | 'terminal' | 'help';

interface Props {
  employee: EmployeeIdentity;
  location?: TerminalLocation;
  shift?: ShiftSummary;
  previewOperationalContext?: boolean;
  onLock?: () => void;
  onCloseRequest?: () => void;
  onLogout: () => void;
  busy?: boolean;
  connectionState?: ConnectionState;
  onConnectionStateChange?: (state: ConnectionState) => void;
}

const RAIL_ITEMS: { id: RailId; label: string; icon: typeof ShoppingBag }[] = [
  { id: 'sale', label: 'New Sale', icon: ShoppingBag },
  { id: 'orders', label: 'Orders', icon: Receipt },
  { id: 'member', label: 'Member', icon: User },
  { id: 'shift', label: 'Shift', icon: Clock },
  { id: 'terminal', label: 'Terminal', icon: Monitor },
  { id: 'help', label: 'Help', icon: HelpCircle },
];

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  pickup: 'Pickup',
};

const POS_CATALOGUE_QUERY = ['pos-catalogue'] as const;

export function CounterWorkspace({
  location,
  shift,
  previewOperationalContext = false,
  onLock = () => undefined,
  onCloseRequest = () => undefined,
  onLogout,
  busy = false,
  connectionState = 'online',
  onConnectionStateChange = () => undefined,
}: Props) {
  const catalogue = useQuery({
    queryKey: POS_CATALOGUE_QUERY,
    queryFn: () => fetchPublishedCatalogue(),
  });
  const [rail, setRail] = useState<RailId>('sale');
  const [categoryId, setCategoryId] = useState(ALL_POS_CATEGORIES);
  const [search, setSearch] = useState('');
  const [compactMenu, setCompactMenu] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [member, setMember] = useState<PreviewMember | null>(null);
  const [selectedReward, setSelectedReward] = useState<PreviewRewardOption | null>(null);
  const [modifierItem, setModifierItem] = useState<CatalogueItem | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OrderSnapshot | null>(null);
  const placementAttempt = useRef<PlacementAttempt | null>(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [heldTickets, setHeldTickets] = useState<HeldTicket[]>([]);
  const [discardTicketId, setDiscardTicketId] = useState<string | null>(null);
  const [showKdsPreview, setShowKdsPreview] = useState(false);

  const [shiftPaidIn, setShiftPaidIn] = useState('');
  const [shiftPaidOut, setShiftPaidOut] = useState('');
  const [shiftDrop, setShiftDrop] = useState('');
  const [shiftMoveReason, setShiftMoveReason] = useState('');
  const [shiftMoveLog, setShiftMoveLog] = useState<string[]>([]);

  const estimateTotalSen = cartTotalSen(cart);

  const categories = useMemo(
    () => catalogue.data ? posCatalogueCategories(catalogue.data) : [],
    [catalogue.data],
  );
  const menuItems = useMemo(
    () => catalogue.data ? posCatalogueItems(catalogue.data) : [],
    [catalogue.data],
  );
  const modifierGroups = useMemo(
    () => modifierItem && catalogue.data ? posModifierGroups(modifierItem, catalogue.data) : [],
    [catalogue.data, modifierItem],
  );

  useEffect(() => {
    if (categoryId !== ALL_POS_CATEGORIES && !categories.some((category) => category.id === categoryId)) {
      setCategoryId(ALL_POS_CATEGORIES);
    }
  }, [categories, categoryId]);

  const filteredMenu = useMemo(() => {
    let items = menuItems;
    if (categoryId !== ALL_POS_CATEGORIES) {
      items = items.filter((item) => item.categoryId === categoryId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
    }
    return items;
  }, [categoryId, menuItems, search]);

  const railItems = previewOperationalContext
    ? RAIL_ITEMS
    : RAIL_ITEMS.filter((item) => item.id === 'sale' || item.id === 'orders' || item.id === 'help');
  const terminalFixture = location
    ? PREVIEW_TERMINALS.find((t) => t.code === location.terminalCode) ?? PREVIEW_TERMINALS[0]
    : null;

  function addToCart(item: CatalogueItem) {
    if (!item.isAvailable || completedOrder) return;
    setModifierItem(item);
  }

  function confirmModifier(
    selections: Record<string, string[]>,
    unitPriceSen: number,
    summary: string,
  ) {
    if (!modifierItem) return;
    const modifiers = Object.entries(selections).map(([groupId, optionIds]) => ({ groupId, optionIds }));
    setCart((prev) => [
      ...prev,
      {
        id: newCartLineId(),
        menuItemId: modifierItem.id,
        name: modifierItem.name,
        unitPriceSen,
        qty: 1,
        modifiers,
        modifierSummary: summary || undefined,
      },
    ]);
    setModifierItem(null);
    setRail('sale');
  }

  function updateQty(lineId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.id === lineId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function updateNote(lineId: string, note: string) {
    setCart((prev) => prev.map((l) => (l.id === lineId ? { ...l, note: note || undefined } : l)));
  }

  function removeLine(lineId: string) {
    setCart((prev) => prev.filter((l) => l.id !== lineId));
  }

  function requestClearSale() {
    if (cart.length === 0) {
      resetSaleState();
      return;
    }
    setClearConfirmOpen(true);
  }

  function resetSaleState() {
    setCart([]);
    setMember(null);
    setSelectedReward(null);
    setShowPayment(false);
    setCompletedOrder(null);
    placementAttempt.current = null;
    setRail('sale');
    setOrderDrawerOpen(false);
  }

  function handlePlaced(order: OrderSnapshot) {
    setCompletedOrder(order);
    setCart([]);
    setShowPayment(false);
    setOrderDrawerOpen(false);
  }

  function startNewSale() {
    resetSaleState();
  }

  function ticketLabelFor(lines: CartLine[]): string {
    const first = lines[0];
    if (!first) return 'Order';
    return lines.length > 1 ? `${first.name} +${lines.length - 1}` : first.name;
  }

  /** POS-O11 — park the in-progress sale so the counter is free for the
   * next customer; the parked ticket keeps its own cart, order type,
   * member and reward exactly as they were. */
  function holdOrder() {
    if (cart.length === 0) return;
    const ticket: HeldTicket = {
      id: newTicketId(),
      label: ticketLabelFor(cart),
      heldAt: formatKlTime(new Date()),
      cart,
      orderType,
      member,
      selectedReward,
    };
    setHeldTickets((prev) => [ticket, ...prev]);
    setCart([]);
    setMember(null);
    setSelectedReward(null);
    setOrderDrawerOpen(false);
  }

  /** Resuming while another order is already active parks the active one
   * first, rather than discarding it — staff can freely switch between
   * tickets instead of being forced to finish or clear one first. */
  function resumeTicket(ticketId: string) {
    const ticket = heldTickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    setHeldTickets((prev) => {
      const withoutResumed = prev.filter((t) => t.id !== ticketId);
      if (cart.length === 0) return withoutResumed;
      const swappedBack: HeldTicket = {
        id: newTicketId(),
        label: ticketLabelFor(cart),
        heldAt: formatKlTime(new Date()),
        cart,
        orderType,
        member,
        selectedReward,
      };
      return [swappedBack, ...withoutResumed];
    });
    setCart(ticket.cart);
    setOrderType(ticket.orderType);
    setMember(ticket.member);
    setSelectedReward(ticket.selectedReward);
    setRail('sale');
    setShowPayment(false);
    setOrderDrawerOpen(false);
  }

  function discardTicket(ticketId: string) {
    setHeldTickets((prev) => prev.filter((t) => t.id !== ticketId));
    setDiscardTicketId(null);
  }

  function logShiftMove(label: string, amountRm: string) {
    const amt = Number(amountRm);
    if (!amt || !shiftMoveReason.trim()) return;
    setShiftMoveLog((prev) => [
      `${label} RM ${amt.toFixed(2)} — ${shiftMoveReason.trim()} (preview; Team 2 audit)`,
      ...prev,
    ]);
    setShiftMoveReason('');
    if (label === 'Paid in') setShiftPaidIn('');
    if (label === 'Paid out') setShiftPaidOut('');
    if (label === 'Safe drop') setShiftDrop('');
  }

  const saleLocked = completedOrder !== null;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <nav
        aria-label="POS navigation"
        className="flex w-20 flex-shrink-0 flex-col items-center gap-1 bg-[var(--aida-espresso)] py-4 sm:w-24"
      >
        <p className="mb-3 font-brand text-2xl text-[var(--aida-floral-pink)]">Aida</p>
        <ul className="flex w-full flex-col items-center gap-1 px-2">
          {railItems.map((item) => {
            const Icon = item.icon;
            const active = rail === item.id;
            return (
              <li key={item.id} className="w-full">
                <button
                  type="button"
                  onClick={() => {
                    setRail(item.id);
                    if (item.id !== 'sale') setShowPayment(false);
                  }}
                  className={
                    active
                      ? 'flex w-full flex-col items-center gap-1 rounded-lg bg-[var(--aida-burgundy)] px-1 py-2.5 text-xs font-semibold text-white'
                      : 'flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2.5 text-xs font-semibold text-[var(--aida-cream)]/80 transition-colors hover:bg-white/10 hover:text-[var(--aida-cream)]'
                  }
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className="flex-1 overflow-y-auto bg-background px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:pb-6">
        {rail === 'sale' && !showPayment && !completedOrder && (
          <>
            <header className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-xl text-primary">Menu</h2>
              <div role="group" aria-label="Order type" className="inline-flex rounded-lg bg-muted p-1">
                {(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map((ot) => (
                  <button
                    key={ot}
                    type="button"
                    onClick={() => setOrderType(ot)}
                    className={
                      orderType === ot
                        ? 'rounded-md bg-card px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm'
                        : 'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground'
                    }
                  >
                    {ORDER_TYPE_LABELS[ot]}
                  </button>
                ))}
              </div>
              <Label htmlFor="menu-search" className="sr-only">
                Search menu
              </Label>
              <Input
                id="menu-search"
                type="search"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-[16rem]"
              />
              <Label className="ml-auto flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={compactMenu} onCheckedChange={(v) => setCompactMenu(!!v)} />
                Compact cards
              </Label>
            </header>

            {heldTickets.length > 0 && (
              <div role="group" aria-label="Held orders" className="mt-3 flex flex-wrap gap-2">
                {heldTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-center gap-2 rounded-lg border border-dashed border-primary bg-accent py-1.5 pl-3 pr-2"
                  >
                    <button type="button" onClick={() => resumeTicket(ticket.id)} className="text-left">
                      <p className="text-sm font-semibold text-foreground">{ticket.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.cart.length} item{ticket.cart.length === 1 ? '' : 's'} ·{' '}
                        {formatRmFromSen(cartTotalSen(ticket.cart))} · held {ticket.heldAt}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Discard held order ${ticket.label}`}
                      onClick={() => setDiscardTicketId(ticket.id)}
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {catalogue.isPending && <p className="mt-4 text-sm text-muted-foreground">Loading shared catalogue…</p>}
            {catalogue.isError && (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4" role="alert">
                <p className="text-sm font-semibold text-destructive">The shared catalogue is unavailable.</p>
                <p className="mt-1 text-sm text-muted-foreground">No preview menu is used as a fallback.</p>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void catalogue.refetch()}>
                  Retry catalogue
                </Button>
              </div>
            )}

            {catalogue.data && <div role="tablist" aria-label="Categories" className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                role="tab"
                aria-selected={categoryId === ALL_POS_CATEGORIES}
                onClick={() => setCategoryId(ALL_POS_CATEGORIES)}
                className={
                  categoryId === ALL_POS_CATEGORIES
                    ? 'rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground'
                    : 'rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground'
                }
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={categoryId === cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={
                    categoryId === cat.id
                      ? 'rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground'
                      : 'rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground'
                  }
                >
                  {cat.name}
                </button>
              ))}
            </div>}

            {catalogue.data && <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
              Showing {filteredMenu.length} item{filteredMenu.length === 1 ? '' : 's'} ·{' '}
              {categoryId === ALL_POS_CATEGORIES
                ? 'all categories'
                : categories.find((category) => category.id === categoryId)?.name ?? 'shared category'}
              {' '}· catalogue revision {catalogue.data.revision}
            </p>}

            <div
              data-category={categoryId}
              className={
                compactMenu
                  ? 'mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6'
                  : 'mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4'
              }
            >
              {filteredMenu.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.isAvailable}
                  onClick={() => addToCart(item)}
                  className={
                    compactMenu
                      ? 'group relative flex aspect-square flex-col justify-end overflow-hidden rounded-xl text-left shadow-sm transition-shadow hover:shadow-md disabled:cursor-not-allowed'
                      : 'group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-2xl text-left shadow-sm transition-shadow hover:shadow-lg disabled:cursor-not-allowed'
                  }
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      loading="lazy"
                      className={
                        item.isAvailable
                          ? 'absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                          : 'absolute inset-0 h-full w-full object-cover grayscale'
                      }
                    />
                  ) : (
                    <span aria-hidden="true" className="absolute inset-0 bg-[var(--aida-burgundy)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                  {item.isBestSeller && (
                    <span className="absolute left-2 top-2 rounded-full bg-[var(--aida-gold)] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[var(--aida-espresso)]">
                      Best seller
                    </span>
                  )}
                  {!item.isAvailable && (
                    <span className="absolute right-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-xs font-bold uppercase text-destructive-foreground">
                      Sold out
                    </span>
                  )}

                  <div className="relative z-10 p-3 text-white">
                    {!compactMenu && (
                      <p className="text-xs font-bold uppercase tracking-widest text-white/80">
                        {item.categoryName}
                      </p>
                    )}
                    <p className={compactMenu ? 'text-sm font-bold leading-tight' : 'mt-1 text-lg font-bold leading-tight'}>
                      {compactMenu ? compactCatalogueLabel(item.name) : item.name}
                    </p>
                    <p
                      className={
                        compactMenu
                          ? 'text-sm font-bold text-[var(--aida-gold)]'
                          : 'mt-1 text-base font-bold text-[var(--aida-gold)]'
                      }
                    >
                      {formatRmFromSen(item.basePriceSen)}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <Label className="mt-4 flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={showKdsPreview} onCheckedChange={(v) => setShowKdsPreview(!!v)} />
              Show KDS ticket preview
            </Label>
            {showKdsPreview && cart.length > 0 && (
              <aside
                aria-label="KDS ticket preview"
                className="mt-3 rounded-lg border border-dashed border-border bg-card p-4"
              >
                <h3 className="text-sm font-bold text-foreground">KDS preview</h3>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                  {cart.map((line) => (
                    <li key={line.id}>
                      {line.qty}× {line.name} → {catalogue.data?.items.find((item) => item.id === line.menuItemId)?.prepRoute ?? 'bar'}
                      {line.note && ` · Note: ${line.note}`}
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </>
        )}

        {rail === 'sale' && completedOrder && (
          <AuthoritativeOrderReceipt order={completedOrder} onNewSale={startNewSale} />
        )}

        {rail === 'orders' && <OrderBoard />}

        {previewOperationalContext && rail === 'member' && (
          <MemberPanel
            member={member}
            selectedRewardId={selectedReward?.id ?? null}
            onSelectMember={setMember}
            onApplyReward={setSelectedReward}
          />
        )}

        {previewOperationalContext && shift && rail === 'shift' && (
          <section aria-labelledby="shift-panel-title" className="max-w-2xl">
            <h2 id="shift-panel-title" className="font-display text-xl text-primary">
              Shift controls
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="font-semibold text-muted-foreground">Status</dt>
                <dd>{shift.status}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">Opening float</dt>
                <dd>{formatRm(shift.openingFloat)}</dd>
              </div>
              {shift.openedAt && (
                <div>
                  <dt className="font-semibold text-muted-foreground">Opened</dt>
                  <dd>{formatKlDateTime(shift.openedAt)}</dd>
                </div>
              )}
              <div>
                <dt className="font-semibold text-muted-foreground">Variance threshold</dt>
                <dd>{formatRmFromSen(PREVIEW_VARIANCE_THRESHOLD_SEN)} (preview)</dd>
              </div>
            </dl>

            <fieldset className="mt-5 rounded-xl border border-border bg-card p-4">
              <legend className="px-1 text-sm font-bold text-foreground">Cash drawer moves (preview)</legend>
              <div className="flex flex-col gap-2">
                <Label htmlFor="shift-reason">Reason (required)</Label>
                <Input
                  id="shift-reason"
                  value={shiftMoveReason}
                  onChange={(e) => setShiftMoveReason(e.target.value)}
                  placeholder="Manager-approved reason"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="paid-in">Paid in (RM)</Label>
                  <Input
                    id="paid-in"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shiftPaidIn}
                    onChange={(e) => setShiftPaidIn(e.target.value)}
                    className="w-32"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => logShiftMove('Paid in', shiftPaidIn)}>
                  Record
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="paid-out">Paid out (RM)</Label>
                  <Input
                    id="paid-out"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shiftPaidOut}
                    onChange={(e) => setShiftPaidOut(e.target.value)}
                    className="w-32"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => logShiftMove('Paid out', shiftPaidOut)}>
                  Record
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="safe-drop">Safe drop (RM)</Label>
                  <Input
                    id="safe-drop"
                    type="number"
                    min="0"
                    step="0.01"
                    value={shiftDrop}
                    onChange={(e) => setShiftDrop(e.target.value)}
                    className="w-32"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => logShiftMove('Safe drop', shiftDrop)}>
                  Record
                </Button>
              </div>
            </fieldset>
            {shiftMoveLog.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
                {shiftMoveLog.map((entry, i) => (
                  <li key={i}>{entry}</li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onLock} disabled={busy}>
                Lock shift
              </Button>
              <Button type="button" variant="outline" onClick={onCloseRequest} disabled={busy}>
                Close shift
              </Button>
              <Button type="button" variant="outline" onClick={onLogout}>
                Log out
              </Button>
            </div>
          </section>
        )}

        {previewOperationalContext && location && rail === 'terminal' && (
          <section aria-labelledby="terminal-info-title" className="max-w-xl">
            <h2 id="terminal-info-title" className="font-display text-xl text-primary">
              Terminal
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              <Label htmlFor="connection-state">Connection (preview)</Label>
              <Select value={connectionState} onValueChange={(v) => onConnectionStateChange(v as ConnectionState)}>
                <SelectTrigger id="connection-state" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="degraded">Degraded</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="syncing">Syncing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="font-semibold text-muted-foreground">Code</dt>
                <dd>{location.terminalCode}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">Branch</dt>
                <dd>{location.branchName || location.branchCode}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">Sales point</dt>
                <dd>{location.salesPointName || location.salesPointCode}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">Heartbeat</dt>
                <dd>{terminalFixture?.heartbeat ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">Last seen</dt>
                <dd>{terminalFixture?.lastSeen ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">Receipt printer</dt>
                <dd>{terminalFixture?.printer ?? 'Unknown'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">KDS</dt>
                <dd>{terminalFixture?.kds ?? 'Unknown'}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted-foreground">Payment device</dt>
                <dd>{terminalFixture?.paymentDevice ?? 'Unknown'}</dd>
              </div>
            </dl>
          </section>
        )}

        {rail === 'help' && (
          <section aria-labelledby="help-title" className="max-w-xl">
            <h2 id="help-title" className="font-display text-xl text-primary">
              Help &amp; recovery
            </h2>
            {previewOperationalContext ? (
              <ul className="mt-4 flex flex-col gap-3 text-sm text-foreground">
                <li>If connection shows <strong className="font-semibold">Offline</strong>, continue cash sales and sync when back online (Team 2).</li>
                <li>If payment shows <strong className="font-semibold">Unknown</strong>, use Check status on the terminal before retrying charge.</li>
                <li>If printer fails, reprint from Orders after sale completes (permission required).</li>
                <li>Lock shift before leaving the counter; manager closes with counted cash.</li>
                <li>Contact branch manager for enrolment codes and variance approval.</li>
              </ul>
            ) : (
              <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-foreground">
                <p className="font-semibold">Live single-café operations</p>
                <p className="mt-1 text-muted-foreground">Sale and Orders use trusted shared catalogue and order services. Terminal, shift and branch operations are deferred and are not required for this workspace.</p>
                <Button type="button" variant="outline" className="mt-4" onClick={onLogout}>Log out</Button>
              </div>
            )}
          </section>
        )}

        {showPayment && !completedOrder && (
          <OrderCheckoutPanel
            lines={cart}
            placementAttempt={placementAttempt}
            onPlaced={handlePlaced}
            onCancel={() => setShowPayment(false)}
          />
        )}
      </main>

      <aside
        className={
          orderDrawerOpen
            ? 'order-ribbon fixed inset-0 z-50 flex flex-col overflow-y-auto bg-card p-4 lg:static lg:inset-auto lg:z-auto lg:w-80 lg:flex-shrink-0 lg:overflow-visible lg:border-l lg:border-border'
            : 'order-ribbon hidden lg:flex lg:w-80 lg:flex-shrink-0 lg:flex-col lg:overflow-visible lg:border-l lg:border-border lg:bg-card lg:p-4'
        }
      >
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{saleLocked ? 'Completed sale' : 'Current order'}</h2>
          <button
            type="button"
            aria-expanded={orderDrawerOpen}
            onClick={() => setOrderDrawerOpen((v) => !v)}
            className="text-sm font-semibold text-primary lg:hidden"
          >
            {orderDrawerOpen ? 'Close' : 'Open'}
          </button>
        </header>

        <p className="mt-1 text-sm text-muted-foreground">{ORDER_TYPE_LABELS[orderType]}</p>

        {saleLocked && completedOrder ? (
          <div className="mt-4 flex flex-col gap-1">
            <p className="text-lg font-bold text-foreground">Server total: {formatRmFromSen(completedOrder.totalSen)}</p>
            <p className="text-sm text-muted-foreground">
              Order #{completedOrder.orderNumber} · Pay at counter
            </p>
          </div>
        ) : cart.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="No items yet" description="Select products from the menu." />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3 overflow-y-auto">
            {cart.map((line) => (
              <li key={line.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground">{line.name}</span>
                  {line.modifierSummary && (
                    <span className="text-xs text-muted-foreground">{line.modifierSummary}</span>
                  )}
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Note
                    <input
                      type="text"
                      value={line.note ?? ''}
                      onChange={(e) => updateNote(line.id, e.target.value)}
                      placeholder="Item note"
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
                    />
                  </label>
                  <span className="text-sm font-bold text-primary">
                    {formatRmFromSen(line.unitPriceSen * line.qty)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => updateQty(line.id, -1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground"
                    >
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <span className="w-4 text-center text-sm font-semibold">{line.qty}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => updateQty(line.id, 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground"
                    >
                      <PlusIcon size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => removeLine(line.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {member && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="status-pill status-pill--info">{member.displayName}</span>
            {selectedReward && (
              <span className="status-pill status-pill--ok">Reward: {selectedReward.label}</span>
            )}
          </div>
        )}

        <footer className="mt-auto flex flex-col gap-2 pt-4">
          {!saleLocked && (
            <>
              <p className="text-sm text-muted-foreground">Local catalogue estimate</p>
              <p className="text-lg font-bold text-foreground">Estimate: {formatRmFromSen(estimateTotalSen)}</p>
              {selectedReward && (
                <p className="text-xs text-muted-foreground">Preview reward is not applied to the authoritative order.</p>
              )}
            </>
          )}
          {saleLocked ? (
            <Button type="button" className="order-ribbon__pay" onClick={startNewSale}>
              New sale
            </Button>
          ) : (
            <>
              <Button
                type="button"
                className="order-ribbon__pay"
                disabled={cart.length === 0 || showPayment}
                onClick={() => {
                  setShowPayment(true);
                  setOrderDrawerOpen(false);
                }}
              >
                Review &amp; place
              </Button>
              {cart.length > 0 && !showPayment && (
                <Button type="button" variant="outline" onClick={holdOrder}>
                  Hold order
                </Button>
              )}
              {cart.length > 0 && (
                <Button type="button" variant="outline" onClick={requestClearSale}>
                  Clear
                </Button>
              )}
            </>
          )}
        </footer>
      </aside>

      {!orderDrawerOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-border bg-card px-4 py-3 shadow-lg lg:hidden">
          <p className="text-sm font-semibold text-foreground">
            {cart.length} item{cart.length === 1 ? '' : 's'} · estimate {formatRmFromSen(estimateTotalSen)}
          </p>
          <Button type="button" size="sm" onClick={() => setOrderDrawerOpen(true)}>
            {saleLocked ? 'View receipt' : 'View order'}
          </Button>
        </div>
      )}

      <ModifierSheet
        open={modifierItem !== null}
        itemName={modifierItem?.name ?? ''}
        basePriceSen={modifierItem?.basePriceSen ?? 0}
        groups={modifierGroups}
        onConfirm={confirmModifier}
        onClose={() => setModifierItem(null)}
      />

      <ConfirmDialog
        open={clearConfirmOpen}
        title="Clear current sale?"
        message="This removes all items from the cart. This cannot be undone in preview."
        confirmLabel="Clear sale"
        onConfirm={() => {
          setClearConfirmOpen(false);
          resetSaleState();
        }}
        onCancel={() => setClearConfirmOpen(false)}
      />

      <ConfirmDialog
        open={discardTicketId !== null}
        title="Discard held order?"
        message="This removes the parked order entirely. This cannot be undone in preview."
        confirmLabel="Discard order"
        onConfirm={() => {
          if (discardTicketId) discardTicket(discardTicketId);
        }}
        onCancel={() => setDiscardTicketId(null)}
      />

    </div>
  );
}
