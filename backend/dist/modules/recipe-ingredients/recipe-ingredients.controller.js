"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getByBranch = getByBranch;
exports.getByMenuItem = getByMenuItem;
exports.upsert = upsert;
exports.deleteIngredientHandler = deleteIngredientHandler;
const response_1 = require("../../utils/response");
const recipe_ingredients_service_1 = require("./recipe-ingredients.service");
// ---------------------------------------------------------------------------
// GET /recipe-ingredients/branch
// Returns all menu-item recipes for the caller's branch, grouped by menu item.
// ---------------------------------------------------------------------------
async function getByBranch(req, res, next) {
    try {
        const data = await (0, recipe_ingredients_service_1.getRecipesForBranch)(req.branchId);
        res.json((0, response_1.success)(data));
    }
    catch (err) {
        next(err);
    }
}
// ---------------------------------------------------------------------------
// GET /recipe-ingredients/menu-item/:menuItemId
// Returns the full ingredient list for a single menu item.
// ---------------------------------------------------------------------------
async function getByMenuItem(req, res, next) {
    try {
        const data = await (0, recipe_ingredients_service_1.getRecipeForMenuItem)(req.params.menuItemId, req.branchId);
        res.json((0, response_1.success)(data));
    }
    catch (err) {
        next(err);
    }
}
// ---------------------------------------------------------------------------
// POST /recipe-ingredients
// Upserts (insert-or-update) the ingredient list for a menu item.
// Body is validated by upsertRecipeSchema before reaching here.
// ---------------------------------------------------------------------------
async function upsert(req, res, next) {
    try {
        const { menu_item_id, ingredients } = req.body;
        const data = await (0, recipe_ingredients_service_1.upsertRecipe)(menu_item_id, ingredients, req.branchId);
        res.status(201).json((0, response_1.success)(data, 'Recipe updated successfully'));
    }
    catch (err) {
        next(err);
    }
}
// ---------------------------------------------------------------------------
// DELETE /recipe-ingredients
// Removes a single ingredient mapping from a menu item's recipe.
// Body is validated by deleteIngredientSchema before reaching here.
// ---------------------------------------------------------------------------
async function deleteIngredientHandler(req, res, next) {
    try {
        const { menu_item_id, inventory_item_id } = req.body;
        const data = await (0, recipe_ingredients_service_1.deleteIngredient)(menu_item_id, inventory_item_id, req.branchId);
        res.json((0, response_1.success)(data, 'Ingredient removed from recipe'));
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=recipe-ingredients.controller.js.map