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

export type LoyaltyWalletProgram = Omit<LoyaltyProgram, 'stampRewardId' | 'updatedAt'>;
export type LoyaltyWalletReward = Omit<LoyaltyReward, 'isPointsRedeemable' | 'isActive' | 'updatedAt'>;
export type LoyaltyWalletVoucher = {
  id: string;
  code: string;
  status: 'active' | 'used' | 'expired';
  rewardCode: string;
  rewardName: string;
  rewardType: 'fixed_amount' | 'free_item';
  fixedAmountSen: number | null;
  eligibleCategorySlugs: string[];
  eligibleItemSkus: string[];
  pointsSpent: number;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
};

export type LoyaltyAdminState = { program: LoyaltyProgram; rewards: LoyaltyReward[] };
export type MemberLoyaltyWallet = {
  memberId: string;
  memberCode: string;
  pointsBalance: number;
  stampBalance: number;
  lifetimePointsEarned: number;
  lifetimeStampsEarned: number;
  program: LoyaltyWalletProgram;
  vouchers: LoyaltyWalletVoucher[];
  rewards: LoyaltyWalletReward[];
  issuedVoucherId?: string;
};

type JsonRecord = Record<string, unknown>;

type Parser<T> = (value: unknown) => T;

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as JsonRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Invalid ${label}`);
  return value;
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`Invalid ${label}`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${label}`);
  return value;
}

function timestamp(value: unknown, label: string): string {
  const parsed = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}`);
  return value as string;
}

function nullableTimestamp(value: unknown, label: string): string | null {
  if (value === null) return null;
  return timestamp(value, label);
}

function nullableInteger(value: unknown, label: string, minimum = 0): number | null {
  if (value === null) return null;
  return integer(value, label, minimum);
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) throw new Error(`Invalid ${label}`);
  return [...value] as string[];
}

function rewardType(value: unknown, label: string): 'fixed_amount' | 'free_item' {
  if (value !== 'fixed_amount' && value !== 'free_item') throw new Error(`Invalid ${label}`);
  return value;
}

function parseProgram(value: unknown): LoyaltyProgram {
  const row = record(value, 'loyalty program');
  return {
    pointsPerRinggit: integer(row.pointsPerRinggit, 'loyalty points rate', 1),
    stampsPerQualifyingOrder: integer(row.stampsPerQualifyingOrder, 'loyalty stamp rate', 1),
    stampGoal: integer(row.stampGoal, 'loyalty stamp goal', 1),
    stampRewardId: text(row.stampRewardId, 'loyalty stamp reward id'),
    updatedAt: timestamp(row.updatedAt, 'loyalty program updatedAt'),
  };
}

function parseWalletProgram(value: unknown): LoyaltyWalletProgram {
  const row = record(value, 'wallet program');
  return {
    pointsPerRinggit: integer(row.pointsPerRinggit, 'wallet points rate', 1),
    stampsPerQualifyingOrder: integer(row.stampsPerQualifyingOrder, 'wallet stamp rate', 1),
    stampGoal: integer(row.stampGoal, 'wallet stamp goal', 1),
  };
}

function parseReward(value: unknown): LoyaltyReward {
  const row = record(value, 'loyalty reward');
  const type = rewardType(row.rewardType, 'reward type');
  const fixedAmountSen = nullableInteger(row.fixedAmountSen, 'reward fixed amount', 1);
  if ((type === 'fixed_amount' && fixedAmountSen === null) || (type === 'free_item' && fixedAmountSen !== null)) {
    throw new Error('Invalid reward fixed amount');
  }
  return {
    id: text(row.id, 'reward id'),
    code: text(row.code, 'reward code'),
    name: text(row.name, 'reward name'),
    rewardType: type,
    pointsCost: integer(row.pointsCost, 'reward points cost'),
    fixedAmountSen,
    eligibleCategorySlugs: strings(row.eligibleCategorySlugs, 'reward category eligibility'),
    eligibleItemSkus: strings(row.eligibleItemSkus, 'reward item eligibility'),
    expiryDays: integer(row.expiryDays, 'reward expiry days', 1),
    isPointsRedeemable: boolean(row.isPointsRedeemable, 'reward points redeemable flag'),
    isActive: boolean(row.isActive, 'reward active flag'),
    updatedAt: timestamp(row.updatedAt, 'reward updatedAt'),
  };
}

function parseWalletReward(value: unknown): LoyaltyWalletReward {
  const row = record(value, 'wallet reward');
  const type = rewardType(row.rewardType, 'wallet reward type');
  const fixedAmountSen = nullableInteger(row.fixedAmountSen, 'wallet reward fixed amount', 1);
  if ((type === 'fixed_amount' && fixedAmountSen === null) || (type === 'free_item' && fixedAmountSen !== null)) {
    throw new Error('Invalid wallet reward fixed amount');
  }
  return {
    id: text(row.id, 'wallet reward id'),
    code: text(row.code, 'wallet reward code'),
    name: text(row.name, 'wallet reward name'),
    rewardType: type,
    pointsCost: integer(row.pointsCost, 'wallet reward points cost'),
    fixedAmountSen,
    eligibleCategorySlugs: strings(row.eligibleCategorySlugs, 'wallet reward category eligibility'),
    eligibleItemSkus: strings(row.eligibleItemSkus, 'wallet reward item eligibility'),
    expiryDays: integer(row.expiryDays, 'wallet reward expiry days', 1),
  };
}

function parseVoucher(value: unknown): LoyaltyWalletVoucher {
  const row = record(value, 'wallet voucher');
  const type = rewardType(row.rewardType, 'voucher reward type');
  const fixedAmountSen = nullableInteger(row.fixedAmountSen, 'voucher fixed amount', 1);
  if ((type === 'fixed_amount' && fixedAmountSen === null) || (type === 'free_item' && fixedAmountSen !== null)) {
    throw new Error('Invalid voucher fixed amount');
  }
  if (row.status !== 'active' && row.status !== 'used' && row.status !== 'expired') throw new Error('Invalid voucher status');
  return {
    id: text(row.id, 'voucher id'),
    code: text(row.code, 'voucher code'),
    status: row.status,
    rewardCode: text(row.rewardCode, 'voucher reward code'),
    rewardName: text(row.rewardName, 'voucher reward name'),
    rewardType: type,
    fixedAmountSen,
    eligibleCategorySlugs: strings(row.eligibleCategorySlugs, 'voucher category eligibility'),
    eligibleItemSkus: strings(row.eligibleItemSkus, 'voucher item eligibility'),
    pointsSpent: integer(row.pointsSpent, 'voucher points spent'),
    issuedAt: timestamp(row.issuedAt, 'voucher issuedAt'),
    expiresAt: timestamp(row.expiresAt, 'voucher expiresAt'),
    usedAt: nullableTimestamp(row.usedAt, 'voucher usedAt'),
  };
}

function parseAdminState(value: unknown): LoyaltyAdminState {
  const row = record(value, 'loyalty admin state');
  if (!Array.isArray(row.rewards)) throw new Error('Invalid loyalty rewards');
  return { program: parseProgram(row.program), rewards: row.rewards.map(parseReward) };
}

function parseWallet(value: unknown): MemberLoyaltyWallet {
  const row = record(value, 'member loyalty wallet');
  if (!Array.isArray(row.rewards) || !Array.isArray(row.vouchers)) throw new Error('Invalid wallet collections');
  const issuedVoucherId = row.issuedVoucherId === undefined ? undefined : text(row.issuedVoucherId, 'issued voucher id');
  return {
    memberId: text(row.memberId, 'wallet member id'),
    memberCode: text(row.memberCode, 'wallet member code'),
    pointsBalance: integer(row.pointsBalance, 'points balance'),
    stampBalance: integer(row.stampBalance, 'stamp balance'),
    lifetimePointsEarned: integer(row.lifetimePointsEarned, 'lifetime points earned'),
    lifetimeStampsEarned: integer(row.lifetimeStampsEarned, 'lifetime stamps earned'),
    program: parseWalletProgram(row.program),
    rewards: row.rewards.map(parseWalletReward),
    vouchers: row.vouchers.map(parseVoucher),
    ...(issuedVoucherId ? { issuedVoucherId } : {}),
  };
}

async function parse<T>(response: Response, parser: Parser<T>): Promise<T> {
  const body = await response.json().catch(() => ({})) as { data?: unknown; error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  if (body.data === undefined) throw new Error('Backend response is missing data');
  return parser(body.data);
}

export async function loadLoyaltyAdminState(): Promise<LoyaltyAdminState> {
  return parse(await fetch('/api/v1/admin/loyalty', { credentials: 'include', cache: 'no-store' }), parseAdminState);
}

async function post<T>(path: string, payload: unknown, parser: Parser<T>): Promise<T> {
  return parse(await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }), parser);
}

export function saveLoyaltyProgram(payload: Pick<LoyaltyProgram, 'pointsPerRinggit' | 'stampGoal' | 'stampRewardId'>) {
  return post('/api/v1/admin/loyalty/program', payload, parseProgram);
}

export function saveLoyaltyReward(payload: Omit<LoyaltyReward, 'updatedAt'>) {
  return post('/api/v1/admin/loyalty/reward', payload, parseReward);
}

export async function loadMemberLoyalty(memberCode: string): Promise<MemberLoyaltyWallet> {
  const params = new URLSearchParams({ memberCode });
  return parse(await fetch(`/api/v1/admin/loyalty/member?${params}`, { credentials: 'include', cache: 'no-store' }), parseWallet);
}

export function adjustMemberLoyalty(payload: { memberCode: string; pointsDelta: number; stampsDelta: number; reason: string }) {
  return post('/api/v1/admin/loyalty/adjust', payload, parseWallet);
}
