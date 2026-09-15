import { describe, expect, it } from 'vitest';
import { parsePosMemberLoyalty } from './posLoyaltyClient';

const valid = {
  memberCode: 'AIDA-001', pointsBalance: 120, stampBalance: 4,
  program: { pointsPerRinggit: 1, stampsPerQualifyingOrder: 1, stampGoal: 10 },
  vouchers: [{
    id: 'voucher-1', code: 'AIDA-V-1', rewardCode: 'POINTS_RM5', rewardName: 'RM5 Voucher',
    rewardType: 'fixed_amount', fixedAmountSen: 500, eligibleCategorySlugs: [], eligibleItemSkus: [],
    expiresAt: '2026-10-15T00:00:00Z',
  }],
  shiftId: 'shift-1',
};

describe('POS loyalty response parser', () => {
  it('accepts the canonical shift-bound shape', () => {
    expect(parsePosMemberLoyalty(valid)).toMatchObject({ memberCode: 'AIDA-001', shiftId: 'shift-1' });
  });

  it('rejects malformed balances, reward shape and expiry', () => {
    expect(() => parsePosMemberLoyalty({ ...valid, stampBalance: -1 })).toThrow(/stamp balance/i);
    expect(() => parsePosMemberLoyalty({ ...valid, vouchers: [{ ...valid.vouchers[0], fixedAmountSen: null }] })).toThrow(/fixed amount/i);
    expect(() => parsePosMemberLoyalty({ ...valid, vouchers: [{ ...valid.vouchers[0], expiresAt: 'not-a-date' }] })).toThrow(/expiresAt/i);
  });
});
