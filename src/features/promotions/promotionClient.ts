export type PromotionDiscountType = 'fixed' | 'percent';
export type PromotionStackingMode = 'exclusive' | 'stackable';

export type Promotion = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: PromotionDiscountType;
  fixedAmountSen: number | null;
  percentBasisPoints: number | null;
  minimumSubtotalSen: number;
  maximumDiscountSen: number | null;
  startsAt: string | null;
  endsAt: string | null;
  priority: number;
  stackingMode: PromotionStackingMode;
  allowWithVoucher: boolean;
  requiresMember: boolean;
  globalUsageLimit: number | null;
  perMemberUsageLimit: number | null;
  isActive: boolean;
  branchIds: string[];
  itemIds: string[];
  variantIds: string[];
  addonItemIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SavePromotionPayload = Omit<Promotion, 'createdAt' | 'updatedAt'> & { id?: string };

type JsonRecord = Record<string, unknown>;

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as JsonRecord;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Invalid ${label}`);
  return value;
}

function nullableText(value: unknown, label: string): string | null {
  if (value === null) return null;
  return text(value, label);
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`Invalid ${label}`);
  return value;
}

function nullableInteger(value: unknown, label: string, minimum = 0): number | null {
  if (value === null) return null;
  return integer(value, label, minimum);
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

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`Invalid ${label}`);
  }
  return [...value] as string[];
}

function discountType(value: unknown): PromotionDiscountType {
  if (value !== 'fixed' && value !== 'percent') throw new Error('Invalid promotion discount type');
  return value;
}

function stackingMode(value: unknown): PromotionStackingMode {
  if (value !== 'exclusive' && value !== 'stackable') throw new Error('Invalid promotion stacking mode');
  return value;
}

export function parsePromotion(value: unknown): Promotion {
  const row = record(value, 'promotion');
  const type = discountType(row.discountType);
  const fixedAmountSen = nullableInteger(row.fixedAmountSen, 'promotion fixed amount', 1);
  const percentBasisPoints = nullableInteger(row.percentBasisPoints, 'promotion percent basis points', 1);
  if ((type === 'fixed' && (fixedAmountSen === null || percentBasisPoints !== null))
    || (type === 'percent' && (fixedAmountSen !== null || percentBasisPoints === null || percentBasisPoints > 10_000))) {
    throw new Error('Invalid promotion discount shape');
  }
  const startsAt = nullableTimestamp(row.startsAt, 'promotion startsAt');
  const endsAt = nullableTimestamp(row.endsAt, 'promotion endsAt');
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new Error('Invalid promotion schedule');
  }
  return {
    id: text(row.id, 'promotion id'),
    code: text(row.code, 'promotion code'),
    name: text(row.name, 'promotion name'),
    description: row.description === null ? null : nullableText(row.description, 'promotion description'),
    discountType: type,
    fixedAmountSen,
    percentBasisPoints,
    minimumSubtotalSen: integer(row.minimumSubtotalSen, 'promotion minimum subtotal'),
    maximumDiscountSen: nullableInteger(row.maximumDiscountSen, 'promotion maximum discount', 1),
    startsAt,
    endsAt,
    priority: integer(row.priority, 'promotion priority'),
    stackingMode: stackingMode(row.stackingMode),
    allowWithVoucher: boolean(row.allowWithVoucher, 'promotion voucher compatibility'),
    requiresMember: boolean(row.requiresMember, 'promotion member requirement'),
    globalUsageLimit: nullableInteger(row.globalUsageLimit, 'promotion global usage limit', 1),
    perMemberUsageLimit: nullableInteger(row.perMemberUsageLimit, 'promotion member usage limit', 1),
    isActive: boolean(row.isActive, 'promotion active flag'),
    branchIds: strings(row.branchIds, 'promotion branch scope'),
    itemIds: strings(row.itemIds, 'promotion item scope'),
    variantIds: strings(row.variantIds, 'promotion variant scope'),
    addonItemIds: strings(row.addonItemIds, 'promotion add-on scope'),
    createdAt: timestamp(row.createdAt, 'promotion createdAt'),
    updatedAt: timestamp(row.updatedAt, 'promotion updatedAt'),
  };
}

async function parseBody<T>(response: Response, parser: (value: unknown) => T): Promise<T> {
  const body = await response.json().catch(() => ({})) as { data?: unknown; error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  if (body.data === undefined) throw new Error('Backend response is missing data');
  return parser(body.data);
}

function parsePromotionList(value: unknown): Promotion[] {
  if (!Array.isArray(value)) throw new Error('Invalid promotion list');
  return value.map(parsePromotion);
}

export async function loadPromotions(): Promise<Promotion[]> {
  return parseBody(
    await fetch('/api/v1/admin/promotions', { credentials: 'include', cache: 'no-store' }),
    parsePromotionList,
  );
}

export async function savePromotion(payload: SavePromotionPayload): Promise<Promotion> {
  return parseBody(
    await fetch('/api/v1/admin/promotions/save', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    parsePromotion,
  );
}
