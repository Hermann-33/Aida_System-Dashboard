import { describe, expect, it } from 'vitest';
import type { CatalogueSnapshot } from '../catalogue/catalogueClient';
import {
  compactCatalogueLabel,
  posCatalogueCategories,
  posCatalogueItems,
  posModifierGroups,
} from './posCatalogue';

const snapshot: CatalogueSnapshot = {
  revision: 4,
  categories: [
    { id: 'coffee', slug: 'coffee', name: 'Coffee', imageUrl: null, sortOrder: 10, isActive: true, itemCount: 2 },
    { id: 'hidden', slug: 'hidden', name: 'Hidden', imageUrl: null, sortOrder: 20, isActive: false, itemCount: 1 },
  ],
  items: [
    {
      id: 'latte', categoryId: 'coffee', categoryName: 'Coffee', slug: 'latte', sku: 'LATTE', kind: 'product',
      name: 'Cafe Latte', description: '', basePriceSen: 1050, isAvailable: true, isPublished: true,
      isFeatured: false, isBestSeller: true, isStudentEligible: false, imageUrl: null, volumeMl: 350,
      prepRoute: 'bar', sortOrder: 10, compatibleAddOnIds: ['oat'],
      variants: [
        { id: 'small', code: 'small', label: 'Small', priceDeltaSen: -50, isDefault: false, isAvailable: true, sortOrder: 10 },
        { id: 'large', code: 'large', label: 'Large', priceDeltaSen: 150, isDefault: true, isAvailable: true, sortOrder: 20 },
      ],
    },
    {
      id: 'oat', categoryId: 'coffee', categoryName: 'Coffee', slug: 'oat', sku: 'OAT', kind: 'addon',
      name: 'Oat milk', description: '', basePriceSen: 150, isAvailable: false, isPublished: true,
      isFeatured: false, isBestSeller: false, isStudentEligible: false, imageUrl: null, volumeMl: null,
      prepRoute: 'bar', sortOrder: 20, compatibleAddOnIds: [], variants: [],
    },
    {
      id: 'draft', categoryId: 'hidden', categoryName: 'Hidden', slug: 'draft', sku: 'DRAFT', kind: 'product',
      name: 'Draft', description: '', basePriceSen: 100, isAvailable: true, isPublished: false,
      isFeatured: false, isBestSeller: false, isStudentEligible: false, imageUrl: null, volumeMl: null,
      prepRoute: 'kitchen', sortOrder: 10, compatibleAddOnIds: [], variants: [],
    },
  ],
};

describe('POS shared catalogue adapter', () => {
  it('uses active shared categories and published product items only', () => {
    expect(posCatalogueCategories(snapshot).map((category) => category.id)).toEqual(['coffee']);
    expect(posCatalogueItems(snapshot).map((item) => item.id)).toEqual(['latte']);
  });

  it('maps per-item variants and compatible add-ons without copied prices', () => {
    const groups = posModifierGroups(snapshot.items[0]!, snapshot);
    expect(groups[0]?.options).toEqual([
      expect.objectContaining({ id: 'small', priceDeltaSen: -50 }),
      expect.objectContaining({ id: 'large', priceDeltaSen: 150, isDefault: true }),
    ]);
    expect(groups[1]?.options).toEqual([
      expect.objectContaining({ id: 'oat', priceDeltaSen: 150, available: false }),
    ]);
  });

  it('derives compact presentation labels from shared names', () => {
    expect(compactCatalogueLabel('Cafe Latte')).toBe('CL');
    expect(compactCatalogueLabel('Mocha')).toBe('MOCH');
  });
});
