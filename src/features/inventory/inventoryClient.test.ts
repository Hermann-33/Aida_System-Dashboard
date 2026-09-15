import { describe, expect, it } from 'vitest';
import { parseInventoryState } from './inventoryClient';

const valid = {
  branchId: 'branch-main',
  items: [{ id: 'inv-1', sku: 'BEAN', name: 'Beans', baseUnit: 'g', isActive: true, onHandMilli: 5000 }],
  recipes: [{ id: 'recipe-1', itemId: 'item-1', variantId: null, name: 'Latte', isActive: true, components: [{ inventoryItemId: 'inv-1', quantityMilli: 180 }] }],
};

describe('inventory response parser', () => {
  it('accepts non-negative stock and positive recipe quantities', () => {
    expect(parseInventoryState(valid)).toEqual(valid);
  });

  it('rejects impossible stock, recipe quantities and non-boolean activity flags', () => {
    expect(() => parseInventoryState({ ...valid, items: [{ ...valid.items[0], onHandMilli: -1 }] })).toThrow(/onHandMilli/i);
    expect(() => parseInventoryState({ ...valid, recipes: [{ ...valid.recipes[0], components: [{ inventoryItemId: 'inv-1', quantityMilli: 0 }] }] })).toThrow(/quantityMilli/i);
    expect(() => parseInventoryState({ ...valid, items: [{ ...valid.items[0], isActive: 'false' }] })).toThrow(/isActive/i);
  });
});
