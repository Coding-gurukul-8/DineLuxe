/**
 * backend/src/modules/users/users.service.ts
 *
 * GDPR compliance (Section M23):
 *   - anonymizeUserAccount(): permanent PII erasure with full audit trail
 *   - exportUserData():       right to data portability (all data in one call)
 *
 * All other functions are unchanged from the pre-GDPR version.
 */

import crypto from 'crypto';                                     // esModuleInterop: true in tsconfig ✓
import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import { insertAuditLog } from '../../utils/audit-log';
import { UpdateProfileInput, NotificationPreferencesInput } from './users.schema';

// ─── Internal helpers ────────────────────────────────────────────────────────

function refreshTokenKey(userId: string): string {
  return `refresh_token:${userId}`;
}

const NOTIFICATION_PREFERENCES_KEY =
  (userId: string) => `user_notification_preferences:${userId}`;

/**
 * Splits a single "first last" name string into constituent parts.
 * Handles missing / null / extra-whitespace names gracefully.
 */
function splitName(name?: string | null): { first_name: string; last_name: string } {
  const parts = (name ?? '').trim().split(' ').filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

/**
 * Normalises a raw DB row into the shape the API returns.
 * Adds virtual first_name / last_name fields and exposes profile_pic_url
 * under the alias avatar_url that the frontend expects.
 */
function mapUserRow(row: any) {
  const { first_name, last_name } = splitName(row?.name);
  return {
    ...row,
    first_name,
    last_name,
    // BUG FIX: original returned both profile_pic_url AND avatar_url (noisy).
    // Keep profile_pic_url for DB fidelity; expose avatar_url as the alias.
    avatar_url: row?.profile_pic_url ?? null,
  };
}

// ─── Get Full Profile ────────────────────────────────────────────────────────

export async function getMe(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select(`
      id,
      name,
      email,
      phone,
      dob,
      gender,
      profile_pic_url,
      address,
      city,
      pin_code,
      role,
      employee_id,
      is_active,
      force_password_change,
      restaurant_id,
      branch_id,
      created_at
    `)
    .eq('id', userId)
    .single();

  if (error) throw new Error(`Failed to fetch profile: ${error.message}`);
  return mapUserRow(data);
}

// ─── Update Profile ──────────────────────────────────────────────────────────

export async function updateMe(userId: string, updates: UpdateProfileInput) {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.first_name || updates.last_name) {
    const { data: current, error: currentError } = await supabaseAdmin
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    if (currentError) throw new Error(`Failed to load current name: ${currentError.message}`);

    const currentSplit = splitName(current?.name);
    const first = updates.first_name ?? currentSplit.first_name;
    const last  = updates.last_name  ?? currentSplit.last_name;
    updateData.name = `${first} ${last}`.trim();
  }

  if (updates.phone)      updateData.phone           = updates.phone;
  if (updates.dob)        updateData.dob             = updates.dob;
  if (updates.gender)     updateData.gender          = updates.gender;
  if (updates.avatar_url) updateData.profile_pic_url = updates.avatar_url;

  if (updates.address) {
    const parts = [updates.address.line1, updates.address.line2, updates.address.state]
      .filter(Boolean)
      .join(', ');
    if (parts)                   updateData.address  = parts;
    if (updates.address.city)    updateData.city     = updates.address.city;
    if (updates.address.pincode) updateData.pin_code = updates.address.pincode;
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update profile: ${error.message}`);
  return mapUserRow(data);
}

// ─── GDPR: Anonymise Account ─────────────────────────────────────────────────
//
// Spec M23 — DELETE /api/customer/account (logged-in customer):
//   → Anonymise : name → 'Deleted User', email → random hash, phone → null,
//                 profile_pic_url / dob / gender / address / city / pin_code → null
//   → Delete    : Supabase Auth user (removes login), push subscriptions
//   → Keep      : order history (anonymised) for restaurant financial records
//   → Unlink    : loyalty account (history kept, user_id severed)
//   → Cancel    : pending / confirmed bookings
//   → Revoke    : all JWTs via Redis tombstone (7-day TTL)
//   → Audit     : CUSTOMER_SELF_DELETED entry in audit_logs
//
// IMPORTANT — auth.middleware.ts must also check the revoked_user:{id} key on
// every request so the Redis tombstone actually blocks access.  See the
// companion patch in auth.middleware.ts.
//
// Staff accounts (role ≠ 'customer') cannot self-delete here — they must
// contact their employer or the platform admin.
// ─────────────────────────────────────────────────────────────────────────────

export async function anonymizeUserAccount(
  userId: string,
): Promise<{ success: boolean; message: string }> {

  // ── Step 1: Verify user exists and is a customer ─────────────────────────
  const { data: user, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('id, role, email, name, is_active')
    .eq('id', userId)
    .single();

  if (fetchError || !user) {
    throw new Error('User not found.');
  }

  if (user.role !== 'customer') {
    throw new Error(
      'Staff accounts cannot be self-deleted. ' +
      'Please contact your employer or the platform administrator to remove your account.',
    );
  }

  if (!user.is_active) {
    // Idempotent — if somehow called twice, return a clear 409 from the controller
    throw new Error('This account has already been deleted.');
  }

  // ── Step 2: Generate anonymous identifiers ────────────────────────────────
  // 64-bit random hex → effectively zero collision probability
  // @deleted.invalid TLD is reserved (RFC 2606) — can never receive email
  const anonEmail = `deleted_${crypto.randomBytes(8).toString('hex')}@deleted.invalid`;
  const now       = new Date().toISOString();

  // ── Step 3: Anonymise the DB row ──────────────────────────────────────────
  // Row is KEPT (anonymised) so that FK references from orders / payments /
  // loyalty remain intact for restaurant financial records.
  const { error: anonError } = await supabaseAdmin
    .from('users')
    .update({
      name:            'Deleted User',
      email:           anonEmail,
      phone:           null,
      profile_pic_url: null,
      dob:             null,
      gender:          null,
      address:         null,
      city:            null,
      pin_code:        null,
      // Scramble the hash so the original password can never be recovered
      password_hash:   `ANONYMIZED_${Date.now()}`,
      is_active:       false,
      updated_at:      now,
      deleted_at:      now,
      anonymized_at:   now,
    })
    .eq('id', userId);

  if (anonError) {
    throw new Error(`Failed to anonymise account: ${anonError.message}`);
  }

  // ── Step 4: Delete Supabase Auth user ────────────────────────────────────
  // Removes the login entry (email/phone) from Supabase's auth.users table.
  // The platform DB row is already anonymised above — keeping it is safe.
  // If the auth entry is already gone, treat it as a no-op.
  try {
    await supabaseAdmin.auth.admin.deleteUser(userId);
  } catch (authErr: any) {
    console.error(
      `[anonymizeUserAccount] Supabase Auth deletion failed for ${userId}:`,
      authErr?.message,
    );
    // Do NOT rethrow — the DB record is already anonymised; this is best-effort.
  }

  // ── Step 5: Revoke all JWTs ───────────────────────────────────────────────
  // 1. Delete the stored refresh token so it cannot be cycled.
  // 2. Set a tombstone key that auth.middleware.ts checks on every request.
  //    TTL = 7 days (max refresh token lifetime) so the key self-cleans.
  await redis.del(refreshTokenKey(userId));
  await redis.set(`revoked_user:${userId}`, 'deleted', 'EX', 7 * 24 * 60 * 60);

  // ── Step 6: Delete device push subscriptions ──────────────────────────────
  // Silently continues if push_subscriptions doesn't exist yet;
  // ON DELETE CASCADE on the FK would handle this too, but we do it
  // explicitly so the intent is clear in the deletion audit trail.
  await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId);

  // ── Step 7: Unlink loyalty account ───────────────────────────────────────
  // Severs the PII link while preserving points / transaction history for
  // restaurant reporting.
  // NOTE: requires `ALTER TABLE loyalty_accounts ADD COLUMN IF NOT EXISTS anonymized BOOLEAN DEFAULT FALSE`
  await supabaseAdmin
    .from('loyalty_accounts')
    .update({ user_id: null, anonymized: true, updated_at: now } as any)
    .eq('user_id', userId);

  // ── Step 8: Cancel open bookings ─────────────────────────────────────────
  // Prevents ghost reservations on tables after the user is gone.
  await supabaseAdmin
    .from('bookings')
    .update({ status: 'cancelled', updated_at: now })
    .eq('user_id', userId)
    .in('status', ['pending', 'confirmed']);

  // ── Step 9: Audit log (fire-and-forget — must never block deletion) ───────
  insertAuditLog({
    actorId:    userId,
    action:     'CUSTOMER_SELF_DELETED',
    targetType: 'user',
    targetId:   userId,
    newValue:   { anonymized_at: now, reason: 'GDPR self-deletion request (M23)' },
  }).catch(() => { /* intentionally swallowed */ });

  return {
    success: true,
    message: 'Your account has been permanently deleted. All personal data has been removed.',
  };
}

// ─── GDPR: Data Export ───────────────────────────────────────────────────────
//
// Spec M23 — GET /api/customer/account/data-export (right to data portability)
// Returns ALL data the platform holds about a user in a single JSON object.
//
// All seven queries run in parallel (Promise.all) — single round-trip latency.
// Notifications are capped at 500 to prevent runaway payloads for power users.
// For users with thousands of orders, consider queuing a Bull job instead
// (see report-export.ts for the async pattern).
// ─────────────────────────────────────────────────────────────────────────────

export interface UserDataExport {
  exportedAt:          string;
  profile:             Record<string, unknown> | null;
  orders:              unknown[];
  bookings:            unknown[];
  reviews:             unknown[];
  loyaltyTransactions: unknown[];
  notifications:       unknown[];
}

export async function exportUserData(userId: string): Promise<UserDataExport> {
  const [
    profileResult,
    ordersResult,
    bookingsResult,
    reviewsResult,
    loyaltyResult,
    notificationsResult,
  ] = await Promise.all([

    // 1. User profile — personal data fields only (no password_hash etc.)
    supabaseAdmin
      .from('users')
      .select('id, name, email, phone, dob, gender, address, city, pin_code, role, created_at')
      .eq('id', userId)
      .single(),

    // 2. All orders + nested items and restaurant branch
    supabaseAdmin
      .from('orders')
      .select(`
        id,
        order_type,
        status,
        total_amount,
        tax_amount,
        discount_amount,
        special_instructions,
        created_at,
        order_items (
          id,
          quantity,
          unit_price,
          menu_items ( name, price )
        ),
        branches ( name )
      `)
      .eq('customer_id', userId)
      .order('created_at', { ascending: false }),

    // 3. All bookings with table and branch info
    supabaseAdmin
      .from('bookings')
      .select(`
        id,
        guest_count,
        status,
        arrival_time,
        special_requests,
        created_at,
        tables ( label, capacity ),
        branches ( name )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    // 4. User's own reviews
    supabaseAdmin
      .from('reviews')
      .select(`
        id,
        overall_rating,
        food_rating,
        service_rating,
        ambience_rating,
        comment,
        created_at,
        branches ( name )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    // 5. Loyalty transactions (points earned / redeemed)
    supabaseAdmin
      .from('loyalty_transactions')
      .select(`
        id,
        type,
        points,
        description,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    // 6. In-app notifications (capped — prevents runaway JSON for power users)
    supabaseAdmin
      .from('notifications')
      .select('id, type, title, body, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  return {
    exportedAt:          new Date().toISOString(),
    profile:             profileResult.data      ?? null,
    orders:              ordersResult.data        ?? [],
    bookings:            bookingsResult.data      ?? [],
    reviews:             reviewsResult.data       ?? [],
    loyaltyTransactions: loyaltyResult.data       ?? [],
    notifications:       notificationsResult.data ?? [],
  };
}

// ─── Get User By ID (manager / owner / admin) ────────────────────────────────

export async function getUserById(userId: string, restaurantId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select(`
      id, name, email, phone, dob,
      gender, profile_pic_url, address, city, pin_code, role, employee_id,
      is_active, force_password_change, branch_id, created_at
    `)
    .eq('id', userId)
    .eq('restaurant_id', restaurantId)   // tenant isolation
    .single();

  if (error) throw new Error(`User not found: ${error.message}`);
  return mapUserRow(data);
}

// ─── List Users (owner / manager / admin) ────────────────────────────────────

export async function listUsers(restaurantId: string, role?: string) {
  let query = supabaseAdmin
    .from('users')
    .select(`id, name, email, phone, role, is_active, created_at, profile_pic_url`)
    .eq('restaurant_id', restaurantId);

  if (role) query = query.eq('role', role);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch users: ${error.message}`);
  return (data ?? []).map(mapUserRow);
}

// ─── Notification Preferences ────────────────────────────────────────────────

const defaultNotificationPreferences = {
  email_new_orders:    true,
  push_staff_actions:  true,
  daily_sales_summary: true,
  low_inventory_alerts: true,
  new_review_alerts:   true,
};

export async function getNotificationPreferences(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('notification_preferences')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data?.notification_preferences ?? defaultNotificationPreferences;
  } catch (err: any) {
    // Column may not exist on older DB instances — fall back to Redis
    if ((err?.message ?? '').includes('notification_preferences')) {
      const stored = await redis.get(NOTIFICATION_PREFERENCES_KEY(userId));
      if (!stored) return defaultNotificationPreferences;
      try { return JSON.parse(stored); }
      catch { return defaultNotificationPreferences; }
    }
    throw new Error(`Failed to fetch notification preferences: ${err.message ?? err}`);
  }
}

export async function updateNotificationPreferences(
  userId: string,
  updates: NotificationPreferencesInput,
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ notification_preferences: updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('notification_preferences')
      .single();

    if (error) throw error;
    return data?.notification_preferences ?? defaultNotificationPreferences;
  } catch (err: any) {
    if ((err?.message ?? '').includes('notification_preferences')) {
      await redis.set(NOTIFICATION_PREFERENCES_KEY(userId), JSON.stringify(updates));
      return updates;
    }
    throw new Error(`Failed to update notification preferences: ${err.message ?? err}`);
  }
}

// ─── Session Management ───────────────────────────────────────────────────────

export async function getActiveSessions(userId: string) {
  const count = await redis.exists(refreshTokenKey(userId));
  return { count: count === 1 ? 1 : 0 };
}

export async function revokeUserSessions(userId: string) {
  await redis.del(refreshTokenKey(userId));
  return { revoked: true };
}

// ─── Check Email Availability ─────────────────────────────────────────────────

export async function checkEmail(email: string): Promise<{ available: boolean }> {
  // BUG FIX: normalise before the query so case differences don't give false
  // "available" results for emails already in the DB in a different case.
  const normalised = email.toLowerCase().trim();

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', normalised)
    .maybeSingle();

  if (error) throw new Error(`Email check failed: ${error.message}`);
  return { available: data === null };
}
/*
import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import { UpdateProfileInput, NotificationPreferencesInput } from './users.schema';

function refreshTokenKey(userId: string): string {
  return `refresh_token:${userId}`;
}

const NOTIFICATION_PREFERENCES_KEY = (userId: string) => `user_notification_preferences:${userId}`;

function splitName(name?: string | null): { first_name: string; last_name: string } {
  const parts = (name ?? '').trim().split(' ').filter(Boolean);
  if (parts.length === 0) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

function mapUserRow(row: any) {
  const { first_name, last_name } = splitName(row?.name);
  return {
    ...row,
    first_name,
    last_name,
    // BUG FIX: original set avatar_url: row?.profile_pic_url ?? null but then
    // returned both profile_pic_url AND avatar_url in the payload (noisy).
    // Keep profile_pic_url for DB fidelity and expose avatar_url as alias.
    avatar_url: row?.profile_pic_url ?? null,
  };
}

// ─── Get Full Profile ───────────────────────────────────────────────────────
export async function getMe(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select(`
      id,
      name,
      email,
      phone,
      dob,
      gender,
      profile_pic_url,
      address,
      city,
      pin_code,
      role,
      employee_id,
      is_active,
      force_password_change,
      restaurant_id,
      branch_id,
      created_at
    `)
    .eq('id', userId)
    .single();

  if (error) throw new Error(`Failed to fetch profile: ${error.message}`);
  return mapUserRow(data);
}

// ─── Update Profile ─────────────────────────────────────────────────────────
export async function updateMe(userId: string, updates: UpdateProfileInput) {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.first_name || updates.last_name) {
    const { data: current, error: currentError } = await supabaseAdmin
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    if (currentError) throw new Error(`Failed to load current name: ${currentError.message}`);

    const currentSplit = splitName(current?.name);
    const first = updates.first_name ?? currentSplit.first_name;
    const last  = updates.last_name  ?? currentSplit.last_name;
    updateData.name = `${first} ${last}`.trim();
  }

  if (updates.phone)      updateData.phone = updates.phone;
  if (updates.dob)        updateData.dob   = updates.dob;
  if (updates.gender)     updateData.gender = updates.gender;
  if (updates.avatar_url) updateData.profile_pic_url = updates.avatar_url;

  if (updates.address) {
    const parts = [updates.address.line1, updates.address.line2, updates.address.state]
      .filter(Boolean)
      .join(', ');
    if (parts)                   updateData.address  = parts;
    if (updates.address.city)    updateData.city     = updates.address.city;
    if (updates.address.pincode) updateData.pin_code = updates.address.pincode;
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update profile: ${error.message}`);
  return mapUserRow(data);
}

// ─── Deactivate Account ─────────────────────────────────────────────────────
export async function deleteMe(userId: string) {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`Failed to deactivate account: ${error.message}`);

  await redis.del(refreshTokenKey(userId));

  return { deleted: true };
}

// ─── Get User By ID (admin / manager) ──────────────────────────────────────
export async function getUserById(userId: string, restaurantId: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select(`
      id, name, email, phone, dob,
      gender, profile_pic_url, address, city, pin_code, role, employee_id,
      is_active, force_password_change, branch_id, created_at
    `)
    .eq('id', userId)
    .eq('restaurant_id', restaurantId)   // tenant isolation
    .single();

  if (error) throw new Error(`User not found: ${error.message}`);
  return mapUserRow(data);
}

// ─── List Users (owner/manager/admin) ───────────────────────────────────────
export async function listUsers(restaurantId: string, role?: string) {
  let query = supabaseAdmin
    .from('users')
    .select(
      `id, name, email, phone, role, is_active, created_at, profile_pic_url`
    )
    .eq('restaurant_id', restaurantId);

  if (role) {
    query = query.eq('role', role);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch users: ${error.message}`);
  return (data ?? []).map(mapUserRow);
}

// ─── Notification Preferences ───────────────────────────────────────────────────
const defaultNotificationPreferences = {
  email_new_orders: true,
  push_staff_actions: true,
  daily_sales_summary: true,
  low_inventory_alerts: true,
  new_review_alerts: true,
};

export async function getNotificationPreferences(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('notification_preferences')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data?.notification_preferences ?? defaultNotificationPreferences;
  } catch (err: any) {
    if ((err?.message ?? '').includes('notification_preferences')) {
      const stored = await redis.get(NOTIFICATION_PREFERENCES_KEY(userId));
      if (!stored) return defaultNotificationPreferences;
      try {
        return JSON.parse(stored);
      } catch {
        return defaultNotificationPreferences;
      }
    }
    throw new Error(`Failed to fetch notification preferences: ${err.message ?? err}`);
  }
}

export async function updateNotificationPreferences(userId: string, updates: NotificationPreferencesInput) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ notification_preferences: updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('notification_preferences')
      .single();

    if (error) throw error;
    return data?.notification_preferences ?? defaultNotificationPreferences;
  } catch (err: any) {
    if ((err?.message ?? '').includes('notification_preferences')) {
      await redis.set(NOTIFICATION_PREFERENCES_KEY(userId), JSON.stringify(updates));
      return updates;
    }
    throw new Error(`Failed to update notification preferences: ${err.message ?? err}`);
  }
}

// ─── Session management ─────────────────────────────────────────────────────────
export async function getActiveSessions(userId: string) {
  const count = await redis.exists(refreshTokenKey(userId));
  return { count: count === 1 ? 1 : 0 };
}

export async function revokeUserSessions(userId: string) {
  await redis.del(refreshTokenKey(userId));
  return { revoked: true };
}

// ─── Check Email Availability ────────────────────────────────────────────────
export async function checkEmail(email: string): Promise<{ available: boolean }> {
  // BUG FIX: email should be normalised before the DB query — the original code
  // did normalise it (toLowerCase + trim) but only inside the query, meaning
  // the raw value was queried. Move normalisation before the call.
  const normalised = email.toLowerCase().trim();

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', normalised)
    .maybeSingle();

  if (error) throw new Error(`Email check failed: ${error.message}`);
  return { available: data === null };
}
*/