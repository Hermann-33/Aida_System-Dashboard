import type {
  CatalogueCategory,
  CatalogueItem,
  CatalogueSnapshot,
} from '../catalogue/catalogueClient';
import type { ModifierGroup } from './ModifierSheet';

export const ALL_POS_CATEGORIES = 'all';

export function posCatalogueCategories(snapshot: CatalogueSnapshot): CatalogueCategory[] {
  const productCategoryIds = new Set(
    snapshot.items.filter((item) => item.kind === 'product').map((item) => item.categoryId),
  );
  return snapshot.categories.filter(
    (category) => category.isActive && productCategoryIds.has(category.id),
  );
}

export function posCatalogueItems(snapshot: CatalogueSnapshot): CatalogueItem[] {
  return snapshot.items.filter((item) => item.kind === 'product' && item.isPublished);
}

export function posModifierGroups(
  item: CatalogueItem,
  snapshot: CatalogueSnapshot,
): ModifierGroup[] {
  const groups: ModifierGroup[] = [];
  if (item.variants.length > 0) {
    groups.push({
      id: 'variant',
      name: 'Variant',
      required: true,
      min: 1,
      max: 1,
      help: 'Choose one available variant',
      options: item.variants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        priceDeltaSen: variant.priceDeltaSen,
        available: variant.isAvailable,
        isDefault: variant.isDefault,
      })),
    });
  }

  for (const group of item.customizationGroups ?? []) {
    groups.push({
      id: `option:${group.id}`,
      name: group.name,
      required: true,
      min: 1,
      max: 1,
      help: `Choose one ${group.name.toLowerCase()} option`,
      options: group.options.map((option) => ({
        id: option.id,
        label: option.label,
        priceDeltaSen: option.priceDeltaSen,
        available: option.isAvailable,
        isDefault: option.isDefault,
      })),
    });
  }

  const compatibleIds = new Set(item.compatibleAddOnIds);
  const addOns = snapshot.items.filter(
    (candidate) => candidate.kind === 'addon'
      && candidate.isPublished
      && compatibleIds.has(candidate.id),
  );
  if (addOns.length > 0) {
    groups.push({
      id: 'addons',
      name: 'Add-ons',
      required: false,
      min: 0,
      max: addOns.length,
      help: 'Optional compatible add-ons for this line',
      options: addOns.map((addOn) => ({
        id: addOn.id,
        label: addOn.name,
        priceDeltaSen: addOn.basePriceSen,
        available: addOn.isAvailable,
      })),
    });
  }
  return groups;
}

export function compactCatalogueLabel(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((word) => word[0]).join('').slice(0, 4).toUpperCase();
  return name.trim().slice(0, 4).toUpperCase();
}
