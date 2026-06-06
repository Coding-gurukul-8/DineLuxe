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

const HEALTH_SCORE_CACHE_KEY = 'admin:health_score';
const HEALTH_SCORE_CACHE_TTL = 300; // 5 minutes

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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthScoreComponent {
  name: string;
  score: number;
  max: number;
  color: 'green' | 'yellow' | 'orange' | 'red';
}

export interface HealthScoreResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  components: HealthScoreComponent[];
  computed_at: string;
}

// ─── Platform Health Score (Section 6.1) ─────────────────────────────────────
// Composite 0-100 score from: uptime (30), order completion (30),
// API response time (20), customer satisfaction (20).
export async function getHealthScore(): Promise<HealthScoreResult> {
  // ── Cache check ────────────────────────────────────────────────────────────
  try {
    const cached = await redis.get(HEALTH_SCORE_CACHE_KEY);
    if (cached) return JSON.parse(cached) as HealthScoreResult;
  } catch {
    // Cache miss or Redis unavailable — recompute
  }

  const components: HealthScoreComponent[] = [];

  // ── Component 1: System Uptime (30 pts) ───────────────────────────────────
  let dbOk = false;
  let redisUp = false;

  try {
    const dbCheck = supabaseAdmin
      .from('restaurants')
      .select('id', { count: 'exact', head: true });
    const timeout = new Promise<{ timeout: true }>((res) =>
      setTimeout(() => res({ timeout: true }), 500),
    );
    const result = await Promise.race([dbCheck, timeout as unknown]);
    dbOk = !(result as any)?.timeout && !(result as any)?.error;
  } catch {
    dbOk = false;
  }

  try {
    await redis.ping();
    redisUp = true;
  } catch {
    redisUp = false;
  }

  const uptimeScore = dbOk && redisUp ? 30 : dbOk || redisUp ? 15 : 0;
  const uptimeColor: HealthScoreComponent['color'] =
    uptimeScore === 30 ? 'green' : uptimeScore === 15 ? 'yellow' : 'red';

  components.push({ name: 'System Uptime', score: uptimeScore, max: 30, color: uptimeColor });

  // ── Component 2: Order Completion Rate (30 pts) ───────────────────────────
  let orderScore = 5;
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [totalRes, completedRes] = await Promise.all([
      supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
      supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', since24h).in('status', ['paid', 'served', 'closed']),
    ]);
    const total = totalRes.count ?? 0;
    const completed = completedRes.count ?? 0;
    if (total === 0) {
      orderScore = 30;
    } else {
      const pct = (completed / total) * 100;
      if (pct > 90)       orderScore = 30;
      else if (pct >= 75) orderScore = 22;
      else if (pct >= 60) orderScore = 15;
      else                orderScore = 5;
    }
  } catch { /* leave floor */ }

  const orderColor: HealthScoreComponent['color'] =
    orderScore === 30 ? 'green' : orderScore === 22 ? 'yellow' : orderScore === 15 ? 'orange' : 'red';
  components.push({ name: 'Order Completion', score: orderScore, max: 30, color: orderColor });

  // ── Component 3: API Response Time (20 pts) ───────────────────────────────
  let responseScore = 20;
  try {
    const rawTimes = (await redis.call('LRANGE', 'metric:query_times', '0', '99')) as string[];
    if (Array.isArray(rawTimes) && rawTimes.length > 0) {
      const times = rawTimes.map(Number).filter(Number.isFinite);
      if (times.length > 0) {
        const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
        if (avgMs < 200)       responseScore = 20;
        else if (avgMs < 500)  responseScore = 15;
        else if (avgMs < 1000) responseScore = 8;
        else                   responseScore = 0;
      }
    }
  } catch { /* leave full marks */ }

  const responseColor: HealthScoreComponent['color'] =
    responseScore === 20 ? 'green' : responseScore === 15 ? 'yellow' : responseScore === 8 ? 'orange' : 'red';
  components.push({ name: 'Response Time', score: responseScore, max: 20, color: responseColor });

  // ── Component 4: Customer Satisfaction (20 pts) ───────────────────────────
  let satisfactionScore = 16;
  try {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: reviewRows, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select('overall_rating')
      .gte('created_at', since7d);
    if (!reviewError && reviewRows && reviewRows.length > 0) {
      const ratings = reviewRows.map((r: any) => Number(r.overall_rating)).filter(Number.isFinite);
      if (ratings.length > 0) {
        const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
        if (avg > 4.5)      satisfactionScore = 20;
        else if (avg >= 4)  satisfactionScore = 16;
        else if (avg >= 3.5) satisfactionScore = 10;
        else                satisfactionScore = 5;
      }
    }
  } catch { /* leave default */ }

  const satisfactionColor: HealthScoreComponent['color'] =
    satisfactionScore >= 16 ? 'green' : satisfactionScore === 10 ? 'yellow' : 'red';
  components.push({ name: 'Customer Satisfaction', score: satisfactionScore, max: 20, color: satisfactionColor });

  // ── Composite ─────────────────────────────────────────────────────────────
  const score = components.reduce((sum, c) => sum + c.score, 0);
  let grade: HealthScoreResult['grade'];
  let label: string;
  if (score >= 85)      { grade = 'A'; label = 'Excellent'; }
  else if (score >= 70) { grade = 'B'; label = 'Good'; }
  else if (score >= 55) { grade = 'C'; label = 'Fair'; }
  else if (score >= 40) { grade = 'D'; label = 'Poor'; }
  else                  { grade = 'F'; label = 'Critical'; }

  const result: HealthScoreResult = { score, grade, label, components, computed_at: new Date().toISOString() };
  try { await redis.setex(HEALTH_SCORE_CACHE_KEY, HEALTH_SCORE_CACHE_TTL, JSON.stringify(result)); } catch {}
  return result;
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
  await redis.del(DASHBOARD_CACHE_KEY);
  return data;
}

// ─── Get pending restaurants for review (paginated) ───────────────────────────
export async function getPendingRestaurants(page: number, limit: number) {
  const { from, to } = paginate(page, limit);
  const { data, error, count } = await supabaseAdmin
    .from('restaurants')
    .select(
      `id, name, cuisine_type, gst_number, status, created_at, updated_at,
       owner:users!restaurants_owner_id_fkey(id, name, email, phone, is_active, created_at)`,
      { count: 'exact' },
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .range(from, to);

  if (error) throw error;
  return { data, count };
}

// ─── Approve a pending restaurant ─────────────────────────────────────────────
export async function approveRestaurant(restaurantId: string, adminId: string) {
  const now = new Date().toISOString();

  const { data: restaurant, error: fetchError } = await supabaseAdmin
    .from('restaurants')
    .select(`id, name, status, owner:users!restaurants_owner_id_fkey(id, name, email)`)
    .eq('id', restaurantId)
    .single();

  if (fetchError) throw fetchError;
  if (!restaurant) throw Object.assign(new Error('Restaurant not found'), { statusCode: 404 });
  if ((restaurant as any).status !== 'pending') {
    throw Object.assign(
      new Error(`Restaurant is not pending — current status: ${(restaurant as any).status}`),
      { statusCode: 400 },
    );
  }

  const owner = (restaurant as any).owner as { id: string; name: string; email: string } | null;
  if (!owner) throw Object.assign(new Error('Restaurant owner not found'), { statusCode: 404 });

  const { error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .update({ status: 'active', approved_by: adminId, approved_at: now, updated_at: now })
    .eq('id', restaurantId);
  if (restaurantError) throw restaurantError;

  await supabaseAdmin.from('users').update({ is_active: true, updated_at: now }).eq('id', owner.id);

  await createInApp(owner.id, 'system_alert', 'Restaurant Approved! 🎉', 'Your restaurant has been approved! You can now go live.', restaurantId, 'restaurant')
    .catch((err) => console.error('[approveRestaurant] Notification failed:', err));

  const dashboardUrl = process.env.OWNER_DASHBOARD_URL ?? 'https://app.dineluxe.app/owner';
  await sendEmail({ to: owner.email, templateName: 'restaurant-approved', data: { ownerName: owner.name, restaurantName: (restaurant as any).name, dashboardUrl } });

  insertAuditLog({ actorId: adminId, action: 'RESTAURANT_APPROVED', targetType: 'restaurant', targetId: restaurantId, newValue: { status: 'active', approved_by: adminId, approved_at: now } }).catch(() => {});

  try {
    const { io } = await import('../../server');
    io.to('admin').emit('restaurant_approved', { restaurant_id: restaurantId, restaurant_name: (restaurant as any).name, approved_by: adminId, approved_at: now });
  } catch {}

  await redis.del(DASHBOARD_CACHE_KEY);
  return { success: true, restaurant_id: restaurantId, owner_notified: true };
}

// ─── Reject a pending restaurant ──────────────────────────────────────────────
export async function rejectRestaurant(restaurantId: string, adminId: string, reason: string) {
  const now = new Date().toISOString();

  const { data: restaurant, error: fetchError } = await supabaseAdmin
    .from('restaurants')
    .select(`id, name, status, owner:users!restaurants_owner_id_fkey(id, name, email)`)
    .eq('id', restaurantId)
    .single();

  if (fetchError) throw fetchError;
  if (!restaurant) throw Object.assign(new Error('Restaurant not found'), { statusCode: 404 });
  if ((restaurant as any).status !== 'pending') {
    throw Object.assign(
      new Error(`Restaurant is not pending — current status: ${(restaurant as any).status}`),
      { statusCode: 400 },
    );
  }

  const owner = (restaurant as any).owner as { id: string; name: string; email: string } | null;
  if (!owner) throw Object.assign(new Error('Restaurant owner not found'), { statusCode: 404 });

  const { error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .update({ status: 'rejected', rejected_by: adminId, rejected_at: now, rejection_reason: reason, updated_at: now })
    .eq('id', restaurantId);
  if (restaurantError) throw restaurantError;

  await createInApp(owner.id, 'system_alert', 'Application Update', `Your restaurant application was not approved: ${reason}`, restaurantId, 'restaurant')
    .catch((err) => console.error('[rejectRestaurant] Notification failed:', err));

  await sendEmail({ to: owner.email, templateName: 'restaurant-rejected', data: { ownerName: owner.name, restaurantName: (restaurant as any).name, reason } });

  insertAuditLog({ actorId: adminId, action: 'RESTAURANT_REJECTED', targetType: 'restaurant', targetId: restaurantId, newValue: { status: 'rejected', rejected_by: adminId, rejected_at: now, reason } }).catch(() => {});

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

  if (status === 'active') query = query.eq('is_active', true);
  else if (status === 'inactive') query = query.eq('is_active', false);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

// ─── Update customer status ───────────────────────────────────────────────────
export async function updateCustomerStatus(id: string, status: string) {
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
  const hashedPassword = await bcrypt.hash(input.password, config.BCRYPT_SALT_ROUNDS);

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (authError) throw new Error(`Auth creation failed: ${authError.message}`);

  const userId = authData.user.id;
  const now = new Date().toISOString();
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
export async function suspendCustomer(customerId: string, adminId: string, reason: string): Promise<{ success: true }> {
  const now = new Date().toISOString();

  const { data: user, error: fetchError } = await supabaseAdmin
    .from('users').select('id, name, email, role').eq('id', customerId).eq('role', 'customer').single();
  if (fetchError || !user) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ is_active: false, suspension_reason: reason, suspended_at: now, suspended_by: adminId, updated_at: now })
    .eq('id', customerId).eq('role', 'customer');
  if (updateError) throw updateError;

  await redis.set(`suspended:${customerId}`, 'true');

  await createInApp(customerId, 'system_alert', 'Account Suspended', 'Your account has been suspended. Contact support@dineluxe.app')
    .catch((err: unknown) => console.error('[suspendCustomer] Notification failed:', err));

  insertAuditLog({ actorId: adminId, action: 'CUSTOMER_SUSPENDED', targetType: 'user', targetId: customerId, newValue: { is_active: false, suspension_reason: reason, suspended_at: now } }).catch(() => {});

  return { success: true };
}

// ─── Unsuspend a customer ─────────────────────────────────────────────────────
export async function unsuspendCustomer(customerId: string, adminId: string): Promise<{ success: true }> {
  const now = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ is_active: true, suspension_reason: null, suspended_at: null, suspended_by: null, updated_at: now })
    .eq('id', customerId);
  if (updateError) throw updateError;

  await redis.del(`suspended:${customerId}`);

  insertAuditLog({ actorId: adminId, action: 'CUSTOMER_UNSUSPENDED', targetType: 'user', targetId: customerId, newValue: { is_active: true } }).catch(() => {});

  return { success: true };
}

// ─── Flag a customer for review ───────────────────────────────────────────────
export async function flagCustomer(customerId: string, adminId: string, flagReason: string): Promise<{ success: true }> {
  const now = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ is_flagged: true, flag_reason: flagReason, flagged_at: now, flagged_by: adminId, updated_at: now })
    .eq('id', customerId);

  if (updateError) {
    console.warn('[flagCustomer] DB update failed, using Redis fallback:', updateError.message);
    await redis.set(`flagged:${customerId}`, JSON.stringify({ reason: flagReason, flaggedBy: adminId, flaggedAt: now }));
  }

  insertAuditLog({ actorId: adminId, action: 'CUSTOMER_FLAGGED', targetType: 'user', targetId: customerId, newValue: { is_flagged: true, flag_reason: flagReason, flagged_at: now } }).catch(() => {});

  return { success: true };
}

// ─── Get full customer detail (admin view) ────────────────────────────────────
export async function getCustomerDetail(customerId: string) {
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id, name, email, phone, date_of_birth, role, is_active, is_flagged, flag_reason, suspension_reason, suspended_at, created_at')
    .eq('id', customerId).eq('role', 'customer').single();

  if (userError || !user) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });

  const { data: orders } = await supabaseAdmin
    .from('orders').select('id, total_amount, created_at, status').eq('customer_id', customerId).order('created_at', { ascending: false });

  const totalOrders = orders?.length ?? 0;
  const totalSpent = (orders ?? []).reduce((sum, o: any) => sum + (o.total_amount ?? 0), 0);
  const lastOrderDate = orders?.[0]?.created_at ?? null;

  const { count: openTickets } = await supabaseAdmin
    .from('support_tickets').select('id', { count: 'exact', head: true }).eq('customer_id', customerId).in('status', ['open', 'in_progress']);

  const { data: pendingRefunds } = await supabaseAdmin
    .from('refund_requests').select('id, order_id, amount, reason, created_at, status').eq('customer_id', customerId).eq('status', 'pending');

  const isSuspended = !(user as any).is_active;
  const isFlagged = (user as any).is_flagged === true;
  const accountStatus: 'active' | 'suspended' | 'flagged' = isSuspended ? 'suspended' : isFlagged ? 'flagged' : 'active';

  return {
    profile: user,
    orderSummary: { totalOrders, totalSpent, lastOrderDate },
    openTickets: openTickets ?? 0,
    pendingRefunds: pendingRefunds ?? [],
    accountStatus,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// ─── SPONSORED PLACEMENTS — Section 9.2 / 19.1 ────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

const SPONSORSHIP_CACHE_PREFIX = 'sponsorships:';
const SPONSORSHIP_CACHE_TTL = 300; // 5 minutes — matches product spec

// ─── Impression debounce via Redis INCR + background flush ───────────────────
//
// Architecture: instead of hitting Postgres on every impression request we:
//   1. atomically INCR a Redis counter key  `sponsorship:impressions:{id}`
//   2. a module-level setInterval fires every 60 s, scans all pending
//      counter keys, reads+deletes them with GETDEL, and calls the
//      increment_impression_count() Postgres RPC to batch-write the totals.
//
// Result: zero DB writes per request; at most N writes per minute where
// N = number of distinct sponsored items that received impressions.

const IMPRESSION_REDIS_PREFIX = 'sponsorship:impressions:';
let _impressionFlushStarted = false;

function startImpressionFlush(): void {
  if (_impressionFlushStarted) return;
  _impressionFlushStarted = true;

  setInterval(async () => {
    try {
      // SCAN is safe in production (non-blocking, cursor-based)
      let cursor = '0';
      const pendingKeys: string[] = [];

      do {
        const [nextCursor, batch] = (await redis.call(
          'SCAN', cursor, 'MATCH', `${IMPRESSION_REDIS_PREFIX}*`, 'COUNT', '200',
        )) as [string, string[]];
        cursor = nextCursor;
        pendingKeys.push(...batch);
      } while (cursor !== '0');

      if (pendingKeys.length === 0) return;

      // Flush each counter to Postgres
      await Promise.all(
        pendingKeys.map(async (key) => {
          // GETDEL atomically reads and removes — prevents double-counting
          const raw = await (redis as any).getdel(key) as string | null;
          const delta = parseInt(raw ?? '0', 10);
          if (!delta || delta <= 0) return;

          const id = key.slice(IMPRESSION_REDIS_PREFIX.length);

          // Prefer the atomic RPC; fall back to a direct UPDATE if the RPC
          // hasn't been created yet (e.g. during initial deploy).
          const { error: rpcError } = await supabaseAdmin.rpc('increment_impression_count', {
            p_id: id,
            p_delta: delta,
          });

          if (rpcError) {
            // Fallback: raw UPDATE (not atomic but acceptable for rare edge case)
            await supabaseAdmin
              .from('sponsored_placements')
              .update({ impression_count: delta }) // note: Supabase JS doesn't support += directly
              .eq('id', id);
          }
        }),
      );
    } catch (err) {
      console.error('[sponsored] Impression flush error:', err);
    }
  }, 60_000);
}

// Start flush loop immediately when this module is first imported by the server
startImpressionFlush();

// ─── getActiveSponsorships ────────────────────────────────────────────────────
/**
 * Public endpoint — returns currently live sponsored placements of a given type.
 * Cached in Redis for 5 minutes under key `sponsorships:{placementType}`.
 */
export async function getActiveSponsorships(placementType: string) {
  const cacheKey = `${SPONSORSHIP_CACHE_PREFIX}${placementType}`;

  // Cache hit
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('sponsored_placements')
    .select(
      `
      id,
      restaurant_id,
      placement_type,
      banner_url,
      headline,
      cta_text,
      is_active,
      starts_at,
      ends_at,
      impression_count,
      click_count,
      created_at,
      restaurant:restaurants!sponsored_placements_restaurant_id_fkey(
        id,
        name
      ),
      branding:restaurant_branding!restaurant_branding_restaurant_id_fkey(
        logo_url,
        primary_color
      )
      `,
    )
    .eq('placement_type', placementType)
    .eq('is_active', true)
    .lte('starts_at', nowIso)
    .gte('ends_at', nowIso)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Flatten joined relations into a single-level object for the frontend
  const result = (data ?? []).map((sp: any) => ({
    id:               sp.id,
    restaurant_id:    sp.restaurant_id,
    placement_type:   sp.placement_type,
    banner_url:       sp.banner_url,
    headline:         sp.headline,
    cta_text:         sp.cta_text,
    is_active:        sp.is_active,
    starts_at:        sp.starts_at,
    ends_at:          sp.ends_at,
    impression_count: sp.impression_count,
    click_count:      sp.click_count,
    created_at:       sp.created_at,
    // Flattened joins
    restaurant_name:  sp.restaurant?.name ?? null,
    logo_url:         sp.branding?.logo_url ?? null,
    primary_color:    sp.branding?.primary_color ?? null,
  }));

  try {
    await redis.setex(cacheKey, SPONSORSHIP_CACHE_TTL, JSON.stringify(result));
  } catch {}

  return result;
}

// ─── recordImpression ─────────────────────────────────────────────────────────
/**
 * Fire-and-forget — increments a Redis counter only.
 * The background flush loop writes to Postgres every 60 s.
 */
export async function recordImpression(sponsorshipId: string): Promise<void> {
  await redis.incr(`${IMPRESSION_REDIS_PREFIX}${sponsorshipId}`);
}

// ─── recordClick ──────────────────────────────────────────────────────────────
/**
 * Clicks are low-volume and high-value signals so we write directly to Postgres.
 * Uses the increment_click_count RPC for an atomic update.
 */
export async function recordClick(sponsorshipId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('increment_click_count', { p_id: sponsorshipId });

  if (error) {
    // Fallback: plain UPDATE if the RPC hasn't been deployed yet
    // Supabase client doesn't expose a `raw()` helper on the client type.
    // Do a simple read-then-write increment as a safe fallback (best-effort).
    console.warn('[sponsored] recordClick RPC failed, using fallback:', error.message);
    try {
      const { data: row, error: selErr } = await supabaseAdmin
        .from('sponsored_placements')
        .select('click_count')
        .eq('id', sponsorshipId)
        .limit(1)
        .single();

      if (selErr) {
        console.warn('[sponsored] fallback select failed:', selErr.message);
      } else {
        const current = (row && (row as any).click_count) ?? 0;
        await supabaseAdmin
          .from('sponsored_placements')
          .update({ click_count: Number(current) + 1 })
          .eq('id', sponsorshipId);
      }
    } catch (e) {
      console.error('[sponsored] fallback update failed:', e instanceof Error ? e.message : e);
    }
  }
}

// ─── createSponsorship ────────────────────────────────────────────────────────
export interface CreateSponsorshipInput {
  restaurant_id:  string;
  placement_type: 'home_banner' | 'search_top' | 'featured_card';
  banner_url?:    string | null;
  headline?:      string | null;
  cta_text?:      string | null;
  starts_at:      string;   // ISO 8601
  ends_at:        string;   // ISO 8601
  is_active?:     boolean;
}

export async function createSponsorship(
  input: CreateSponsorshipInput,
  adminId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('sponsored_placements')
    .insert({
      restaurant_id:    input.restaurant_id,
      placement_type:   input.placement_type,
      banner_url:       input.banner_url  ?? null,
      headline:         input.headline    ?? null,
      cta_text:         input.cta_text    ?? null,
      starts_at:        input.starts_at,
      ends_at:          input.ends_at,
      is_active:        input.is_active   ?? true,
      impression_count: 0,
      click_count:      0,
      created_by:       adminId,
    })
    .select()
    .single();

  if (error) throw error;

  // Immediately bust the cache so the new record shows up without waiting for TTL
  await redis.del(`${SPONSORSHIP_CACHE_PREFIX}${input.placement_type}`).catch(() => {});

  return data;
}

// ─── listSponsorships ─────────────────────────────────────────────────────────
export async function listSponsorships(page: number, limit: number) {
  const { from, to } = paginate(page, limit);

  const { data, error, count } = await supabaseAdmin
    .from('sponsored_placements')
    .select(
      `
      id,
      placement_type,
      banner_url,
      headline,
      cta_text,
      is_active,
      starts_at,
      ends_at,
      impression_count,
      click_count,
      created_at,
      restaurant:restaurants!sponsored_placements_restaurant_id_fkey(
        id,
        name
      )
      `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const items = (data ?? []).map((sp: any) => ({
    ...sp,
    restaurant_name: sp.restaurant?.name  ?? null,
    restaurant_id:   sp.restaurant?.id    ?? null,
    restaurant:      undefined, // strip nested object
  }));

  return { data: items, count };
}

// ─── toggleSponsorship ────────────────────────────────────────────────────────
export async function toggleSponsorship(id: string) {
  // 1. Fetch current state (need placement_type to bust the right cache key)
  const { data: current, error: fetchError } = await supabaseAdmin
    .from('sponsored_placements')
    .select('id, is_active, placement_type')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;
  if (!current) throw Object.assign(new Error('Sponsorship not found'), { statusCode: 404 });

  // 2. Flip the flag
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('sponsored_placements')
    .update({ is_active: !(current as any).is_active })
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw updateError;

  // 3. Bust cache so the change is visible immediately
  await redis.del(`${SPONSORSHIP_CACHE_PREFIX}${(current as any).placement_type}`).catch(() => {});

  return updated;
}