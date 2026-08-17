import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminLoginPage } from './AdminLoginPage';

const liveAdminSession = vi.hoisted(() => ({
  status: 'authenticated' as const,
  identity: {
    id: 'admin-1',
    username: 'admin@example.com',
    role: 'admin' as const,
    fullName: 'Live Admin',
    isGlobalManager: true,
    dualRolePosEnabled: false,
    selectedProduct: 'admin' as const,
    assignedBranchIds: [],
  },
  idleLocked: false,
  lastErrorCode: null,
}));

vi.mock('../auth/employeeSession', () => ({
  getEmployeeSession: () => liveAdminSession,
  subscribeEmployeeSession: () => () => undefined,
  loginWithPassword: vi.fn(),
  logoutEmployee: vi.fn(),
}));

describe('Admin login destination handoff', () => {
  it('returns an authenticated live Admin to the originally requested route', async () => {
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/admin/login',
        state: { from: '/admin/reports/members', reason: 'ADMIN_SIGN_IN_REQUIRED' },
      }]}>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/reports/members" element={<h1>Member destination</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Member destination' })).toBeInTheDocument();
  });
});
