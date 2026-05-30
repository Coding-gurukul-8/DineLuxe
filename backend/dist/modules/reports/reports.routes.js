"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const rbac_middleware_1 = require("../../middleware/rbac.middleware");
const tenant_middleware_1 = require("../../middleware/tenant.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const reports_controller_1 = require("./reports.controller");
const reports_schema_1 = require("./reports.schema");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// ─── Existing backend-shaped endpoints ───────────────────────────────────────
router.get('/sales', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner', 'manager'), (0, validate_middleware_1.validate)({ query: reports_schema_1.salesReportQuerySchema }), reports_controller_1.getSales);
router.get('/menu-performance', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner', 'manager'), reports_controller_1.getMenuPerformance);
router.get('/kitchen-performance', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner', 'manager'), reports_controller_1.getKitchenPerformance);
router.get('/customer-insights', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner'), reports_controller_1.getCustomerInsights);
router.get('/admin/platform', (0, rbac_middleware_1.requireRole)('admin', 'super_admin'), reports_controller_1.getAdminPlatform);
router.get('/platform', (0, rbac_middleware_1.requireRole)('admin', 'super_admin'), reports_controller_1.getPlatformReport);
router.get('/admin/trends', (0, rbac_middleware_1.requireRole)('admin', 'super_admin'), reports_controller_1.getAdminTrends);
router.post('/export', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner', 'admin'), (0, validate_middleware_1.validate)(reports_schema_1.exportReportSchema), reports_controller_1.exportReport);
// ─── NEW: Frontend-shaped endpoints for ReportsDashboard ─────────────────────
// These map 1-to-1 onto the tab fetches in components/owner/ReportsDashboard.tsx
// All require owner or manager authentication + restaurant context injection.
/**
 * GET /reports/revenue?branch_id=&from=&to=
 * Used by: ReportsDashboard — Revenue tab (line chart)
 */
router.get('/revenue', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner', 'manager'), reports_controller_1.getRevenueReport);
/**
 * GET /reports/orders?branch_id=&from=&to=
 * Used by: ReportsDashboard — Orders tab (pie/donut chart)
 */
router.get('/orders', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner', 'manager'), reports_controller_1.getOrdersReport);
/**
 * GET /reports/menu?branch_id=&from=&to=
 * Used by: ReportsDashboard — Menu tab (horizontal bar chart)
 */
router.get('/menu', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner', 'manager'), reports_controller_1.getMenuReport);
/**
 * GET /reports/staff?branch_id=&from=&to=
 * Used by: ReportsDashboard — Staff tab (performance table)
 */
router.get('/staff', tenant_middleware_1.injectTenant, (0, rbac_middleware_1.requireRole)('owner', 'manager'), reports_controller_1.getStaffReport);
exports.default = router;
//# sourceMappingURL=reports.routes.js.map