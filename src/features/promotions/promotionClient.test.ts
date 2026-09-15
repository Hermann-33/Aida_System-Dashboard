import { describe, expect, it } from 'vitest';
import { parsePromotion } from './promotionClient';

function promotion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promotion-1',
    code: 'P7_TEST',
    name: 'Phase 7 Test',
    description: null,
    discountType: 'fixed',
    fixedAmountSen: 100,
    percentBasisPoints: null,
    minimumSubtotalSen: 0,
    maximumDiscountSen: null,
    startsAt: null,
    endsAt: null,
    priority: 10,
    stackingMode: 'exclusive',
    allowWithVoucher: false,
    requiresMember: false,
    globalUsageLimit: null,
    perMemberUsageLimit: null,
    isActive: true,
    branchIds: [],
    itemIds: [],
    variantIds: [],
    addonItemIds: [],
    createdAt: '2026-09-15T08:00:00Z',
    updatedAt: '2026-09-15T08:00:00Z',
    ...overrides,
  };
}

describe('promotion client contract', () => {
  it('accepts a canonical fixed promotion', () => {
    expect(parsePromotion(promotion())).toMatchObject({ code: 'P7_TEST', fixedAmountSen: 100, percentBasisPoints: null });
  });

  it('accepts a canonical percentage promotion', () => {
    expect(parsePromotion(promotion({ discountType: 'percent', fixedAmountSen: null, percentBasisPoints: 1250 })))
      .toMatchObject({ discountType: 'percent', percentBasisPoints: 1250 });
  });

  it('rejects mixed fixed and percentage commercial authority', () => {
    expect(() => parsePromotion(promotion({ percentBasisPoints: 1000 }))).toThrow('Invalid promotion discount shape');
  });

  it('rejects percentage values over 100 percent', () => {
    expect(() => parsePromotion(promotion({ discountType: 'percent', fixedAmountSen: null, percentBasisPoints: 10_001 })))
      .toThrow('Invalid promotion discount shape');
  });

  it('rejects malformed scope collections', () => {
    expect(() => parsePromotion(promotion({ itemIds: ['item-1', 42] }))).toThrow('Invalid promotion item scope');
  });

  it('rejects inverted campaign windows', () => {
    expect(() => parsePromotion(promotion({ startsAt: '2026-09-16T08:00:00Z', endsAt: '2026-09-15T08:00:00Z' })))
      .toThrow('Invalid promotion schedule');
  });
});
