import { supabaseAdmin } from '../../config/supabase';

// ---------------------------------------------------------------------------
// Typed shapes returned by this service
// ---------------------------------------------------------------------------

export interface RecipeIngredientRow {
  inventory_item_id: string;
  ingredient_name: string;
  quantity_per_serving: number;
  unit: string;
  current_stock: number;
}

export interface BranchRecipeRow {
  menu_item_id: string;
  menu_item_name: string;
  ingredients: RecipeIngredientRow[];
}

export interface UpsertResult {
  upserted_count: number;
  recipe: RecipeIngredientRow[];
}

export interface RequirementRow {
  inventory_item_id: string;
  total_quantity_needed: number;
  unit: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function httpError(status: number, code: string, message: string): Error {
  return Object.assign(new Error(message), { status, code });
}

/**
 * Verifies that a menu_item belongs to the given branch.
 * Returns the menu_item row on success; throws 404 if not found.
 */
async function assertMenuItemBelongsToBranch(
  menuItemId: string,
  branchId: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .select('id, name')
    .eq('id', menuItemId)
    .eq('branch_id', branchId)
    .single();

  if (error?.code === 'PGRST116' || !data) {
    throw httpError(
      404,
      'MENU_ITEM_NOT_FOUND',
      `Menu item ${menuItemId} not found in this branch.`,
    );
  }
  if (error) throw error;

  return data as { id: string; name: string };
}

/**
 * Verifies every inventory_item_id in the list belongs to the given branch.
 * Throws 400 with the list of invalid IDs if any fail.
 */
async function assertInventoryItemsBelongToBranch(
  inventoryItemIds: string[],
  branchId: string,
): Promise<void> {
  if (inventoryItemIds.length === 0) return;

  const { data, error } = await supabaseAdmin
    .from('inventory_items')
    .select('id')
    .eq('branch_id', branchId)
    .in('id', inventoryItemIds);

  if (error) throw error;

  const found = new Set((data ?? []).map((r: { id: string }) => r.id));
  const invalid = inventoryItemIds.filter((id) => !found.has(id));

  if (invalid.length > 0) {
    throw httpError(
      400,
      'INVALID_INVENTORY_ITEMS',
      `The following inventory items do not belong to this branch: ${invalid.join(', ')}`,
    );
  }
}

// ---------------------------------------------------------------------------
// getRecipeForMenuItem
// GET /recipe-ingredients/menu-item/:menuItemId
// ---------------------------------------------------------------------------
export async function getRecipeForMenuItem(
  menuItemId: string,
  branchId: string,
): Promise<RecipeIngredientRow[]> {
  // Verify ownership first
  await assertMenuItemBelongsToBranch(menuItemId, branchId);

  // Fetch recipe rows; join inventory_items for name + current stock
  const { data, error } = await supabaseAdmin
    .from('recipe_ingredients')
    .select(
      `
      inventory_item_id,
      quantity_per_serving,
      unit,
      inventory_items (
        ingredient_name,
        current_quantity
      )
    `,
    )
    .eq('menu_item_id', menuItemId);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    inventory_item_id: row.inventory_item_id,
    ingredient_name: row.inventory_items?.ingredient_name ?? '',
    quantity_per_serving: Number(row.quantity_per_serving),
    unit: row.unit,
    current_stock: Number(row.inventory_items?.current_quantity ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// getRecipesForBranch
// GET /recipe-ingredients/branch
// ---------------------------------------------------------------------------
export async function getRecipesForBranch(branchId: string): Promise<BranchRecipeRow[]> {
  // Pull all recipe_ingredients for the branch via the menu_items join
  const { data, error } = await supabaseAdmin
    .from('recipe_ingredients')
    .select(
      `
      menu_item_id,
      inventory_item_id,
      quantity_per_serving,
      unit,
      menu_items!inner (
        id,
        name,
        branch_id
      ),
      inventory_items (
        ingredient_name,
        current_quantity
      )
    `,
    )
    .eq('menu_items.branch_id', branchId);

  if (error) throw error;

  // Group rows by menu_item_id
  const map = new Map<string, BranchRecipeRow>();

  for (const row of data ?? []) {
    const menuItem = (row as any).menu_items;
    const invItem = (row as any).inventory_items;
    const menuItemId: string = row.menu_item_id;

    if (!map.has(menuItemId)) {
      map.set(menuItemId, {
        menu_item_id: menuItemId,
        menu_item_name: menuItem?.name ?? '',
        ingredients: [],
      });
    }

    map.get(menuItemId)!.ingredients.push({
      inventory_item_id: row.inventory_item_id,
      ingredient_name: invItem?.ingredient_name ?? '',
      quantity_per_serving: Number(row.quantity_per_serving),
      unit: row.unit,
      current_stock: Number(invItem?.current_quantity ?? 0),
    });
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// upsertRecipe
// POST /recipe-ingredients
// ---------------------------------------------------------------------------
export async function upsertRecipe(
  menuItemId: string,
  ingredients: Array<{
    inventory_item_id: string;
    quantity_per_serving: number;
    unit: string;
  }>,
  branchId: string,
): Promise<UpsertResult> {
  // 1. Verify the menu item belongs to this branch
  await assertMenuItemBelongsToBranch(menuItemId, branchId);

  // 2. Verify all inventory items belong to this branch
  const inventoryItemIds = ingredients.map((i) => i.inventory_item_id);
  await assertInventoryItemsBelongToBranch(inventoryItemIds, branchId);

  // 3. Build the upsert payload
  const rows = ingredients.map((i) => ({
    menu_item_id: menuItemId,
    inventory_item_id: i.inventory_item_id,
    quantity_per_serving: i.quantity_per_serving,
    unit: i.unit,
  }));

  const { error: upsertError } = await supabaseAdmin
    .from('recipe_ingredients')
    .upsert(rows, { onConflict: 'menu_item_id,inventory_item_id' });

  if (upsertError) throw upsertError;

  // 4. Return the full updated recipe
  const recipe = await getRecipeForMenuItem(menuItemId, branchId);

  return {
    upserted_count: rows.length,
    recipe,
  };
}

// ---------------------------------------------------------------------------
// deleteIngredient
// DELETE /recipe-ingredients
// ---------------------------------------------------------------------------
export async function deleteIngredient(
  menuItemId: string,
  inventoryItemId: string,
  branchId: string,
): Promise<{ deleted: true; menu_item_id: string; inventory_item_id: string }> {
  // Verify ownership — ensures the caller can only delete their own branch's data
  await assertMenuItemBelongsToBranch(menuItemId, branchId);

  const { error, count } = await supabaseAdmin
    .from('recipe_ingredients')
    .delete({ count: 'exact' })
    .eq('menu_item_id', menuItemId)
    .eq('inventory_item_id', inventoryItemId);

  if (error) throw error;

  if (!count || count === 0) {
    throw httpError(
      404,
      'RECIPE_INGREDIENT_NOT_FOUND',
      `No recipe ingredient mapping found for menu_item_id=${menuItemId} and inventory_item_id=${inventoryItemId}.`,
    );
  }

  return { deleted: true, menu_item_id: menuItemId, inventory_item_id: inventoryItemId };
}

// ---------------------------------------------------------------------------
// getRecipeIngredientRequirements
// Internal — used by the orders/inventory deduction pipeline
// ---------------------------------------------------------------------------
export async function getRecipeIngredientRequirements(
  menuItemId: string,
  quantity: number,
): Promise<RequirementRow[]> {
  const { data, error } = await supabaseAdmin
    .from('recipe_ingredients')
    .select('inventory_item_id, quantity_per_serving, unit')
    .eq('menu_item_id', menuItemId);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    inventory_item_id: row.inventory_item_id,
    total_quantity_needed: Number(row.quantity_per_serving) * quantity,
    unit: row.unit,
  }));
}