import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CounterWorkspace } from './CounterWorkspace';
import type { EmployeeIdentity, ShiftSummary, TerminalLocation } from '../../auth/types';
import { MemberPanel } from './MemberPanel';
import { fetchPublishedCatalogue, type CatalogueSnapshot } from '../catalogue/catalogueClient';

vi.mock('../../preview/uiPreviewMode', () => ({
  isUiPreviewMode: vi.fn(() => true),
  UI_PREVIEW_LABEL: 'UI PREVIEW — SAMPLE DATA',
}));

vi.mock('../catalogue/catalogueClient', async (importOriginal) => {
  const original = await importOriginal<typeof import('../catalogue/catalogueClient')>();
  return { ...original, fetchPublishedCatalogue: vi.fn() };
});

const sharedCatalogue: CatalogueSnapshot = {
  revision: 8,
  categories: [
    { id: 'coffee', slug: 'coffee', name: 'Coffee', imageUrl: null, sortOrder: 10, isActive: true, itemCount: 2 },
  ],
  items: [
    {
      id: 'latte', categoryId: 'coffee', categoryName: 'Coffee', slug: 'latte', sku: 'LATTE', kind: 'product',
      name: 'Latte', description: '', basePriceSen: 1050, isAvailable: true, isPublished: true,
      isFeatured: false, isBestSeller: true, isStudentEligible: false, isDrink: true, imageUrl: null, volumeMl: 350,
      prepRoute: 'bar', sortOrder: 10, compatibleAddOnIds: ['oat'],
      variants: [
        { id: 'medium', code: 'medium', label: 'Medium', priceDeltaSen: 0, isDefault: true, isAvailable: true, sortOrder: 10 },
      ],
      customizationGroups: [
        {
          id: 'temperature', code: 'temperature', name: 'Temperature', sortOrder: 10,
          options: [
            { id: 'hot', code: 'hot', label: 'Hot', priceDeltaSen: 0, isDefault: true, isAvailable: true, sortOrder: 10 },
            { id: 'iced', code: 'iced', label: 'Iced', priceDeltaSen: 0, isDefault: false, isAvailable: true, sortOrder: 20 },
          ],
        },
        {
          id: 'sweetness', code: 'sweetness', name: 'Sweetness', sortOrder: 20,
          options: [
            { id: 'regular', code: 'regular', label: 'Regular', priceDeltaSen: 0, isDefault: true, isAvailable: true, sortOrder: 10 },
            { id: 'less-sweet', code: 'less-sweet', label: 'Less sweet', priceDeltaSen: 0, isDefault: false, isAvailable: true, sortOrder: 20 },
          ],
        },
      ],
    },
    {
      id: 'oat', categoryId: 'coffee', categoryName: 'Coffee', slug: 'oat', sku: 'OAT', kind: 'addon',
      name: 'Oat milk', description: '', basePriceSen: 150, isAvailable: true, isPublished: true,
      isFeatured: false, isBestSeller: false, isStudentEligible: false, isDrink: false, imageUrl: null, volumeMl: null,
      prepRoute: 'bar', sortOrder: 20, compatibleAddOnIds: [], variants: [], customizationGroups: [],
    },
  ],
};

const employee: EmployeeIdentity = {
  id: 'e1',
  username: 'nadia',
  role: 'staff',
  fullName: 'Nadia',
  isGlobalManager: false,
  dualRolePosEnabled: false,
  selectedProduct: 'pos',
  assignedBranchIds: ['b1'],
};

const location: TerminalLocation = {
  terminalId: 't1',
  terminalCode: 'MC-T01',
  branchId: 'b1',
  branchCode: 'MAIN',
  salesPointId: 'sp1',
  salesPointCode: 'COUNTER',
};

const shift: ShiftSummary = {
  id: 's1',
  status: 'open',
  terminalId: 't1',
  salesPointId: 'sp1',
  branchId: 'b1',
  staffUserId: 'e1',
  openingFloat: 100,
  closingExpectedCash: null,
  closingActualCash: null,
  cashVariance: null,
  openedAt: '2026-07-19T08:00:00+08:00',
};

const workspaceProps = {
  employee,
  location,
  shift,
  onLock: () => {},
  onCloseRequest: () => {},
  onLogout: () => {},
  connectionState: 'online' as const,
  onConnectionStateChange: () => {},
};

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CounterWorkspace {...workspaceProps} />
    </QueryClientProvider>,
  );
}

describe('CounterWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchPublishedCatalogue).mockResolvedValue(sharedCatalogue);
  });

  it('renders New Sale rail and an item from the shared catalogue', async () => {
    renderWorkspace();
    expect(screen.getByRole('navigation', { name: 'POS navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new sale/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /latte/i })).toBeInTheDocument();
    expect(screen.getByText(/catalogue revision 8/i)).toBeInTheDocument();
  });

  it('shows product label Aida Counter in context via workspace brand', async () => {
    renderWorkspace();
    expect(screen.getByText('Aida')).toBeInTheDocument();
    await screen.findByRole('button', { name: /latte/i });
  });

  it('fails visibly without falling back to the preview menu', async () => {
    vi.mocked(fetchPublishedCatalogue).mockRejectedValueOnce(new Error('offline'));
    renderWorkspace();
    expect(await screen.findByRole('alert')).toHaveTextContent(/shared catalogue is unavailable/i);
    expect(screen.queryByRole('button', { name: /salted caramel latte/i })).not.toBeInTheDocument();
  });

  it('keeps independently configured drink options and add-ons on separate cart lines', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(await screen.findByRole('button', { name: /latte/i }));
    await user.click(screen.getByLabelText('Iced'));
    await user.click(screen.getByLabelText('Less sweet'));
    await user.click(screen.getByRole('checkbox', { name: /Oat milk/i }));
    await user.click(screen.getByRole('button', { name: /add to order/i }));

    await user.click(screen.getByRole('button', { name: /latte/i }));
    expect(screen.getByLabelText('Hot')).toBeChecked();
    expect(screen.getByLabelText('Regular')).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Oat milk/i })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: /add to order/i }));

    expect(screen.getByText('Variant: Medium · Temperature: Iced · Sweetness: Less sweet · Add-ons: Oat milk')).toBeInTheDocument();
    expect(screen.getByText('Variant: Medium · Temperature: Hot · Sweetness: Regular')).toBeInTheDocument();
  });
});

describe('MemberPanel', () => {
  it('does not show unrestricted purchase history export', () => {
    render(
      <MemberPanel
        member={null}
        selectedRewardId={null}
        onSelectMember={() => {}}
        onApplyReward={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/no purchase history export/i)).toBeInTheDocument();
  });

  it('shows inactive member error on select', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <MemberPanel
        member={null}
        selectedRewardId={null}
        onSelectMember={onSelect}
        onApplyReward={() => {}}
      />,
    );
    await user.type(screen.getByPlaceholderText(/search|member|id/i), 'Inactive');
    await user.click(screen.getByRole('option', { name: /inactive member/i }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/inactive/i);
  });
});
