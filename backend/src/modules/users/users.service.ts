import crypto from 'crypto';
import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import { insertAuditLog } from '../../utils/audit-log';
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

// ─── GDPR Account Anonymisation (replaces hard-delete / soft-deactivate) ─────
//
// Section M23: DELETE /api/customer/account
//   - Anonymise: name, email, phone, profile_pic, dob, gender, address
//   - Keep: order history (anonymised) for restaurant financial records
//   - Delete: Supabase Auth user, push subscriptions
//   - Revoke: all JWTs via Redis tombstone
//   - Cancel: pending / confirmed bookings
//   - Unlink: loyalty account (keep history, nullify user_id)
//
// Staff accounts (role !== 'customer') may NOT self-delete via this endpoint;
// they must contact their employer / platform admin.
// ─────────────────────────────────────────────────────────────────────────────
export async function anonymizeUserAccount(userId: string): Promise<{ success: boolean; message: string }> {
  // ── 1. Verify user exists and is a customer ──────────────────────────────
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
    throw new Error('This account has already been deleted.');
  }

  // ── 2. Generate anonymised identifiers ───────────────────────────────────
  const anonEmail = `deleted_${crypto.randomBytes(8).toString('hex')}@deleted.invalid`;
  const now       = new Date().toISOString();

  // ── 3. Anonymise the user row in the DB ──────────────────────────────────
  const { error: anonError } = await supabaseAdmin
    .from('users')
    .update({
      name:           'Deleted User',
      email:          anonEmail,
      phone:          null,
      profile_pic_url: null,
      dob:            null,
      gender:         null,
      address:        null,
      city:           null,
      pin_code:       null,
      // Scramble the password hash so it can never be reused
      password_hash:  `ANONYMIZED_${Date.now()}`,
      is_active:      false,
      updated_at:     now,
      deleted_at:     now,
      anonymized_at:  now,
    })
    .eq('id', userId);

  if (anonError) {
    throw new Error(`Failed to anonymise account: ${anonError.message}`);
  }

  // ── 4. Delete Supabase Auth user (removes login capability entirely) ─────
  //    The DB record is kept (anonymised) for financial/audit retention.
  //    If the auth user is already gone for any reason, treat it as a no-op.
  try {
    await supabaseAdmin.auth.admin.deleteUser(userId);
  } catch (authErr: any) {
    // Log but never block the overall deletion — the DB record is already
    // anonymised; the auth entry may already be absent.
    console.error(`[anonymizeUserAccount] Supabase Auth delete failed for ${userId}:`, authErr?.message);
  }

  // ── 5. Revoke all JWTs immediately ───────────────────────────────────────
  //    Auth middleware checks this key on every request; a 7-day TTL covers
  //    any long-lived refresh tokens that haven't been cycled yet.
  await redis.del(refreshTokenKey(userId));
  await redis.set(`revoked_user:${userId}`, 'deleted', 'EX', 7 * 24 * 60 * 60);

  // ── 6. Delete device push tokens ─────────────────────────────────────────
  //    Silently ignored if the table doesn't exist yet (ON DELETE CASCADE
  //    on users FK would handle it, but we do it explicitly here for clarity).
  await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId);

  // ── 7. Unlink loyalty account ─────────────────────────────────────────────
  //    Keep the points/transaction history for restaurant reporting; just
  //    sever the link to the now-anonymised user.
  await supabaseAdmin
    .from('loyalty_accounts')
    .update({ user_id: null, anonymized: true, updated_at: now } as any)
    .eq('user_id', userId);

  // ── 8. Cancel pending / confirmed bookings ────────────────────────────────
  await supabaseAdmin
    .from('bookings')
    .update({ status: 'cancelled', updated_at: now })
    .eq('user_id', userId)
    .in('status', ['pending', 'confirmed']);

  // ── 9. Audit log ─────────────────────────────────────────────────────────
  insertAuditLog({
    actorId:    userId,
    action:     'CUSTOMER_SELF_DELETED',
    targetType: 'user',
    targetId:   userId,
    newValue:   { anonymized_at: now, reason: 'GDPR self-deletion request' },
  }).catch(() => {/* never block on audit log */});

  return {
    success: true,
    message: 'Your account has been permanently deleted. All personal data has been removed.',
  };
}

// ─── GDPR Data Export (right to data portability) ────────────────────────────
//
// Returns everything the platform holds about a user as a single JSON object.
// Fetched in parallel for performance; safe for most users (<100 orders).
// For very large datasets, consider queuing a Bull job (see report-export.ts).
// ─────────────────────────────────────────────────────────────────────────────
export interface UserDataExport {
  exportedAt: string;
  profile: Record<string, unknown> | null;
  orders: unknown[];
  bookings: unknown[];
  reviews: unknown[];
  loyaltyTransactions: unknown[];
  notifications: unknown[];
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
    // Profile
    supabaseAdmin
      .from('users')
      .select('id, name, email, phone, dob, gender, address, city, pin_code, role, created_at')
      .eq('id', userId)
      .single(),

    // All orders with items
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

    // All bookings
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

    // User's own reviews
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

    // Loyalty transactions
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

    // In-app notifications
    supabaseAdmin
      .from('notifications')
      .select('id, type, title, body, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500), // cap at 500 — enough for portability, prevents runaway payloads
  ]);

  return {
    exportedAt:          new Date().toISOString(),
    profile:             profileResult.data   ?? null,
    orders:              ordersResult.data     ?? [],
    bookings:            bookingsResult.data   ?? [],
    reviews:             reviewsResult.data    ?? [],
    loyaltyTransactions: loyaltyResult.data    ?? [],
    notifications:       notificationsResult.data ?? [],
  };
}

// ─── Get User By ID (admin / manager) ───────────────────────────────────────
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

// ─── List Users (owner/manager/admin) ────────────────────────────────────────
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

// ─── Notification Preferences ────────────────────────────────────────────────
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

// ─── Session management ──────────────────────────────────────────────────────
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