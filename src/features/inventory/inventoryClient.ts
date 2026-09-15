import { employeeFetch } from '../../auth/employeeSession';

type JsonRecord = Record<string, unknown>;

export type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  baseUnit: 'g' | 'ml' | 'unit';
  isActive: boolean;
  onHandMilli: number;
};

export type RecipeComponent = { inventoryItemId: string; quantityMilli: number };
export type Recipe = {
  id: string;
  itemId: string;
  variantId: string | null;
  name: string;
  isActive: boolean;
  components: RecipeComponent[];
};
export type InventoryState = { branchId: string; items: InventoryItem[]; recipes: Recipe[] };

function record(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as JsonRecord;
}
function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`Invalid ${label}`);
  return value;
}
function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(`Invalid ${label}`);
  return value;
}
function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}
function parseState(value: unknown): InventoryState {
  const root = record(value, 'inventory state');
  if (!Array.isArray(root.items) || !Array.isArray(root.recipes)) throw new Error('Invalid inventory arrays');
  return {
    branchId: string(root.branchId, 'branchId'),
    items: root.items.map((value) => {
      const row = record(value, 'inventory item');
      const unit = string(row.baseUnit, 'baseUnit');
      if (unit !== 'g' && unit !== 'ml' && unit !== 'unit') throw new Error('Invalid baseUnit');
      return { id: string(row.id,'item.id'), sku: string(row.sku,'item.sku'), name: string(row.name,'item.name'), baseUnit: unit, isActive: Boolean(row.isActive), onHandMilli: integer(row.onHandMilli,'item.onHandMilli') };
    }),
    recipes: root.recipes.map((value) => {
      const row = record(value, 'recipe');
      if (!Array.isArray(row.components)) throw new Error('Invalid recipe components');
      return {
        id: string(row.id,'recipe.id'), itemId: string(row.itemId,'recipe.itemId'), variantId: nullableString(row.variantId), name: string(row.name,'recipe.name'), isActive: Boolean(row.isActive),
        components: row.components.map((component) => { const c=record(component,'recipe component'); return { inventoryItemId:string(c.inventoryItemId,'component.inventoryItemId'), quantityMilli:integer(c.quantityMilli,'component.quantityMilli') }; }),
      };
    }),
  };
}
async function body(response: Response): Promise<JsonRecord> {
  const parsed = await response.json().catch(() => null);
  const row = record(parsed, 'backend response');
  if (!response.ok) throw new Error(typeof row.error === 'string' ? row.error : 'Inventory request failed');
  return row;
}
export async function fetchInventoryState(branchId: string): Promise<InventoryState> {
  const response = await employeeFetch(`/api/v1/admin/inventory?branchId=${encodeURIComponent(branchId)}`);
  return parseState((await body(response)).data);
}
export async function saveInventoryItem(payload: { id?: string; sku: string; name: string; baseUnit: InventoryItem['baseUnit']; isActive: boolean }): Promise<void> {
  const response = await employeeFetch('/api/v1/admin/inventory/item', { method:'POST', body:JSON.stringify(payload) });
  await body(response);
}
export async function recordInventoryMovement(payload: { branchId:string; inventoryItemId:string; deltaMilli:number; movementKind:'receiving'|'waste'|'adjustment'; note?:string }): Promise<void> {
  const response = await employeeFetch('/api/v1/admin/inventory/movement', { method:'POST', body:JSON.stringify(payload) });
  await body(response);
}
export async function saveRecipe(payload: { id?:string; itemId:string; variantId:string|null; name:string; isActive:boolean; components:RecipeComponent[] }): Promise<void> {
  const response = await employeeFetch('/api/v1/admin/inventory/recipe', { method:'POST', body:JSON.stringify(payload) });
  await body(response);
}
