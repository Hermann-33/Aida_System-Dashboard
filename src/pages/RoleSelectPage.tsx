import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getEmployeeSession, selectProduct } from '../auth/employeeSession';
import { Button } from '@/components/ui/button';
import { EmployeeAuthShell } from './employee/EmployeeAuthShell';

export function RoleSelectPage() {
  const navigate = useNavigate();
  const identity = getEmployeeSession().identity;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!identity) return <Navigate to="/employee" replace />;
  if (identity.role !== 'admin' || !identity.dualRolePosEnabled) {
    return <Navigate to={identity.role === 'admin' ? '/admin' : '/pos'} replace />;
  }
  if (identity.selectedProduct) {
    return <Navigate to={identity.selectedProduct === 'pos' ? '/pos' : '/admin'} replace />;
  }

  async function choose(product: 'pos' | 'admin') {
    setBusy(true);
    setError('');
    try {
      await selectProduct(product);
      navigate(product === 'pos' ? '/pos' : '/admin', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Selection failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <EmployeeAuthShell
      titleId="role-select-title"
      kicker="Dual-role access"
      title="Choose workspace"
      lede="Select POS or Admin. This choice is recorded in the audit log."
    >
      <div className="grid gap-4">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void choose('pos')}
          className="h-16 text-base font-bold"
        >
          Staff POS
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void choose('admin')}
          className="h-16 text-base font-bold"
        >
          Admin Dashboard
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </EmployeeAuthShell>
  );
}
