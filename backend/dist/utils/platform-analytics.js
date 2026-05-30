"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformPeriodReport = getPlatformPeriodReport;
const supabase_1 = require("../config/supabase");
const PERIOD_DAYS = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
};
const ORDER_STATUSES = [
    'created',
    'confirmed',
    'preparing',
    'ready',
    'served',
    'paid',
    'closed',
];
function normalizePeriod(period) {
    if (period === '7d' || period === '30d' || period === '90d')
        return period;
    return '30d';
}
function toDateKey(value) {
    return new Date(value).toISOString().slice(0, 10);
}
function formatDateLabel(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    return utcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
async function getPlatformPeriodReport(periodInput) {
    const period = normalizePeriod(periodInput);
    const days = PERIOD_DAYS[period];
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const startIso = start.toISOString();
    const [paymentsRes, ordersRes] = await Promise.all([
        supabase_1.supabaseAdmin
            .from('payments')
            .select('amount, created_at')
            .eq('status', 'completed')
            .gte('created_at', startIso),
        supabase_1.supabaseAdmin
            .from('orders')
            .select('created_at, status')
            .in('status', ORDER_STATUSES)
            .gte('created_at', startIso),
    ]);
    if (paymentsRes.error)
        throw paymentsRes.error;
    if (ordersRes.error)
        throw ordersRes.error;
    const revenueByDay = new Map();
    const ordersByDay = new Map();
    for (const row of paymentsRes.data ?? []) {
        if (!row.created_at)
            continue;
        const key = toDateKey(row.created_at);
        const amount = Number(row.amount ?? 0);
        revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + amount);
    }
    for (const row of ordersRes.data ?? []) {
        if (!row.created_at)
            continue;
        const key = toDateKey(row.created_at);
        ordersByDay.set(key, (ordersByDay.get(key) ?? 0) + 1);
    }
    const period_breakdowns = [];
    for (let i = 0; i < days; i += 1) {
        const day = new Date(start);
        day.setUTCDate(start.getUTCDate() + i);
        const key = toDateKey(day.toISOString());
        period_breakdowns.push({
            date: formatDateLabel(key),
            revenue: revenueByDay.get(key) ?? 0,
            orders: ordersByDay.get(key) ?? 0,
        });
    }
    const revenue_total = Array.from(revenueByDay.values()).reduce((sum, v) => sum + v, 0);
    const orders_total = Array.from(ordersByDay.values()).reduce((sum, v) => sum + v, 0);
    const avg_order_value = orders_total > 0 ? revenue_total / orders_total : 0;
    return {
        period,
        days,
        revenue_total,
        orders_total,
        avg_order_value,
        period_breakdowns,
    };
}
//# sourceMappingURL=platform-analytics.js.map