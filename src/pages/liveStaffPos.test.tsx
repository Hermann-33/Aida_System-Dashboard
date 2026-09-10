import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const {
  employeeFetch,
  loginWithPassword,
  employeeSession,
  fetchTerminalStatus,
  enrolTerminal,
} = vi.hoisted(() => ({
  employeeFetch: vi.fn(),
  loginWithPassword: vi.fn(),
  fetchTerminalStatus: vi.fn(),
  enrolTerminal: vi.fn(),
  employeeSession: {
    status: 'authenticated',
    identity: {
      id: 'staff-1',
      username: 'staff@example.test',
      role: 'staff',
      fullName: 'Nora Staff',
      isGlobalManager: false,
      dualRolePosEnabled: false,
      selectedProduct: 'pos',
      assignedBranchIds: ['branch-main'],
    },
  },
}));

const terminalLocation = {
  terminalId: 'terminal-main',
  terminalCode: 'POS-MAIN-01',
  branchId: 'branch-main',
  branchCode: 'BR-MAIN',
  branchName: 'Main Café',
  salesPointId: 'sales-main',
  salesPointCode: 'SP-MAIN',
  salesPointName: 'Main Counter',
};

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
vi.mock('../auth/terminalCredential', () => ({
  fetchTerminalStatus,
  enrolTerminal,
  clearTerminalEnrolment: vi.fn(),
}));
vi.mock('../features/pos/CounterWorkspace', () => ({
  CounterWorkspace: () => <div>Trusted live Sale and Orders workspace</div>,
}));

describe('live staff POS access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchTerminalStatus.mockResolvedValue({
      enrolled: true,
      location: terminalLocation,
    });
  });

  it('routes a successful staff password login to POS only after terminal status is validated', async () => {
    const { EmployeeWelcomePage } = await import('./EmployeeWelcomePage');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/employee']}>
        <Routes>
          <Route path="/employee" element={<EmployeeWelcomePage />} />
          <Route path="/pos" element={<div>POS destination</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(await screen.findByRole('textbox', { name: /username/i }), 'staff@example.test');
    await user.type(document.querySelector<HTMLInputElement>('#emp-password')!, 'approved-test-password');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(fetchTerminalStatus).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('POS destination')).toBeInTheDocument();
  });

  it('stops POS navigation and requests manager-issued activation when terminal is unenrolled', async () => {
    fetchTerminalStatus.mockResolvedValueOnce({
      enrolled: false,
      code: 'TERMINAL_UNENROLLED',
    });
    const { EmployeeWelcomePage } = await import('./EmployeeWelcomePage');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/employee']}>
        <Routes>
          <Route path="/employee" element={<EmployeeWelcomePage />} />
          <Route path="/pos" element={<div>POS destination</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(await screen.findByRole('textbox', { name: /username/i }), 'staff@example.test');
    await user.type(document.querySelector<HTMLInputElement>('#emp-password')!, 'approved-test-password');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByRole('heading', { name: /activate this terminal/i })).toBeInTheDocument();
    expect(screen.queryByText('POS destination')).not.toBeInTheDocument();
    expect(screen.getByText(/one-time code issued by a manager/i)).toBeInTheDocument();
  });

  it('renders live POS only with trusted terminal context and does not invent a shift', async () => {
    const { PosShellPage } = await import('./PosShellPage');
    render(<PosShellPage />);

    expect(await screen.findByText(/trusted live sale and orders workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/live · single café/i)).toBeInTheDocument();
    expect(fetchTerminalStatus).toHaveBeenCalledTimes(1);

    const details = screen.getByRole('button', { name: /details/i });
    await userEvent.click(details);
    expect(screen.getByText(/Main Café/)).toBeInTheDocument();
    expect(screen.getByText(/Main Counter/)).toBeInTheDocument();
    expect(screen.getByText(/POS-MAIN-01/)).toBeInTheDocument();
    expect(screen.getByText(/authority begins in Phase 2/i)).toBeInTheDocument();
  });
});
