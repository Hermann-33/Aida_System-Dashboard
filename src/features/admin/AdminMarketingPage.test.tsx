import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminMarketingPage } from './AdminMarketingPage';
import { fetchAdminCatalogue } from '../catalogue/catalogueClient';
import { fetchOperationalLocations } from '../locations/operationalLocationClient';
import { loadPromotions, savePromotion } from '../promotions/promotionClient';
import { isUiPreviewMode } from '../../preview/uiPreviewMode';

vi.mock('../catalogue/catalogueClient', () => ({ fetchAdminCatalogue: vi.fn() }));
vi.mock('../locations/operationalLocationClient', () => ({ fetchOperationalLocations: vi.fn() }));
vi.mock('../promotions/promotionClient', async (importOriginal) => {
  const original = await importOriginal<typeof import('../promotions/promotionClient')>();
  return { ...original, loadPromotions: vi.fn(), savePromotion: vi.fn() };
});
vi.mock('../../preview/uiPreviewMode', () => ({ isUiPreviewMode: vi.fn() }));

const promotion = {
  id: 'promotion-1', code: 'CAMPUS10', name: 'Campus 10% off', description: null,
  discountType: 'percent' as const, fixedAmountSen: null, percentBasisPoints: 1000,
  minimumSubtotalSen: 1200, maximumDiscountSen: 500, startsAt: null, endsAt: null,
  priority: 20, stackingMode: 'exclusive' as const, allowWithVoucher: false,
  requiresMember: true, globalUsageLimit: null, perMemberUsageLimit: 1, isActive: true,
  branchIds: ['branch-main'], itemIds: ['item-latte'], variantIds: [], addonItemIds: [],
  createdAt: '2026-09-15T00:00:00Z', updatedAt: '2026-09-15T00:00:00Z',
};

const catalogue = {
  revision: 1,
  categories: [],
  items: [{
    id: 'item-latte', categoryId: 'coffee', categoryName: 'Coffee', slug: 'latte', sku: 'CF-LAT',
    kind: 'product' as const, name: 'Latte', description: '', basePriceSen: 1450,
    isAvailable: true, isPublished: true, isFeatured: false, isBestSeller: false,
    isStudentEligible: false, isDrink: true, imageUrl: null, volumeMl: null, prepRoute: 'bar' as const,
    sortOrder: 10, compatibleAddOnIds: [], variants: [], customizationGroups: [],
  }],
};

const branches = [{
  id: 'branch-main', code: 'BR-MAIN', name: 'Main Café', timezone: 'Asia/Kuala_Lumpur',
  addressText: null, phone: null, isActive: true, isDefault: true, salesPoints: [],
}];

describe('AdminMarketingPage Phase 7 campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isUiPreviewMode).mockReturnValue(false);
    vi.mocked(loadPromotions).mockResolvedValue([promotion]);
    vi.mocked(fetchOperationalLocations).mockResolvedValue(branches);
    vi.mocked(fetchAdminCatalogue).mockResolvedValue(catalogue);
    vi.mocked(savePromotion).mockResolvedValue({ ...promotion, isActive: false });
  });

  it('loads authoritative campaign state and persists an activation change through savePromotion', async () => {
    const user = userEvent.setup();
    render(<AdminMarketingPage />);

    expect(await screen.findByText('Campus 10% off')).toBeInTheDocument();
    expect(loadPromotions).toHaveBeenCalledTimes(1);
    expect(fetchOperationalLocations).toHaveBeenCalledTimes(1);
    expect(fetchAdminCatalogue).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Disable' }));
    expect(savePromotion).toHaveBeenCalledWith(expect.objectContaining({
      id: 'promotion-1',
      code: 'CAMPUS10',
      isActive: false,
      percentBasisPoints: 1000,
      branchIds: ['branch-main'],
      itemIds: ['item-latte'],
    }));
  });

  it('never loads privileged campaign authority in UI preview mode', async () => {
    vi.mocked(isUiPreviewMode).mockReturnValue(true);
    render(<AdminMarketingPage />);

    expect(await screen.findByText('Campus 10% off')).toBeInTheDocument();
    expect(screen.getByText(/sample campaigns.*no privileged backend requests/i)).toBeInTheDocument();
    expect(loadPromotions).not.toHaveBeenCalled();
    expect(fetchOperationalLocations).not.toHaveBeenCalled();
    expect(fetchAdminCatalogue).not.toHaveBeenCalled();
  });
});
