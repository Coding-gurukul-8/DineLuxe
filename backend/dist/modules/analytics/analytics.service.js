"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMenuSuggestions = getMenuSuggestions;
exports.getBundleOpportunities = getBundleOpportunities;
exports.getDemandForecast = getDemandForecast;
exports.getStaffingRecommendation = getStaffingRecommendation;
exports.getRestaurantOverview = getRestaurantOverview;
exports.getBranchHourly = getBranchHourly;
exports.getRestaurantAnalytics = getRestaurantAnalytics;
const supabase_1 = require("../../config/supabase");
function isMissingRpc(error) {
    return (error?.message ?? '').includes('Could not find the function');
}
// ─── Menu suggestions ─────────────────────────────────────────────────────────
async function getMenuSuggestions(branchId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: items, error } = await supabase_1.supabaseAdmin.rpc('get_item_order_counts', {
        p_branch_id: branchId,
        p_since: thirtyDaysAgo,
    });
    if (error) {
        if (isMissingRpc(error))
            return [];
        throw error;
    }
    if (!items?.length)
        return [];
    const totalOrders = items.reduce((sum, i) => sum + i.order_count, 0);
    const avgOrderCount = items.length > 0 ? totalOrders / items.length : 0;
    if (avgOrderCount === 0)
        return [];
    const slowSellers = items.filter((i) => i.order_count < avgOrderCount * 0.3);
    return slowSellers.map((item) => ({
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
async function getBundleOpportunities(branchId) {
    const { data: pairs, error } = await supabase_1.supabaseAdmin.rpc('get_co_order_pairs', {
        p_branch_id: branchId,
        p_min_count: 10,
        p_limit: 5,
    });
    if (error) {
        if (isMissingRpc(error))
            return [];
        throw error;
    }
    if (!pairs?.length)
        return [];
    return pairs.map((pair) => ({
        item_a_id: pair.item_a_id,
        item_a_name: pair.item_a_name,
        item_b_id: pair.item_b_id,
        item_b_name: pair.item_b_name,
        co_order_count: pair.co_orders,
        suggested_bundle_price: Math.round((pair.item_a_price + pair.item_b_price) * 0.9 * 100) / 100,
        discount_percent: 10,
    }));
}
// ─── Demand forecast ──────────────────────────────────────────────────────────
async function getDemandForecast(branchId) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: historical, error } = await supabase_1.supabaseAdmin.rpc('get_order_hourly_distribution', {
        p_branch_id: branchId,
        p_since: ninetyDaysAgo,
    });
    if (error) {
        if (isMissingRpc(error))
            return [];
        throw error;
    }
    const avgByDayHour = {};
    for (const row of historical ?? []) {
        if (!avgByDayHour[row.day_of_week])
            avgByDayHour[row.day_of_week] = {};
        avgByDayHour[row.day_of_week][row.hour] = row.avg_orders;
    }
    const forecast = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
        const dayOfWeek = date.getDay();
        const dayData = avgByDayHour[dayOfWeek] ?? {};
        const predictedOrders = Math.round(Object.values(dayData).reduce((sum, v) => sum + v, 0));
        const dataPoints = historical?.filter((h) => h.day_of_week === dayOfWeek).length ?? 0;
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
async function getStaffingRecommendation(branchId) {
    const forecast = await getDemandForecast(branchId);
    if (forecast.length === 0)
        return [];
    const { data: scheduled, error } = await supabase_1.supabaseAdmin.rpc('get_scheduled_staff', {
        p_branch_id: branchId,
    });
    if (error) {
        if (isMissingRpc(error))
            return [];
        throw error;
    }
    const scheduledMap = {};
    for (const s of scheduled ?? []) {
        scheduledMap[s.date] = { waiters: s.waiter_count, chefs: s.chef_count };
    }
    return forecast.map((day) => {
        const recommendedWaiters = Math.max(1, Math.ceil(day.predicted_orders / 15));
        const recommendedChefs = Math.max(1, Math.ceil(day.predicted_orders / 20));
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
async function getRestaurantOverview(restaurantId) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [todayPayments, weekPayments, todayOrders, tables, topItems] = await Promise.all([
        // Revenue today
        supabase_1.supabaseAdmin
            .from('payments')
            .select('amount')
            .eq('status', 'completed')
            .gte('created_at', startOfToday)
            .then(({ data }) => data ?? []),
        // Revenue this week
        supabase_1.supabaseAdmin
            .from('payments')
            .select('amount')
            .eq('status', 'completed')
            .gte('created_at', startOfWeek)
            .then(({ data }) => data ?? []),
        // Orders today (scoped to restaurant via join on orders → branches)
        supabase_1.supabaseAdmin
            .from('orders')
            .select('id, total_amount', { count: 'exact' })
            .eq('restaurant_id', restaurantId)
            .gte('created_at', startOfToday)
            .neq('status', 'cancelled')
            .then(({ data, count }) => ({ data: data ?? [], count: count ?? 0 })),
        // Tables for occupancy
        supabase_1.supabaseAdmin
            .from('tables')
            .select('status')
            .eq('restaurant_id', restaurantId)
            .then(({ data }) => data ?? []),
        // Top 5 items by order count today
        supabase_1.supabaseAdmin
            .from('order_items')
            .select('menu_item_id, quantity, unit_price, menu_items(name)')
            .gte('created_at', startOfToday)
            .eq('orders.restaurant_id', restaurantId)
            .limit(100)
            .then(({ data }) => data ?? []),
    ]);
    const revenue_today = todayPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
    const revenue_week = weekPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
    const orders_today = todayOrders.count;
    const avg_order_value = orders_today > 0 ? revenue_today / orders_today : 0;
    // Occupancy: occupied / total
    const totalTables = tables.length;
    const occupiedTables = tables.filter((t) => t.status === 'occupied').length;
    const occupancy_rate = totalTables > 0 ? occupiedTables / totalTables : 0;
    // Aggregate top items
    const itemMap = {};
    for (const row of topItems) {
        const id = row.menu_item_id;
        const name = row.menu_items?.name ?? 'Unknown';
        if (!itemMap[id])
            itemMap[id] = { name, count: 0, revenue: 0 };
        itemMap[id].count += row.quantity ?? 1;
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
async function getBranchHourly(branchId) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    // Fetch today's orders for the branch, including payment amounts
    const { data: orders, error } = await supabase_1.supabaseAdmin
        .from('orders')
        .select('id, created_at, total_amount, status')
        .eq('branch_id', branchId)
        .gte('created_at', startOfToday)
        .neq('status', 'cancelled');
    if (error)
        throw error;
    // Bucket into hours 0–23
    const hourBuckets = {};
    for (let h = 0; h < 24; h++) {
        hourBuckets[h] = { orders: 0, revenue: 0 };
    }
    for (const order of orders ?? []) {
        const hour = new Date(order.created_at).getHours();
        hourBuckets[hour].orders += 1;
        hourBuckets[hour].revenue += order.total_amount ?? 0;
    }
    // Only return hours up to current hour (no future empty bars)
    const currentHour = now.getHours();
    const hours = Array.from({ length: currentHour + 1 }, (_, h) => ({
        hour: h,
        orders: hourBuckets[h].orders,
        revenue: Math.round(hourBuckets[h].revenue * 100) / 100,
    }));
    return { hours };
}
// ─── Restaurant Analytics (period-based) ─────────────────────────────────────
// GET /analytics/restaurant/:restaurantId/analytics?period=7d|30d|90d
// Returns: { revenue_by_day, orders_by_day, avg_order_value, top_items }
async function getRestaurantAnalytics(restaurantId, period = '30d') {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    // Fetch paid payments joined to orders for this restaurant within the period
    const { data: payments, error: payErr } = await supabase_1.supabaseAdmin
        .from('payments')
        .select('amount, created_at, order_id, orders!inner(restaurant_id)')
        .eq('status', 'completed')
        .eq('orders.restaurant_id', restaurantId)
        .gte('created_at', since);
    if (payErr)
        throw payErr;
    // Group revenue and order count by day
    const revenueByDay = {};
    const ordersByDay = {};
    for (const p of payments ?? []) {
        const date = p.created_at.split('T')[0];
        revenueByDay[date] = (revenueByDay[date] ?? 0) + (p.amount ?? 0);
        ordersByDay[date] = (ordersByDay[date] ?? 0) + 1;
    }
    const revenue_by_day = Object.entries(revenueByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }));
    const orders_by_day = Object.entries(ordersByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));
    const totalRevenue = revenue_by_day.reduce((s, r) => s + r.amount, 0);
    const totalOrders = orders_by_day.reduce((s, o) => s + o.count, 0);
    const avg_order_value = totalOrders > 0
        ? Math.round((totalRevenue / totalOrders) * 100) / 100
        : 0;
    // Top items by order count for this restaurant in the period
    const { data: orderItems, error: itemErr } = await supabase_1.supabaseAdmin
        .from('order_items')
        .select('menu_item_id, quantity, menu_items(name), orders!inner(restaurant_id, created_at)')
        .eq('orders.restaurant_id', restaurantId)
        .gte('orders.created_at', since);
    if (itemErr)
        throw itemErr;
    const itemMap = {};
    for (const row of orderItems ?? []) {
        const id = row.menu_item_id;
        const name = row.menu_items?.name ?? 'Unknown';
        if (!itemMap[id])
            itemMap[id] = { name, count: 0 };
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
            total_orders: totalOrders,
        },
    };
}
//# sourceMappingURL=analytics.service.js.map