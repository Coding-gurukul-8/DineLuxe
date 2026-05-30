import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import {
  getMenuSuggestions,
  getDemandForecast,
  getBundleOpportunities,
  getStaffingRecommendation,
  getRestaurantOverview,
  getBranchHourly,
  getRestaurantAnalytics,
  getPlatformOverview,
} from './analytics.controller';

const router: import('express').Router = Router();

// ── All analytics routes require authentication ───────────────────────────────
router.use(authenticate);

// ── Platform overview (admin) ───────────────────────────────────────────────
// GET /analytics/overview?period=7d|30d|90d
router.get(
  '/overview',
  requireRole('admin', 'super_admin'),
  getPlatformOverview,
);

// ── Existing AI/forecast routes (owner + manager) ─────────────────────────────
router.get(
  '/menu-suggestions/:branchId',
  injectTenant,
  requireRole('owner', 'manager'),
  getMenuSuggestions,
);

router.get(
  '/demand-forecast/:branchId',
  injectTenant,
  requireRole('owner', 'manager'),
  getDemandForecast,
);

router.get(
  '/bundle-opportunities/:branchId',
  injectTenant,
  requireRole('owner', 'manager'),
  getBundleOpportunities,
);

router.get(
  '/staffing-recommendation/:branchId',
  injectTenant,
  requireRole('owner', 'manager'),
  getStaffingRecommendation,
);

// ── NEW: Restaurant overview KPIs (owner + admin) ─────────────────────────────
// GET /analytics/restaurant/:restaurantId/overview
// Returns: { revenue_today, revenue_week, orders_today, avg_order_value,
//            top_items, occupancy_rate }
router.get(
  '/restaurant/:restaurantId/overview',
  requireRole('owner', 'admin', 'super_admin'),
  getRestaurantOverview,
);

// ── NEW: Branch hourly breakdown (owner + admin) ──────────────────────────────
// GET /analytics/branch/:branchId/hourly
// Returns: { hours: [{ hour, orders, revenue }] }
router.get(
  '/branch/:branchId/hourly',
  requireRole('owner', 'admin', 'super_admin'),
  getBranchHourly,
);

// ── Restaurant period analytics (owner + admin) ───────────────────────────────
// GET /analytics/restaurant/:restaurantId/analytics?period=7d|30d|90d
// Returns: { revenue_by_day, orders_by_day, avg_order_value, top_items }
router.get(
  '/restaurant/:restaurantId/analytics',
  requireRole('owner', 'admin', 'super_admin'),
  getRestaurantAnalytics,
);

export default router;