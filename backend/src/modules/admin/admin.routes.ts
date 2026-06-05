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
  getPendingRestaurants,
  approveRestaurant,
  rejectRestaurant,
  getCustomers,
  updateCustomerStatus,
  getFeedback,
  createAdmin,
  signupSuperAdmin,
  // Section 6.5 — customer account management
  suspendCustomer,
  unsuspendCustomer,
  flagCustomer,
  getCustomerDetail,
} from './admin.controller';
import { createAdminSchema, suspendCustomerSchema, flagCustomerSchema } from './admin.schema';

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

// ── Restaurant management ────────────────────────────────────────────────────
// IMPORTANT: /restaurants/pending must be declared before /restaurants/:id/...
// so Express doesn't interpret "pending" as a dynamic :id parameter.
router.get('/restaurants/pending', getPendingRestaurants);
router.post('/restaurants/:id/approve', approveRestaurant);
router.post('/restaurants/:id/reject', rejectRestaurant);

router.get('/restaurants', getRestaurants);
router.patch('/restaurants/:id/status', updateRestaurantStatus);

// ── Customer management ───────────────────────────────────────────────────────
// IMPORTANT: specific sub-paths (/suspend, /unsuspend, /flag) must be declared
// before the parameterised GET /:id so Express doesn't consume them as IDs.
router.get('/customers', getCustomers);
router.patch('/customers/:id/status', updateCustomerStatus);

// Section 6.5 — account lifecycle
router.get('/customers/:id', getCustomerDetail);
router.patch('/customers/:id/suspend', validate(suspendCustomerSchema), suspendCustomer);
router.patch('/customers/:id/unsuspend', unsuspendCustomer);
router.patch('/customers/:id/flag', validate(flagCustomerSchema), flagCustomer);

// ── Feedback ─────────────────────────────────────────────────────────────────
router.get('/feedback', getFeedback);

export default router;