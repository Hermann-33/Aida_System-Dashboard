import { describe, expect, it, vi } from 'vitest';
import { fetchPublishedCatalogue } from './catalogueClient';

const baseSnapshot = {
  revision: 7,
  categories: [],
  items: [{
    id: 'latte', categoryId: 'coffee', categoryName: 'Coffee', slug: 'latte', sku: 'LATTE', kind: 'product',
    name: 'Latte', description: '', basePriceSen: 1_050, isAvailable: true, isPublished: true,
    isFeatured: false, isBestSeller: false, isStudentEligible: false, imageUrl: null, volumeMl: null,
    prepRoute: 'bar', sortOrder: 10, compatibleAddOnIds: [], variants: [],
  }],
};

describe('catalogue client customization parsing', () => {
  it('parses drink customization groups and their authoritative option fields', async () => {
    const body = {
      ...baseSnapshot,
      items: [{
        ...baseSnapshot.items[0],
        isDrink: true,
        customizationGroups: [{
          id: 'temperature', code: 'temperature', name: 'Temperature', sortOrder: 10,
          options: [{
            id: 'iced', code: 'iced', label: 'Iced', priceDeltaSen: 50,
            isDefault: true, isAvailable: true, sortOrder: 20,
          }],
        }],
      }],
    };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));

    const snapshot = await fetchPublishedCatalogue(fetcher);

    expect(snapshot.items[0]).toMatchObject({
      isDrink: true,
      customizationGroups: [{
        id: 'temperature',
        options: [{ id: 'iced', label: 'Iced', priceDeltaSen: 50, isDefault: true, isAvailable: true }],
      }],
    });
  });

  it('uses safe legacy defaults when drink fields are omitted', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(baseSnapshot)));

    const snapshot = await fetchPublishedCatalogue(fetcher);

    expect(snapshot.items[0]).toMatchObject({ isDrink: false, customizationGroups: [] });
  });

  it('rejects a present malformed customization group instead of inventing usable options', async () => {
    const body = {
      ...baseSnapshot,
      items: [{ ...baseSnapshot.items[0], isDrink: true, customizationGroups: 'temperature' }],
    };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));

    await expect(fetchPublishedCatalogue(fetcher)).rejects.toThrow('Catalogue customization groups are invalid.');
  });
});
