"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const rbac_middleware_1 = require("../../middleware/rbac.middleware");
const tenant_middleware_1 = require("../../middleware/tenant.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const dynamic_pricing_schema_1 = require("./dynamic-pricing.schema");
const dynamic_pricing_controller_1 = require("./dynamic-pricing.controller");
const router = (0, express_1.Router)();
// ─── Public Route ─────────────────────────────────────────────────────────────
// Active rules used by the customer-facing menu to calculate discounted prices.
// NOTE: must be declared BEFORE the router.use(authenticate) block so it stays public.
router.get('/branch/:branchId/active', dynamic_pricing_controller_1.handleGetActiveRulesNow);
// ─── Protected Routes ─────────────────────────────────────────────────────────
router.use(auth_middleware_1.authenticate, tenant_middleware_1.injectTenant);
// GET /dynamic-pricing/branch/:branchId — all rules for a branch
router.get('/branch/:branchId', (0, rbac_middleware_1.requireRole)('manager', 'owner'), dynamic_pricing_controller_1.handleGetRulesForBranch);
// POST /dynamic-pricing — create a new rule
router.post('/', (0, rbac_middleware_1.requireRole)('manager', 'owner'), (0, validate_middleware_1.validate)({ body: dynamic_pricing_schema_1.createRuleSchema }), dynamic_pricing_controller_1.handleCreateRule);
// PATCH /dynamic-pricing/:id/toggle — must come before /:id to avoid Express
// treating 'toggle' as a rule id param
router.patch('/:id/toggle', (0, rbac_middleware_1.requireRole)('manager', 'owner'), dynamic_pricing_controller_1.handleToggleRule);
// PATCH /dynamic-pricing/:id — update a rule
router.patch('/:id', (0, rbac_middleware_1.requireRole)('manager', 'owner'), (0, validate_middleware_1.validate)({ body: dynamic_pricing_schema_1.updateRuleSchema }), dynamic_pricing_controller_1.handleUpdateRule);
// DELETE /dynamic-pricing/:id — delete a rule
router.delete('/:id', (0, rbac_middleware_1.requireRole)('manager', 'owner'), dynamic_pricing_controller_1.handleDeleteRule);
exports.default = router;
//# sourceMappingURL=dynamic-pricing.routes.js.map