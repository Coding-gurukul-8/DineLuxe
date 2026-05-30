import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import {
  getRecipeForMenuItem,
  getRecipesForBranch,
  upsertRecipe,
  deleteIngredient,
} from './recipe-ingredients.service';

// ---------------------------------------------------------------------------
// GET /recipe-ingredients/branch
// Returns all menu-item recipes for the caller's branch, grouped by menu item.
// ---------------------------------------------------------------------------
export async function getByBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getRecipesForBranch(req.branchId!);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /recipe-ingredients/menu-item/:menuItemId
// Returns the full ingredient list for a single menu item.
// ---------------------------------------------------------------------------
export async function getByMenuItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getRecipeForMenuItem(req.params.menuItemId, req.branchId!);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /recipe-ingredients
// Upserts (insert-or-update) the ingredient list for a menu item.
// Body is validated by upsertRecipeSchema before reaching here.
// ---------------------------------------------------------------------------
export async function upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { menu_item_id, ingredients } = req.body as {
      menu_item_id: string;
      ingredients: Array<{
        inventory_item_id: string;
        quantity_per_serving: number;
        unit: string;
      }>;
    };

    const data = await upsertRecipe(menu_item_id, ingredients, req.branchId!);
    res.status(201).json(success(data, 'Recipe updated successfully'));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /recipe-ingredients
// Removes a single ingredient mapping from a menu item's recipe.
// Body is validated by deleteIngredientSchema before reaching here.
// ---------------------------------------------------------------------------
export async function deleteIngredientHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { menu_item_id, inventory_item_id } = req.body as {
      menu_item_id: string;
      inventory_item_id: string;
    };

    const data = await deleteIngredient(menu_item_id, inventory_item_id, req.branchId!);
    res.json(success(data, 'Ingredient removed from recipe'));
  } catch (err) {
    next(err);
  }
}