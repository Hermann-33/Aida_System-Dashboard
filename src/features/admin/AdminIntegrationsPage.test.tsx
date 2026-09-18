import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminIntegrationsPage } from './AdminIntegrationsPage';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import { loadAdminPaymentProviders } from '../payments/paymentClient';

vi.mock('../../preview/uiPreviewMode', () => ({ isUiPreviewMode: vi.fn() }));
vi.mock('../payments/paymentClient', async (importOriginal) => {
  const original = await importOriginal<typeof import('../payments/paymentClient')>();
  return { ...original, loadAdminPaymentProviders: vi.fn() };
});

describe('AdminIntegrationsPage Phase 9 provider status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isUiPreviewMode).mockReturnValue(false);
  });

  it('shows unconfigured truth when no provider exists', async () => {
    vi.mocked(loadAdminPaymentProviders).mockResolvedValue([]);
    render(<AdminIntegrationsPage />);
    expect(await screen.findByText('Unconfigured')).toBeInTheDocument();
    expect(screen.getByText(/external payment initiation remains unavailable/i)).toBeInTheDocument();
  });

  it('shows non-secret configured provider capabilities', async () => {
    vi.mocked(loadAdminPaymentProviders).mockResolvedValue([{
      providerKey: 'provider_a', displayName: 'Provider A', environment: 'test',
      isActive: true, customerEnabled: true, posEnabled: false, supportsRefunds: true,
      createdAt: '2026-09-18T00:00:00Z', updatedAt: '2026-09-18T00:00:00Z',
    }]);
    render(<AdminIntegrationsPage />);
    expect(await screen.findByText('Provider A')).toBeInTheDocument();
    expect(screen.getByText('Declared supported')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activate/i })).not.toBeInTheDocument();
  });

  it('does not load privileged provider state in preview mode', async () => {
    vi.mocked(isUiPreviewMode).mockReturnValue(true);
    render(<AdminIntegrationsPage />);
    expect(await screen.findByText('Sample Payment Provider')).toBeInTheDocument();
    expect(loadAdminPaymentProviders).not.toHaveBeenCalled();
  });
});
