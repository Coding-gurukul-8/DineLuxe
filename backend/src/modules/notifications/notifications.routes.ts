/**
 * backend/src/modules/notifications/notifications.routes.ts
 *
 * Route order matters — Express matches top-to-bottom:
 *   1. Public route (vapid-key) registered BEFORE the authenticate middleware
 *   2. All push/subscribe routes are after authenticate
 *   3. Literal paths (register-device, read-all, push/*) before /:id wildcards
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  getNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  registerDevice,
  removeDevice,
  getVapidKey,
  subscribePush,
  unsubscribePush,
  storeFCMToken,
} from './notifications.controller';
import {
  registerDeviceSchema,
  registerPushSubscriptionSchema,
  storeFCMTokenSchema,
} from './notifications.schema';

const router: import('express').Router = Router();

// ─── Public routes (no auth) ─────────────────────────────────────────────────

/**
 * GET /notifications/push/vapid-key
 *
 * Returns the VAPID public key so the browser can create a PushSubscription.
 * Must be accessible without a token because the client needs this key even
 * before the user has authenticated (e.g. on the login page or during PWA
 * install).
 *
 * Returns 503 when VAPID keys are not configured on the server.
 */
router.get('/push/vapid-key', getVapidKey);

// ─── Authenticated routes ────────────────────────────────────────────────────

router.use(authenticate);

// GET /notifications
router.get('/', getNotifications);

// ── Web Push subscription management ─────────────────────────────────────────
//
// Declared BEFORE /:id/read and other dynamic segments so Express never
// accidentally treats "push" as a notification ID.

/**
 * POST /notifications/push/subscribe
 *
 * Saves a browser PushSubscription (endpoint + keys) for the authenticated
 * user. Call this after `registration.pushManager.subscribe(...)` succeeds
 * on the client.
 *
 * Body: { subscription: { endpoint, keys: { p256dh, auth } }, deviceType? }
 */
router.post(
  '/push/subscribe',
  validate(registerPushSubscriptionSchema),
  subscribePush,
);

/**
 * DELETE /notifications/push/subscribe
 *
 * Removes the push subscription identified by its endpoint URL.
 * Call this when the user explicitly opts out of push notifications.
 *
 * Body: { endpoint: "https://..." }
 */
router.delete('/push/subscribe', unsubscribePush);

// ── FCM token registration ────────────────────────────────────────────────────

/**
 * POST /notifications/push/fcm-token
 *
 * Saves an FCM device registration token for the authenticated user.
 * Called by the useFCMToken hook after Firebase SDK returns a token.
 *
 * Body: { fcm_token: string }
 * Response: { success: true }
 */
router.post(
  '/push/fcm-token',
  validate(storeFCMTokenSchema),
  storeFCMToken,
);

// ── Legacy FCM device token (kept for backwards compatibility) ────────────────

router.post('/register-device', validate(registerDeviceSchema), registerDevice);
router.delete('/device/:token', removeDevice);

// ── In-app notification actions ───────────────────────────────────────────────

// PATCH /notifications/read-all  ← MUST be before /:id/read
router.patch('/read-all', markAllRead);

// PATCH /notifications/:id/read
router.patch('/:id/read', markRead);

// DELETE /notifications/:id
router.delete('/:id', deleteNotification);

export default router;
