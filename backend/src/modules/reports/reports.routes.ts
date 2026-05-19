import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  getSales,
  getMenuPerformance,
  getKitchenPerformance,
  getCustomerInsights,
  getAdminPlatform,
  getAdminTrends,
  exportReport,
  // NEW frontend-shaped endpoints
  getRevenueReport,
  getOrdersReport,
  getMenuReport,
  getStaffReport,
} from './reports.controller';
import { exportReportSchema, salesReportQuerySchema } from './reports.schema';

const router: import('express').Router = Router();

router.use(authenticate);

// ─── Existing backend-shaped endpoints ───────────────────────────────────────

router.get(
  '/sales',
  injectTenant,
  requireRole('owner', 'manager'),
  validate({ query: salesReportQuerySchema }),
  getSales,
);

router.get(
  '/menu-performance',
  injectTenant,
  requireRole('owner', 'manager'),
  getMenuPerformance,
);

router.get(
  '/kitchen-performance',
  injectTenant,
  requireRole('owner', 'manager'),
  getKitchenPerformance,
);

router.get(
  '/customer-insights',
  injectTenant,
  requireRole('owner'),
  getCustomerInsights,
);

router.get(
  '/admin/platform',
  requireRole('admin', 'super_admin'),
  getAdminPlatform,
);

router.get(
  '/admin/trends',
  requireRole('admin', 'super_admin'),
  getAdminTrends,
);

router.post(
  '/export',
  injectTenant,
  requireRole('owner', 'admin'),
  validate(exportReportSchema),
  exportReport,
);

// ─── NEW: Frontend-shaped endpoints for ReportsDashboard ─────────────────────
// These map 1-to-1 onto the tab fetches in components/owner/ReportsDashboard.tsx
// All require owner or manager authentication + restaurant context injection.

/**
 * GET /reports/revenue?branch_id=&from=&to=
 * Used by: ReportsDashboard — Revenue tab (line chart)
 */
router.get(
  '/revenue',
  injectTenant,
  requireRole('owner', 'manager'),
  getRevenueReport,
);

/**
 * GET /reports/orders?branch_id=&from=&to=
 * Used by: ReportsDashboard — Orders tab (pie/donut chart)
 */
router.get(
  '/orders',
  injectTenant,
  requireRole('owner', 'manager'),
  getOrdersReport,
);

/**
 * GET /reports/menu?branch_id=&from=&to=
 * Used by: ReportsDashboard — Menu tab (horizontal bar chart)
 */
router.get(
  '/menu',
  injectTenant,
  requireRole('owner', 'manager'),
  getMenuReport,
);

/**
 * GET /reports/staff?branch_id=&from=&to=
 * Used by: ReportsDashboard — Staff tab (performance table)
 */
router.get(
  '/staff',
  injectTenant,
  requireRole('owner', 'manager'),
  getStaffReport,
);

export default router;