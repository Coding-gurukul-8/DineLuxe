"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteIngredientSchema = exports.upsertRecipeSchema = void 0;
const zod_1 = require("zod");
// ---------------------------------------------------------------------------
// Upsert Recipe
// Replaces (insert-or-update) the full ingredient list for a menu item.
// onConflict: menu_item_id + inventory_item_id
// ---------------------------------------------------------------------------
exports.upsertRecipeSchema = zod_1.z.object({
    menu_item_id: zod_1.z.string().uuid(),
    ingredients: zod_1.z
        .array(zod_1.z.object({
        inventory_item_id: zod_1.z.string().uuid(),
        quantity_per_serving: zod_1.z.number().positive().max(10000),
        unit: zod_1.z.string().min(1).max(20), // e.g. "g", "ml", "pieces"
    }))
        .min(1)
        .max(50),
});
// ---------------------------------------------------------------------------
// Delete a single ingredient mapping from a recipe
// ---------------------------------------------------------------------------
exports.deleteIngredientSchema = zod_1.z.object({
    menu_item_id: zod_1.z.string().uuid(),
    inventory_item_id: zod_1.z.string().uuid(),
});
//# sourceMappingURL=recipe-ingredients.schema.js.map