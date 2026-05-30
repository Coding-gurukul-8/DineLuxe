import { z } from 'zod';

// ---------------------------------------------------------------------------
// Upsert Recipe
// Replaces (insert-or-update) the full ingredient list for a menu item.
// onConflict: menu_item_id + inventory_item_id
// ---------------------------------------------------------------------------
export const upsertRecipeSchema = z.object({
  menu_item_id: z.string().uuid(),
  ingredients: z
    .array(
      z.object({
        inventory_item_id: z.string().uuid(),
        quantity_per_serving: z.number().positive().max(10000),
        unit: z.string().min(1).max(20), // e.g. "g", "ml", "pieces"
      }),
    )
    .min(1)
    .max(50),
});

// ---------------------------------------------------------------------------
// Delete a single ingredient mapping from a recipe
// ---------------------------------------------------------------------------
export const deleteIngredientSchema = z.object({
  menu_item_id: z.string().uuid(),
  inventory_item_id: z.string().uuid(),
});

export type UpsertRecipeInput = z.infer<typeof upsertRecipeSchema>;
export type DeleteIngredientInput = z.infer<typeof deleteIngredientSchema>;