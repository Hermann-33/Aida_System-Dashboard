import type { LucideIcon } from 'lucide-react';
import { BarChart3, Boxes, Coffee, Gift, LayoutDashboard, Settings, Store } from 'lucide-react';

export interface AdminNavItem {
  label: string;
  path: string;
}

export interface AdminNavGroup {
  title: string;
  icon: LucideIcon;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: 'Overview',
    icon: LayoutDashboard,
    items: [{ label: 'Dashboard', path: '/admin' }],
  },
  {
    title: 'Reports',
    icon: BarChart3,
    items: [
      { label: 'Sales & Performance', path: '/admin/reports/sales' },
      { label: 'Transactions', path: '/admin/reports/transactions' },
      { label: 'Members & Loyalty', path: '/admin/reports/members' },
    ],
  },
  {
    title: 'Operations',
    icon: Store,
    items: [
      { label: 'Locations', path: '/admin/operations/branches' },
      { label: 'Pickup scheduling', path: '/admin/operations/pickup' },
      { label: 'Terminals', path: '/admin/operations/terminals' },
      { label: 'Shifts', path: '/admin/operations/shifts' },
      { label: 'Employees', path: '/admin/operations/employees' },
    ],
  },
  {
    title: 'Catalogue',
    icon: Coffee,
    items: [{ label: 'Menu', path: '/admin/catalogue/menu' }],
  },
  {
    title: 'Inventory',
    icon: Boxes,
    items: [{ label: 'Inventory', path: '/admin/inventory/stock' }],
  },
  {
    title: 'Rewards',
    icon: Gift,
    items: [
      { label: 'Loyalty program', path: '/admin/rewards/loyalty' },
      { label: 'Marketing', path: '/admin/rewards/campaigns' },
    ],
  },
  {
    title: 'System',
    icon: Settings,
    items: [
      { label: 'Audit', path: '/admin/system/audit' },
      { label: 'Integrations', path: '/admin/system/integrations' },
      { label: 'Settings', path: '/admin/system/settings' },
    ],
  },
];

const MENU_EDITOR_RE = /^\/admin\/catalogue\/menu\/[^/]+$/;

export function adminPageTitle(pathname: string): string {
  if (MENU_EDITOR_RE.test(pathname)) return 'Menu item editor';
  for (const group of ADMIN_NAV) {
    const item = group.items.find((i) => i.path === pathname);
    if (item) return item.label;
  }
  return 'Admin';
}

/** Whether `pathname` is on or under `item.path` — used to highlight the
 * right nav entry (expanded) or group icon (collapsed) for the current route,
 * including nested routes like the menu item editor. */
export function isNavItemActive(pathname: string, item: AdminNavItem): boolean {
  if (item.path === '/admin') return pathname === '/admin';
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}
