/**
 * backend/src/modules/users/users.routes.ts
 *
 * Route ordering is load-order sensitive — Express matches top to bottom:
 *   /check-email       must be before /:id (else "check-email" is treated as a param)
 *   /me                must be before /:id (same reason)
 *   /me/data-export    must be before /:id (same reason)
 *
 * GDPR changes:
 *   DELETE /me  →  ctrl.anonymizeAccount   (replaces ctrl.deleteMe — M23 compliance)
 *   GET    /me/data-export  →  ctrl.exportMyData   (new — right to data portability)
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  updateProfileSchema,
  notificationPreferencesSchema,
  changePasswordSnakeSchema,
} from './users.schema';
import * as ctrl from './users.controller';

const router: import('express').Router = Router();

// ─── Public ──────────────────────────────────────────────────────────────────
// Must be above /:id so "check-email" is not interpreted as a user ID param.
router.get('/check-email', ctrl.checkEmail);

// ─── Authenticated (self) ─────────────────────────────────────────────────────
// All /me routes must be registered before /:id routes for the same reason.
router.get('/me',   authenticate, ctrl.getMe);
router.patch('/me', authenticate, validate(updateProfileSchema), ctrl.updateMe);
router.put('/me',   authenticate, validate(updateProfileSchema), ctrl.updateMe);

// GDPR M23: full PII anonymisation + JWT revocation.
// Replaces the old DELETE /me → deleteMe (which only set is_active=false).
router.delete('/me', authenticate, ctrl.anonymizeAccount);

// GDPR Article 20: right to data portability.
// Returns a JSON snapshot of everything the platform holds about the caller.
// Registered before /:id so "data-export" is not treated as a user ID.
router.get('/me/data-export', authenticate, ctrl.exportMyData);

// ─── Manager / Owner / Admin only ────────────────────────────────────────────
// injectTenant ensures req.restaurantId is always populated; getUserById no
// longer needs the fragile JWT restaurant_id fallback.
router.get('/',    authenticate, injectTenant, requireRole('manager', 'owner', 'admin'), ctrl.listUsers);
router.get('/:id', authenticate, injectTenant, requireRole('manager', 'owner', 'admin'), ctrl.getUserById);

// ─── User settings (self only — enforced inside each controller) ──────────────
router.get('/:id/notification-preferences',
  authenticate,
  ctrl.getNotificationPreferences,
);
router.patch('/:id/notification-preferences',
  authenticate,
  validate(notificationPreferencesSchema),
  ctrl.updateNotificationPreferences,
);
router.get('/:id/sessions',    authenticate, ctrl.getUserSessions);
router.delete('/:id/sessions', authenticate, ctrl.revokeUserSessions);
router.patch('/:id/password',  authenticate, validate(changePasswordSnakeSchema), ctrl.changePassword);

export default router;
