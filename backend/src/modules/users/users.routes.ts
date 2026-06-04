import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { updateProfileSchema, notificationPreferencesSchema, changePasswordSnakeSchema } from './users.schema';
import * as ctrl from './users.controller';

const router: import('express').Router = Router();

// ─── Public ──────────────────────────────────────────────────────────────────
router.get('/check-email', ctrl.checkEmail);

// ─── Authenticated (self) ────────────────────────────────────────────────────
router.get('/me', authenticate, ctrl.getMe);
router.patch('/me', authenticate, validate(updateProfileSchema), ctrl.updateMe);
router.put('/me',   authenticate, validate(updateProfileSchema), ctrl.updateMe);

// GDPR: permanent anonymisation — replaces the old soft-deactivate (deleteMe).
// Spec M23: anonymise PII, purge auth user, revoke JWTs, cancel bookings.
router.delete('/me', authenticate, ctrl.anonymizeAccount);

// GDPR: right to data portability — returns a JSON snapshot of all user data.
// GET rather than POST because it is a pure read; no body required.
router.get('/me/data-export', authenticate, ctrl.exportMyData);

// ─── Manager / Owner / Admin only ────────────────────────────────────────────
// BUG FIX: injectTenant added so restaurantId is always on req and the
// getUserById controller doesn't need a fragile JWT fallback.
router.get('/',    authenticate, injectTenant, requireRole('manager', 'owner', 'admin'), ctrl.listUsers);
router.get('/:id', authenticate, injectTenant, requireRole('manager', 'owner', 'admin'), ctrl.getUserById);

// ─── User settings (self only) ───────────────────────────────────────────────
router.get('/:id/notification-preferences',   authenticate, ctrl.getNotificationPreferences);
router.patch('/:id/notification-preferences', authenticate, validate(notificationPreferencesSchema), ctrl.updateNotificationPreferences);
router.get('/:id/sessions',    authenticate, ctrl.getUserSessions);
router.delete('/:id/sessions', authenticate, ctrl.revokeUserSessions);
router.patch('/:id/password',  authenticate, validate(changePasswordSnakeSchema), ctrl.changePassword);

export default router;
/*import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { updateProfileSchema, notificationPreferencesSchema, changePasswordSnakeSchema } from './users.schema';
import * as ctrl from './users.controller';

const router: import('express').Router = Router();

// Public
router.get('/check-email', ctrl.checkEmail);

// Authenticated
router.get('/me', authenticate, ctrl.getMe);
router.patch('/me', authenticate, validate(updateProfileSchema), ctrl.updateMe);
router.put('/me', authenticate, validate(updateProfileSchema), ctrl.updateMe);
router.delete('/me', authenticate, ctrl.deleteMe);

// Manager / Owner / Admin only
// BUG FIX: injectTenant added so restaurantId is always on req and the
// getUserById controller doesn't need a fragile JWT fallback.
router.get('/', authenticate, injectTenant, requireRole('manager', 'owner', 'admin'), ctrl.listUsers);
router.get('/:id', authenticate, injectTenant, requireRole('manager', 'owner', 'admin'), ctrl.getUserById);

// User settings endpoints (self only)
router.get('/:id/notification-preferences', authenticate, ctrl.getNotificationPreferences);
router.patch('/:id/notification-preferences', authenticate, validate(notificationPreferencesSchema), ctrl.updateNotificationPreferences);
router.get('/:id/sessions', authenticate, ctrl.getUserSessions);
router.delete('/:id/sessions', authenticate, ctrl.revokeUserSessions);
router.patch('/:id/password', authenticate, validate(changePasswordSnakeSchema), ctrl.changePassword);

export default router;
*/