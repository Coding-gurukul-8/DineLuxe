import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  getByBranch,
  getByMenuItem,
  upsert,
  deleteIngredientHandler,
} from './recipe-ingredients.controller';
import { upsertRecipeSchema, deleteIngredientSchema } from './recipe-ingredients.schema';

const router: import('express').Router = Router();

// All recipe-ingredient routes require authentication + tenant context + role check
router.use(authenticate, injectTenant);

// GET /recipe-ingredients/branch
// Returns all recipes for the caller's branch, grouped by menu item
router.get(
  '/branch',
  requireRole('manager', 'owner', 'chef'),
  getByBranch,
);

// GET /recipe-ingredients/menu-item/:menuItemId
// Returns ingredient list for a specific menu item
router.get(
  '/menu-item/:menuItemId',
  requireRole('manager', 'owner', 'chef'),
  getByMenuItem,
);

// POST /recipe-ingredients
// Upserts the full ingredient mapping for a menu item
router.post(
  '/',
  requireRole('manager', 'owner', 'chef'),
  validate(upsertRecipeSchema),
  upsert,
);

// DELETE /recipe-ingredients
// Removes one ingredient from a menu item's recipe
router.delete(
  '/',
  requireRole('manager', 'owner', 'chef'),
  validate(deleteIngredientSchema),
  deleteIngredientHandler,
);

export default router;
