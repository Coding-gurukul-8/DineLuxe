"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const rbac_middleware_1 = require("../../middleware/rbac.middleware");
const tenant_middleware_1 = require("../../middleware/tenant.middleware");
const analytics_controller_1 = require("./analytics.controller");
const router = (0, express_1.Router)();
// ── All analytics routes require authentication ───────────────────────────────
router.use(auth_middleware_1.authenticate);
// ── Existing AI/forecast routes (owner + manager) ─────────────────────────────
router.get('/menu-suggestions/:branchId', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner', 'manager'), analytics_controller_1.getMenuSuggestions);
router.get('/demand-forecast/:branchId', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner', 'manager'), analytics_controller_1.getDemandForecast);
router.get('/bundle-opportunities/:branchId', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner', 'manager'), analytics_controller_1.getBundleOpportunities);
router.get('/staffing-recommendation/:branchId', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner', 'manager'), analytics_controller_1.getStaffingRecommendation);
// ── NEW: Restaurant overview KPIs (owner + admin) ─────────────────────────────
// GET /analytics/restaurant/:restaurantId/overview
// Returns: { revenue_today, revenue_week, orders_today, avg_order_value,
//            top_items, occupancy_rate }
router.get('/restaurant/:restaurantId/overview', (0, rbac_middleware_1.requireRole)('owner', 'admin', 'super_admin'), analytics_controller_1.getRestaurantOverview);
// ── NEW: Branch hourly breakdown (owner + admin) ──────────────────────────────
// GET /analytics/branch/:branchId/hourly
// Returns: { hours: [{ hour, orders, revenue }] }
router.get('/branch/:branchId/hourly', (0, rbac_middleware_1.requireRole)('owner', 'admin', 'super_admin'), analytics_controller_1.getBranchHourly);
// ── Restaurant period analytics (owner + admin) ───────────────────────────────
// GET /analytics/restaurant/:restaurantId/analytics?period=7d|30d|90d
// Returns: { revenue_by_day, orders_by_day, avg_order_value, top_items }
router.get('/restaurant/:restaurantId/analytics', (0, rbac_middleware_1.requireRole)('owner', 'admin', 'super_admin'), analytics_controller_1.getRestaurantAnalytics);
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map