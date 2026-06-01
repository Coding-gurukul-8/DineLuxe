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
  getPlatformReport,
  exportReport,
  queueExportReport,
  getExportJobStatus,
  // NEW frontend-shaped endpoints
  getRevenueReport,
  getOrdersReport,
  getMenuReport,
  getStaffReport,
} from './reports.controller';
import {
  exportReportSchema,
  queueExportReportSchema,
  salesReportQuerySchema,
} from './reports.schema';

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
  '/platform',
  requireRole('admin', 'super_admin'),
  getPlatformReport,
);

router.get(
  '/admin/trends',
  requireRole('admin', 'super_admin'),
  getAdminTrends,
);

// ─── Async export (Bull-backed) ───────────────────────────────────────────────
/**
 * POST /reports/export
 *
 * Enqueues a report-export job. Returns a job_id immediately.
 * The caller should poll GET /reports/export/:jobId/status until
 * status === 'completed' and use the returned download_url.
 *
 * Supports all formats: csv | xlsx | pdf
 * The requester is emailed when the report is ready.
 *
 * Use this for large datasets (100K+ orders) or when you need XLSX/PDF output.
 *
 * Response 202:
 *   {
 *     success: true,
 *     data: {
 *       job_id: "uuid",
 *       message: "Report is being generated. You will receive an email when ready."
 *     }
 *   }
 */
router.post(
  '/export',
  injectTenant,
  requireRole('owner', 'admin'),
  validate({ body: queueExportReportSchema }),
  queueExportReport,
);

// ─── Job status polling ───────────────────────────────────────────────────────
/**
 * GET /reports/export/:jobId/status
 *
 * Returns the current state of an async export job.
 *
 * Response 200 (waiting / active):
 *   { success: true, data: { status: 'waiting' | 'active', created_at: '...' } }
 *
 * Response 200 (completed):
 *   { success: true, data: { status: 'completed', download_url: '...', created_at: '...' } }
 *
 * Response 200 (failed):
 *   { success: true, data: { status: 'failed', error: '...', created_at: '...' } }
 */
router.get(
  '/export/:jobId/status',
  injectTenant,
  requireRole('owner', 'admin', 'manager'),
  getExportJobStatus,
);

// ─── Synchronous export (small on-demand, < 500 rows) ────────────────────────
/**
 * POST /reports/export/sync
 *
 * Generates and uploads the report synchronously — returns the download URL
 * in the same HTTP response. Suitable for the frontend's "Download CSV" button
 * on small result sets.
 *
 * ⚠ Will timeout (~30 s) for large datasets. Use POST /reports/export instead.
 *
 * Formats supported: csv | pdf (no xlsx — use the async queue for xlsx)
 *
 * Response 200:
 *   { success: true, data: { download_url: '...', expires_in: 3600, expires_at: '...' } }
 */
router.post(
  '/export/sync',
  injectTenant,
  requireRole('owner', 'admin'),
  validate({ body: exportReportSchema }),
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