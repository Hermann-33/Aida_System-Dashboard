import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminAuditPage } from './AdminAuditPage';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import { loadAuditReport, loadPaymentAuditReport } from '../reporting/reportingClient';

vi.mock('../../preview/uiPreviewMode', () => ({ isUiPreviewMode: vi.fn() }));
vi.mock('../reporting/reportingClient', () => ({
  loadAuditReport: vi.fn(),
  loadPaymentAuditReport: vi.fn(),
}));

const generalReport = {
  coverage: { sourceBackedOnly: true, completeGeneralAuditLog: false, notes: ['General source facts.'] },
  filter: {}, totalCount: 1,
  items: [{
    eventKey: 'order-1', occurredAt: '2026-09-18T01:00:00Z', localDate: '2026-09-18',
    localTime: '09:00:00', timezone: 'Asia/Kuala_Lumpur', category: 'order',
    action: 'status_changed', actorUserId: 'admin-user', branchId: 'branch-1',
    salesPointId: null, entityType: 'order', entityId: 'order-1',
    entityLabel: 'Order 100001', details: {},
  }],
};

const paymentReport = {
  coverage: { sourceBackedOnly: true, rawProviderPayloadIncluded: false, notes: ['Payment source facts.'] },
  filter: {}, totalCount: 1,
  items: [{
    eventKey: 'refund-1', occurredAt: '2026-09-18T02:00:00Z', localDate: '2026-09-18',
    localTime: '10:00:00', timezone: 'Asia/Kuala_Lumpur', category: 'refund',
    action: 'succeeded', actorUserId: null, branchId: 'branch-1', salesPointId: null,
    entityType: 'payment_refund', entityId: 'refund-1', entityLabel: 'Order 100001 refund',
    details: { amountSen: 400 },
  }],
};

describe('AdminAuditPage Phase 9 payment audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isUiPreviewMode).mockReturnValue(false);
    vi.mocked(loadAuditReport).mockResolvedValue(generalReport);
    vi.mocked(loadPaymentAuditReport).mockResolvedValue(paymentReport);
  });

  it('loads general and payment audit as separate feeds', async () => {
    render(<AdminAuditPage />);
    expect(await screen.findByText('General source facts.')).toBeInTheDocument();
    expect(await screen.findByText('Payment source facts.')).toBeInTheDocument();
    expect(screen.getByText('Order 100001')).toBeInTheDocument();
    expect(screen.getByText('Order 100001 refund')).toBeInTheDocument();
    expect(screen.getByText(/Raw provider payloads.*not included/i)).toBeInTheDocument();
    expect(loadAuditReport).toHaveBeenCalledTimes(1);
    expect(loadPaymentAuditReport).toHaveBeenCalledTimes(1);
  });

  it('does not load either privileged audit feed in preview mode', async () => {
    vi.mocked(isUiPreviewMode).mockReturnValue(true);
    render(<AdminAuditPage />);
    expect(await screen.findByText('Preview shift')).toBeInTheDocument();
    expect(loadAuditReport).not.toHaveBeenCalled();
    expect(loadPaymentAuditReport).not.toHaveBeenCalled();
  });
});
