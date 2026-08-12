import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';

function renderSidebar(initialPath = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AdminSidebar />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('AdminSidebar (expanded)', () => {
  it('renders single-item groups as direct links and multi-item groups as closed accordions by default', () => {
    renderSidebar();

    // Overview, Catalogue, and Inventory have exactly one page each — no
    // accordion, just a link straight to that page.
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Overview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Catalogue' })).not.toBeInTheDocument();

    // Multi-item groups still accordion, closed until clicked.
    expect(screen.getByRole('button', { name: /Reports/ })).toBeInTheDocument();
    expect(screen.queryByText('Sales & Performance')).not.toBeInTheDocument();
    expect(screen.queryByText('Terminals')).not.toBeInTheDocument();
  });

  it("marks the current route's link active, auto-opening its section", () => {
    renderSidebar('/admin/operations/terminals');
    expect(screen.getByRole('link', { name: 'Terminals' })).toHaveClass(
      'admin-nav-link--active',
    );
  });

  it('marks the single-item Dashboard link active on /admin', () => {
    renderSidebar('/admin');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass('admin-nav-link--active');
  });

  it('shows the signed-in identity and product title', () => {
    renderSidebar();
    expect(screen.getByText('Aida Office')).toBeInTheDocument();
  });

  it('keeps a compact brand mark visible even when collapsed', async () => {
    const user = userEvent.setup();
    const { container } = renderSidebar();
    expect(container.querySelector('.admin-sidebar__brand-mark')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(container.querySelector('.admin-sidebar__brand-mark')).toBeInTheDocument();
  });
});

describe('AdminSidebar (single-item groups)', () => {
  it('links directly to the single page without an accordion, in both modes', async () => {
    const user = userEvent.setup();
    renderSidebar();

    expect(screen.getByRole('link', { name: 'Menu' })).toHaveAttribute(
      'href',
      '/admin/catalogue/menu',
    );

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('link', { name: 'Catalogue' })).toHaveAttribute(
      'href',
      '/admin/catalogue/menu',
    );
  });
});

describe('AdminSidebar (accordion sections)', () => {
  it('opens a closed section on header click, closing whichever other multi-item section was open', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole('button', { name: /Operations/ }));
    expect(screen.getByText('Terminals')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Reports/ }));
    expect(screen.getByText('Sales & Performance')).toBeInTheDocument();
    expect(screen.queryByText('Terminals')).not.toBeInTheDocument();
  });

  it('closes the open section entirely on a second click of its own header', async () => {
    const user = userEvent.setup();
    renderSidebar();

    const reportsHeader = screen.getByRole('button', { name: /Reports/ });
    await user.click(reportsHeader);
    expect(screen.getByText('Sales & Performance')).toBeInTheDocument();

    await user.click(reportsHeader);
    expect(screen.queryByText('Sales & Performance')).not.toBeInTheDocument();
  });

  it('persists the open section across a remount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSidebar();
    await user.click(screen.getByRole('button', { name: /Reports/ }));
    unmount();

    renderSidebar();
    expect(screen.getByText('Sales & Performance')).toBeInTheDocument();
    expect(screen.queryByText('Terminals')).not.toBeInTheDocument();
  });
});

describe('AdminSidebar (collapse toggle)', () => {
  it('starts expanded when there is no stored preference', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  });

  it('collapses to an icon-only rail, hiding text labels', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Reports')).not.toBeInTheDocument();

    // Multi-item groups collapse to icon-only toggle buttons.
    expect(
      screen.getAllByRole('button', { name: /^(Reports|Operations|Rewards|System)$/ }),
    ).toHaveLength(4);

    // Single-item groups collapse to a direct icon link — nothing to expand.
    expect(
      screen.getAllByRole('link', { name: /^(Overview|Catalogue|Inventory)$/ }),
    ).toHaveLength(3);

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('persists collapsed state across a remount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderSidebar();
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    unmount();

    renderSidebar();
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});

describe('AdminSidebar (collapsed rail icon clicks)', () => {
  async function collapse(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
  }

  it('re-expands the sidebar and opens that section when a rail icon is clicked', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await collapse(user);

    await user.click(screen.getByRole('button', { name: 'Reports' }));

    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(screen.getByText('Sales & Performance')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });

  it('opens the newly-clicked section even if a different one was open before collapsing', async () => {
    const user = userEvent.setup();
    renderSidebar();
    await collapse(user);
    await user.click(screen.getByRole('button', { name: 'Reports' }));
    expect(screen.getByText('Sales & Performance')).toBeInTheDocument();

    await collapse(user);
    await user.click(screen.getByRole('button', { name: 'Operations' }));

    expect(screen.getByText('Terminals')).toBeInTheDocument();
    expect(screen.queryByText('Sales & Performance')).not.toBeInTheDocument();
  });

  it('highlights the active group icon when collapsed', async () => {
    const user = userEvent.setup();
    renderSidebar('/admin/operations/terminals');
    await collapse(user);

    expect(screen.getByRole('button', { name: 'Operations' })).toHaveClass(
      'admin-nav-group__icon-btn--active',
    );
    expect(screen.getByRole('button', { name: 'Reports' })).not.toHaveClass(
      'admin-nav-group__icon-btn--active',
    );
  });
});

describe('AdminSidebar (footer)', () => {
  it('shows a footer avatar initial in both modes, and the full name only when expanded', async () => {
    const user = userEvent.setup();
    renderSidebar();

    expect(screen.getByTestId('admin-sidebar-avatar')).toHaveTextContent('A');
    expect(screen.getByTestId('admin-sidebar-footer-name')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByTestId('admin-sidebar-avatar')).toHaveTextContent('A');
    expect(screen.queryByTestId('admin-sidebar-footer-name')).not.toBeInTheDocument();
  });

  it('always has a reachable log out control, in both modes', async () => {
    const user = userEvent.setup();
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });
});
