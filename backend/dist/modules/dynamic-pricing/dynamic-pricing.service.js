"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRulesForBranch = getRulesForBranch;
exports.getActiveRulesNow = getActiveRulesNow;
exports.createRule = createRule;
exports.updateRule = updateRule;
exports.toggleRule = toggleRule;
exports.deleteRule = deleteRule;
const supabase_1 = require("../../config/supabase");
const redis_1 = require("../../config/redis");
const server_1 = require("../../server");
const CACHE_TTL = 60 * 5; // 5 minutes
const cacheKey = (branchId) => `dynamic_pricing:${branchId}`;
// ─── Cache helpers ────────────────────────────────────────────────────────────
async function bustCache(branchId) {
    await redis_1.redis.del(cacheKey(branchId));
}
// ─── IST helpers ──────────────────────────────────────────────────────────────
/** Returns current time in HH:MM:SS (IST = UTC+5:30) */
function getISTTime() {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const istMs = utcMs + 5.5 * 60 * 60000;
    const ist = new Date(istMs);
    const hh = String(ist.getHours()).padStart(2, '0');
    const mm = String(ist.getMinutes()).padStart(2, '0');
    const ss = String(ist.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}
/** Returns current day-of-week in IST (0 = Sunday, 6 = Saturday) */
function getISTDayOfWeek() {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const istMs = utcMs + 5.5 * 60 * 60000;
    return new Date(istMs).getDay();
}
// ─── Service functions ────────────────────────────────────────────────────────
/**
 * Fetch all pricing rules for a branch with Redis caching.
 * Joins menu_items for item name and menu_categories for category name.
 */
async function getRulesForBranch(branchId, restaurantId) {
    const key = cacheKey(branchId);
    const cached = await redis_1.redis.get(key);
    if (cached)
        return JSON.parse(cached);
    const { data, error } = await supabase_1.supabaseAdmin
        .from('dynamic_pricing_rules')
        .select(`
      *,
      menu_items ( id, name ),
      menu_categories ( id, name )
    `)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false });
    if (error)
        throw error;
    const rules = (data ?? []).map((rule) => ({
        ...rule,
        item_name: rule.menu_items?.name ?? null,
        category_name: rule.menu_categories?.name ?? null,
        menu_items: undefined,
        menu_categories: undefined,
    }));
    await redis_1.redis.setex(key, CACHE_TTL, JSON.stringify(rules));
    return rules;
}
/**
 * Filter and return only the rules that are active RIGHT NOW (IST).
 * Used by the menu service to compute real-time discounted prices.
 */
async function getActiveRulesNow(branchId) {
    const { data, error } = await supabase_1.supabaseAdmin
        .from('dynamic_pricing_rules')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_active', true);
    if (error)
        throw error;
    const currentTime = getISTTime(); // e.g. "14:30:00"
    const currentDay = getISTDayOfWeek(); // e.g. 2 (Tuesday)
    const active = (data ?? []).filter((rule) => {
        const inDays = Array.isArray(rule.days_of_week) && rule.days_of_week.includes(currentDay);
        const inTime = currentTime >= rule.start_time && currentTime <= rule.end_time;
        return inDays && inTime;
    });
    return active;
}
/**
 * Create a new dynamic pricing rule for a branch.
 * Verifies branch ownership and (if provided) item ownership before inserting.
 */
async function createRule(branchId, restaurantId, data, createdBy) {
    // Verify branch belongs to this restaurant
    const { data: branch, error: branchErr } = await supabase_1.supabaseAdmin
        .from('branches')
        .select('id')
        .eq('id', branchId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
    if (branchErr)
        throw branchErr;
    if (!branch) {
        throw Object.assign(new Error('Branch not found or does not belong to this restaurant'), {
            statusCode: 404,
        });
    }
    // If menu_item_id provided, verify it belongs to this branch
    if (data.menu_item_id) {
        const { data: item, error: itemErr } = await supabase_1.supabaseAdmin
            .from('menu_items')
            .select('id')
            .eq('id', data.menu_item_id)
            .eq('branch_id', branchId)
            .maybeSingle();
        if (itemErr)
            throw itemErr;
        if (!item) {
            throw Object.assign(new Error('Menu item not found or does not belong to this branch'), {
                statusCode: 404,
            });
        }
    }
    // If menu_category_id provided, verify it belongs to this branch
    if (data.menu_category_id) {
        const { data: category, error: catErr } = await supabase_1.supabaseAdmin
            .from('menu_categories')
            .select('id')
            .eq('id', data.menu_category_id)
            .eq('branch_id', branchId)
            .maybeSingle();
        if (catErr)
            throw catErr;
        if (!category) {
            throw Object.assign(new Error('Menu category not found or does not belong to this branch'), { statusCode: 404 });
        }
    }
    const { data: rule, error } = await supabase_1.supabaseAdmin
        .from('dynamic_pricing_rules')
        .insert({
        ...data,
        branch_id: branchId,
        created_by: createdBy,
        is_active: true,
    })
        .select()
        .single();
    if (error)
        throw error;
    await bustCache(branchId);
    return rule;
}
/**
 * Update an existing pricing rule.
 * Verifies ownership: rule.branch_id === branchId AND branch.restaurant_id === restaurantId.
 */
async function updateRule(ruleId, branchId, restaurantId, updates) {
    // Verify ownership
    const { data: existing, error: findErr } = await supabase_1.supabaseAdmin
        .from('dynamic_pricing_rules')
        .select('id, branch_id, branches!inner(restaurant_id)')
        .eq('id', ruleId)
        .eq('branch_id', branchId)
        .maybeSingle();
    if (findErr)
        throw findErr;
    if (!existing) {
        throw Object.assign(new Error('Pricing rule not found'), { statusCode: 404 });
    }
    const branchRestaurantId = existing.branches?.restaurant_id;
    if (branchRestaurantId !== restaurantId) {
        throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const { data: rule, error } = await supabase_1.supabaseAdmin
        .from('dynamic_pricing_rules')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', ruleId)
        .select()
        .single();
    if (error)
        throw error;
    await bustCache(branchId);
    return rule;
}
/**
 * Toggle the is_active boolean on a rule and emit a WebSocket event
 * so the customer app can refresh the menu in real-time.
 */
async function toggleRule(ruleId, branchId, restaurantId) {
    // Verify ownership
    const { data: existing, error: findErr } = await supabase_1.supabaseAdmin
        .from('dynamic_pricing_rules')
        .select('id, is_active, branch_id, branches!inner(restaurant_id)')
        .eq('id', ruleId)
        .eq('branch_id', branchId)
        .maybeSingle();
    if (findErr)
        throw findErr;
    if (!existing) {
        throw Object.assign(new Error('Pricing rule not found'), { statusCode: 404 });
    }
    const branchRestaurantId = existing.branches?.restaurant_id;
    if (branchRestaurantId !== restaurantId) {
        throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const newActive = !existing.is_active;
    const { data: rule, error } = await supabase_1.supabaseAdmin
        .from('dynamic_pricing_rules')
        .update({ is_active: newActive, updated_at: new Date().toISOString() })
        .eq('id', ruleId)
        .select()
        .single();
    if (error)
        throw error;
    await bustCache(branchId);
    // Emit WebSocket event to the branch room so the customer app refreshes the menu
    server_1.io.to(`branch:${branchId}`).emit('menu_updated', {
        branchId,
        trigger: 'dynamic_pricing_toggled',
        ruleId,
        is_active: newActive,
    });
    return rule;
}
/**
 * Permanently delete a pricing rule after verifying ownership.
 */
async function deleteRule(ruleId, branchId, restaurantId) {
    // Verify ownership
    const { data: existing, error: findErr } = await supabase_1.supabaseAdmin
        .from('dynamic_pricing_rules')
        .select('id, branch_id, branches!inner(restaurant_id)')
        .eq('id', ruleId)
        .eq('branch_id', branchId)
        .maybeSingle();
    if (findErr)
        throw findErr;
    if (!existing) {
        throw Object.assign(new Error('Pricing rule not found'), { statusCode: 404 });
    }
    const branchRestaurantId = existing.branches?.restaurant_id;
    if (branchRestaurantId !== restaurantId) {
        throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
    const { error } = await supabase_1.supabaseAdmin
        .from('dynamic_pricing_rules')
        .delete()
        .eq('id', ruleId);
    if (error)
        throw error;
    await bustCache(branchId);
    return { deleted: true };
}
//# sourceMappingURL=dynamic-pricing.service.js.map