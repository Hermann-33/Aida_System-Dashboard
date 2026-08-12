import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getEmployeeSession,
  loginWithPassword,
  logoutEmployee,
  refreshEmployeeSessionFromServer,
} from '../auth/employeeSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmployeeAuthShell } from './employee/EmployeeAuthShell';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void refreshEmployeeSessionFromServer().then((session) => {
      if (session.status === 'authenticated' && session.identity?.role === 'admin') {
        navigate('/admin', { replace: true });
      }
    });
  }, [navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await loginWithPassword(email.trim(), password);
      setPassword('');
      const identity = getEmployeeSession().identity;
      if (identity?.role !== 'admin') {
        await logoutEmployee();
        setError('Administrator access is required.');
        return;
      }
      navigate('/admin', { replace: true });
    } catch {
      setError('Invalid administrator credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <EmployeeAuthShell
      titleId="admin-login-title"
      kicker="Administration"
      title="Admin sign in"
      lede="Management access uses the trusted AIDA employee session. POS terminal enrolment is not required."
    >
      <form onSubmit={onSubmit} aria-label="Administrator login" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="admin-email">Email</Label>
          <Input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="admin-password">Password</Label>
          <Input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </EmployeeAuthShell>
  );
}
