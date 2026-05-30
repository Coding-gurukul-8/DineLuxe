/**
 * backend/src/utils/push.ts
 *
 * Web Push VAPID initialisation and low-level send helper.
 *
 * This module is the single place that touches the `web-push` package.
 * All other files (notifications.service.ts) import the typed wrappers
 * exported here rather than importing web-push directly, keeping the
 * integration surface small and easy to swap.
 *
 * ─── Install ────────────────────────────────────────────────────────────────
 *   npm install web-push
 *   npm install @types/web-push --save-dev
 *
 * ─── Generate VAPID keys (one-time, run from backend root) ──────────────────
 *   node -e "const wp = require('web-push'); console.log(wp.generateVAPIDKeys())"
 *   # or with npx:
 *   npx web-push generate-vapid-keys
 *
 *   Copy the output into your .env (VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY).
 *
 * ─── Graceful degradation ───────────────────────────────────────────────────
 *   If the VAPID env vars are absent, isWebPushEnabled() returns false and
 *   every call to sendWebPushNotification() is a silent no-op — the rest of
 *   the application continues to work without push.
 */

import webpush, { PushSubscription, SendResult } from 'web-push';
import { config } from '../config/env';

// ─── VAPID initialisation ─────────────────────────────────────────────────────

let _initialised = false;

/**
 * Lazily configure web-push with the VAPID keys from env.
 * Called once on first use, not at module load time, so missing keys never
 * crash the process during startup — they only disable push silently.
 */
function ensureInitialised(): boolean {
  if (_initialised) return true;

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL } = config;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_CONTACT_EMAIL) {
    return false;
  }

  webpush.setVapidDetails(
    `mailto:${VAPID_CONTACT_EMAIL}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );

  _initialised = true;
  return true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true when VAPID keys are present and web-push is ready.
 * Use this guard before any push attempt.
 */
export function isWebPushEnabled(): boolean {
  return ensureInitialised();
}

/**
 * Returns the VAPID public key string, or null when push is not configured.
 * The frontend needs this key to create a PushSubscription via the browser
 * PushManager API.
 */
export function getVapidPublicKey(): string | null {
  return config.VAPID_PUBLIC_KEY ?? null;
}

/**
 * Payload shape sent inside the push notification.
 */
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;               // deduplication key — same tag replaces old notif
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

/**
 * Sends a single Web Push notification to one subscription endpoint.
 *
 * Returns 'sent' on success, 'gone' when the endpoint is stale (caller should
 * delete it), or 'error' for any other failure.
 *
 * Never throws — callers iterate over multiple subscriptions and should not
 * abort the loop on a single failure.
 */
export async function sendWebPushNotification(
  subscription: PushSubscription,
  payload: PushPayload,
): Promise<'sent' | 'gone' | 'error'> {
  if (!ensureInitialised()) {
    console.warn('[push] VAPID keys not configured — push notification skipped.');
    return 'error';
  }

  const body: PushPayload = {
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    ...payload,
  };

  try {
    await webpush.sendNotification(subscription, JSON.stringify(body), {
      TTL: 60 * 60, // 1 hour — message expires after 1h if device is offline
    }) as SendResult;
    return 'sent';
  } catch (err: unknown) {
    // 410 Gone / 404 Not Found — subscription is no longer valid
    if (isExpiredSubscriptionError(err)) {
      return 'gone';
    }
    console.error('[push] sendNotification failed:', err);
    return 'error';
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isExpiredSubscriptionError(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const statusCode = (err as Record<string, unknown>).statusCode;
    return statusCode === 410 || statusCode === 404;
  }
  return false;
}