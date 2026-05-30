import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  getDashboard,
  getPlatformStats,
  getHealth,
  getDetailedHealth,
  getRestaurants,
  updateRestaurantStatus,
  getCustomers,
  updateCustomerStatus,
  getFeedback,
  createAdmin,
  signupSuperAdmin,
} from './admin.controller';
import { createAdminSchema } from './admin.schema';

const router: import('express').Router = Router();

// ── Public ───────────────────────────────────────────────────────────────────

// Basic health — no auth required (used by uptime monitors, load balancers)
router.get('/health', getHealth);

// Detailed health — super_admin only (before the catch-all authenticate below)
router.get(
  '/health/detailed',
  authenticate,
  requireRole('super_admin'),
  getDetailedHealth,
);

// Super_admin signup — no token needed.
// Can create multiple super_admin accounts using the seed secret header.
router.post('/signup', validate(createAdminSchema), signupSuperAdmin);

// ── super_admin only ─────────────────────────────────────────────────────────
router.post(
  '/create-admin',
  authenticate,
  requireRole('super_admin'),
  validate(createAdminSchema),
  createAdmin,
);

// ── admin + super_admin ──────────────────────────────────────────────────────
router.use(authenticate, requireRole('admin', 'super_admin'));

router.get('/dashboard', getDashboard);
router.get('/platform-stats', getPlatformStats);
router.get('/restaurants', getRestaurants);
router.patch('/restaurants/:id/status', updateRestaurantStatus);
router.get('/customers', getCustomers);
router.patch('/customers/:id/status', updateCustomerStatus);
router.get('/feedback', getFeedback);

export default router;