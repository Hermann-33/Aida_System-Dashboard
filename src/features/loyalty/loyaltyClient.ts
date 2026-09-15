export type LoyaltyProgram = {
  pointsPerRinggit: number;
  stampsPerQualifyingOrder: number;
  stampGoal: number;
  stampRewardId: string;
  updatedAt: string;
};

export type LoyaltyReward = {
  id: string;
  code: string;
  name: string;
  rewardType: 'fixed_amount' | 'free_item';
  pointsCost: number;
  fixedAmountSen: number | null;
  eligibleCategorySlugs: string[];
  eligibleItemSkus: string[];
  expiryDays: number;
  isPointsRedeemable: boolean;
  isActive: boolean;
  updatedAt: string;
};

export type LoyaltyAdminState = { program: LoyaltyProgram; rewards: LoyaltyReward[] };
export type MemberLoyaltyWallet = {
  memberId?: string;
  memberCode?: string;
  pointsBalance: number;
  stampBalance: number;
  lifetimePointsEarned?: number;
  lifetimeStampsEarned?: number;
  stampGoal?: number;
  vouchers?: Array<Record<string, unknown>>;
  rewards?: Array<Record<string, unknown>>;
};

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as { data?: T; error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  if (body.data === undefined) throw new Error('Backend response is missing data');
  return body.data;
}

export async function loadLoyaltyAdminState(): Promise<LoyaltyAdminState> {
  return parse<LoyaltyAdminState>(await fetch('/api/v1/admin/loyalty', { credentials: 'include', cache: 'no-store' }));
}

async function post<T>(path: string, payload: unknown): Promise<T> {
  return parse<T>(await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

export function saveLoyaltyProgram(payload: Pick<LoyaltyProgram, 'pointsPerRinggit' | 'stampGoal' | 'stampRewardId'>) {
  return post<LoyaltyProgram>('/api/v1/admin/loyalty/program', payload);
}

export function saveLoyaltyReward(payload: Omit<LoyaltyReward, 'updatedAt'>) {
  return post<LoyaltyReward>('/api/v1/admin/loyalty/reward', payload);
}

export async function loadMemberLoyalty(memberCode: string): Promise<MemberLoyaltyWallet> {
  const params = new URLSearchParams({ memberCode });
  return parse<MemberLoyaltyWallet>(await fetch(`/api/v1/admin/loyalty/member?${params}`, { credentials: 'include', cache: 'no-store' }));
}

export function adjustMemberLoyalty(payload: { memberCode: string; pointsDelta: number; stampsDelta: number; reason: string }) {
  return post<MemberLoyaltyWallet>('/api/v1/admin/loyalty/adjust', payload);
}
