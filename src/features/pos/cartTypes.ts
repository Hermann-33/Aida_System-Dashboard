import type { OrderType, PreviewMember, PreviewRewardOption } from '../../preview/fixtures/catalog';

export interface CartModifierSelection {
  groupId: string;
  optionIds: string[];
}

export interface CartLine {
  id: string;
  menuItemId: string;
  name: string;
  unitPriceSen: number;
  qty: number;
  modifiers: CartModifierSelection[];
  modifierSummary?: string;
  note?: string;
}

/** POS-O11 — a parked order: the whole in-progress sale (cart, order type,
 * member/reward) snapshotted so the counter is free for the next customer. */
export interface HeldTicket {
  id: string;
  label: string;
  heldAt: string;
  cart: CartLine[];
  orderType: OrderType;
  member: PreviewMember | null;
  selectedReward: PreviewRewardOption | null;
}

export function newTicketId(): string {
  return `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function lineTotalSen(line: CartLine): number {
  return line.unitPriceSen * line.qty;
}

export function cartTotalSen(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotalSen(line), 0);
}

export function newCartLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
