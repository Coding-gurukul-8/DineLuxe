/**
 * backend/src/modules/notifications/notifications.service.ts
 *
 * Notification delivery layer — three channels:
 *   1. In-app  — persisted to `notifications` table, broadcast via Supabase
 *                Realtime so the client badge updates instantly.
 *   2. Email   — delegated to src/email/send.ts (Resend).
 *   3. Web Push — VAPID-based push via the `web-push` npm package.
 *                 Gracefully disabled when VAPID keys are absent from env.
 *
 * ─── push_subscriptions table (run once in Supabase SQL editor) ─────────────
 *
 *   CREATE TABLE IF NOT EXISTS push_subscriptions (
 *     id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *     subscription_data JSONB       NOT NULL,
 *     device_type      VARCHAR(20)  NOT NULL DEFAULT 'web',   -- 'web' | 'android' | 'ios'
 *     created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
 *     -- One row per (user, endpoint). Duplicate subscribe calls are idempotent.
 *     UNIQUE (user_id, (subscription_data->>'endpoint'))
 *   );
 *
 *   -- Lookup subscriptions by user quickly
 *   CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
 *     ON push_subscriptions (user_id);
 *
 * ─── Frontend integration overview ──────────────────────────────────────────
 *
 *   // 1. Register a service worker (must be at /public/sw.js)
 *   const registration = await navigator.serviceWorker.register('/sw.js');
 *   await navigator.serviceWorker.ready;
 *
 *   // 2. Fetch the VAPID public key from your API
 *   const { data } = await apiClient.get('/notifications/push/vapid-key');
 *   const vapidPublicKey = data.vapidPublicKey;           // base64url string
 *
 *   // 3. Subscribe via PushManager
 *   const subscription = await registration.pushManager.subscribe({
 *     userVisibleOnly: true,
 *     applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
 *   });
 *
 *   // 4. Send the subscription object to the backend
 *   await apiClient.post('/notifications/push/subscribe', {
 *     subscription: subscription.toJSON(),
 *     deviceType: 'web',
 *   });
 *
 *   // Helper used in step 3:
 *   function urlBase64ToUint8Array(base64String) {
 *     const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
 *     const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
 *     const rawData = atob(base64);
 *     return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
 *   }
 */

import { supabaseAdmin } from '../../config/supabase';
import { sendEmail as sendEmailUtil } from '../../email/send';
import { paginate } from '../../utils/pagination';
import {
  isWebPushEnabled,
  sendWebPushNotification,
  type PushPayload,
} from '../../utils/push';
import type { PushSubscription } from 'web-push';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape stored in the `subscription_data` JSONB column. */
interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
}

/** Row returned from `push_subscriptions`. */
interface PushSubscriptionRow {
  id: string;
  user_id: string;
  subscription_data: StoredSubscription;
  device_type: string;
}

// ─── Push subscription management ────────────────────────────────────────────

/**
 * Stores (or replaces) a browser push subscription for a user.
 *
 * The UNIQUE constraint on (user_id, endpoint) makes this idempotent:
 * calling subscribe again from the same browser re-uses or updates the row.
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
        // Conflict target matches the UNIQUE constraint
        onConflict: 'user_id, subscription_data->>endpoint',
        ignoreDuplicates: false, // update on conflict so we get the id back
      },
    )
    .select('id')
    .single();

  if (error) {
    // Supabase/PostgREST returns a code when the upsert column expression
    // isn't a plain column name — fallback to a plain insert + ignore duplicate
    if (
      error.message?.includes('there is no unique or exclusion constraint') ||
      error.message?.includes('Could not find')
    ) {
      // Table likely missing — surface a clear message
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
 * Removes a specific push subscription endpoint for a user.
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

// ─── Send push notification ───────────────────────────────────────────────────

/**
 * Sends a Web Push notification to all registered browser endpoints for one user.
 *
 * - If VAPID keys are not configured, logs a warning and returns silently
 *   (graceful degradation — email + in-app still work).
 * - Stale subscriptions (HTTP 410 / 404 from the push service) are deleted
 *   automatically so the table doesn't accumulate dead rows.
 * - Never throws — push failures must not break order flows, payment
 *   confirmations, or any other caller.
 *
 * @param userId  - Target user UUID
 * @param title   - Notification title (shown in OS notification tray)
 * @param body    - Notification body text
 * @param data    - Optional key/value payload available in the service worker
 */
export async function sendPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!isWebPushEnabled()) {
    console.warn(
      `[push] VAPID keys not configured — push to user ${userId} skipped. ` +
      'Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT_EMAIL in .env to enable.',
    );
    return;
  }

  // Fetch all active subscriptions for this user
  const { data: rows, error: fetchError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, subscription_data, device_type')
    .eq('user_id', userId)
    .returns<PushSubscriptionRow[]>();

  if (fetchError) {
    console.error(`[push] Failed to fetch subscriptions for user ${userId}:`, fetchError);
    return;
  }

  if (!rows || rows.length === 0) {
    // User has no registered push endpoints — nothing to do
    return;
  }

  const payload: PushPayload = {
    title,
    body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: `restaurant-os-${Date.now()}`,
    ...(data ? { data } : {}),
  };

  // Fan out to all endpoints (usually just 1 per user, occasionally more
  // if they're logged in on multiple devices/browsers)
  const staleIds: string[] = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      const subscription = row.subscription_data as unknown as PushSubscription;
      const result = await sendWebPushNotification(subscription, payload);

      if (result === 'gone') {
        // Endpoint is expired — queue for deletion
        staleIds.push(row.id);
        console.info(
          `[push] Subscription ${row.id} returned 410/404 — marked for removal.`,
        );
      }
    }),
  );

  // Clean up stale subscriptions in one batch
  if (staleIds.length > 0) {
    const { error: deleteError } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .in('id', staleIds);

    if (deleteError) {
      console.error('[push] Failed to delete stale subscriptions:', deleteError);
    }
  }
}

/**
 * Sends a Web Push notification to every staff member with a given role
 * in a given branch. Useful for broadcast events like "new order arrived".
 *
 * Fetches the user list from the `users` table (role + branch_id columns)
 * then fans out to sendPush() for each matching user.
 *
 * @param branchId - Branch UUID to scope the role search
 * @param role     - Staff role string (e.g. 'chef', 'waiter', 'manager')
 * @param title    - Notification title
 * @param body     - Notification body
 * @param data     - Optional extra payload for the service worker
 */
export async function sendPushToRole(
  branchId: string,
  role: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!isWebPushEnabled()) {
    console.warn(`[push] VAPID keys not configured — role broadcast (${role}@${branchId}) skipped.`);
    return;
  }

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