"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const rbac_middleware_1 = require("../../middleware/rbac.middleware");
const tenant_middleware_1 = require("../../middleware/tenant.middleware");
const staffing_controller_1 = require("./staffing.controller");
const router = (0, express_1.Router)();
// All staffing routes require authentication, tenant context, and manager/owner role.
// Staffing data contains labour-planning info — customers and regular staff must not access it.
router.use(auth_middleware_1.authenticate, tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('manager', 'owner'));
// GET /staffing/prediction?branch_id=&date=
// Returns hourly demand predictions for a target date
router.get('/prediction', staffing_controller_1.handleGetDemandPrediction);
// GET /staffing/recommendation?branch_id=&date=
// Returns hourly staffing recommendations + warnings for a target date
router.get('/recommendation', staffing_controller_1.handleGetRecommendation);
// GET /staffing/weekly?branch_id=&week_start=
// Returns a 7-day staffing forecast from week_start
router.get('/weekly', staffing_controller_1.handleGetWeeklyForecast);
exports.default = router;
//# sourceMappingURL=staffing.routes.js.map