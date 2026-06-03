import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  registerSchema,
  updateRestaurantSchema,
  updateRestaurantSettingsSchema,
  updateStatusSchema,
} from './restaurants.schema';
import * as ctrl from './restaurants.controller';

const router: import('express').Router = Router();

// ── Public ──────────────────────────────────────────────────────────────────
router.post('/register', validate(registerSchema), ctrl.register);
router.get('/nearby', ctrl.getNearby);
router.get('/:id', ctrl.getById);
router.get('/:id/live-status', ctrl.getLiveStatus);

// ── Owner — manage own restaurant ────────────────────────────────────────────
router.patch(
  '/:id',
  authenticate,
  injectTenant,
  requireRole('owner'),
  validate(updateRestaurantSchema),
  ctrl.update
);

router.get(
  '/:id/settings',
  authenticate,
  injectTenant,
  requireRole('owner'),
  ctrl.getSettings
);

router.patch(
  '/:id/settings',
  authenticate,
  injectTenant,
  requireRole('owner'),
  validate(updateRestaurantSettingsSchema),
  ctrl.updateSettings
);

// ── Admin only ───────────────────────────────────────────────────────────────
router.get('/', authenticate, requireRole('admin'), ctrl.getAll);
router.patch(
  '/:id/status',
  authenticate,
  requireRole('admin'),
  validate(updateStatusSchema),
  ctrl.updateStatus
);

export default router;
