export type PosVoucher = {
  id: string;
  code: string;
  rewardCode: string;
  rewardName: string;
  rewardType: 'fixed_amount' | 'free_item';
  fixedAmountSen: number | null;
  eligibleCategorySlugs: string[];
  eligibleItemSkus: string[];
  expiresAt: string;
};

export type PosMemberLoyalty = {
  memberCode: string;
  pointsBalance: number;
  stampBalance: number;
  program: {
    pointsPerRinggit: number;
    stampsPerQualifyingOrder: number;
    stampGoal: number;
  };
  vouchers: PosVoucher[];
  shiftId: string;
};

export async function fetchPosMemberLoyalty(memberCode: string): Promise<PosMemberLoyalty> {
  const params = new URLSearchParams({ memberCode: memberCode.trim() });
  const response = await fetch(`/api/v1/pos/member-loyalty?${params}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({})) as { data?: PosMemberLoyalty; error?: string };
  if (!response.ok || !body.data) throw new Error(body.error || `Member lookup failed (${response.status})`);
  return body.data;
}
