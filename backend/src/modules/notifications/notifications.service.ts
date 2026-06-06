/**
 * backend/src/modules/notifications/notifications.service.ts
 *
 * Notification delivery layer — four channels:
 *   1. In-app  — persisted to `notifications` table, broadcast via Supabase
 *                Realtime so the client badge updates instantly.
 *   2. Email   — delegated to src/email/send.ts (Resend).
 *   3. Web Push — VAPID-based push via the `web-push` npm package.
 *                 Works on desktops and Android Chrome.
 *                 Gracefully disabled when VAPID keys are absent from env.
 *   4. FCM     — Firebase Cloud Messaging via `firebase-admin`.
 *                 Required for iOS Safari and native Android apps.
 *                 Gracefully disabled when FIREBASE_PROJECT_ID is absent.
 *
 * sendPush() runs BOTH Web Push and FCM in parallel via Promise.allSettled so
 * each user gets the notification on whichever channel(s) they're subscribed to.
 *
 * ─── push_subscriptions table ───────────────────────────────────────────────
 *
 *   The same table stores both Web Push and FCM tokens, differentiated by
 *   the `subscription_data.type` field:
 *
 *   Web Push row:
 *     subscription_data = {
 *       endpoint: "https://fcm.googleapis.com/fcm/send/...",
 *       keys: { p256dh: "...", auth: "..." }
 *     }
 *     device_type = 'web'
 *
 *   FCM row:
 *     subscription_data = { type: "fcm", token: "<fcm-token>" }
 *     device_type = 'mobile'
 *
 *   CREATE TABLE IF NOT EXISTS push_subscriptions (
 *     id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *     subscription_data JSONB       NOT NULL,
 *     device_type      VARCHAR(20)  NOT NULL DEFAULT 'web',
 *     created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
 *     UNIQUE (user_id, (subscription_data->>'endpoint')),
 *     UNIQUE (user_id, (subscription_data->>'token'))
 *   );
 *
 *   CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
 *     ON push_subscriptions (user_id);
 */

import { supabaseAdmin } from '../../config/supabase';
import { sendEmail as sendEmailUtil } from '../../email/send';
import { paginate } from '../../utils/pagination';
import {
  isWebPushEnabled,
  sendWebPushNotification,
  type PushPayload,
} from '../../utils/push';
import {
  isFCMEnabled,
  sendFCMNotification,
} from '../../utils/fcm';
import type { PushSubscription } from 'web-push';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape stored in the `subscription_data` JSONB column for Web Push. */
interface StoredWebSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
}

/** Shape stored in the `subscription_data` JSONB column for FCM. */
interface StoredFCMSubscription {
  type: 'fcm';
  token: string;
}

type StoredSubscription = StoredWebSubscription | StoredFCMSubscription;

/** Row returned from `push_subscriptions`. */
interface PushSubscriptionRow {
  id: string;
  user_id: string;
  subscription_data: StoredSubscription;
  device_type: string;
}

// ─── FCM token storage ────────────────────────────────────────────────────────

/**
 * Stores (or updates) an FCM device token for a user.
 *
 * Tokens are upserted so re-registering from the same device replaces the
 * old token rather than creating a duplicate row.
 *
 * @param userId   - Authenticated user UUID
 * @param fcmToken - FCM registration token from the Firebase SDK on the client
 */
export async function storeFCMToken(
  userId: string,
  fcmToken: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        subscription_data: { type: 'fcm', token: fcmToken },
        device_type: 'mobile',
        created_at: new Date().toISOString(),
      },
      {
        // Conflict on (user_id, token) — update the row so the token stays fresh
        onConflict: 'user_id, subscription_data->>token',
        ignoreDuplicates: false,
      },
    );

  if (error) {
    // Surface a descriptive message when the table isn't set up yet
    if (
      error.message?.includes('there is no unique or exclusion constraint') ||
      error.message?.includes('Could not find')
    ) {
      throw Object.assign(
        new Error(
          'push_subscriptions table not found or missing UNIQUE constraint on token. ' +
          'Run the CREATE TABLE / ALTER TABLE statements in notifications.service.ts.',
        ),
        { statusCode: 503 },
      );
    }
    throw error;
  }
}

// ─── Web Push subscription management ────────────────────────────────────────

/**
 * Stores (or replaces) a browser Web Push subscription for a user.
 *
 * The UNIQUE constraint on (user_id, endpoint) makes this idempotent.
 *
 * @param userId           - Authenticated user's UUID
 * @param subscriptionData - Raw object from `PushSubscription.toJSON()`
 * @param deviceType       - 'web' | 'android' | 'ios' (default: 'web')
 */
export async function registerPushSubscription(
  userId: string,
  subscriptionData: Record<string, unknown>,
  deviceType: string = 'web',
): Promise<{ success: true; id: string }> {
  // Validate minimal shape — we need at least endpoint + keys
  const endpoint = subscriptionData['endpoint'];
  const keys = subscriptionData['keys'] as Record<string, string> | undefined;

  if (
    typeof endpoint !== 'string' ||
    !endpoint.startsWith('https://') ||
    !keys?.p256dh ||
    !keys?.auth
  ) {
    throw Object.assign(new Error('Invalid push subscription object'), { statusCode: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        subscription_data: subscriptionData,
        device_type: deviceType,
        created_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id, subscription_data->>endpoint',
        ignoreDuplicates: false,
      },
    )
    .select('id')
    .single();

  if (error) {
    if (
      error.message?.includes('there is no unique or exclusion constraint') ||
      error.message?.includes('Could not find')
    ) {
      throw Object.assign(
        new Error(
          'push_subscriptions table not found. ' +
          'Run the CREATE TABLE statement in notifications.service.ts first.',
        ),
        { statusCode: 503 },
      );
    }
    throw error;
  }

  return { success: true, id: data.id };
}

/**
 * Removes a specific Web Push subscription endpoint for a user.
 * Called when the user explicitly opts out of push, or on 410/404 push error.
 */
export async function removePushSubscriptionByEndpoint(
  userId: string,
  endpoint: string,
): Promise<void> {
  await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('subscription_data->>endpoint', endpoint);
}

// ─── Send push notification (Web Push + FCM in parallel) ─────────────────────

/**
 * Sends a push notification to all registered endpoints for one user.
 *
 * Tries BOTH channels concurrently:
 *   - Web Push (VAPID) for browser/desktop subscriptions
 *   - FCM for mobile device tokens (iOS + Android)
 *
 * - Gracefully degrades when either channel is not configured.
 * - Stale subscriptions are deleted automatically.
 * - Never throws — push failures must not break order flows or payments.
 *
 * @param userId  - Target user UUID
 * @param title   - Notification title (shown in OS notification tray)
 * @param body    - Notification body text
 * @param data    - Optional key/value payload for the service worker / app
 */
export async function sendPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const webPushEnabled = isWebPushEnabled();
  const fcmEnabled = isFCMEnabled();

  if (!webPushEnabled && !fcmEnabled) {
    console.warn(
      `[push] No push channel configured — notification to user ${userId} skipped. ` +
      'Set VAPID_* or FIREBASE_* env vars to enable push.',
    );
    return;
  }

  // Fetch all active subscriptions for this user (both web and FCM)
  const { data: rows, error: fetchError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, subscription_data, device_type')
    .eq('user_id', userId)
    .returns<PushSubscriptionRow[]>();

  if (fetchError) {
    console.error(`[push] Failed to fetch subscriptions for user ${userId}:`, fetchError);
    return;
  }

  if (!rows || rows.length === 0) return;

  // Separate rows into Web Push and FCM buckets
  const webRows = rows.filter(
    (r) => !('type' in r.subscription_data) || (r.subscription_data as any).type !== 'fcm',
  );
  const fcmRows = rows.filter(
    (r) => 'type' in r.subscription_data && (r.subscription_data as any).type === 'fcm',
  );

  const payload: PushPayload = {
    title,
    body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: `restaurant-os-${Date.now()}`,
    ...(data ? { data } : {}),
  };

  // Stringify data values for FCM (FCM only accepts string values in the data map)
  const fcmData: Record<string, string> | undefined = data
    ? Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)]),
      )
    : undefined;

  const staleWebIds: string[] = [];

  // Build Web Push promises
  const webPushPromises: Promise<void>[] = webPushEnabled
    ? webRows.map(async (row) => {
        const subscription = row.subscription_data as unknown as PushSubscription;
        const result = await sendWebPushNotification(subscription, payload);
        if (result === 'gone') {
          staleWebIds.push(row.id);
          console.info(`[push] Web Push subscription ${row.id} returned 410/404 — marking for removal.`);
        }
      })
    : [];

  // Build FCM promises
  const fcmPromises: Promise<void>[] = fcmEnabled
    ? fcmRows.map(async (row) => {
        const stored = row.subscription_data as StoredFCMSubscription;
        await sendFCMNotification(stored.token, title, body, fcmData);
      })
    : [];

  // Fire all channels in parallel
  await Promise.allSettled([...webPushPromises, ...fcmPromises]);

  // Clean up stale Web Push subscriptions in one batch
  if (staleWebIds.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .in('id', staleWebIds);

    if (deleteError) {
      console.error('[push] Failed to delete stale Web Push subscriptions:', deleteError);
    }
  }
}

/**
 * Sends a push notification to every staff member with a given role
 * in a given branch. Useful for broadcast events like "new order arrived".
 *
 * @param branchId - Branch UUID to scope the role search
 * @param role     - Staff role string (e.g. 'chef', 'waiter', 'manager')
 * @param title    - Notification title
 * @param body     - Notification body
 * @param data     - Optional extra payload for the service worker / app
 */
export async function sendPushToRole(
  branchId: string,
  role: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('branch_id', branchId)
    .eq('role', role)
    .eq('is_active', true);

  if (error) {
    console.error(`[push] Failed to fetch users for role ${role} in branch ${branchId}:`, error);
    return;
  }

  if (!users || users.length === 0) return;

  // Push to all matched users in parallel — failures are swallowed inside sendPush()
  await Promise.allSettled(
    users.map((u: { id: string }) => sendPush(u.id, title, body, data)),
  );
}

// ─── Email notification ───────────────────────────────────────────────────────

export async function sendEmailNotification(
  userId: string,
  templateName: string,
  templateData: Record<string, unknown>,
): Promise<void> {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (error || !user?.email) return;

  await sendEmailUtil({
    to: user.email,
    templateName,
    data: templateData as Record<string, any>,
  });
}

// ─── In-app notification ──────────────────────────────────────────────────────

export async function createInApp(
  userId: string,
  type:
    | 'order_update'
    | 'booking_update'
    | 'payment'
    | 'queue_update'
    | 'system_alert'
    | 'promotional',
  title: string,
  body: string,
  referenceId?: string,
  referenceType?: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      body,
      reference_id: referenceId ?? null,
      reference_type: referenceType ?? null,
      is_read: false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  await supabaseAdmin.channel(`user:${userId}`).send({
    type: 'broadcast',
    event: 'new_notification',
    payload: data,
  });
}

// ─── Get notifications for user ───────────────────────────────────────────────

export async function getForUser(userId: string, page: number, limit: number) {
  const { from, to } = paginate(page, limit);
  const { data, error, count } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data, count };
}

// ─── Mark single notification read ────────────────────────────────────────────

export async function markRead(id: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Mark all notifications read ─────────────────────────────────────────────

export async function markAllRead(userId: string) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

// ─── Delete a single notification ────────────────────────────────────────────

/**
 * Hard-deletes a single notification row, scoped to the requesting user so
 * one user can never delete another user's notifications.
 */
export async function deleteNotification(id: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
}

// ─── Device token management (legacy FCM stub — kept for compatibility) ───────

export async function registerDevice(
  userId: string,
  token: string,
  platform?: string,
) {
  const { data, error } = await supabaseAdmin
    .from('device_tokens')
    .upsert(
      {
        user_id: userId,
        token,
        platform: platform ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    )
    .select()
    .single();

  if (error) {
    const msg = String(error.message ?? '');
    if (msg.includes('device_tokens') || msg.includes('Could not find')) {
      return { user_id: userId, token, platform: platform ?? null, stub: true as const };
    }
    throw error;
  }
  return data;
}

export async function removeDevice(userId: string, token: string) {
  const { error } = await supabaseAdmin
    .from('device_tokens')
    .delete()
    .eq('token', token)
    .eq('user_id', userId);

  if (error) {
    const msg = String(error.message ?? '');
    if (msg.includes('device_tokens') || msg.includes('Could not find')) return;
    throw error;
  }
}
