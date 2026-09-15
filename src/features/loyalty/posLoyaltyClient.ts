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

type JsonRecord = Record<string, unknown>;

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

function nullableInteger(value: unknown, label: string, minimum = 0): number | null {
  if (value === null) return null;
  return integer(value, label, minimum);
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) throw new Error(`Invalid ${label}`);
  return [...value] as string[];
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ${label}`);
  return value;
}

function parseVoucher(value: unknown): PosVoucher {
  const row = record(value, 'POS voucher');
  if (row.rewardType !== 'fixed_amount' && row.rewardType !== 'free_item') throw new Error('Invalid POS voucher reward type');
  const fixedAmountSen = nullableInteger(row.fixedAmountSen, 'POS voucher fixed amount', 1);
  if ((row.rewardType === 'fixed_amount' && fixedAmountSen === null)
    || (row.rewardType === 'free_item' && fixedAmountSen !== null)) {
    throw new Error('Invalid POS voucher fixed amount');
  }
  return {
    id: text(row.id, 'POS voucher id'),
    code: text(row.code, 'POS voucher code'),
    rewardCode: text(row.rewardCode, 'POS voucher reward code'),
    rewardName: text(row.rewardName, 'POS voucher reward name'),
    rewardType: row.rewardType,
    fixedAmountSen,
    eligibleCategorySlugs: strings(row.eligibleCategorySlugs, 'POS voucher category eligibility'),
    eligibleItemSkus: strings(row.eligibleItemSkus, 'POS voucher item eligibility'),
    expiresAt: timestamp(row.expiresAt, 'POS voucher expiresAt'),
  };
}

export function parsePosMemberLoyalty(value: unknown): PosMemberLoyalty {
  const row = record(value, 'POS member loyalty');
  const program = record(row.program, 'POS loyalty program');
  if (!Array.isArray(row.vouchers)) throw new Error('Invalid POS voucher list');
  return {
    memberCode: text(row.memberCode, 'member code'),
    pointsBalance: integer(row.pointsBalance, 'points balance'),
    stampBalance: integer(row.stampBalance, 'stamp balance'),
    program: {
      pointsPerRinggit: integer(program.pointsPerRinggit, 'points rate', 1),
      stampsPerQualifyingOrder: integer(program.stampsPerQualifyingOrder, 'stamp rate', 1),
      stampGoal: integer(program.stampGoal, 'stamp goal', 1),
    },
    vouchers: row.vouchers.map(parseVoucher),
    shiftId: text(row.shiftId, 'shift id'),
  };
}

export async function fetchPosMemberLoyalty(memberCode: string): Promise<PosMemberLoyalty> {
  const params = new URLSearchParams({ memberCode: memberCode.trim() });
  const response = await fetch(`/api/v1/pos/member-loyalty?${params}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({})) as { data?: unknown; error?: string };
  if (!response.ok) throw new Error(body.error || `Member lookup failed (${response.status})`);
  if (body.data === undefined) throw new Error('Member lookup response is missing data');
  return parsePosMemberLoyalty(body.data);
}
