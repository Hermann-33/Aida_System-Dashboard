import { useState } from 'react';
import { useSyncExternalStore } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { getEmployeeSession, logoutEmployee, subscribeEmployeeSession } from '../auth/employeeSession';
import { ADMIN_NAV, isNavItemActive } from '../features/admin/adminNav';

const COLLAPSE_STORAGE_KEY = 'aida-admin-sidebar-collapsed';
const OPEN_SECTION_STORAGE_KEY = 'aida-admin-sidebar-open-section';

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsedPreference(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(value));
  } catch {
    // Cosmetic preference only — not worth surfacing an error for.
  }
}

function writeOpenSection(value: string | null) {
  try {
    if (value) {
      window.localStorage.setItem(OPEN_SECTION_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(OPEN_SECTION_STORAGE_KEY);
    }
  } catch {
    // Cosmetic preference only — not worth surfacing an error for.
  }
}

/** Whichever section was last left open, falling back to the section that
 * contains the current route, so the sidebar never opens to a state where
 * the page you're already on is hidden inside a collapsed section. */
function initialOpenSection(pathname: string): string | null {
  try {
    const stored = window.localStorage.getItem(OPEN_SECTION_STORAGE_KEY);
    if (stored && ADMIN_NAV.some((g) => g.title === stored)) return stored;
  } catch {
    // Fall through to route-based default.
  }
  const activeGroup = ADMIN_NAV.find((g) => g.items.some((item) => isNavItemActive(pathname, item)));
  return activeGroup?.title ?? null;
}

export function AdminSidebar() {
  const location = useLocation();
  const session = useSyncExternalStore(
    subscribeEmployeeSession,
    getEmployeeSession,
    getEmployeeSession,
  );
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const [openSection, setOpenSection] = useState(() => initialOpenSection(location.pathname));

  function setCollapsedPersisted(value: boolean) {
    setCollapsed(value);
    writeCollapsedPreference(value);
  }

  // A real accordion, not independent toggles — opening one section closes
  // whichever other one was open, so the sidebar stays short instead of
  // growing to fit every group's items at once.
  function toggleSection(title: string) {
    setOpenSection((current) => {
      const next = current === title ? null : title;
      writeOpenSection(next);
      return next;
    });
  }

  // Clicking a group's icon in the collapsed rail re-expands the sidebar and
  // jumps straight to that group's section, rather than popping open a
  // separate flyout menu — one interaction model instead of two.
  function expandToSection(title: string) {
    setCollapsedPersisted(false);
    setOpenSection(title);
    writeOpenSection(title);
  }

  const identity = session.identity?.fullName ?? 'Admin';
  const roleLabel = session.identity?.isGlobalManager
    ? 'Global manager'
    : session.identity?.role === 'admin'
      ? 'Admin'
      : 'Staff';

  function onLogout() {
    void logoutEmployee().then(() => {
      window.location.href = '/employee';
    });
  }

  return (
    <aside className={collapsed ? 'admin-sidebar admin-sidebar--collapsed' : 'admin-sidebar'}>
      <button
        type="button"
        className="admin-sidebar__toggle"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        onClick={() => setCollapsedPersisted(!collapsed)}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      <div className="admin-sidebar__header">
        <span className="admin-sidebar__brand-mark" aria-hidden="true">
          A
        </span>
        {!collapsed && <p className="brand-script">Aida Cafe</p>}
      </div>

      {!collapsed && <p className="admin-product-title">Aida Office</p>}

      <nav aria-label="Admin modules" className="admin-nav">
        {ADMIN_NAV.map((group) => {
          const Icon = group.icon;
          const groupActive = group.items.some((item) =>
            isNavItemActive(location.pathname, item),
          );

          // A group with exactly one page has nothing to expand into — an
          // accordion revealing a single, already-named link just adds a
          // click. Link straight to that page instead, in both modes.
          if (group.items.length === 1) {
            const onlyItem = group.items[0];
            if (!onlyItem) return null;
            const linkClassName = ({ isActive }: { isActive: boolean }) =>
              isActive || (onlyItem.path === '/admin' && location.pathname === '/admin')
                ? collapsed
                  ? 'admin-nav-group__icon-btn admin-nav-group__icon-btn--active'
                  : 'admin-nav-group__title admin-nav-link--active'
                : collapsed
                  ? 'admin-nav-group__icon-btn'
                  : 'admin-nav-group__title';

            return (
              <div
                key={group.title}
                className={collapsed ? 'admin-nav-group admin-nav-group--collapsed' : 'admin-nav-group'}
              >
                <NavLink
                  to={onlyItem.path}
                  end={onlyItem.path === '/admin'}
                  aria-label={collapsed ? group.title : undefined}
                  className={linkClassName}
                >
                  <Icon size={collapsed ? 20 : 16} aria-hidden={collapsed ? undefined : 'true'} />
                  {!collapsed && <span className="admin-nav-group__title-text">{onlyItem.label}</span>}
                </NavLink>
              </div>
            );
          }

          if (collapsed) {
            return (
              <div key={group.title} className="admin-nav-group admin-nav-group--collapsed">
                <button
                  type="button"
                  className={
                    groupActive
                      ? 'admin-nav-group__icon-btn admin-nav-group__icon-btn--active'
                      : 'admin-nav-group__icon-btn'
                  }
                  aria-label={group.title}
                  onClick={() => expandToSection(group.title)}
                >
                  <Icon size={20} />
                </button>
              </div>
            );
          }

          const isOpenSection = openSection === group.title;
          return (
            <div key={group.title} className="admin-nav-group">
              <button
                type="button"
                className="admin-nav-group__title"
                aria-expanded={isOpenSection}
                onClick={() => toggleSection(group.title)}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="admin-nav-group__title-text">{group.title}</span>
                {isOpenSection ? (
                  <ChevronDown size={14} aria-hidden="true" />
                ) : (
                  <ChevronRight size={14} aria-hidden="true" />
                )}
              </button>
              {isOpenSection && (
                <ul className="admin-nav-list">
                  {group.items.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) =>
                          isActive || (item.path === '/admin' && location.pathname === '/admin')
                            ? 'admin-nav-link admin-nav-link--active'
                            : 'admin-nav-link'
                        }
                        end={item.path === '/admin'}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="admin-sidebar__footer">
        <span
          className="admin-sidebar__avatar"
          data-testid="admin-sidebar-avatar"
          aria-hidden="true"
        >
          {identity.charAt(0).toUpperCase()}
        </span>
        {!collapsed && (
          <span className="admin-sidebar__footer-text">
            <span
              className="admin-sidebar__footer-name"
              data-testid="admin-sidebar-footer-name"
            >
              {identity}
            </span>
            <span className="admin-sidebar__footer-role">{roleLabel}</span>
          </span>
        )}
        <button
          type="button"
          className="admin-sidebar__logout"
          aria-label="Log out"
          onClick={onLogout}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
