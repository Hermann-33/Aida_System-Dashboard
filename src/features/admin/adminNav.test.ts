import { describe, expect, it } from 'vitest';
import { ADMIN_NAV, adminPageTitle, isNavItemActive } from './adminNav';

describe('ADMIN_NAV', () => {
  it('gives every group an icon component', () => {
    for (const group of ADMIN_NAV) {
      expect(group.icon).toBeTruthy();
    }
  });

  it('keeps existing page-title lookup working', () => {
    expect(adminPageTitle('/admin/operations/terminals')).toBe('Terminals');
    expect(adminPageTitle('/admin/catalogue/menu/abc123')).toBe('Menu item editor');
  });
});

describe('isNavItemActive', () => {
  it('matches the dashboard item only on exact root path', () => {
    expect(isNavItemActive('/admin', { label: 'Dashboard', path: '/admin' })).toBe(true);
    expect(isNavItemActive('/admin/live', { label: 'Dashboard', path: '/admin' })).toBe(false);
  });

  it('matches non-root items exactly or as a path prefix', () => {
    const item = { label: 'Menu', path: '/admin/catalogue/menu' };
    expect(isNavItemActive('/admin/catalogue/menu', item)).toBe(true);
    expect(isNavItemActive('/admin/catalogue/menu/abc123', item)).toBe(true);
    expect(isNavItemActive('/admin/catalogue/menu-other', item)).toBe(false);
    expect(isNavItemActive('/admin/catalogue/categories', item)).toBe(false);
  });
});
