import bcrypt from 'bcryptjs';
import { config } from '../../config/env';
import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import { paginate } from '../../utils/pagination';
import { sendEmail } from '../../email/send';
import { createInApp } from '../notifications/notifications.service';
import { insertAuditLog } from '../../utils/audit-log';

const DASHBOARD_CACHE_KEY = 'admin:dashboard';
const DASHBOARD_CACHE_TTL = 300; // 5 minutes

// ─── Dashboard ────────────────────────────────────────────────────────────────
export async function getDashboard() {
  const cached = await redis.get(DASHBOARD_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    restaurantStats,
    customerStats,
    newCustomers,
    todayOrders,
    todayRevenue,
    topRestaurants,
  ] = await Promise.all([
    // Restaurants by status
    supabaseAdmin
      .from('restaurants')
      .select('status')
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data ?? []).forEach((r: any) => {
          counts[r.status] = (counts[r.status] || 0) + 1;
        });
        return counts;
      }),

    // Total customers
    supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'customer'),

    // New customers this month
    supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'customer')
      .gte('created_at', startOfMonth),

    // Today's orders count
    supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfToday),

    // Today's revenue
    supabaseAdmin
      .from('payments')
      .select('amount')
      .gte('created_at', startOfToday)
      .eq('status', 'completed'),

    // Top 5 restaurants by revenue (last 30 days)
    supabaseAdmin.rpc('get_top_restaurants_by_revenue', {
      p_since: thirtyDaysAgo,
      p_limit: 5,
    }),
  ]);

  const revenueToday = (todayRevenue.data ?? []).reduce(
    (sum: number, p: any) => sum + (p.amount ?? 0),
    0
  );

  // Composite platform health score (0-100)
  const totalRestaurants = Object.values(restaurantStats).reduce((a, b) => a + b, 0);
  const activeRatio = totalRestaurants > 0 ? (restaurantStats['active'] || 0) / totalRestaurants : 1;
  const platformHealthScore = Math.round(activeRatio * 100);

  const dashboard = {
    restaurants: restaurantStats,
    total_customers: customerStats.count ?? 0,
    new_customers_this_month: newCustomers.count ?? 0,
    orders_today: todayOrders.count ?? 0,
    revenue_today: revenueToday,
    top_restaurants: topRestaurants.data ?? [],
    platform_health_score: platformHealthScore,
    generated_at: new Date().toISOString(),
  };

  await redis.setex(DASHBOARD_CACHE_KEY, DASHBOARD_CACHE_TTL, JSON.stringify(dashboard));
  return dashboard;
}

// ─── Platform stats (7×24 peak hours matrix) ─────────────────────────────────
export async function getPlatformStats() {
  const { data, error } = await supabaseAdmin.rpc('get_peak_hours_matrix');
  if (error) {
    if ((error.message ?? '').includes('Could not find the function')) {
      return [];
    }
    throw error;
  }
  return data ?? [];
}

// ─── Health check (public) ────────────────────────────────────────────────────
export async function getBasicHealth() {
  // DB check with 500ms timeout
  let dbStatus: 'ok' | 'degraded' = 'ok';
  let dbDown = false;
  let dbLatency = 0;

  try {
    const dbStart = Date.now();
    const dbCheck = supabaseAdmin
      .from('restaurants')
      .select('id', { count: 'exact', head: true });
    const timeout = new Promise<{ timeout: true }>((res) =>
      setTimeout(() => res({ timeout: true }), 500),
    );
    const result = await Promise.race([dbCheck, timeout as unknown]);
    dbLatency = Date.now() - dbStart;

    // If timeout resolved, mark DB as down
    if ((result as any)?.timeout) {
      dbDown = true;
      dbStatus = 'degraded';
    } else {
      const { error } = result as any;
      if (error) dbStatus = 'degraded';
    }
  } catch {
    dbStatus = 'degraded';
  }

  // Redis check
  let redisLatency = 0;
  let redisOk = true;

  try {
    const redisStart = Date.now();
    await redis.ping();
    redisLatency = Date.now() - redisStart;
  } catch {
    redisOk = false;
  }

  const overallStatus =
    dbDown ? 'down'
    : dbStatus === 'degraded' || !redisOk ? 'degraded'
    : 'ok';

  return {
    status: overallStatus as 'ok' | 'degraded' | 'down',
    db_latency_ms: dbLatency,
    redis_latency_ms: redisLatency,
    timestamp: new Date().toISOString(),
  };
}

// Keep legacy alias so existing controller reference still compiles
export const getHealth = getBasicHealth;

// ─── Detailed health (super_admin only) ──────────────────────────────────────
export async function getDetailedHealth() {
  const basic = await getBasicHealth();

  // ── Redis metrics ──────────────────────────────────────────────────────────
  let redisHitRate = 0;
  let usedMemoryHuman = 'N/A';
  let connectedClients = 0;

  try {
    const info = await redis.info('all');

    const parse = (key: string): number => {
      const m = info.match(new RegExp(`${key}:(\\d+)`));
      return m ? parseInt(m[1], 10) : 0;
    };

    const parseStr = (key: string): string => {
      const m = info.match(new RegExp(`${key}:([^\\r\\n]+)`));
      return m ? m[1].trim() : 'N/A';
    };

    const hits = parse('keyspace_hits');
    const misses = parse('keyspace_misses');
    redisHitRate = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;
    usedMemoryHuman = parseStr('used_memory_human');
    connectedClients = parse('connected_clients');
  } catch {
    // Redis info unavailable — leave defaults
  }

  // ── API metrics from Redis ─────────────────────────────────────────────────
  let avgQueryMs = 0;
  let errorRate = 0;

  try {
    const minute = Math.floor(Date.now() / 60_000);

    // Average of last 100 request durations tracked by metrics middleware
    const [queryTimes, reqCount, errCount] = await Promise.all([
      redis.call('LRANGE', 'metric:query_times', '0', '99') as Promise<string[]>,
      redis.get(`metric:requests:${minute}`),
      redis.get(`metric:errors:${minute}`),
    ]);

    if (Array.isArray(queryTimes) && queryTimes.length > 0) {
      const times = queryTimes.map(Number).filter(Number.isFinite);
      avgQueryMs = times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : 0;
    }

    const totalReqs = parseInt(reqCount ?? '0', 10);
    const totalErrs = parseInt(errCount ?? '0', 10);
    errorRate = totalReqs > 0 ? Math.round((totalErrs / totalReqs) * 100 * 10) / 10 : 0;
  } catch {
    // Metrics not available — leave defaults
  }

  // ── WebSocket stats via socket.io ──────────────────────────────────────────
  let wsConnections = 0;
  let wsRooms = 0;

  try {
    const { io } = await import('../../server');
    wsConnections = io.engine.clientsCount;
    wsRooms = io.sockets.adapter.rooms.size;
  } catch {
    // io not available (e.g. test environment)
  }

  // ── Active sessions (estimate from Redis session keys) ─────────────────────
  let activeSessions = 0;

  try {
    // Scan for session:* keys — safer than KEYS in production
    let cursor = '0';
    let count = 0;
    do {
      const [nextCursor, keys] = (await redis.call(
        'SCAN', cursor, 'MATCH', 'session:*', 'COUNT', '100',
      )) as [string, string[]];
      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== '0' && count < 5000); // cap scan at 5000 keys
    activeSessions = count;
  } catch {
    // SCAN not available in memory fallback
  }

  return {
    ...basic,
    redis_hit_rate_percent: redisHitRate,
    redis_memory: usedMemoryHuman,
    redis_connected_clients: connectedClients,
    db_metrics: {
      avg_query_ms: avgQueryMs,
      // Active connections via Supabase not directly queryable without pg_stat_activity RPC
      // Expose what the frontend HealthDetailed interface expects:
      active_connections: null as number | null,
      idle_connections: null as number | null,
      total_connections: null as number | null,
    },
    api_metrics: {
      error_rate_percent: errorRate,
      avg_response_ms: avgQueryMs,
    },
    websocket: {
      connections: wsConnections,
      rooms: wsRooms,
    },
    active_sessions: activeSessions,
  };
}

// ─── Get all restaurants (paginated) ─────────────────────────────────────────
export async function getRestaurants(page: number, limit: number, status?: string) {
  const { from, to } = paginate(page, limit);
  let query = supabaseAdmin
    .from('restaurants')
    .select('*, owner:users(id, name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

// ─── Update restaurant status ─────────────────────────────────────────────────
export async function updateRestaurantStatus(id: string, status: string) {
  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Invalidate dashboard cache
  await redis.del(DASHBOARD_CACHE_KEY);
  return data;
}

// ─── Get pending restaurants for review (paginated) ───────────────────────────
export async function getPendingRestaurants(page: number, limit: number) {
  const { from, to } = paginate(page, limit);

  const { data, error, count } = await supabaseAdmin
    .from('restaurants')
    .select(
      `
      id,
      name,
      cuisine_type,
      gst_number,
      status,
      created_at,
      updated_at,
      owner:users!restaurants_owner_id_fkey(
        id,
        name,
        email,
        phone,
        is_active,
        created_at
      )
    `,
      { count: 'exact' },
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true }) // oldest first — first come, first serve
    .range(from, to);

  if (error) throw error;
  return { data, count };
}

// ─── Approve a pending restaurant ─────────────────────────────────────────────
export async function approveRestaurant(restaurantId: string, adminId: string) {
  const now = new Date().toISOString();

  // 1. Fetch the restaurant and verify it's pending
  const { data: restaurant, error: fetchError } = await supabaseAdmin
    .from('restaurants')
    .select(
      `
      id,
      name,
      status,
      owner:users!restaurants_owner_id_fkey(id, name, email)
    `,
    )
    .eq('id', restaurantId)
    .single();

  if (fetchError) throw fetchError;
  if (!restaurant) {
    const err = Object.assign(new Error('Restaurant not found'), { statusCode: 404 });
    throw err;
  }

  if ((restaurant as any).status !== 'pending') {
    const err = Object.assign(
      new Error(`Restaurant is not pending — current status: ${(restaurant as any).status}`),
      { statusCode: 400 },
    );
    throw err;
  }

  const owner = (restaurant as any).owner as {
    id: string;
    name: string;
    email: string;
  } | null;

  if (!owner) {
    const err = Object.assign(new Error('Restaurant owner not found'), { statusCode: 404 });
    throw err;
  }

  // 2. Update restaurant status to active
  const { error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .update({
      status: 'active',
      approved_by: adminId,
      approved_at: now,
      updated_at: now,
    })
    .eq('id', restaurantId);

  if (restaurantError) throw restaurantError;

  // 3. Activate the owner user (they may have been pending-inactive)
  await supabaseAdmin
    .from('users')
    .update({ is_active: true, updated_at: now })
    .eq('id', owner.id);

  // 4. Create in-app notification for the owner
  await createInApp(
    owner.id,
    'system_alert',
    'Restaurant Approved! 🎉',
    'Your restaurant has been approved! You can now go live.',
    restaurantId,
    'restaurant',
  ).catch((err) => console.error('[approveRestaurant] Notification failed:', err));

  // 5. Send approval email
  const dashboardUrl = process.env.OWNER_DASHBOARD_URL ?? 'https://app.dineluxe.app/owner';
  await sendEmail({
    to: owner.email,
    templateName: 'restaurant-approved',
    data: {
      ownerName: owner.name,
      restaurantName: (restaurant as any).name,
      dashboardUrl,
    },
  });

  // 6. Audit log
  insertAuditLog({
    actorId: adminId,
    action: 'RESTAURANT_APPROVED',
    targetType: 'restaurant',
    targetId: restaurantId,
    newValue: { status: 'active', approved_by: adminId, approved_at: now },
  }).catch(() => {});

  // 7. Emit WebSocket event to admin room
  try {
    const { io } = await import('../../server');
    io.to('admin').emit('restaurant_approved', {
      restaurant_id: restaurantId,
      restaurant_name: (restaurant as any).name,
      approved_by: adminId,
      approved_at: now,
    });
  } catch {
    // WebSocket emission failure is non-fatal
  }

  // Invalidate dashboard cache so pending count reflects new state
  await redis.del(DASHBOARD_CACHE_KEY);

  return {
    success: true,
    restaurant_id: restaurantId,
    owner_notified: true,
  };
}

// ─── Reject a pending restaurant ──────────────────────────────────────────────
export async function rejectRestaurant(restaurantId: string, adminId: string, reason: string) {
  const now = new Date().toISOString();

  // 1. Fetch the restaurant and verify it's pending
  const { data: restaurant, error: fetchError } = await supabaseAdmin
    .from('restaurants')
    .select(
      `
      id,
      name,
      status,
      owner:users!restaurants_owner_id_fkey(id, name, email)
    `,
    )
    .eq('id', restaurantId)
    .single();

  if (fetchError) throw fetchError;
  if (!restaurant) {
    const err = Object.assign(new Error('Restaurant not found'), { statusCode: 404 });
    throw err;
  }

  if ((restaurant as any).status !== 'pending') {
    const err = Object.assign(
      new Error(`Restaurant is not pending — current status: ${(restaurant as any).status}`),
      { statusCode: 400 },
    );
    throw err;
  }

  const owner = (restaurant as any).owner as {
    id: string;
    name: string;
    email: string;
  } | null;

  if (!owner) {
    const err = Object.assign(new Error('Restaurant owner not found'), { statusCode: 404 });
    throw err;
  }

  // 2. Update restaurant status to rejected
  const { error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .update({
      status: 'rejected',
      rejected_by: adminId,
      rejected_at: now,
      rejection_reason: reason,
      updated_at: now,
    })
    .eq('id', restaurantId);

  if (restaurantError) throw restaurantError;

  // 3. Create in-app notification for the owner with the reason
  await createInApp(
    owner.id,
    'system_alert',
    'Application Update',
    `Your restaurant application was not approved: ${reason}`,
    restaurantId,
    'restaurant',
  ).catch((err) => console.error('[rejectRestaurant] Notification failed:', err));

  // 4. Send rejection email
  await sendEmail({
    to: owner.email,
    templateName: 'restaurant-rejected',
    data: {
      ownerName: owner.name,
      restaurantName: (restaurant as any).name,
      reason,
    },
  });

  // 5. Audit log
  insertAuditLog({
    actorId: adminId,
    action: 'RESTAURANT_REJECTED',
    targetType: 'restaurant',
    targetId: restaurantId,
    newValue: { status: 'rejected', rejected_by: adminId, rejected_at: now, reason },
  }).catch(() => {});

  // Invalidate dashboard cache
  await redis.del(DASHBOARD_CACHE_KEY);

  return { success: true };
}

// ─── Get all customers (paginated) ───────────────────────────────────────────
export async function getCustomers(page: number, limit: number, status?: string) {
  const { from, to } = paginate(page, limit);
  let query = supabaseAdmin
    .from('users')
    .select('id, name, email, phone, is_active, created_at', { count: 'exact' })
    .eq('role', 'customer')
    .order('created_at', { ascending: false })
    .range(from, to);

  // status param maps to is_active: 'active' -> true, 'inactive' -> false
  if (status === 'active') query = query.eq('is_active', true);
  else if (status === 'inactive') query = query.eq('is_active', false);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

// ─── Update customer status ───────────────────────────────────────────────────
export async function updateCustomerStatus(id: string, status: string) {
  // Map 'active'/'inactive' to the boolean is_active column
  const is_active = status === 'active';
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Get anonymous staff feedback ─────────────────────────────────────────────
export async function getFeedback(page: number, limit: number) {
  const { from, to } = paginate(page, limit);
  const { data, error, count } = await supabaseAdmin
    .from('staff_feedback')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data, count };
}
// ─── Shared helper: create any privileged user (admin or super_admin) ─────────
async function createPrivilegedUser(input: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'admin' | 'super_admin';
}) {
  const email = input.email.toLowerCase().trim();
  const name = `${input.first_name} ${input.last_name}`.trim();

  // BUG FIX: hash the password so it is stored in users.password_hash.
  // Without this, login crashes with "Illegal arguments: string, object".
  const hashedPassword = await bcrypt.hash(input.password, config.BCRYPT_SALT_ROUNDS);

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });

  if (authError) throw new Error(`Auth creation failed: ${authError.message}`);

  const userId = authData.user.id;
  const now = new Date().toISOString();

  // Some environments only expose 'super_admin' in the UserRole enum.
  // Store admin logins as super_admin so platform endpoints remain reachable.
  const persistedRole = input.role === 'admin' ? 'super_admin' : input.role;

  const { error: profileError } = await supabaseAdmin.from('users').insert({
    id: userId,
    name,
    email,
    phone: input.phone ?? null,
    password_hash: hashedPassword,
    role: persistedRole,
    is_active: true,
    force_password_change: false,
    created_by_restaurant: false,
    created_at: now,
    updated_at: now,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`Profile creation failed: ${profileError.message}`);
  }

  return { id: userId, email, name, phone: input.phone ?? null, role: persistedRole };
}

// ─── Create admin (called by super_admin via POST /admin/create-admin) ────────
export async function createAdmin(input: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}) {
  return createPrivilegedUser({ ...input, role: 'admin' });
}

// ─── Create a super_admin (via POST /admin/signup) ─────────────────────────
// Protected by X-Seed-Secret header — NOT a JWT route.
export async function createSuperAdmin(input: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}) {
  return createPrivilegedUser({ ...input, role: 'super_admin' });
}

// ─── Suspend a customer (Section 6.5) ────────────────────────────────────────
// Sets is_active=false, writes suspension metadata to DB, stores Redis key
// `suspended:{id}` (no TTL) so auth middleware can instantly block the user.
export async function suspendCustomer(
  customerId: string,
  adminId: string,
  reason: string,
): Promise<{ success: true }> {
  const now = new Date().toISOString();

  // 1. Verify the target is a customer
  const { data: user, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role')
    .eq('id', customerId)
    .eq('role', 'customer')
    .single();

  if (fetchError || !user) {
    const err = Object.assign(new Error('Customer not found'), { statusCode: 404 });
    throw err;
  }

  // 2. Update DB — mark inactive + record suspension metadata
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      is_active: false,
      suspension_reason: reason,
      suspended_at: now,
      suspended_by: adminId,
      updated_at: now,
    })
    .eq('id', customerId)
    .eq('role', 'customer');

  if (updateError) throw updateError;

  // 3. Revoke all active JWTs by setting Redis sentinel key (no TTL — persists until unsuspended)
  await redis.set(`suspended:${customerId}`, 'true');

  // 4. In-app notification to the customer
  await createInApp(
    customerId,
    'system_alert',
    'Account Suspended',
    'Your account has been suspended. Contact support@dineluxe.app',
  ).catch((err: unknown) => console.error('[suspendCustomer] Notification failed:', err));

  // 5. Audit log (fire-and-forget)
  insertAuditLog({
    actorId: adminId,
    action: 'CUSTOMER_SUSPENDED',
    targetType: 'user',
    targetId: customerId,
    newValue: { is_active: false, suspension_reason: reason, suspended_at: now },
  }).catch(() => {});

  return { success: true };
}

// ─── Unsuspend a customer ─────────────────────────────────────────────────────
export async function unsuspendCustomer(
  customerId: string,
  adminId: string,
): Promise<{ success: true }> {
  const now = new Date().toISOString();

  // 1. Restore active status and clear suspension fields
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      is_active: true,
      suspension_reason: null,
      suspended_at: null,
      suspended_by: null,
      updated_at: now,
    })
    .eq('id', customerId);

  if (updateError) throw updateError;

  // 2. Remove Redis sentinel key so JWTs become valid again immediately
  await redis.del(`suspended:${customerId}`);

  // 3. Audit log
  insertAuditLog({
    actorId: adminId,
    action: 'CUSTOMER_UNSUSPENDED',
    targetType: 'user',
    targetId: customerId,
    newValue: { is_active: true },
  }).catch(() => {});

  return { success: true };
}

// ─── Flag a customer for review ───────────────────────────────────────────────
// Flagging ≠ suspending. The account stays active; it is marked for admin review.
export async function flagCustomer(
  customerId: string,
  adminId: string,
  flagReason: string,
): Promise<{ success: true }> {
  const now = new Date().toISOString();

  // Attempt DB column update first (columns may not exist on older schemas)
  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({
      is_flagged: true,
      flag_reason: flagReason,
      flagged_at: now,
      flagged_by: adminId,
      updated_at: now,
    })
    .eq('id', customerId);

  if (updateError) {
    // Graceful fallback: store flag in Redis if columns are absent
    console.warn('[flagCustomer] DB update failed, using Redis fallback:', updateError.message);
    await redis.set(
      `flagged:${customerId}`,
      JSON.stringify({ reason: flagReason, flaggedBy: adminId, flaggedAt: now }),
    );
  }

  // Audit log
  insertAuditLog({
    actorId: adminId,
    action: 'CUSTOMER_FLAGGED',
    targetType: 'user',
    targetId: customerId,
    newValue: { is_flagged: true, flag_reason: flagReason, flagged_at: now },
  }).catch(() => {});

  return { success: true };
}

// ─── Get full customer detail (admin view) ────────────────────────────────────
export async function getCustomerDetail(customerId: string) {
  // 1. User profile
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select(
      'id, name, email, phone, date_of_birth, role, is_active, is_flagged, flag_reason, suspension_reason, suspended_at, created_at',
    )
    .eq('id', customerId)
    .eq('role', 'customer')
    .single();

  if (userError || !user) {
    const err = Object.assign(new Error('Customer not found'), { statusCode: 404 });
    throw err;
  }

  // 2. Order history summary
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, total_amount, created_at, status')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  const totalOrders = orders?.length ?? 0;
  const totalSpent = (orders ?? []).reduce((sum, o: any) => sum + (o.total_amount ?? 0), 0);
  const lastOrderDate = orders?.[0]?.created_at ?? null;

  // 3. Open support tickets count
  const { count: openTickets } = await supabaseAdmin
    .from('support_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .in('status', ['open', 'in_progress']);

  // 4. Pending refund requests
  const { data: pendingRefunds } = await supabaseAdmin
    .from('refund_requests')
    .select('id, order_id, amount, reason, created_at, status')
    .eq('customer_id', customerId)
    .eq('status', 'pending');

  // 5. Determine account status label
  const isSuspended = !(user as any).is_active;
  const isFlagged = (user as any).is_flagged === true;
  const accountStatus: 'active' | 'suspended' | 'flagged' = isSuspended
    ? 'suspended'
    : isFlagged
      ? 'flagged'
      : 'active';

  return {
    profile: user,
    orderSummary: {
      totalOrders,
      totalSpent,
      lastOrderDate,
    },
    openTickets: openTickets ?? 0,
    pendingRefunds: pendingRefunds ?? [],
    accountStatus,
  };
}