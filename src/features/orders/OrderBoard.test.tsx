import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  OrderClientError,
  fetchOrderDetail,
  fetchOrders,
  transitionOrderStatus,
  type OrderSnapshot,
} from './orderClient';
import { OrderBoard } from './OrderBoard';

vi.mock('./orderClient', async (importOriginal) => {
  const original = await importOriginal<typeof import('./orderClient')>();
  return {
    ...original,
    fetchOrders: vi.fn(),
    fetchOrderDetail: vi.fn(),
    transitionOrderStatus: vi.fn(),
  };
});

function fixture(status: OrderSnapshot['status'] = 'confirmed'): OrderSnapshot {
  return {
    id: `order-${status}`, orderNumber: 100021, source: 'customer', customerUserId: 'customer-1', memberId: 'member-1',
    fulfillmentType: 'asap', requestedPickupAt: null, prepareAt: null,
    serverNow: '2026-08-14T00:30:00Z', scheduleState: null, status, statusVersion: 4, currency: 'MYR', pricingVersion: 1,
    subtotalSen: 1450, totalSen: 1450, createdAt: '2026-08-14T00:00:00Z', updatedAt: '2026-08-14T00:00:00Z',
    statusUpdatedAt: '2026-08-14T00:00:00Z', preparingAt: null, readyAt: null, completedAt: null, cancelledAt: null,
    lines: [{
      id: 'line-1', lineNumber: 1, itemId: 'item-1', sku: 'CF-LAT', name: 'Latte', prepRoute: 'bar',
      basePriceSen: 1300, variant: null, addOns: [], addOnTotalSen: 0, unitPriceSen: 1450,
      quantity: 1, lineTotalSen: 1450, note: null,
    }],
  };
}

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><OrderBoard /></QueryClientProvider>);
  return client;
}

describe('live staff order board', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOrders).mockResolvedValue([fixture()]);
    vi.mocked(fetchOrderDetail).mockImplementation(async () => fixture());
    vi.mocked(transitionOrderStatus).mockResolvedValue({ ...fixture('preparing'), statusVersion: 5 });
  });

  it('loads the persisted queue, polls through the order client, and never presents preview fallback authority', async () => {
    renderBoard();
    expect(await screen.findByText('#100021')).toBeInTheDocument();
    expect(fetchOrders).toHaveBeenCalledWith(['scheduled', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']);
    expect(screen.getByText(/refreshes every 2.5 seconds/i)).toBeInTheDocument();
    expect(screen.queryByText(/preview history|void preview|refund preview/i)).not.toBeInTheDocument();
  });

  it('presents an overdue scheduled order as urgent Active work while keeping its persisted Scheduled status', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([{
      ...fixture('scheduled'), fulfillmentType: 'scheduled', requestedPickupAt: '2026-08-14T00:00:00Z',
      prepareAt: '2026-08-13T23:45:00Z', scheduleState: 'overdue',
    }]);
    renderBoard();
    expect(await screen.findByText('Overdue')).toBeInTheDocument();
    expect(screen.getAllByText('Scheduled').some((element) => element.classList.contains('status-pill'))).toBe(true);
    expect(screen.getByRole('button', { name: /start preparing/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /active/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('submits only a legal transition with the current expected status version', async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(await screen.findByRole('button', { name: /start preparing/i }));
    expect(transitionOrderStatus).toHaveBeenCalledWith({
      orderId: 'order-confirmed',
      toStatus: 'preparing',
      expectedVersion: 4,
    });
    expect(screen.queryByRole('button', { name: /mark ready|complete fulfilment/i })).not.toBeInTheDocument();
  });

  it('refetches and reports a concise stale-version conflict', async () => {
    const user = userEvent.setup();
    vi.mocked(transitionOrderStatus).mockRejectedValueOnce(
      new OrderClientError('stale version', 409, 'ORDER_VERSION_CONFLICT'),
    );
    renderBoard();
    await user.click(await screen.findByRole('button', { name: /start preparing/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/changed elsewhere.*reloaded/i);
    expect(fetchOrders).toHaveBeenCalledTimes(2);
  });

  it('shows no mutation controls for terminal states', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchOrders).mockResolvedValue([fixture('completed')]);
    vi.mocked(fetchOrderDetail).mockResolvedValue(fixture('completed'));
    renderBoard();
    await user.click(await screen.findByRole('tab', { name: /history/i }));
    await user.click(await screen.findByRole('button', { name: /detail/i }));
    expect(await screen.findByText(/terminal order state/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start preparing|mark ready|complete fulfilment|cancel order/i })).not.toBeInTheDocument();
  });

  it('fails closed when the live queue is unavailable', async () => {
    vi.mocked(fetchOrders).mockRejectedValueOnce(new Error('queue offline'));
    renderBoard();
    expect(await screen.findByRole('alert')).toHaveTextContent(/queue offline/i);
    expect(screen.getByText(/no preview orders are used as a fallback/i)).toBeInTheDocument();
  });
});
