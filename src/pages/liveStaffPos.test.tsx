import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
const { employeeFetch, loginWithPassword, employeeSession } = vi.hoisted(() => ({
  employeeFetch: vi.fn(),
  loginWithPassword: vi.fn(),
  employeeSession: {
    status: 'authenticated',
    identity: {
      id: 'staff-1', username: 'staff@example.test', role: 'staff', fullName: 'Nora Staff',
      isGlobalManager: false, dualRolePosEnabled: false, selectedProduct: 'pos', assignedBranchIds: [],
    },
  },
}));

vi.mock('../preview/uiPreviewMode', () => ({ isUiPreviewMode: () => false }));
vi.mock('../auth/employeeSession', () => ({
  employeeFetch,
  getEmployeeSession: () => employeeSession,
  subscribeEmployeeSession: () => () => undefined,
  logoutEmployee: vi.fn(),
  loginWithPassword,
  loginWithBadge: vi.fn(),
  refreshEmployeeSessionFromServer: vi.fn(async () => ({ status: 'anonymous', identity: null })),
}));
vi.mock('../features/pos/CounterWorkspace', () => ({
  CounterWorkspace: () => <div>Trusted live Sale and Orders workspace</div>,
}));

describe('live staff POS access', () => {
  it('routes a successful staff password login to POS', async () => {
    const { EmployeeWelcomePage } = await import('./EmployeeWelcomePage');
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/employee']}><Routes><Route path="/employee" element={<EmployeeWelcomePage />} /><Route path="/pos" element={<div>POS destination</div>} /></Routes></MemoryRouter>);
    await user.type(await screen.findByRole('textbox', { name: /username/i }), 'staff@example.test');
    await user.type(document.querySelector<HTMLInputElement>('#emp-password')!, 'approved-test-password');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByText('POS destination')).toBeInTheDocument();
  });

  it('renders live Sale and Orders without terminal or shift API prerequisites', async () => {
    const { PosShellPage } = await import('./PosShellPage');
    render(<PosShellPage />);
    expect(await screen.findByText(/trusted live sale and orders workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/live · single café/i)).toBeInTheDocument();
    expect(employeeFetch).not.toHaveBeenCalledWith(expect.stringMatching(/\/terminals\/|\/shifts\//), expect.anything());
  });
});
