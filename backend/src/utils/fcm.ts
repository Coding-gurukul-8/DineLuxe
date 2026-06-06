/**
 * backend/src/utils/fcm.ts
 *
 * Firebase Cloud Messaging (FCM) — server-side send helpers.
 *
 * Uses the Firebase Admin SDK to send push notifications to mobile devices
 * (iOS via APNs + Android). This complements the existing Web Push / VAPID
 * channel (push.ts) which only works on desktops and Android Chrome.
 *
 * Strategy: BOTH channels are used in parallel.
 *   • FCM  → iOS + Android native apps / PWA on mobile
 *   • Web Push (VAPID) → Desktop browsers + Android Chrome
 *
 * ─── Install ─────────────────────────────────────────────────────────────────
 *   npm install firebase-admin
 *
 * ─── Firebase setup (one-time) ───────────────────────────────────────────────
 *   1. Go to Firebase Console → Project Settings → Service Accounts
 *   2. Click "Generate New Private Key" → download JSON
 *   3. Copy the three fields into your .env:
 *        FIREBASE_PROJECT_ID=...
 *        FIREBASE_CLIENT_EMAIL=...
 *        FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *
 * ─── Graceful degradation ────────────────────────────────────────────────────
 *   If FIREBASE_PROJECT_ID is absent, all functions become silent no-ops.
 *   The rest of the application (email, Web Push, in-app) continues to work.
 */

import * as admin from 'firebase-admin';
import { supabaseAdmin } from '../config/supabase';

// ─── Singleton initialisation ─────────────────────────────────────────────────

let initialized = false;

/**
 * Lazily initialise the Firebase Admin SDK using service account credentials
 * from environment variables. Safe to call many times — only runs once.
 */
function initFCM(): void {
  if (initialized || !process.env.FIREBASE_PROJECT_ID) return;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // The private key is stored with literal \n in the env var; restore real newlines
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });

  initialized = true;
}

/**
 * Returns true when FCM is properly configured and ready to send.
 */
export function isFCMEnabled(): boolean {
  initFCM();
  return admin.apps.length > 0;
}

// ─── Single-device send ───────────────────────────────────────────────────────

/**
 * Sends an FCM push notification to a single device token.
 *
 * - Configures high-priority delivery on both Android and iOS.
 * - Automatically removes stale tokens (registration-token-not-registered).
 * - Never throws — push failures must not break order / payment flows.
 *
 * @param fcmToken - Device registration token obtained from Firebase SDK on client
 * @param title    - Notification title shown in the OS tray
 * @param body     - Notification body text
 * @param data     - Optional string key/value payload forwarded to the app
 */
export async function sendFCMNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  initFCM();

  if (!isFCMEnabled()) {
    console.warn('[FCM] Firebase not configured — skipping push notification.');
    return;
  }

  const message: admin.messaging.Message = {
    token: fcmToken,
    notification: { title, body },
    data: data ?? {},
    // ── Android ────────────────────────────────────────────────────────────────
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'restaurant_alerts',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
    },
    // ── iOS / APNs ─────────────────────────────────────────────────────────────
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
          contentAvailable: true,
        },
      },
    },
  };

  try {
    await admin.messaging().send(message);
  } catch (err: any) {
    if (err.code === 'messaging/registration-token-not-registered') {
      // Token is stale — silently remove it so we don't keep sending to dead tokens
      await removeStaleToken(fcmToken);
    }
    console.error('[FCM] Send failed:', err.message);
  }
}

// ─── Multi-device send ────────────────────────────────────────────────────────

/**
 * Sends an FCM notification to multiple device tokens in batches of 500
 * (the FCM multicast limit). Tokens that are no longer registered are cleaned
 * up automatically after each batch.
 *
 * @param fcmTokens - Array of device registration tokens
 * @param title     - Notification title
 * @param body      - Notification body
 * @param data      - Optional string key/value payload
 */
export async function sendFCMToMultiple(
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (!fcmTokens.length) return;

  initFCM();

  if (!isFCMEnabled()) {
    console.warn('[FCM] Firebase not configured — skipping multicast push.');
    return;
  }

  const FCM_BATCH_LIMIT = 500;

  // Process in batches — FCM rejects more than 500 tokens per multicast call
  for (let i = 0; i < fcmTokens.length; i += FCM_BATCH_LIMIT) {
    const batch = fcmTokens.slice(i, i + FCM_BATCH_LIMIT);

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: data ?? {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'restaurant_alerts',
          },
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { sound: 'default', badge: 1, contentAvailable: true } },
        },
      });

      // Collect stale tokens from failed entries
      const staleTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (
          !resp.success &&
          resp.error?.code === 'messaging/registration-token-not-registered'
        ) {
          staleTokens.push(batch[idx]);
        }
      });

      // Remove all stale tokens in parallel (best-effort)
      if (staleTokens.length > 0) {
        await Promise.allSettled(staleTokens.map(removeStaleToken));
      }
    } catch (err: any) {
      console.error('[FCM] Multicast send failed:', err.message);
    }
  }
}

// ─── Stale token cleanup ──────────────────────────────────────────────────────

/**
 * Removes a stale / expired FCM token from the push_subscriptions table.
 *
 * FCM tokens are stored inside subscription_data JSONB with shape:
 *   { type: 'fcm', token: '<token>' }
 *
 * We match on the `token` field inside that JSONB column.
 * Errors are swallowed — cleanup is best-effort.
 */
export async function removeStaleToken(token: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('subscription_data->>token', token)
      .eq('subscription_data->>type', 'fcm');
  } catch (err: any) {
    console.error('[FCM] Failed to remove stale token:', err.message);
  }
}
