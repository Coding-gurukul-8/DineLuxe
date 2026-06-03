import { supabaseAdmin } from '../../config/supabase';
import { getPlatformPeriodReport } from '../../utils/platform-analytics';

function isMissingRpc(error: { message?: string } | null): boolean {
  return (error?.message ?? '').includes('Could not find the function');
}

const ORDER_STATUSES = [
  'created',
  'confirmed',
  'preparing',
  'ready',
  'served',
  'paid',
  'closed',
];

// ─── Menu suggestions ─────────────────────────────────────────────────────────
export async function getMenuSuggestions(branchId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: items, error } = await supabaseAdmin.rpc('get_item_order_counts', {
    p_branch_id: branchId,
    p_since: thirtyDaysAgo,
  });

  if (error) {
    if (isMissingRpc(error)) return [];
    throw error;
  }
  if (!items?.length) return [];

  const totalOrders = items.reduce((sum: number, i: any) => sum + i.order_count, 0);
  const avgOrderCount = items.length > 0 ? totalOrders / items.length : 0;

  if (avgOrderCount === 0) return [];

  const slowSellers = items.filter((i: any) => i.order_count < avgOrderCount * 0.3);

  return slowSellers.map((item: any) => ({
    item_id: item.menu_item_id,
    item_name: item.item_name,
    order_count_30d: item.order_count,
    avg_order_count: Math.round(avgOrderCount),
    suggestion_type: 'promote_or_remove',
    suggestion_text: `"${item.item_name}" has only ${item.order_count} orders in 30 days (${Math.round((item.order_count / avgOrderCount) * 100)}% of average). Consider a promotion or removal.`,
    potential_revenue_impact: item.price * Math.round(avgOrderCount * 0.3),
  }));
}

// ─── Bundle opportunities ─────────────────────────────────────────────────────
export async function getBundleOpportunities(branchId: string) {
  const { data: pairs, error } = await supabaseAdmin.rpc('get_co_order_pairs', {
    p_branch_id: branchId,
    p_min_count: 10,
    p_limit: 5,
  });

  if (error) {
    if (isMissingRpc(error)) return [];
    throw error;
  }
  if (!pairs?.length) return [];

  return pairs.map((pair: any) => ({
    item_a_id: pair.item_a_id,
    item_a_name: pair.item_a_name,
    item_b_id: pair.item_b_id,
    item_b_name: pair.item_b_name,
    co_order_count: pair.co_orders,
    suggested_bundle_price:
      Math.round((pair.item_a_price + pair.item_b_price) * 0.9 * 100) / 100,
    discount_percent: 10,
  }));
}

// ─── Demand forecast ──────────────────────────────────────────────────────────
export async function getDemandForecast(branchId: string) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: historical, error } = await supabaseAdmin.rpc('get_order_hourly_distribution', {
    p_branch_id: branchId,
    p_since: ninetyDaysAgo,
  });

  if (error) {
    if (isMissingRpc(error)) return [];
    throw error;
  }

  const avgByDayHour: Record<number, Record<number, number>> = {};
  for (const row of historical ?? []) {
    if (!avgByDayHour[row.day_of_week]) avgByDayHour[row.day_of_week] = {};
    avgByDayHour[row.day_of_week][row.hour] = row.avg_orders;
  }

  const forecast = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = date.getDay();
    const dayData = avgByDayHour[dayOfWeek] ?? {};
    const predictedOrders = Math.round(
      Object.values(dayData).reduce((sum: number, v) => sum + v, 0)
    );
    const dataPoints = historical?.filter((h: any) => h.day_of_week === dayOfWeek).length ?? 0;

    forecast.push({
      date: date.toISOString().split('T')[0],
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
      predicted_orders: predictedOrders,
      confidence: dataPoints >= 8 ? 'high' : dataPoints >= 4 ? 'medium' : 'low',
    });
  }

  return forecast;
}

// ─── Staffing recommendation ──────────────────────────────────────────────────
export async function getStaffingRecommendation(branchId: string) {
  const forecast = await getDemandForecast(branchId);

  if (forecast.length === 0) return [];

  const { data: scheduled, error } = await supabaseAdmin.rpc('get_scheduled_staff', {
    p_branch_id: branchId,
  });

  if (error) {
    if (isMissingRpc(error)) return [];
    throw error;
  }

  const scheduledMap: Record<string, { waiters: number; chefs: number }> = {};
  for (const s of scheduled ?? []) {
    scheduledMap[s.date] = { waiters: s.waiter_count, chefs: s.chef_count };
  }

  return forecast.map((day) => {
    const recommendedWaiters = Math.max(1, Math.ceil(day.predicted_orders / 15));
    const recommendedChefs   = Math.max(1, Math.ceil(day.predicted_orders / 20));
    const current = scheduledMap[day.date] ?? { waiters: 0, chefs: 0 };

    return {
      date: day.date,
      day: day.day,
      predicted_orders: day.predicted_orders,
      confidence: day.confidence,
      recommended_waiters: recommendedWaiters,
      recommended_chefs: recommendedChefs,
      scheduled_waiters: current.waiters,
      scheduled_chefs: current.chefs,
      waiter_gap: recommendedWaiters - current.waiters,
      chef_gap: recommendedChefs - current.chefs,
    };
  });
}

// ─── Restaurant overview (NEW) ────────────────────────────────────────────────
// GET /analytics/restaurant/:restaurantId/overview
// Returns: { revenue_today, revenue_week, orders_today, avg_order_value,
//            top_items, occupancy_rate }
export async function getRestaurantOverview(restaurantId: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfWeek  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [todayPayments, weekPayments, todayOrders, tables, topItems] = await Promise.all([
    // Revenue today
    supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', startOfToday)
      .then(({ data }) => data ?? []),

    // Revenue this week
    supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', startOfWeek)
      .then(({ data }) => data ?? []),

    // Orders today (scoped to restaurant via join on orders → branches)
    supabaseAdmin
      .from('orders')
      .select('id, total_amount', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .gte('created_at', startOfToday)
      .in('status', ORDER_STATUSES)
      .then(({ data, count }) => ({ data: data ?? [], count: count ?? 0 })),

    // Tables for occupancy
    supabaseAdmin
      .from('tables')
      .select('status')
      .eq('restaurant_id', restaurantId)
      .then(({ data }) => data ?? []),

    // Top 5 items by order count today
    supabaseAdmin
      .from('order_items')
      .select('menu_item_id, quantity, unit_price, menu_items(name)')
      .gte('created_at', startOfToday)
      .eq('orders.restaurant_id', restaurantId)
      .limit(100)
      .then(({ data }) => data ?? []),
  ]);

  const revenue_today = todayPayments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
  const revenue_week  = weekPayments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
  const orders_today  = todayOrders.count;
  const avg_order_value = orders_today > 0 ? revenue_today / orders_today : 0;

  // Occupancy: occupied / total
  const totalTables    = tables.length;
  const occupiedTables = tables.filter((t: any) => t.status === 'occupied').length;
  const occupancy_rate = totalTables > 0 ? occupiedTables / totalTables : 0;

  // Aggregate top items
  const itemMap: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const row of topItems as any[]) {
    const id   = row.menu_item_id;
    const name = row.menu_items?.name ?? 'Unknown';
    if (!itemMap[id]) itemMap[id] = { name, count: 0, revenue: 0 };
    itemMap[id].count   += row.quantity ?? 1;
    itemMap[id].revenue += (row.unit_price ?? 0) * (row.quantity ?? 1);
  }
  const top_items = Object.values(itemMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    revenue_today,
    revenue_week,
    orders_today,
    avg_order_value: Math.round(avg_order_value * 100) / 100,
    top_items,
    occupancy_rate: Math.round(occupancy_rate * 100) / 100,
  };
}

// ─── Branch hourly activity (NEW) ─────────────────────────────────────────────
// GET /analytics/branch/:branchId/hourly
// Returns: { hours: [{ hour, orders, revenue }] }
export async function getBranchHourly(branchId: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [{ data: orders, error: ordersError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('id, created_at, status')
      .eq('branch_id', branchId)
      .gte('created_at', startOfToday)
      .in('status', ORDER_STATUSES),

    supabaseAdmin
      .from('payments')
      .select('amount, order_id, orders!inner(created_at, branch_id, status)')
      .eq('status', 'completed')
      .eq('orders.branch_id', branchId)
      .gte('orders.created_at', startOfToday),
  ]);

  if (ordersError) throw ordersError;
  if (paymentsError) throw paymentsError;

  const paymentRevenueByHour: Record<number, number> = {};
  for (const payment of payments ?? []) {
    const orderCreatedAt = (payment.orders as any)?.created_at;
    if (!orderCreatedAt) continue;
    const hour = new Date(orderCreatedAt).getHours();
    paymentRevenueByHour[hour] = (paymentRevenueByHour[hour] ?? 0) + Number(payment.amount ?? 0);
  }

  // Bucket into hours 0–23
  const hourBuckets: Record<number, { orders: number; revenue: number }> = {};
  for (let h = 0; h < 24; h++) {
    hourBuckets[h] = { orders: 0, revenue: paymentRevenueByHour[h] ?? 0 };
  }

  for (const order of orders ?? []) {
    const hour = new Date(order.created_at).getHours();
    hourBuckets[hour].orders += 1;
  }

  // Only return hours up to current hour (no future empty bars)
  const currentHour = now.getHours();
  const hours = Array.from({ length: currentHour + 1 }, (_, h) => ({
    hour: h,
    orders:  hourBuckets[h].orders,
    revenue: Math.round(hourBuckets[h].revenue * 100) / 100,
  }));

  return { hours };
}

// ─── Branch performance (owner + admin) ───────────────────────────────────────
// GET /analytics/branch-performance?restaurant_id=:restaurantId
export async function getBranchPerformance(
  restaurantId: string,
  authUser?: { role: string; restaurant_id?: string },
) {
  if (authUser?.role === 'owner' && authUser.restaurant_id !== restaurantId) {
    throw Object.assign(new Error('Restaurant access mismatch'), { statusCode: 403 });
  }

  const startOfToday = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  ).toISOString();

  const { data: branches, error: branchesErr } = await supabaseAdmin
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', restaurantId);

  if (branchesErr) throw branchesErr;
  if (!branches?.length) return [];

  const branchIds = branches.map((branch: any) => branch.id);

  const { data: orders, error: ordersErr } = await supabaseAdmin
    .from('orders')
    .select('id, branch_id, status, created_at')
    .in('branch_id', branchIds)
    .gte('created_at', startOfToday)
    .in('status', ['paid', 'closed']);

  if (ordersErr) throw ordersErr;

  const orderIds = (orders ?? []).map((order: any) => order.id);
  let payments: any[] = [];

  if (orderIds.length > 0) {
    const { data, error: paymentsErr } = await supabaseAdmin
      .from('payments')
      .select('amount, order_id, orders!inner(branch_id)')
      .eq('status', 'completed')
      .in('order_id', orderIds);

    if (paymentsErr) throw paymentsErr;
    payments = data ?? [];
  }

  const branchRevenue: Record<string, number> = {};
  for (const payment of payments) {
    const branchId = (payment.orders as any)?.branch_id;
    if (!branchId) continue;
    branchRevenue[branchId] = (branchRevenue[branchId] ?? 0) + Number(payment.amount ?? 0);
  }

  const { data: tables, error: tablesErr } = await supabaseAdmin
    .from('tables')
    .select('branch_id, status')
    .in('branch_id', branchIds);

  if (tablesErr) throw tablesErr;

  const metricMap: Record<string, { id: string; name: string; revenue: number; orders: number; occupied: number; total_tables: number }> = {};
  for (const branch of branches) {
    metricMap[branch.id] = {
      id: branch.id,
      name: branch.name,
      revenue: 0,
      orders: 0,
      occupied: 0,
      total_tables: 0,
    };
  }

  for (const order of orders ?? []) {
    const metrics = metricMap[order.branch_id];
    if (!metrics) continue;
    metrics.orders += 1;
  }

  for (const branchId of Object.keys(branchRevenue)) {
    const metrics = metricMap[branchId];
    if (!metrics) continue;
    metrics.revenue = branchRevenue[branchId];
  }

  for (const table of tables ?? []) {
    const metrics = metricMap[table.branch_id];
    if (!metrics) continue;
    metrics.total_tables += 1;
    if (table.status === 'occupied') metrics.occupied += 1;
  }

  return Object.values(metricMap).map((branch) => {
    const occupancyRate = branch.total_tables > 0 ? Math.round((branch.occupied / branch.total_tables) * 100) / 100 : 0;
    return {
      id: branch.id,
      name: branch.name,
      revenue: Math.round(branch.revenue * 100) / 100,
      orders: branch.orders,
      occupancy_rate: occupancyRate,
      occupancy: occupancyRate,
    };
  });
}

// ─── Restaurant Analytics (period-based) ─────────────────────────────────────
// GET /analytics/restaurant/:restaurantId/analytics?period=7d|30d|90d
// Returns: { revenue_by_day, orders_by_day, avg_order_value, top_items }

export async function getRestaurantAnalytics(
  restaurantId: string,
  period: string = '30d',
) {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Fetch paid payments joined to orders for this restaurant within the period
  const { data: payments, error: payErr } = await supabaseAdmin
    .from('payments')
    .select('amount, created_at, order_id, orders!inner(restaurant_id)')
    .eq('status', 'completed')
    .eq('orders.restaurant_id', restaurantId)
    .gte('created_at', since);

  if (payErr) throw payErr;

  // Group revenue and order count by day
  const revenueByDay: Record<string, number> = {};
  const ordersByDay:  Record<string, number> = {};

  for (const p of payments ?? []) {
    const date = (p.created_at as string).split('T')[0];
    revenueByDay[date] = (revenueByDay[date] ?? 0) + (p.amount ?? 0);
    ordersByDay[date]  = (ordersByDay[date]  ?? 0) + 1;
  }

  const revenue_by_day = Object.entries(revenueByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }));

  const orders_by_day = Object.entries(ordersByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const totalRevenue    = revenue_by_day.reduce((s, r) => s + r.amount, 0);
  const totalOrders     = orders_by_day.reduce((s, o) => s + o.count, 0);
  const avg_order_value = totalOrders > 0
    ? Math.round((totalRevenue / totalOrders) * 100) / 100
    : 0;

  // Top items by order count for this restaurant in the period
  const { data: orderItems, error: itemErr } = await supabaseAdmin
    .from('order_items')
    .select('menu_item_id, quantity, menu_items(name), orders!inner(restaurant_id, created_at)')
    .eq('orders.restaurant_id', restaurantId)
    .gte('orders.created_at', since);

  if (itemErr) throw itemErr;

  const itemMap: Record<string, { name: string; count: number }> = {};
  for (const row of (orderItems as any[]) ?? []) {
    const id   = row.menu_item_id;
    const name = row.menu_items?.name ?? 'Unknown';
    if (!itemMap[id]) itemMap[id] = { name, count: 0 };
    itemMap[id].count += row.quantity ?? 1;
  }

  const top_items = Object.values(itemMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(({ name, count }) => ({ name, count }));

  return {
    period,
    since,
    revenue_by_day,
    orders_by_day,
    avg_order_value,
    top_items,
    summary: {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_orders:  totalOrders,
    },
  };
}

// ─── Platform overview (admin) ───────────────────────────────────────────────
// GET /analytics/overview?period=7d|30d|90d
export async function getPlatformOverview(period: string) {
  const report = await getPlatformPeriodReport(period);
  return {
    daily_revenue: report.period_breakdowns.map((row) => ({
      date: row.date,
      revenue: row.revenue,
    })),
    daily_orders: report.period_breakdowns.map((row) => ({
      date: row.date,
      orders: row.orders,
    })),
    top_categories: [],
  };
}