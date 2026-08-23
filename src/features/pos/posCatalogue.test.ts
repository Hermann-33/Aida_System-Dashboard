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
      isFeatured: false, isBestSeller: true, isStudentEligible: false, isDrink: true, imageUrl: null, volumeMl: 350,
      prepRoute: 'bar', sortOrder: 10, compatibleAddOnIds: ['oat'],
      variants: [
        { id: 'small', code: 'small', label: 'Small', priceDeltaSen: -50, isDefault: false, isAvailable: true, sortOrder: 10 },
        { id: 'large', code: 'large', label: 'Large', priceDeltaSen: 150, isDefault: true, isAvailable: true, sortOrder: 20 },
      ],
      customizationGroups: [
        {
          id: 'temperature', code: 'temperature', name: 'Temperature', sortOrder: 10,
          options: [
            { id: 'hot', code: 'hot', label: 'Hot', priceDeltaSen: 0, isDefault: false, isAvailable: false, sortOrder: 10 },
            { id: 'iced', code: 'iced', label: 'Iced', priceDeltaSen: 0, isDefault: true, isAvailable: true, sortOrder: 20 },
          ],
        },
        {
          id: 'sweetness', code: 'sweetness', name: 'Sweetness', sortOrder: 20,
          options: [
            { id: 'regular', code: 'regular', label: 'Regular', priceDeltaSen: 0, isDefault: true, isAvailable: true, sortOrder: 10 },
            { id: 'less', code: 'less-sweet', label: 'Less sweet', priceDeltaSen: 0, isDefault: false, isAvailable: true, sortOrder: 20 },
          ],
        },
      ],
    },
    {
      id: 'oat', categoryId: 'coffee', categoryName: 'Coffee', slug: 'oat', sku: 'OAT', kind: 'addon',
      name: 'Oat milk', description: '', basePriceSen: 150, isAvailable: false, isPublished: true,
      isFeatured: false, isBestSeller: false, isStudentEligible: false, isDrink: false, imageUrl: null, volumeMl: null,
      prepRoute: 'bar', sortOrder: 20, compatibleAddOnIds: [], variants: [], customizationGroups: [],
    },
    {
      id: 'draft', categoryId: 'hidden', categoryName: 'Hidden', slug: 'draft', sku: 'DRAFT', kind: 'product',
      name: 'Draft', description: '', basePriceSen: 100, isAvailable: true, isPublished: false,
      isFeatured: false, isBestSeller: false, isStudentEligible: false, isDrink: false, imageUrl: null, volumeMl: null,
      prepRoute: 'kitchen', sortOrder: 10, compatibleAddOnIds: [], variants: [], customizationGroups: [],
    },
  ],
};

describe('POS shared catalogue adapter', () => {
  it('uses active shared categories and published product items only', () => {
    expect(posCatalogueCategories(snapshot).map((category) => category.id)).toEqual(['coffee']);
    expect(posCatalogueItems(snapshot).map((item) => item.id)).toEqual(['latte']);
  });

  it('maps variants, required drink groups and compatible add-ons from shared data', () => {
    const groups = posModifierGroups(snapshot.items[0]!, snapshot);
    const variant = groups.find((group) => group.id === 'variant');
    const temperature = groups.find((group) => group.name === 'Temperature');
    const sweetness = groups.find((group) => group.name === 'Sweetness');
    const addOns = groups.find((group) => group.id === 'addons');

    expect(variant?.options).toEqual([
      expect.objectContaining({ id: 'small', priceDeltaSen: -50 }),
      expect.objectContaining({ id: 'large', priceDeltaSen: 150, isDefault: true }),
    ]);
    expect(temperature).toMatchObject({ required: true, min: 1, max: 1 });
    expect(temperature?.options.find((option) => option.id === 'hot')?.available).toBe(false);
    expect(temperature?.options.find((option) => option.id === 'iced')?.isDefault).toBe(true);
    expect(sweetness).toMatchObject({ required: true, min: 1, max: 1 });
    expect(addOns).toMatchObject({ required: false, min: 0, max: 1 });
    expect(addOns?.options).toEqual([
      expect.objectContaining({ id: 'oat', priceDeltaSen: 150, available: false }),
    ]);
  });

  it('derives compact presentation labels from shared names', () => {
    expect(compactCatalogueLabel('Cafe Latte')).toBe('CL');
    expect(compactCatalogueLabel('Mocha')).toBe('MOCH');
  });
});
