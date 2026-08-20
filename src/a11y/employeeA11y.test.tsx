import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmployeeWelcomePage } from '../pages/EmployeeWelcomePage';
import { IdleLockModal } from '../components/IdleLockModal';

describe('Accessibility smoke (Phase 2B Closure)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/auth/employee/session')) {
          return new Response(JSON.stringify({ code: 'EMPLOYEE_SESSION_REQUIRED' }), { status: 401 });
        }
        if (url.includes('/terminals/status')) {
          return new Response(
            JSON.stringify({ data: { enrolled: false, code: 'TERMINAL_UNENROLLED' } }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('live employee access has a labelled sign-in form without terminal enrolment', async () => {
    render(
      <MemoryRouter>
        <EmployeeWelcomePage />
      </MemoryRouter>,
    );
    const heading = await screen.findByRole('heading', { name: /sign in/i });
    expect(heading).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/enrolment code/i)).not.toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /^sign in$/i });
    expect(btn).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/terminals/'), expect.anything());
  });

  it('idle-lock modal has dialog, aria-modal, and PIN label', () => {
    render(
      <MemoryRouter>
        <IdleLockModal />
      </MemoryRouter>,
    );
    const dialog = screen.getByRole('dialog', { name: /session locked/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText(/^pin$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument();
  });
});
