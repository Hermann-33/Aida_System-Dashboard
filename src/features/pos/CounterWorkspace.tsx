import { useMemo, useState } from 'react';
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
  PREVIEW_CATEGORIES,
  PREVIEW_MENU,
  PREVIEW_MODIFIER_GROUPS,
  PREVIEW_TERMINALS,
  PREVIEW_TRANSACTIONS,
  PREVIEW_VARIANCE_THRESHOLD_SEN,
  type ConnectionState,
  type OrderType,
  type PreviewCategory,
  type PreviewMember,
  type PreviewMenuItem,
  type PreviewRewardOption,
  type PreviewTxn,
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
import { ManagerPinDialog } from './ManagerPinDialog';
import { MemberPanel } from './MemberPanel';
import { ModifierSheet } from './ModifierSheet';
import { CompletedSaleReceipt, PaymentPanel } from './PaymentPanel';
import type { PreviewSaleReceipt } from './paymentReceipt';
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
  location: TerminalLocation;
  shift: ShiftSummary;
  onLock: () => void;
  onCloseRequest: () => void;
  onLogout: () => void;
  busy?: boolean;
  connectionState: ConnectionState;
  onConnectionStateChange: (state: ConnectionState) => void;
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

function rewardDiscountSen(reward: PreviewRewardOption | null): number {
  if (!reward?.eligible) return 0;
  if (reward.kind === 'offer' && reward.label.includes('RM2')) return 200;
  if (reward.kind === 'voucher' && reward.label.includes('RM 5')) return 500;
  if (reward.kind === 'voucher' && reward.label.includes('RM 10')) return 1000;
  if (reward.kind === 'free_pastry') return 750;
  if (reward.kind === 'free_drink') return 1200;
  return 0;
}

export function CounterWorkspace({
  employee,
  location,
  shift,
  onLock,
  onCloseRequest,
  onLogout,
  busy = false,
  connectionState,
  onConnectionStateChange,
}: Props) {
  const [rail, setRail] = useState<RailId>('sale');
  const [category, setCategory] = useState<PreviewCategory>('All');
  const [search, setSearch] = useState('');
  const [compactMenu, setCompactMenu] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [member, setMember] = useState<PreviewMember | null>(null);
  const [selectedReward, setSelectedReward] = useState<PreviewRewardOption | null>(null);
  const [modifierItem, setModifierItem] = useState<PreviewMenuItem | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [completedSale, setCompletedSale] = useState<PreviewSaleReceipt | null>(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [heldTickets, setHeldTickets] = useState<HeldTicket[]>([]);
  const [discardTicketId, setDiscardTicketId] = useState<string | null>(null);
  const [showKdsPreview, setShowKdsPreview] = useState(false);

  const [ordersQuery, setOrdersQuery] = useState('');
  const [ordersStatus, setOrdersStatus] = useState<'all' | PreviewTxn['status']>('all');
  const [selectedOrder, setSelectedOrder] = useState<PreviewTxn | null>(null);
  const [orderAction, setOrderAction] = useState<'void' | 'refund' | 'cancel' | null>(null);
  const [orderActionReason, setOrderActionReason] = useState('');
  const [orderActionPinOpen, setOrderActionPinOpen] = useState(false);
  const [orderActionLog, setOrderActionLog] = useState<string[]>([]);

  const [shiftPaidIn, setShiftPaidIn] = useState('');
  const [shiftPaidOut, setShiftPaidOut] = useState('');
  const [shiftDrop, setShiftDrop] = useState('');
  const [shiftMoveReason, setShiftMoveReason] = useState('');
  const [shiftMoveLog, setShiftMoveLog] = useState<string[]>([]);

  const discountSen = rewardDiscountSen(selectedReward);
  const totalSen = Math.max(0, cartTotalSen(cart) - discountSen);

  const filteredMenu = useMemo(() => {
    let items = PREVIEW_MENU;
    if (category !== 'All') {
      items = items.filter((i) => i.category === category || (category === 'Favourites' && i.bestSeller));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
    }
    return items;
  }, [category, search]);

  const filteredOrders = useMemo(() => {
    let rows = PREVIEW_TRANSACTIONS;
    if (ordersStatus !== 'all') {
      rows = rows.filter((t) => t.status === ordersStatus);
    }
    if (ordersQuery.trim()) {
      const q = ordersQuery.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.order.toLowerCase().includes(q)
          || t.staff.toLowerCase().includes(q)
          || (t.member?.toLowerCase().includes(q) ?? false),
      );
    }
    return rows;
  }, [ordersQuery, ordersStatus]);

  const terminalFixture = PREVIEW_TERMINALS.find((t) => t.code === location.terminalCode)
    ?? PREVIEW_TERMINALS[0];

  function addToCart(item: PreviewMenuItem) {
    if (!item.available || completedSale) return;
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
    setCompletedSale(null);
    setRail('sale');
    setOrderDrawerOpen(false);
  }

  function handlePaid(receipt: PreviewSaleReceipt) {
    setCompletedSale(receipt);
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

  const saleLocked = completedSale !== null;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <nav
        aria-label="POS navigation"
        className="flex w-20 flex-shrink-0 flex-col items-center gap-1 bg-[var(--aida-espresso)] py-4 sm:w-24"
      >
        <p className="mb-3 font-brand text-2xl text-[var(--aida-floral-pink)]">Aida</p>
        <ul className="flex w-full flex-col items-center gap-1 px-2">
          {RAIL_ITEMS.map((item) => {
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
        {rail === 'sale' && !showPayment && !completedSale && (
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

            <div role="tablist" aria-label="Categories" className="mt-4 flex flex-wrap gap-2">
              {PREVIEW_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={category === cat}
                  onClick={() => setCategory(cat)}
                  className={
                    category === cat
                      ? 'rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground'
                      : 'rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground'
                  }
                >
                  {cat}
                </button>
              ))}
            </div>

            <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
              Showing {filteredMenu.length} item{filteredMenu.length === 1 ? '' : 's'} ·{' '}
              {category === 'All' ? 'all categories' : category}
            </p>

            <div
              data-category={category}
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
                  disabled={!item.available}
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
                        item.available
                          ? 'absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
                          : 'absolute inset-0 h-full w-full object-cover grayscale'
                      }
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      title={`Tone ${item.imageTone}`}
                      className="absolute inset-0"
                      style={{ backgroundColor: item.imageTone }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                  {item.bestSeller && (
                    <span className="absolute left-2 top-2 rounded-full bg-[var(--aida-gold)] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[var(--aida-espresso)]">
                      Best seller
                    </span>
                  )}
                  {!item.available && (
                    <span className="absolute right-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-xs font-bold uppercase text-destructive-foreground">
                      Sold out
                    </span>
                  )}

                  <div className="relative z-10 p-3 text-white">
                    {!compactMenu && (
                      <p className="text-xs font-bold uppercase tracking-widest text-white/80">
                        {item.category}
                      </p>
                    )}
                    <p className={compactMenu ? 'text-sm font-bold leading-tight' : 'mt-1 text-lg font-bold leading-tight'}>
                      {compactMenu ? item.compactLabel : item.name}
                    </p>
                    <p
                      className={
                        compactMenu
                          ? 'text-sm font-bold text-[var(--aida-gold)]'
                          : 'mt-1 text-base font-bold text-[var(--aida-gold)]'
                      }
                    >
                      {formatRmFromSen(item.priceSen)}
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
                      {line.qty}× {line.name} → {PREVIEW_MENU.find((m) => m.id === line.menuItemId)?.route ?? 'bar'}
                      {line.note && ` · Note: ${line.note}`}
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </>
        )}

        {rail === 'sale' && completedSale && <CompletedSaleReceipt receipt={completedSale} />}

        {rail === 'orders' && (
          <section aria-labelledby="orders-preview-title">
            <h2 id="orders-preview-title" className="font-display text-xl text-primary">
              Orders
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Preview history — void/refund/cancel write Team 2 audit records when live.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Label htmlFor="orders-search" className="sr-only">
                Search orders
              </Label>
              <Input
                id="orders-search"
                type="search"
                placeholder="Order #, staff, member…"
                value={ordersQuery}
                onChange={(e) => setOrdersQuery(e.target.value)}
                className="max-w-[18rem]"
              />
              <Select value={ordersStatus} onValueChange={(v) => setOrdersStatus(v as typeof ordersStatus)}>
                <SelectTrigger aria-label="Filter by status" className="w-[10rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Refunded">Refunded</SelectItem>
                  <SelectItem value="Voided">Voided</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <table className="data-table admin-table mt-4">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>When</th>
                  <th>Staff</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((row) => (
                  <tr key={row.order}>
                    <td>{row.order}</td>
                    <td>{row.when}</td>
                    <td>{row.staff}</td>
                    <td>{row.status}</td>
                    <td>{formatRmFromSen(row.totalSen)}</td>
                    <td>
                      <Button type="button" variant="outline" size="sm" onClick={() => setSelectedOrder(row)}>
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedOrder && (
              <div
                role="region"
                aria-label="Order detail"
                className="mt-4 rounded-xl border border-border bg-card p-5"
              >
                <h3 className="text-lg font-bold text-foreground">{selectedOrder.order}</h3>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="font-semibold text-muted-foreground">When</dt>
                    <dd>{selectedOrder.when}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-muted-foreground">Staff</dt>
                    <dd>{selectedOrder.staff}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-muted-foreground">Point</dt>
                    <dd>{selectedOrder.salesPoint}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-muted-foreground">Method</dt>
                    <dd>{selectedOrder.method}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-muted-foreground">Status</dt>
                    <dd>{selectedOrder.status}</dd>
                  </div>
                  {selectedOrder.member && (
                    <div>
                      <dt className="font-semibold text-muted-foreground">Member</dt>
                      <dd>{selectedOrder.member}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-semibold text-muted-foreground">Total</dt>
                    <dd>{formatRmFromSen(selectedOrder.totalSen)}</dd>
                  </div>
                </dl>
                {orderAction && (
                  <div className="mt-4 flex flex-col gap-2">
                    <Label htmlFor="order-action-reason">
                      Reason for {orderAction} (Team 2 audit when live)
                    </Label>
                    <textarea
                      id="order-action-reason"
                      value={orderActionReason}
                      onChange={(e) => setOrderActionReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setOrderAction('void')}>
                    Void preview
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOrderAction('refund')}>
                    Refund preview
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOrderAction('cancel')}>
                    Cancel preview
                  </Button>
                  {orderAction && (
                    <Button
                      type="button"
                      disabled={!orderActionReason.trim()}
                      onClick={() => setOrderActionPinOpen(true)}
                    >
                      Submit {orderAction} preview
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedOrder(null);
                      setOrderAction(null);
                      setOrderActionReason('');
                    }}
                  >
                    Close
                  </Button>
                </div>

                {orderActionLog.filter((entry) => entry.includes(selectedOrder.order)).length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
                    {orderActionLog
                      .filter((entry) => entry.includes(selectedOrder.order))
                      .map((entry, i) => (
                        <li key={i}>{entry}</li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {rail === 'member' && (
          <MemberPanel
            member={member}
            selectedRewardId={selectedReward?.id ?? null}
            onSelectMember={setMember}
            onApplyReward={setSelectedReward}
          />
        )}

        {rail === 'shift' && (
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

        {rail === 'terminal' && (
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
            <ul className="mt-4 flex flex-col gap-3 text-sm text-foreground">
              <li>If connection shows <strong className="font-semibold">Offline</strong>, continue cash sales and sync when back online (Team 2).</li>
              <li>If payment shows <strong className="font-semibold">Unknown</strong>, use Check status on the terminal before retrying charge.</li>
              <li>If printer fails, reprint from Orders after sale completes (permission required).</li>
              <li>Lock shift before leaving the counter; manager closes with counted cash.</li>
              <li>Contact branch manager for enrolment codes and variance approval.</li>
            </ul>
          </section>
        )}

        {showPayment && !completedSale && (
          <PaymentPanel
            lines={cart}
            orderType={orderType}
            member={member}
            employee={employee}
            location={location}
            shift={shift}
            discountSen={discountSen}
            rewardLabel={selectedReward?.label}
            onPaid={handlePaid}
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

        {saleLocked && completedSale ? (
          <div className="mt-4 flex flex-col gap-1">
            <p className="text-lg font-bold text-foreground">Total paid: {formatRmFromSen(completedSale.totalSen)}</p>
            <p className="text-sm text-muted-foreground">
              Order {completedSale.orderNumber} · {METHOD_SHORT[completedSale.method]}
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
              <p className="text-sm text-muted-foreground">
                Subtotal: {formatRmFromSen(cartTotalSen(cart))}
                {discountSen > 0 && (
                  <span className="text-[var(--aida-success)]"> · −{formatRmFromSen(discountSen)} reward</span>
                )}
              </p>
              <p className="text-lg font-bold text-foreground">Total: {formatRmFromSen(totalSen)}</p>
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
                Pay
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
            {cart.length} item{cart.length === 1 ? '' : 's'} · {formatRmFromSen(totalSen)}
          </p>
          <Button type="button" size="sm" onClick={() => setOrderDrawerOpen(true)}>
            {saleLocked ? 'View receipt' : 'View order'}
          </Button>
        </div>
      )}

      <ModifierSheet
        open={modifierItem !== null}
        itemName={modifierItem?.name ?? ''}
        basePriceSen={modifierItem?.priceSen ?? 0}
        groups={PREVIEW_MODIFIER_GROUPS}
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

      <ManagerPinDialog
        open={orderActionPinOpen}
        actionLabel={`${orderAction ?? 'approve'} order ${selectedOrder?.order ?? ''}`}
        onApprove={(managerName) => {
          setOrderActionLog((prev) => [
            `${selectedOrder?.order} — ${orderAction} — "${orderActionReason}" — approved by ${managerName} (preview; Team 2 audit)`,
            ...prev,
          ]);
          setOrderActionPinOpen(false);
          setOrderAction(null);
          setOrderActionReason('');
        }}
        onCancel={() => setOrderActionPinOpen(false)}
      />
    </div>
  );
}

const METHOD_SHORT: Record<PreviewSaleReceipt['method'], string> = {
  cash: 'Cash',
  card: 'Card',
  ewallet: 'E-wallet',
  student_wallet: 'Student wallet',
};
