"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalance = getBalance;
exports.earn = earn;
exports.redeem = redeem;
exports.getHistory = getHistory;
exports.getCustomerLoyalty = getCustomerLoyalty;
exports.awardPoints = awardPoints;
exports.redeemPoints = redeemPoints;
const supabase_1 = require("../../config/supabase");
const POINTS_PER_RUPEE = Number(process.env.LOYALTY_POINTS_PER_RUPEE ?? 0.1); // e.g. 1 pt per ₹10
const MIN_REDEEM_POINTS = Number(process.env.LOYALTY_MIN_REDEEM_POINTS ?? 50);
const RUPEES_PER_POINT = Number(process.env.LOYALTY_RUPEES_PER_POINT ?? 0.1);
// ─── Internal helper: get or create loyalty account ───────────────────────────
async function getOrCreateAccount(userId, restaurantId) {
    const { data: existing } = await supabase_1.supabaseAdmin
        .from('loyalty_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
    if (existing)
        return existing;
    const { data: created, error } = await supabase_1.supabaseAdmin
        .from('loyalty_accounts')
        .insert({ user_id: userId, restaurant_id: restaurantId, points_balance: 0, total_earned: 0 })
        .select()
        .single();
    if (error)
        throw error;
    return created;
}
// ─── Get loyalty balance ───────────────────────────────────────────────────────
async function getBalance(userId) {
    const { data, error } = await supabase_1.supabaseAdmin
        .from('loyalty_accounts')
        .select('restaurant_id, points_balance, total_earned')
        .eq('user_id', userId);
    if (error)
        throw error;
    const totalBalance = (data ?? []).reduce((sum, a) => sum + a.points_balance, 0);
    const totalEarned = (data ?? []).reduce((sum, a) => sum + a.total_earned, 0);
    return {
        user_id: userId,
        balance: totalBalance,
        total_earned: totalEarned,
        accounts: data ?? [],
    };
}
// ─── Earn points on order completion ──────────────────────────────────────────
async function earn(userId, orderId, amountPaid, restaurantId) {
    const { data: order, error: orderErr } = await supabase_1.supabaseAdmin
        .from('orders')
        .select('id, customer_id, status, branch_id')
        .eq('id', orderId)
        .single();
    if (orderErr || !order) {
        throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    }
    if (order.customer_id !== userId) {
        throw Object.assign(new Error('You can only earn points on your own orders'), { statusCode: 403 });
    }
    if (order.status !== 'paid') {
        throw Object.assign(new Error('Order must be paid before earning points'), { statusCode: 422 });
    }
    const { data: branch, error: branchErr } = await supabase_1.supabaseAdmin
        .from('branches')
        .select('restaurant_id')
        .eq('id', order.branch_id)
        .single();
    if (branchErr || !branch?.restaurant_id || branch.restaurant_id !== restaurantId) {
        throw Object.assign(new Error('restaurant_id does not match order branch'), { statusCode: 422 });
    }
    const pointsEarned = Math.floor(amountPaid * POINTS_PER_RUPEE);
    if (pointsEarned <= 0)
        return { points_earned: 0, new_balance: 0 };
    const account = await getOrCreateAccount(userId, restaurantId);
    const { data: existingEarn } = await supabase_1.supabaseAdmin
        .from('loyalty_transactions')
        .select('id')
        .eq('loyalty_account_id', account.id)
        .eq('reference_id', orderId)
        .eq('reason', 'order_purchase')
        .maybeSingle();
    if (existingEarn) {
        throw Object.assign(new Error('Points already earned for this order'), { statusCode: 409 });
    }
    const { error: txErr } = await supabase_1.supabaseAdmin.from('loyalty_transactions').insert({
        loyalty_account_id: account.id,
        points_change: pointsEarned,
        reason: 'order_purchase',
        reference_id: orderId,
    });
    if (txErr)
        throw txErr;
    const newBalance = account.points_balance + pointsEarned;
    const newTotalEarned = account.total_earned + pointsEarned;
    const { error: updateErr } = await supabase_1.supabaseAdmin
        .from('loyalty_accounts')
        .update({ points_balance: newBalance, total_earned: newTotalEarned })
        .eq('id', account.id);
    if (updateErr)
        throw updateErr;
    return { points_earned: pointsEarned, new_balance: newBalance };
}
// ─── Redeem points against an order ───────────────────────────────────────────
async function redeem(userId, orderId, pointsToRedeem, restaurantId) {
    if (!Number.isInteger(pointsToRedeem) || pointsToRedeem <= 0) {
        throw Object.assign(new Error('points_to_redeem must be a positive integer'), { statusCode: 400 });
    }
    if (pointsToRedeem < MIN_REDEEM_POINTS) {
        throw Object.assign(new Error(`Minimum redemption is ${MIN_REDEEM_POINTS} points`), {
            statusCode: 422,
        });
    }
    const { data: order, error: orderErr } = await supabase_1.supabaseAdmin
        .from('orders')
        .select('id, customer_id, status, branch_id')
        .eq('id', orderId)
        .single();
    if (orderErr || !order) {
        throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    }
    if (order.customer_id !== userId) {
        throw Object.assign(new Error('You can only redeem on your own orders'), { statusCode: 403 });
    }
    if (['paid', 'closed'].includes(order.status)) {
        throw Object.assign(new Error('Cannot redeem points on a paid or closed order'), { statusCode: 422 });
    }
    const { data: branch, error: branchErr } = await supabase_1.supabaseAdmin
        .from('branches')
        .select('restaurant_id')
        .eq('id', order.branch_id)
        .single();
    if (branchErr || !branch?.restaurant_id || branch.restaurant_id !== restaurantId) {
        throw Object.assign(new Error('restaurant_id does not match order branch'), { statusCode: 422 });
    }
    const account = await getOrCreateAccount(userId, restaurantId);
    if (account.points_balance < pointsToRedeem) {
        throw Object.assign(new Error(`Insufficient points. Balance: ${account.points_balance}, requested: ${pointsToRedeem}`), { statusCode: 422 });
    }
    const discountAmount = Math.round(pointsToRedeem * RUPEES_PER_POINT * 100) / 100;
    const { error: txErr } = await supabase_1.supabaseAdmin.from('loyalty_transactions').insert({
        loyalty_account_id: account.id,
        points_change: -pointsToRedeem,
        reason: 'redeemed',
        reference_id: orderId,
    });
    if (txErr)
        throw txErr;
    const newBalance = account.points_balance - pointsToRedeem;
    const { error: updateErr } = await supabase_1.supabaseAdmin
        .from('loyalty_accounts')
        .update({ points_balance: newBalance })
        .eq('id', account.id);
    if (updateErr)
        throw updateErr;
    const { data: payment } = await supabase_1.supabaseAdmin
        .from('payments')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();
    if (payment?.id) {
        const { error: payErr } = await supabase_1.supabaseAdmin
            .from('payments')
            .update({ discount_amount: discountAmount })
            .eq('id', payment.id);
        if (payErr)
            throw payErr;
    }
    return { discount_amount: discountAmount, new_balance: newBalance };
}
// ─── Get loyalty transaction history ──────────────────────────────────────────
async function getHistory(userId, page, limit) {
    const { data: accounts, error: accErr } = await supabase_1.supabaseAdmin
        .from('loyalty_accounts')
        .select('id')
        .eq('user_id', userId);
    if (accErr)
        throw accErr;
    if (!accounts?.length)
        return { data: [], count: 0 };
    const accountIds = accounts.map((a) => a.id);
    const offset = (page - 1) * limit;
    const { data, error, count } = await supabase_1.supabaseAdmin
        .from('loyalty_transactions')
        .select('*', { count: 'exact' })
        .in('loyalty_account_id', accountIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error)
        throw error;
    return { data: data ?? [], count: count ?? 0 };
}
// ─── Tier helpers ──────────────────────────────────────────────────────────────
function resolveTier(totalEarned) {
    if (totalEarned >= 5000)
        return { tier: 'platinum', next_tier: null, points_to_next: null };
    if (totalEarned >= 2000)
        return { tier: 'gold', next_tier: 'platinum', points_to_next: 5000 - totalEarned };
    if (totalEarned >= 500)
        return { tier: 'silver', next_tier: 'gold', points_to_next: 2000 - totalEarned };
    return { tier: 'bronze', next_tier: 'silver', points_to_next: 500 - totalEarned };
}
// ─── getCustomerLoyalty ────────────────────────────────────────────────────────
// Returns points_balance, tier, next_tier, and recent transaction history.
async function getCustomerLoyalty(userId) {
    const { data: accounts, error: accErr } = await supabase_1.supabaseAdmin
        .from('loyalty_accounts')
        .select('id, restaurant_id, points_balance, total_earned')
        .eq('user_id', userId);
    if (accErr)
        throw accErr;
    const points_balance = (accounts ?? []).reduce((s, a) => s + (a.points_balance ?? 0), 0);
    const total_earned = (accounts ?? []).reduce((s, a) => s + (a.total_earned ?? 0), 0);
    const tierInfo = resolveTier(total_earned);
    let history = [];
    if (accounts?.length) {
        const accountIds = accounts.map((a) => a.id);
        const { data: txns } = await supabase_1.supabaseAdmin
            .from('loyalty_transactions')
            .select('*')
            .in('loyalty_account_id', accountIds)
            .order('created_at', { ascending: false })
            .limit(20);
        history = txns ?? [];
    }
    return {
        user_id: userId,
        points_balance,
        total_earned,
        tier: tierInfo.tier,
        next_tier: tierInfo.next_tier,
        points_to_next_tier: tierInfo.points_to_next,
        accounts: accounts ?? [],
        history,
    };
}
// ─── awardPoints ──────────────────────────────────────────────────────────────
// Calculate and award points (1 point per ₹10 spent).
// Wraps the existing `earn` function; requires restaurantId resolved from orderId.
async function awardPoints(userId, orderId, amount) {
    // Resolve restaurantId from the order's branch
    const { data: order, error: orderErr } = await supabase_1.supabaseAdmin
        .from('orders')
        .select('branch_id')
        .eq('id', orderId)
        .single();
    if (orderErr || !order)
        throw Object.assign(new Error('Order not found'), { status: 404 });
    const { data: branch, error: branchErr } = await supabase_1.supabaseAdmin
        .from('branches')
        .select('restaurant_id')
        .eq('id', order.branch_id)
        .single();
    if (branchErr || !branch?.restaurant_id) {
        throw Object.assign(new Error('Could not resolve restaurant for order'), { status: 422 });
    }
    return earn(userId, orderId, amount, branch.restaurant_id);
}
// ─── redeemPoints ─────────────────────────────────────────────────────────────
// Deduct points and validate sufficient balance.
// Wraps the existing `redeem` function; restaurantId resolved from orderId.
async function redeemPoints(userId, points, orderId) {
    // Resolve restaurantId from the order's branch
    const { data: order, error: orderErr } = await supabase_1.supabaseAdmin
        .from('orders')
        .select('branch_id')
        .eq('id', orderId)
        .single();
    if (orderErr || !order)
        throw Object.assign(new Error('Order not found'), { status: 404 });
    const { data: branch, error: branchErr } = await supabase_1.supabaseAdmin
        .from('branches')
        .select('restaurant_id')
        .eq('id', order.branch_id)
        .single();
    if (branchErr || !branch?.restaurant_id) {
        throw Object.assign(new Error('Could not resolve restaurant for order'), { status: 422 });
    }
    // Validate sufficient balance before delegating
    const { data: accounts } = await supabase_1.supabaseAdmin
        .from('loyalty_accounts')
        .select('points_balance')
        .eq('user_id', userId)
        .eq('restaurant_id', branch.restaurant_id)
        .maybeSingle();
    const currentBalance = accounts?.points_balance ?? 0;
    if (currentBalance < points) {
        throw Object.assign(new Error(`Insufficient points. Balance: ${currentBalance}, requested: ${points}`), { status: 422 });
    }
    return redeem(userId, orderId, points, branch.restaurant_id);
}
//# sourceMappingURL=loyalty.service.js.map