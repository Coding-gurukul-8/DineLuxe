import bcrypt from 'bcryptjs';
import { config } from '../../config/env';
import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import { paginate } from '../../utils/pagination';

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