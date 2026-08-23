import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CartLine } from '../pos/cartTypes';
import {
  fetchOrderingPolicy,
  placeOrder,
  quoteOrder,
  type OrderSnapshot,
} from './orderClient';
import { OrderCheckoutPanel } from './OrderCheckoutPanel';

vi.mock('./orderClient', async (importOriginal) => {
  const original = await importOriginal<typeof import('./orderClient')>();
  return {
    ...original,
    fetchOrderingPolicy: vi.fn(),
    quoteOrder: vi.fn(),
    placeOrder: vi.fn(),
  };
});

const cart: CartLine[] = [{
  id: 'line-1', menuItemId: 'item-1', name: 'Latte', unitPriceSen: 1, qty: 1,
  modifiers: [{ groupId: 'variant', optionIds: ['variant-1'] }],
}];

const policy = {
  serverNow: '2026-08-14T00:00:00.000Z', timezone: 'Asia/Kuala_Lumpur', scheduleEnabled: true,
  minimumLeadMinutes: 15, preparationLeadMinutes: 15, slotIntervalMinutes: 15, maximumAdvanceDays: 7,
};

const order = {
  id: 'order-1', orderNumber: 100015, source: 'pos', customerUserId: null, memberId: null,
  fulfillmentType: 'asap', requestedPickupAt: null, prepareAt: null,
  serverNow: '2026-08-14T00:00:00Z', scheduleState: null, status: 'confirmed', statusVersion: 1,
  currency: 'MYR', pricingVersion: 2, subtotalSen: 1450, totalSen: 1450,
  createdAt: '2026-08-14T00:00:00Z', updatedAt: '2026-08-14T00:00:00Z',
  statusUpdatedAt: '2026-08-14T00:00:00Z', preparingAt: null, readyAt: null,
  completedAt: null, cancelledAt: null, lines: [],
} satisfies OrderSnapshot;

function renderPanel(onPlaced = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const placementAttempt = { current: null };
  render(
    <QueryClientProvider client={client}>
      <OrderCheckoutPanel lines={cart} placementAttempt={placementAttempt} onCancel={() => {}} onPlaced={onPlaced} />
    </QueryClientProvider>,
  );
  return onPlaced;
}

describe('authoritative POS checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOrderingPolicy).mockResolvedValue(policy);
    vi.mocked(quoteOrder).mockResolvedValue({
      pricingVersion: 2, currency: 'MYR', subtotalSen: 1450, totalSen: 1450,
      fulfillmentType: 'asap', requestedPickupAt: null, serverNow: policy.serverNow,
      schedulePolicy: { ...policy }, lines: [],
    });
  });

  it('uses Now as presentation copy while retaining the asap wire intent', async () => {
    renderPanel();
    expect(await screen.findByRole('button', { name: 'Now' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ASAP' })).not.toBeInTheDocument();
  });

  it('renders the server quote total and explicit unpaid pay-at-counter wording', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText(/loading server scheduling policy/i);
    await user.click(await screen.findByRole('button', { name: /review authoritative total/i }));
    expect(await screen.findByText('RM 14.50')).toBeInTheDocument();
    expect(screen.getByText(/authoritative server total/i)).toBeInTheDocument();
    expect(screen.getAllByText(/pay at counter/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/card|e-wallet|student wallet|total paid/i)).not.toBeInTheDocument();
  });

  it('retains the logical placement id across a failed retry and completes only on persistence', async () => {
    const user = userEvent.setup();
    const onPlaced = vi.fn();
    vi.mocked(placeOrder).mockRejectedValueOnce(new Error('network interrupted')).mockResolvedValueOnce(order);
    renderPanel(onPlaced);

    await user.click(await screen.findByRole('button', { name: /review authoritative total/i }));
    await screen.findByText('RM 14.50');
    const placeButton = screen.getByRole('button', { name: /place order/i });
    await user.click(placeButton);
    expect(await screen.findByRole('alert')).toHaveTextContent(/network interrupted/i);
    expect(onPlaced).not.toHaveBeenCalled();
    await user.click(placeButton);
    expect(onPlaced).toHaveBeenCalledWith(order);
    const firstId = vi.mocked(placeOrder).mock.calls[0]![0].clientRequestId;
    const retryId = vi.mocked(placeOrder).mock.calls[1]![0].clientRequestId;
    expect(retryId).toBe(firstId);
  });

  it('offers server-policy-derived scheduled pickup without inventing branch capacity', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: /schedule for later/i }));
    const select = await screen.findByLabelText(/pickup time/i);
    expect(select.querySelectorAll('option').length).toBeGreaterThan(2);
    expect(screen.getByText(/15-minute lead.*15-minute intervals.*7 days/i)).toBeInTheDocument();
    expect(screen.queryByText(/capacity|branch hours|delivery/i)).not.toBeInTheDocument();
  });
});
