import { Request, Response, NextFunction } from 'express';
import * as notificationsService from './notifications.service';
import { success, error } from '../../utils/response';
import { getVapidPublicKey } from '../../utils/push';

// ─── In-app notifications ─────────────────────────────────────────────────────

export async function getNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await notificationsService.getForUser(req.user!.id, page, limit);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function markRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = await notificationsService.markRead(req.params.id, req.user!.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await notificationsService.markAllRead(req.user!.id);
    res.json(success({ message: 'All notifications marked as read' }));
  } catch (err) {
    next(err);
  }
}

// ─── Legacy FCM device token ──────────────────────────────────────────────────

export async function registerDevice(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { token, platform } = req.body;
    const data = await notificationsService.registerDevice(req.user!.id, token, platform);
    res.status(201).json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function removeDevice(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await notificationsService.removeDevice(req.user!.id, req.params.token);
    res.json(success({ message: 'Device token removed' }));
  } catch (err) {
    next(err);
  }
}

// ─── Web Push: VAPID public key ───────────────────────────────────────────────

/**
 * GET /notifications/push/vapid-key
 *
 * Public endpoint — no authentication required.
 * The client needs the VAPID public key BEFORE the user logs in (e.g. on the
 * landing page) so they can call PushManager.subscribe(). Exposing this key
 * is safe: it is a public key by design (analogous to a TLS certificate).
 *
 * Response:
 *   200 { success: true, data: { vapidPublicKey: "BF..." } }
 *   503 { success: false, error: { code: "PUSH_NOT_CONFIGURED", ... } }
 */
export async function getVapidKey(
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const key = getVapidPublicKey();

  if (!key) {
    res.status(503).json(
      error(
        'PUSH_NOT_CONFIGURED',
        'Push notifications are not enabled on this server.',
      ),
    );
    return;
  }

  res.json(success({ vapidPublicKey: key }));
}

// ─── Web Push: subscribe ──────────────────────────────────────────────────────

/**
 * POST /notifications/push/subscribe
 *
 * Authenticated. Stores the browser PushSubscription for the current user.
 *
 * Body (validated by registerPushSubscriptionSchema):
 *   {
 *     "subscription": {
 *       "endpoint": "https://fcm.googleapis.com/fcm/send/...",
 *       "keys": { "p256dh": "...", "auth": "..." }
 *     },
 *     "deviceType": "web"   // optional
 *   }
 *
 * Response:
 *   201 { success: true, data: { success: true, id: "<uuid>" } }
 */
export async function subscribePush(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { subscription, deviceType } = req.body as {
      subscription: Record<string, unknown>;
      deviceType?: string;
    };

    const result = await notificationsService.registerPushSubscription(
      req.user!.id,
      subscription,
      deviceType,
    );

    res.status(201).json(success(result, 'Push subscription registered'));
  } catch (err) {
    next(err);
  }
}

// ─── Web Push: unsubscribe ────────────────────────────────────────────────────

/**
 * DELETE /notifications/push/subscribe
 *
 * Authenticated. Removes the browser PushSubscription for the current user
 * identified by its endpoint URL.
 *
 * Body:
 *   { "endpoint": "https://..." }
 */
export async function unsubscribePush(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { endpoint } = req.body as { endpoint: string };

    if (!endpoint || typeof endpoint !== 'string') {
      res.status(400).json(error('VALIDATION_ERROR', 'endpoint is required'));
      return;
    }

    await notificationsService.removePushSubscriptionByEndpoint(
      req.user!.id,
      endpoint,
    );

    res.json(success({ message: 'Push subscription removed' }));
  } catch (err) {
    next(err);
  }
}