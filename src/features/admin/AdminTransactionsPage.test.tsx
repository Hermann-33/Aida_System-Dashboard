import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminTransactionsPage } from './AdminTransactionsPage';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import { loadTransactionReport } from '../reporting/reportingClient';
import { loadAdminPaymentState, requestAdminRefund } from '../payments/paymentClient';

vi.mock('../../preview/uiPreviewMode', () => ({ isUiPreviewMode: vi.fn() }));
vi.mock('../reporting/reportingClient', () => ({ loadTransactionReport: vi.fn() }));
vi.mock('../payments/paymentClient', async (importOriginal) => {
  const original = await importOriginal<typeof import('../payments/paymentClient')>();
  return {
    ...original,
    loadAdminPaymentState: vi.fn(),
    requestAdminRefund: vi.fn(),
  };
});

const transactionReport = {
  semantics: {
    totalSen: 'accepted order value',
    refundDataAvailable: true,
    processorSettlementIncluded: false,
    providerLifecycleAvailable: true,
    acceptedOrderValueUnchangedByRefunds: true,
    providerSettlementStateAvailable: true,
  },
  filter: {},
  totalCount: 1,
  items: [{
    orderId: 'order-1',
    orderNumber: 100001,
    createdAt: '2026-09-18T01:00:00Z',
    localDate: '2026-09-18',
    localTime: '09:00',
    branch: { id: 'branch-1', code: 'BR-1', name: 'Main', timezone: 'Asia/Kuala_Lumpur' },
    salesPoint: { id: 'sp-1', code: 'SP-1', name: 'Counter' },
    terminalCode: 'POS-1',
    source: 'pos',
    status: 'completed',
    fulfillmentType: 'asap',
    requestedPickupAt: null,
    subtotalSen: 1000,
    voucherDiscountSen: 0,
    promotionDiscountSen: 0,
    discountSen: 0,
    totalSen: 1000,
    currency: 'MYR',
    refundedSen: 0,
    refundableSen: 1000,
    refundReservedSen: 0,
    refundReconciled: true,
    latestPaymentIntent: null,
    refunds: [],
    discountReconciled: true,
    tenderType: 'cash',
    paymentState: 'paid',
    paidAt: '2026-09-18T01:00:00Z',
    shiftId: 'shift-1',
    createdByUserId: 'admin-user',
    memberAttached: false,
    voucher: null,
    promotions: [],
    lines: [],
  }],
};

const paidCash = {
  tenderType: 'cash' as const,
  paymentState: 'paid' as const,
  paidAt: '2026-09-18T01:00:00Z',
  refundedSen: 0,
  refundableSen: 1000,
  providerAvailable: false,
  latestIntent: null,
  refunds: [],
};

describe('AdminTransactionsPage Phase 9 refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isUiPreviewMode).mockReturnValue(false);
    vi.mocked(loadTransactionReport).mockResolvedValue(transactionReport);
    vi.mocked(loadAdminPaymentState).mockResolvedValue(paidCash);
    vi.mocked(requestAdminRefund).mockResolvedValue({
      ...paidCash,
      paymentState: 'partially_refunded',
      refundedSen: 250,
      refundableSen: 750,
      refunds: [{
        id: 'refund-1',
        tenderType: 'cash',
        state: 'succeeded',
        amountSen: 250,
        reason: 'Duplicate item',
        createdAt: '2026-09-18T02:00:00Z',
        succeededAt: '2026-09-18T02:00:00Z',
      }],
    });
  });

  it('loads protected payment state and submits a cash refund intent', async () => {
    const user = userEvent.setup();
    render(<AdminTransactionsPage />);

    await screen.findByText('#100001');
    await user.click(screen.getByRole('button', { name: 'Detail' }));
    expect(await screen.findByText('Payment & refund authority')).toBeInTheDocument();
    expect(loadAdminPaymentState).toHaveBeenCalledWith('order-1', 1000, 'MYR');

    await user.type(screen.getByLabelText('Refund amount (RM)'), '2.50');
    await user.type(screen.getByLabelText('Refund reason'), 'Duplicate item');
    await user.click(screen.getByRole('button', { name: /Refund up to/i }));

    expect(requestAdminRefund).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 'order-1',
      tenderType: 'cash',
      amountSen: 250,
      reason: 'Duplicate item',
      idempotencyKey: expect.any(String),
    }), 1000, 'MYR');
    expect(await screen.findByText(/trusted shift cash-out was recorded/i)).toBeInTheDocument();
  });

  it('keeps privileged payment authority isolated from UI preview', async () => {
    vi.mocked(isUiPreviewMode).mockReturnValue(true);
    render(<AdminTransactionsPage />);
    expect(await screen.findByText(/UI preview sample transactions/i)).toBeInTheDocument();
    expect(loadTransactionReport).not.toHaveBeenCalled();
    expect(loadAdminPaymentState).not.toHaveBeenCalled();
    expect(requestAdminRefund).not.toHaveBeenCalled();
  });
});
