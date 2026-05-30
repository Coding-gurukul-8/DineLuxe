"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const customer_preferences_schema_1 = require("./customer-preferences.schema");
const customer_preferences_controller_1 = require("./customer-preferences.controller");
const router = (0, express_1.Router)();
// All routes require customer authentication
router.use(auth_middleware_1.authenticate);
// ─── Dietary Profile ──────────────────────────────────────────────────────────
// GET /customer-preferences/dietary — fetch the customer's dietary profile
router.get('/dietary', customer_preferences_controller_1.handleGetDietaryProfile);
// PATCH /customer-preferences/dietary — create or update dietary profile
router.patch('/dietary', (0, validate_middleware_1.validate)({ body: customer_preferences_schema_1.upsertDietaryProfileSchema }), customer_preferences_controller_1.handleUpsertDietaryProfile);
// ─── Table Preferences ────────────────────────────────────────────────────────
// GET /customer-preferences/tables — all saved preferences across branches
// NOTE: must be declared BEFORE /tables/:branchId so Express doesn't treat
// a request to /tables as matching /:branchId with branchId = undefined
router.get('/tables', customer_preferences_controller_1.handleGetAllPreferences);
// GET /customer-preferences/tables/:branchId — preference for one branch
router.get('/tables/:branchId', customer_preferences_controller_1.handleGetTablePreference);
// POST /customer-preferences/tables — save or update preferred table
router.post('/tables', (0, validate_middleware_1.validate)({ body: customer_preferences_schema_1.saveTablePreferenceSchema }), customer_preferences_controller_1.handleSaveTablePreference);
exports.default = router;
//# sourceMappingURL=customer-preferences.routes.js.map