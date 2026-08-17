import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentPanel } from './PaymentPanel';
import { CounterWorkspace } from './CounterWorkspace';
import type { EmployeeIdentity, ShiftSummary, TerminalLocation } from '../../auth/types';
import { resetPreviewOrderSequence } from './paymentReceipt';
import type { CartLine } from './cartTypes';
import { fetchPublishedCatalogue, type CatalogueSnapshot } from '../catalogue/catalogueClient';

vi.mock('../../preview/uiPreviewMode', () => ({
  isUiPreviewMode: vi.fn(() => true),
}));

vi.mock('../catalogue/catalogueClient', async (importOriginal) => {
  const original = await importOriginal<typeof import('../catalogue/catalogueClient')>();
  return { ...original, fetchPublishedCatalogue: vi.fn() };
});

const sharedCatalogue: CatalogueSnapshot = {
  revision: 1,
  categories: [
    { id: 'coffee', slug: 'coffee', name: 'Coffee', imageUrl: null, sortOrder: 10, isActive: true, itemCount: 1 },
  ],
  items: [{
    id: 'latte', categoryId: 'coffee', categoryName: 'Coffee', slug: 'latte', sku: 'LATTE', kind: 'product',
    name: 'Latte', description: '', basePriceSen: 1050, isAvailable: true, isPublished: true,
    isFeatured: false, isBestSeller: false, isStudentEligible: false, imageUrl: null, volumeMl: null,
    prepRoute: 'bar', sortOrder: 10, compatibleAddOnIds: [], variants: [
      { id: 'medium', code: 'medium', label: 'Medium', priceDeltaSen: 0, isDefault: true, isAvailable: true, sortOrder: 10 },
    ],
  }],
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

const lines: CartLine[] = [
  {
    id: 'l1',
    menuItemId: 'latte',
    name: 'Latte',
    unitPriceSen: 1050,
    qty: 1,
    modifiers: [],
  },
];

describe('detached preview PaymentPanel', () => {
  beforeEach(() => {
    resetPreviewOrderSequence(10521);
  });

  it('shows insufficient cash validation and change due', async () => {
    const user = userEvent.setup();
    render(
      <PaymentPanel
        lines={lines}
        orderType="dine_in"
        member={null}
        employee={employee}
        location={location}
        shift={shift}
        discountSen={0}
        onPaid={() => {}}
        onCancel={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^exact$/i }));
    expect(screen.getByText(/change due: rm 0\.00/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/cash received/i));
    await user.type(screen.getByLabelText(/cash received/i), '5');
    expect(screen.getByText(/insufficient cash/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm payment/i })).toBeDisabled();
  });

  it('calls onPaid with receipt on cash confirm', async () => {
    const user = userEvent.setup();
    const onPaid = vi.fn();
    render(
      <PaymentPanel
        lines={lines}
        orderType="takeaway"
        member={null}
        employee={employee}
        location={location}
        shift={shift}
        discountSen={0}
        onPaid={onPaid}
        onCancel={() => {}}
      />,
    );

    await user.click(screen.getByRole('button', { name: /^exact$/i }));
    await user.click(screen.getByRole('button', { name: /confirm payment/i }));
    expect(onPaid).toHaveBeenCalledTimes(1);
    const receipt = onPaid.mock.calls[0]?.[0];
    expect(receipt?.totalSen).toBe(1050);
    expect(receipt?.changeSen).toBe(0);
  });
});

describe('CounterWorkspace authoritative payment boundary', () => {
  it('routes the active POS sale to server placement instead of the preview tender', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['pos-catalogue'], sharedCatalogue);
    vi.mocked(fetchPublishedCatalogue).mockResolvedValue(sharedCatalogue);

    render(
      <QueryClientProvider client={queryClient}>
        <CounterWorkspace
          employee={employee}
          location={location}
          shift={shift}
          onLock={() => {}}
          onCloseRequest={() => {}}
          onLogout={() => {}}
          connectionState="online"
          onConnectionStateChange={() => {}}
        />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole('button', { name: /latte/i }));
    await user.click(screen.getByRole('button', { name: /add to order/i }));
    expect(screen.getByRole('button', { name: /review & place/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^pay$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^exact$|confirm payment/i })).not.toBeInTheDocument();
  });
});
