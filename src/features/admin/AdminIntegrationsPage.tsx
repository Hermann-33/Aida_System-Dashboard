import { useEffect, useState } from 'react';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';
import {
  loadAdminPaymentProviders,
  type PaymentProviderAdminState,
} from '../payments/paymentClient';
import { AdminPageShell } from './AdminPageShell';
import './admin.css';

const PREVIEW_PROVIDER: PaymentProviderAdminState = {
  providerKey: 'preview_provider',
  displayName: 'Sample Payment Provider',
  environment: 'test',
  isActive: false,
  customerEnabled: false,
  posEnabled: false,
  supportsRefunds: true,
  createdAt: '2026-09-18T00:00:00Z',
  updatedAt: '2026-09-18T00:00:00Z',
};

function providerStatus(provider: PaymentProviderAdminState): string {
  if (!provider.isActive) return 'Inactive';
  if (provider.customerEnabled || provider.posEnabled) return 'Active';
  return 'Configured only';
}

export function AdminIntegrationsPage() {
  const preview = isUiPreviewMode();
  const [providers, setProviders] = useState<PaymentProviderAdminState[]>(preview ? [PREVIEW_PROVIDER] : []);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preview) return;
    let active = true;
    setLoading(true);
    setError(null);
    loadAdminPaymentProviders()
      .then((data) => { if (active) setProviders(data); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Payment provider status failed');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [preview]);

  const activeProvider = providers.find((provider) => provider.isActive && (provider.customerEnabled || provider.posEnabled));

  return (
    <AdminPageShell
      pageId="admin-integrations"
      title="Integrations"
      hint={preview
        ? 'UI preview sample integration state — no privileged backend request is made.'
        : 'Read-only integration status. Credentials and provider activation remain server-side owner approval boundaries.'}
    >
      <section className="admin-section" aria-labelledby="payment-provider-heading">
        <h2 id="payment-provider-heading" className="admin-section-title">Payment provider</h2>
        {loading && <p className="form-hint">Loading non-secret provider status…</p>}
        {error && <div className="form-error" role="alert">{error}</div>}
        {!loading && !error && providers.length === 0 && (
          <article className="integration-card">
            <header>
              <h3 className="admin-section-title">External payments</h3>
              <span className="status-pill status-pill--warn">Unconfigured</span>
            </header>
            <p>No payment provider is configured. Customer/POS external payment initiation remains unavailable.</p>
            <p className="form-hint">Provider selection, merchant onboarding, credentials and any cost-bearing activation require explicit owner approval.</p>
            <button type="button" className="btn-secondary" disabled>Configure (owner approval required)</button>
          </article>
        )}
        {!loading && !error && providers.map((provider) => (
          <article className="integration-card" key={provider.providerKey}>
            <header>
              <h3 className="admin-section-title">{provider.displayName}</h3>
              <span className={`status-pill ${provider.isActive ? 'status-pill--ok' : 'status-pill--warn'}`}>
                {providerStatus(provider)}
              </span>
            </header>
            <dl className="admin-dl">
              <dt>Provider key</dt><dd>{provider.providerKey}</dd>
              <dt>Environment</dt><dd>{provider.environment}</dd>
              <dt>Customer channel</dt><dd>{provider.customerEnabled ? 'Enabled' : 'Disabled'}</dd>
              <dt>POS channel</dt><dd>{provider.posEnabled ? 'Enabled' : 'Disabled'}</dd>
              <dt>Refund capability</dt><dd>{provider.supportsRefunds ? 'Declared supported' : 'Not supported'}</dd>
            </dl>
            <p className="form-hint">This view contains non-secret capability metadata only. Provider credentials are never exposed here.</p>
          </article>
        ))}
        {!preview && activeProvider && (
          <p className="form-hint" role="status">
            External payment availability is source-backed by {activeProvider.displayName}; capture, settlement and refunds still advance only from trusted server/provider evidence.
          </p>
        )}
      </section>

      <article className="integration-card">
        <header>
          <h2 className="admin-section-title">MyInvois e-Invoice</h2>
          <span className="status-pill status-pill--warn">Pending</span>
        </header>
        <p>MyInvois pending business and API decision</p>
        <p className="form-hint">
          LHDN MyInvois requires business registration details and API credentials. No production connection is claimed by Phase 9.
        </p>
        <button type="button" className="btn-secondary" disabled>Configure (blocked)</button>
      </article>
    </AdminPageShell>
  );
}
