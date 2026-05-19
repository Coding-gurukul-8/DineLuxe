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
} from './analytics.controller';

const router: import('express').Router = Router();

// ── All analytics routes require authentication ───────────────────────────────
router.use(authenticate);

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

export default router;