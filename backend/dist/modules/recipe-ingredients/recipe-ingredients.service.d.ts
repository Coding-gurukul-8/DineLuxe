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
export declare function getRecipeForMenuItem(menuItemId: string, branchId: string): Promise<RecipeIngredientRow[]>;
export declare function getRecipesForBranch(branchId: string): Promise<BranchRecipeRow[]>;
export declare function upsertRecipe(menuItemId: string, ingredients: Array<{
    inventory_item_id: string;
    quantity_per_serving: number;
    unit: string;
}>, branchId: string): Promise<UpsertResult>;
export declare function deleteIngredient(menuItemId: string, inventoryItemId: string, branchId: string): Promise<{
    deleted: true;
    menu_item_id: string;
    inventory_item_id: string;
}>;
export declare function getRecipeIngredientRequirements(menuItemId: string, quantity: number): Promise<RequirementRow[]>;
//# sourceMappingURL=recipe-ingredients.service.d.ts.map