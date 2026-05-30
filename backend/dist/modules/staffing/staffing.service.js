"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.predictDemand = predictDemand;
exports.getStaffingRecommendation = getStaffingRecommendation;
exports.getWeeklyForecast = getWeeklyForecast;
const supabase_1 = require("../../config/supabase");
const redis_1 = require("../../config/redis");
// ─── Redis key helpers ────────────────────────────────────────────────────────
const predictionCacheKey = (branchId, dateStr) => `staffing_prediction:${branchId}:${dateStr}`;
const CACHE_TTL = 60 * 60 * 2; // 2 hours
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Map JS getDay() (0=Sun) to Postgres EXTRACT(DOW) (0=Sun) — they match. */
function getDayOfWeek(dateStr) {
    // Parse as local midnight to avoid UTC shift affecting the day
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).getDay();
}
/** Add N days to a YYYY-MM-DD string, returning another YYYY-MM-DD string. */
function addDays(dateStr, n) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}
/** Compute confidence based on number of distinct weeks represented in data. */
function computeConfidence(weeksWithData) {
    if (weeksWithData >= 6)
        return 'high';
    if (weeksWithData >= 3)
        return 'medium';
    return 'low';
}
// ─── predictDemand ────────────────────────────────────────────────────────────
/**
 * Queries historical orders for the same day-of-week over the last 8 weeks and
 * returns an hourly predicted order count with confidence level for hours 9–23.
 *
 * Cache key: 'staffing_prediction:{branchId}:{dateStr}'  TTL: 2 hours
 */
async function predictDemand(branchId, restaurantId, targetDate) {
    const cacheKey = predictionCacheKey(branchId, targetDate);
    const cached = await redis_1.redis.get(cacheKey);
    if (cached)
        return JSON.parse(cached);
    const targetDayOfWeek = getDayOfWeek(targetDate);
    // Use Supabase RPC if available; fall back to client-side aggregation.
    // We fetch raw orders for the same DOW in the last 8 weeks and aggregate in JS
    // to avoid relying on a custom RPC that may not exist yet.
    const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders, error } = await supabase_1.supabaseAdmin
        .from('orders')
        .select('id, created_at')
        .eq('branch_id', branchId)
        .gte('created_at', eightWeeksAgo);
    if (error)
        throw error;
    // Filter to matching day-of-week on the server side (Supabase doesn't expose
    // EXTRACT directly in the JS client filter chain)
    const matchingOrders = (orders ?? []).filter((o) => {
        const d = new Date(o.created_at);
        return d.getDay() === targetDayOfWeek;
    });
    // Group by ISO week + hour to count distinct weeks and per-hour order totals
    const hourTotals = {}; // hour → total orders across all weeks
    const weeksSeen = new Set(); // unique week identifiers
    for (const order of matchingOrders) {
        const d = new Date(order.created_at);
        const hour = d.getHours();
        // ISO week key: year-W<weekNumber>
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
        weeksSeen.add(`${d.getFullYear()}-W${weekNum}`);
        hourTotals[hour] = (hourTotals[hour] ?? 0) + 1;
    }
    const weeksWithData = weeksSeen.size;
    const divisor = Math.max(weeksWithData, 1); // avoid div-by-zero
    const confidence = computeConfidence(weeksWithData);
    // Build predictions for operating hours 9–23
    const predictions = [];
    for (let hour = 9; hour <= 23; hour++) {
        const avgOrders = Math.round((hourTotals[hour] ?? 0) / divisor);
        predictions.push({
            hour,
            predicted_orders: avgOrders,
            confidence,
        });
    }
    await redis_1.redis.setex(cacheKey, CACHE_TTL, JSON.stringify(predictions));
    return predictions;
}
// ─── getStaffingRecommendation ────────────────────────────────────────────────
/**
 * Returns hourly staffing requirements based on demand predictions,
 * compares against currently scheduled staff, and generates warnings.
 */
async function getStaffingRecommendation(branchId, restaurantId, targetDate) {
    // 1. Get hourly demand predictions
    const predictions = await predictDemand(branchId, restaurantId, targetDate);
    // 2. Build per-hour staffing recommendations
    const recommendations = predictions.map((p) => ({
        hour: p.hour,
        waiters: Math.max(1, Math.ceil(p.predicted_orders / 15)),
        chefs: Math.max(1, Math.ceil(p.predicted_orders / 20)),
        cashiers: Math.max(1, Math.ceil(p.predicted_orders / 40)),
    }));
    // 3. Identify peak hours (predicted_orders > average)
    const totalOrders = predictions.reduce((s, p) => s + p.predicted_orders, 0);
    const avgOrders = totalOrders / Math.max(predictions.length, 1);
    const peakHours = predictions
        .filter((p) => p.predicted_orders > avgOrders * 1.2)
        .map((p) => p.hour);
    // 4. Fetch currently scheduled staff for the target date
    //    Assumes a 'shifts' table with columns: branch_id, shift_date, role, COUNT(*)
    //    Falls back to zeros if the table/data doesn't exist yet.
    const currentScheduled = { waiter: 0, chef: 0, cashier: 0, host: 0 };
    try {
        const { data: shifts } = await supabase_1.supabaseAdmin
            .from('shifts')
            .select('role')
            .eq('branch_id', branchId)
            .eq('shift_date', targetDate);
        for (const shift of shifts ?? []) {
            const role = shift.role;
            if (role in currentScheduled) {
                currentScheduled[role] += 1;
            }
        }
    }
    catch {
        // Shifts table may not exist yet — proceed with zeros
    }
    // 5. Generate warnings for understaffed peak hours
    const warnings = [];
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][getDayOfWeek(targetDate)];
    for (const rec of recommendations) {
        if (!peakHours.includes(rec.hour))
            continue;
        if (currentScheduled.waiter < rec.waiters) {
            warnings.push(`${dayName} ${rec.hour}:00 needs ${rec.waiters} waiter(s), only ${currentScheduled.waiter} scheduled`);
        }
        if (currentScheduled.chef < rec.chefs) {
            warnings.push(`${dayName} ${rec.hour}:00 needs ${rec.chefs} chef(s), only ${currentScheduled.chef} scheduled`);
        }
        if (currentScheduled.cashier < rec.cashiers) {
            warnings.push(`${dayName} ${rec.hour}:00 needs ${rec.cashiers} cashier(s), only ${currentScheduled.cashier} scheduled`);
        }
    }
    // Deduplicate warnings (same role/count may fire for consecutive peak hours)
    const uniqueWarnings = [...new Set(warnings)];
    return {
        date: targetDate,
        peak_hours: peakHours,
        recommendations,
        current_scheduled: currentScheduled,
        warnings: uniqueWarnings,
    };
}
// ─── getWeeklyForecast ────────────────────────────────────────────────────────
/**
 * Returns staffing recommendations for 7 consecutive days starting from weekStart.
 * weekStart must be a YYYY-MM-DD string.
 */
async function getWeeklyForecast(branchId, restaurantId, weekStart) {
    const days = [];
    for (let i = 0; i < 7; i++) {
        const dateStr = addDays(weekStart, i);
        days.push(getStaffingRecommendation(branchId, restaurantId, dateStr));
    }
    // Run all 7 days in parallel — each has its own Redis cache
    return Promise.all(days);
}
//# sourceMappingURL=staffing.service.js.map