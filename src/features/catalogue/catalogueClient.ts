import { employeeFetch } from '../../auth/employeeSession';

export type CatalogueVariant = {
  id: string;
  code: string;
  label: string;
  priceDeltaSen: number;
  isDefault: boolean;
  isAvailable: boolean;
  sortOrder: number;
};

export type CatalogueCategory = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  itemCount: number;
};

export type CatalogueItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  slug: string;
  sku: string;
  kind: 'product' | 'addon';
  name: string;
  description: string;
  basePriceSen: number;
  isAvailable: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isStudentEligible: boolean;
  imageUrl: string | null;
  volumeMl: number | null;
  prepRoute: 'bar' | 'kitchen';
  sortOrder: number;
  variants: CatalogueVariant[];
  compatibleAddOnIds: string[];
};

export type CatalogueSnapshot = {
  revision: number;
  categories: CatalogueCategory[];
  items: CatalogueItem[];
};

export type SaveCategoryPayload = {
  id?: string;
  name: string;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type SaveItemPayload = {
  id?: string;
  categoryId: string;
  name: string;
  sku?: string;
  kind: 'product' | 'addon';
  description: string;
  basePriceSen: number;
  isAvailable: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isStudentEligible: boolean;
  imageUrl?: string | null;
  volumeMl?: number | null;
  prepRoute: 'bar' | 'kitchen';
  sortOrder: number;
  variants: Array<{
    code?: string;
    label: string;
    priceDeltaSen: number;
    isDefault: boolean;
    isAvailable: boolean;
    sortOrder: number;
  }>;
  compatibleAddOnIds: string[];
};

async function parseSnapshot(response: Response): Promise<CatalogueSnapshot> {
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Administrator authorization is required to manage the menu.');
    }
    throw new Error(`Unable to load catalogue (${response.status}).`);
  }
  const raw = await response.json() as Partial<CatalogueSnapshot>;
  if (!Array.isArray(raw.categories) || !Array.isArray(raw.items)) {
    throw new Error('Catalogue response is invalid.');
  }
  return {
    revision: Number(raw.revision ?? 0),
    categories: raw.categories,
    items: raw.items,
  };
}

export async function fetchPublishedCatalogue(
  fetcher: typeof fetch = fetch,
): Promise<CatalogueSnapshot> {
  return parseSnapshot(await fetcher('/api/v1/catalogue', {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  }));
}

export async function fetchAdminCatalogue(): Promise<CatalogueSnapshot> {
  return parseSnapshot(await employeeFetch('/api/v1/admin/catalogue', {
    method: 'GET',
  }));
}

async function save(path: string, payload: object): Promise<string> {
  const response = await employeeFetch(path, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({})) as { id?: unknown; error?: unknown };
  if (!response.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Catalogue update failed.');
  }
  if (typeof body.id !== 'string') throw new Error('Catalogue update returned an invalid ID.');
  return body.id;
}

export function saveCatalogueCategory(payload: SaveCategoryPayload): Promise<string> {
  return save('/api/v1/admin/catalogue/category', payload);
}

export function saveCatalogueItem(payload: SaveItemPayload): Promise<string> {
  return save('/api/v1/admin/catalogue/item', payload);
}
