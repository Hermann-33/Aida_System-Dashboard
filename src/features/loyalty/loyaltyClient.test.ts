import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLoyaltyAdminState, loadMemberLoyalty } from './loyaltyClient';

afterEach(() => vi.unstubAllGlobals());

function response(data: unknown) {
  return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const program = {
  pointsPerRinggit: 1, stampsPerQualifyingOrder: 1, stampGoal: 10,
  stampRewardId: 'reward-stamp', updatedAt: '2026-09-15T00:00:00Z',
};
const reward = {
  id: 'reward-1', code: 'POINTS_RM5', name: 'RM5 Voucher', rewardType: 'fixed_amount',
  pointsCost: 100, fixedAmountSen: 500, eligibleCategorySlugs: [], eligibleItemSkus: [],
  expiryDays: 30, isPointsRedeemable: true, isActive: true, updatedAt: '2026-09-15T00:00:00Z',
};
const wallet = {
  memberId: 'member-1', memberCode: 'AIDA-001', pointsBalance: 120, stampBalance: 4,
  lifetimePointsEarned: 220, lifetimeStampsEarned: 9,
  program: { pointsPerRinggit: 1, stampsPerQualifyingOrder: 1, stampGoal: 10 },
  rewards: [{ id: 'reward-1', code: 'POINTS_RM5', name: 'RM5 Voucher', rewardType: 'fixed_amount', pointsCost: 100, fixedAmountSen: 500, eligibleCategorySlugs: [], eligibleItemSkus: [], expiryDays: 30 }],
  vouchers: [{ id: 'voucher-1', code: 'AIDA-V-1', status: 'active', rewardCode: 'POINTS_RM5', rewardName: 'RM5 Voucher', rewardType: 'fixed_amount', fixedAmountSen: 500, eligibleCategorySlugs: [], eligibleItemSkus: [], pointsSpent: 100, issuedAt: '2026-09-15T00:00:00Z', expiresAt: '2026-10-15T00:00:00Z', usedAt: null }],
};

describe('loyalty client response validation', () => {
  it('accepts the canonical admin state and rejects malformed booleans', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ program, rewards: [reward] })));
    await expect(loadLoyaltyAdminState()).resolves.toMatchObject({ program: { stampGoal: 10 }, rewards: [{ code: 'POINTS_RM5' }] });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ program, rewards: [{ ...reward, isActive: 'false' }] })));
    await expect(loadLoyaltyAdminState()).rejects.toThrow(/active flag/i);
  });

  it('accepts a canonical wallet and rejects malformed balances or voucher expiry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(wallet)));
    await expect(loadMemberLoyalty('AIDA-001')).resolves.toMatchObject({ pointsBalance: 120, vouchers: [{ code: 'AIDA-V-1' }] });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ ...wallet, pointsBalance: -1 })));
    await expect(loadMemberLoyalty('AIDA-001')).rejects.toThrow(/points balance/i);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ ...wallet, vouchers: [{ ...wallet.vouchers[0], expiresAt: 'invalid' }] })));
    await expect(loadMemberLoyalty('AIDA-001')).rejects.toThrow(/expiresAt/i);
  });
});
