import { useEffect, useState } from 'react';
import {
  fetchOperationalLocations,
  type OperationalBranch,
} from '../locations/operationalLocationClient';
import { AdminPageShell } from './AdminPageShell';
import { BranchPickupConfigurationPanel } from './BranchPickupConfigurationPanel';
import './admin.css';

export function AdminPickupSchedulingPage() {
  const [branches, setBranches] = useState<OperationalBranch[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetchOperationalLocations()
      .then((rows) => {
        if (active) setBranches(rows);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load branches');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminPageShell
      pageId="admin-pickup-scheduling"
      title="Pickup scheduling"
      hint="Server-authoritative branch hours, scheduled pickup policy, dated closures and slot capacity."
    >
      {error && <p className="form-hint" role="alert">{error}</p>}
      {branches.map((branch) => (
        <article key={branch.id} className="branch-card">
          <header>
            <h2 className="admin-section-title">
              {branch.name} <span className="branch-code">{branch.code}</span>
            </h2>
            <span className={`status-pill status-pill--${branch.isActive ? 'ok' : 'info'}`}>
              {branch.isActive ? 'active' : 'inactive'}
            </span>
          </header>
          <p>
            {branch.timezone}
            {branch.isDefault ? ' · default branch' : ''}
          </p>
          <div className="admin-row-actions">
            <BranchPickupConfigurationPanel branchId={branch.id} />
          </div>
        </article>
      ))}
      {!error && branches.length === 0 && (
        <p className="empty-state">No operational branches are available.</p>
      )}
    </AdminPageShell>
  );
}
