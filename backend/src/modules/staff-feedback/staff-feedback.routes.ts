import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { validate } from '../../middleware/validate.middleware';
import { submitFeedbackSchema } from './staff-feedback.schema';
import {
  submitFeedbackHandler,
  getFeedbackForRestaurantHandler,
  getFeedbackForAdminHandler,
  flagFeedbackHandler,
} from './staff-feedback.controller';

const router: import('express').Router = Router();

// All routes require authentication
router.use(authenticate, injectTenant);

// POST /staff-feedback
// Any authenticated staff role can submit feedback
router.post(
  '/',
  requireRole('manager', 'host', 'waiter', 'chef', 'cashier'),
  validate(submitFeedbackSchema),
  submitFeedbackHandler,
);

// GET /staff-feedback/admin
// MUST be declared BEFORE GET / to prevent Express matching 'admin' as a param
// Super admin only — cross-restaurant view
router.get(
  '/admin',
  requireRole('super_admin'),
  getFeedbackForAdminHandler,
);

// GET /staff-feedback
// Owner or super_admin — sees their own restaurant's feedback
router.get(
  '/',
  requireRole('owner', 'super_admin'),
  getFeedbackForRestaurantHandler,
);

// PATCH /staff-feedback/:id/flag
// Owner or super_admin can flag entries for follow-up
router.patch(
  '/:id/flag',
  requireRole('owner', 'super_admin'),
  flagFeedbackHandler,
);

export default router;