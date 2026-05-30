"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const rbac_middleware_1 = require("../../middleware/rbac.middleware");
const tenant_middleware_1 = require("../../middleware/tenant.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const recipe_ingredients_controller_1 = require("./recipe-ingredients.controller");
const recipe_ingredients_schema_1 = require("./recipe-ingredients.schema");
const router = (0, express_1.Router)();
// All recipe-ingredient routes require authentication + tenant context + role check
router.use(auth_middleware_1.authenticate, tenant_middleware_1.injectTenant);
// GET /recipe-ingredients/branch
// Returns all recipes for the caller's branch, grouped by menu item
router.get('/branch', (0, rbac_middleware_1.requireRole)('manager', 'owner', 'chef'), recipe_ingredients_controller_1.getByBranch);
// GET /recipe-ingredients/menu-item/:menuItemId
// Returns ingredient list for a specific menu item
router.get('/menu-item/:menuItemId', (0, rbac_middleware_1.requireRole)('manager', 'owner', 'chef'), recipe_ingredients_controller_1.getByMenuItem);
// POST /recipe-ingredients
// Upserts the full ingredient mapping for a menu item
router.post('/', (0, rbac_middleware_1.requireRole)('manager', 'owner', 'chef'), (0, validate_middleware_1.validate)(recipe_ingredients_schema_1.upsertRecipeSchema), recipe_ingredients_controller_1.upsert);
// DELETE /recipe-ingredients
// Removes one ingredient from a menu item's recipe
router.delete('/', (0, rbac_middleware_1.requireRole)('manager', 'owner', 'chef'), (0, validate_middleware_1.validate)(recipe_ingredients_schema_1.deleteIngredientSchema), recipe_ingredients_controller_1.deleteIngredientHandler);
exports.default = router;
//# sourceMappingURL=recipe-ingredients.routes.js.map