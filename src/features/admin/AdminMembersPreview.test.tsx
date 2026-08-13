import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminMembersLoyaltyReportPage } from './AdminMembersLoyaltyReportPage';
import { fetchAdminMembers } from './memberDirectory';

vi.mock('../../preview/uiPreviewMode', () => ({
  isUiPreviewMode: () => true,
}));

vi.mock('./memberDirectory', async (importOriginal) => {
  const original = await importOriginal<typeof import('./memberDirectory')>();
  return { ...original, fetchAdminMembers: vi.fn() };
});

describe('Admin Members UI preview boundary', () => {
  it('stays mounted, shows the live-Admin requirement, and makes no privileged request', () => {
    render(
      <MemoryRouter>
        <AdminMembersLoyaltyReportPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /members & loyalty/i })).toBeInTheDocument();
    expect(screen.getByText(/live member data requires a real aida admin session/i)).toBeInTheDocument();
    expect(fetchAdminMembers).not.toHaveBeenCalled();
    expect(screen.queryByText(/no members have signed up/i)).not.toBeInTheDocument();
  });
});
