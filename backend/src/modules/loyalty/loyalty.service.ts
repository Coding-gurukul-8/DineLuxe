import { supabaseAdmin } from '../../config/supabase';

const POINTS_PER_RUPEE = Number(process.env.LOYALTY_POINTS_PER_RUPEE ?? 0.1); // e.g. 1 pt per ₹10
const MIN_REDEEM_POINTS = Number(process.env.LOYALTY_MIN_REDEEM_POINTS ?? 50);
const RUPEES_PER_POINT = Number(process.env.LOYALTY_RUPEES_PER_POINT ?? 0.1);

// ─── Internal helper: get or create loyalty account ───────────────────────────

async function getOrCreateAccount(userId: string, restaurantId: string) {
  const { data: existing } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabaseAdmin
    .from('loyalty_accounts')
    .insert({ user_id: userId, restaurant_id: restaurantId, points_balance: 0, total_earned: 0 })
    .select()
    .single();

  if (error) throw error;
  return created;
}

// ─── Get loyalty balance ───────────────────────────────────────────────────────

export async function getBalance(
  userId: string,
): Promise<{ user_id: string; balance: number; total_earned: number; accounts: any[] }> {
  const { data, error } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('restaurant_id, points_balance, total_earned')
    .eq('user_id', userId);

  if (error) throw error;

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

export async function earn(
  userId: string,
  orderId: string,
  amountPaid: number,
  restaurantId: string,
): Promise<{ points_earned: number; new_balance: number }> {
  const { data: order, error: orderErr } = await supabaseAdmin
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

  const { data: branch, error: branchErr } = await supabaseAdmin
    .from('branches')
    .select('restaurant_id')
    .eq('id', order.branch_id)
    .single();

  if (branchErr || !branch?.restaurant_id || branch.restaurant_id !== restaurantId) {
    throw Object.assign(new Error('restaurant_id does not match order branch'), { statusCode: 422 });
  }

  const pointsEarned = Math.floor(amountPaid * POINTS_PER_RUPEE);
  if (pointsEarned <= 0) return { points_earned: 0, new_balance: 0 };

  const account = await getOrCreateAccount(userId, restaurantId);

  const { data: existingEarn } = await supabaseAdmin
    .from('loyalty_transactions')
    .select('id')
    .eq('loyalty_account_id', account.id)
    .eq('reference_id', orderId)
    .eq('reason', 'order_purchase')
    .maybeSingle();

  if (existingEarn) {
    throw Object.assign(new Error('Points already earned for this order'), { statusCode: 409 });
  }

  const { error: txErr } = await supabaseAdmin.from('loyalty_transactions').insert({
    loyalty_account_id: account.id,
    points_change: pointsEarned,
    reason: 'order_purchase',
    reference_id: orderId,
  });

  if (txErr) throw txErr;

  const newBalance = account.points_balance + pointsEarned;
  const newTotalEarned = account.total_earned + pointsEarned;

  const { error: updateErr } = await supabaseAdmin
    .from('loyalty_accounts')
    .update({ points_balance: newBalance, total_earned: newTotalEarned })
    .eq('id', account.id);

  if (updateErr) throw updateErr;

  return { points_earned: pointsEarned, new_balance: newBalance };
}

// ─── Redeem points against an order ───────────────────────────────────────────

export async function redeem(
  userId: string,
  orderId: string,
  pointsToRedeem: number,
  restaurantId: string,
): Promise<{ discount_amount: number; new_balance: number }> {
  if (!Number.isInteger(pointsToRedeem) || pointsToRedeem <= 0) {
    throw Object.assign(new Error('points_to_redeem must be a positive integer'), { statusCode: 400 });
  }
  if (pointsToRedeem < MIN_REDEEM_POINTS) {
    throw Object.assign(new Error(`Minimum redemption is ${MIN_REDEEM_POINTS} points`), {
      statusCode: 422,
    });
  }

  const { data: order, error: orderErr } = await supabaseAdmin
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

  const { data: branch, error: branchErr } = await supabaseAdmin
    .from('branches')
    .select('restaurant_id')
    .eq('id', order.branch_id)
    .single();

  if (branchErr || !branch?.restaurant_id || branch.restaurant_id !== restaurantId) {
    throw Object.assign(new Error('restaurant_id does not match order branch'), { statusCode: 422 });
  }

  const account = await getOrCreateAccount(userId, restaurantId);

  if (account.points_balance < pointsToRedeem) {
    throw Object.assign(
      new Error(`Insufficient points. Balance: ${account.points_balance}, requested: ${pointsToRedeem}`),
      { statusCode: 422 },
    );
  }

  const discountAmount = Math.round(pointsToRedeem * RUPEES_PER_POINT * 100) / 100;

  const { error: txErr } = await supabaseAdmin.from('loyalty_transactions').insert({
    loyalty_account_id: account.id,
    points_change: -pointsToRedeem,
    reason: 'redeemed',
    reference_id: orderId,
  });

  if (txErr) throw txErr;

  const newBalance = account.points_balance - pointsToRedeem;

  const { error: updateErr } = await supabaseAdmin
    .from('loyalty_accounts')
    .update({ points_balance: newBalance })
    .eq('id', account.id);

  if (updateErr) throw updateErr;

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (payment?.id) {
    const { error: payErr } = await supabaseAdmin
      .from('payments')
      .update({ discount_amount: discountAmount })
      .eq('id', payment.id);
    if (payErr) throw payErr;
  }

  return { discount_amount: discountAmount, new_balance: newBalance };
}

// ─── Get loyalty transaction history ──────────────────────────────────────────

export async function getHistory(
  userId: string,
  page: number,
  limit: number,
): Promise<{ data: any[]; count: number }> {
  const { data: accounts, error: accErr } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('id')
    .eq('user_id', userId);

  if (accErr) throw accErr;
  if (!accounts?.length) return { data: [], count: 0 };

  const accountIds = accounts.map((a) => a.id);
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('loyalty_transactions')
    .select('*', { count: 'exact' })
    .in('loyalty_account_id', accountIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// ─── Tier helpers ──────────────────────────────────────────────────────────────

function resolveTier(totalEarned: number): { tier: string; next_tier: string | null; points_to_next: number | null } {
  if (totalEarned >= 5000) return { tier: 'platinum', next_tier: null,       points_to_next: null };
  if (totalEarned >= 2000) return { tier: 'gold',     next_tier: 'platinum', points_to_next: 5000 - totalEarned };
  if (totalEarned >= 500)  return { tier: 'silver',   next_tier: 'gold',     points_to_next: 2000 - totalEarned };
  return                          { tier: 'bronze',   next_tier: 'silver',   points_to_next: 500  - totalEarned };
}

// ─── getCustomerLoyalty ────────────────────────────────────────────────────────
// Returns points_balance, tier, next_tier, and recent transaction history.

export async function getCustomerLoyalty(userId: string) {
  const { data: accounts, error: accErr } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('id, restaurant_id, points_balance, total_earned')
    .eq('user_id', userId);

  if (accErr) throw accErr;

  const points_balance = (accounts ?? []).reduce((s, a) => s + (a.points_balance ?? 0), 0);
  const total_earned   = (accounts ?? []).reduce((s, a) => s + (a.total_earned   ?? 0), 0);
  const tierInfo       = resolveTier(total_earned);

  let history: any[] = [];
  if (accounts?.length) {
    const accountIds = accounts.map((a) => a.id);
    const { data: txns } = await supabaseAdmin
      .from('loyalty_transactions')
      .select('*')
      .in('loyalty_account_id', accountIds)
      .order('created_at', { ascending: false })
      .limit(20);
    history = txns ?? [];
  }

  return {
    user_id:             userId,
    points_balance,
    total_earned,
    tier:                tierInfo.tier,
    next_tier:           tierInfo.next_tier,
    points_to_next_tier: tierInfo.points_to_next,
    accounts:            accounts ?? [],
    history,
  };
}

// ─── awardPoints ──────────────────────────────────────────────────────────────
// Calculate and award points (1 point per ₹10 spent).
// Wraps the existing `earn` function; requires restaurantId resolved from orderId.

export async function awardPoints(
  userId: string,
  orderId: string,
  amount: number,
): Promise<{ points_earned: number; new_balance: number }> {
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('branch_id')
    .eq('id', orderId)
    .single();

  if (orderErr || !order) throw Object.assign(new Error('Order not found'), { status: 404 });

  const { data: branch, error: branchErr } = await supabaseAdmin
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

export async function redeemPoints(
  userId: string,
  points: number,
  orderId: string,
): Promise<{ discount_amount: number; new_balance: number }> {
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('branch_id')
    .eq('id', orderId)
    .single();

  if (orderErr || !order) throw Object.assign(new Error('Order not found'), { status: 404 });

  const { data: branch, error: branchErr } = await supabaseAdmin
    .from('branches')
    .select('restaurant_id')
    .eq('id', order.branch_id)
    .single();

  if (branchErr || !branch?.restaurant_id) {
    throw Object.assign(new Error('Could not resolve restaurant for order'), { status: 422 });
  }

  const { data: accounts } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('points_balance')
    .eq('user_id', userId)
    .eq('restaurant_id', branch.restaurant_id)
    .maybeSingle();

  const currentBalance = accounts?.points_balance ?? 0;
  if (currentBalance < points) {
    throw Object.assign(
      new Error(`Insufficient points. Balance: ${currentBalance}, requested: ${points}`),
      { status: 422 },
    );
  }

  return redeem(userId, orderId, points, branch.restaurant_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner-facing service functions
// ─────────────────────────────────────────────────────────────────────────────

// ─── getLoyaltyStats ──────────────────────────────────────────────────────────
// Returns aggregate stats for the owner dashboard overview card.
// Counts distinct members, total points issued, redeemed, and active this month.

export async function getLoyaltyStats(restaurantId: string): Promise<{
  total_members: number;
  total_points_issued: number;
  total_points_redeemed: number;
  active_this_month: number;
}> {
  const { data: accounts, error: accErr } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('id, user_id, total_earned')
    .eq('restaurant_id', restaurantId);

  if (accErr) throw accErr;

  const accountList = accounts ?? [];
  const total_members = new Set(accountList.map((a) => a.user_id)).size;
  const total_points_issued = accountList.reduce((s, a) => s + (a.total_earned ?? 0), 0);

  const accountIds = accountList.map((a) => a.id);

  let total_points_redeemed = 0;
  if (accountIds.length > 0) {
    const { data: redemptions, error: redErr } = await supabaseAdmin
      .from('loyalty_transactions')
      .select('points_change')
      .in('loyalty_account_id', accountIds)
      .eq('reason', 'redeemed');

    if (redErr) throw redErr;
    total_points_redeemed = (redemptions ?? []).reduce(
      (s, t) => s + Math.abs(t.points_change),
      0,
    );
  }

  let active_this_month = 0;
  if (accountIds.length > 0) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: activeTxns, error: activeErr } = await supabaseAdmin
      .from('loyalty_transactions')
      .select('loyalty_account_id')
      .in('loyalty_account_id', accountIds)
      .gte('created_at', startOfMonth.toISOString());

    if (activeErr) throw activeErr;

    const activeAccountIds = new Set(
      (activeTxns ?? []).map((t) => t.loyalty_account_id),
    );
    const activeUserIds = new Set(
      accountList
        .filter((a) => activeAccountIds.has(a.id))
        .map((a) => a.user_id),
    );
    active_this_month = activeUserIds.size;
  }

  return { total_members, total_points_issued, total_points_redeemed, active_this_month };
}

// ─── updateLoyaltySettings ────────────────────────────────────────────────────
// Persists settings to a loyalty_settings table keyed by restaurant_id.
//
// Required migration (run once):
//   CREATE TABLE IF NOT EXISTS loyalty_settings (
//     restaurant_id         UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
//     rupees_per_point      NUMERIC(10,2)  NOT NULL DEFAULT 10,
//     rupees_per_redemption NUMERIC(10,4)  NOT NULL DEFAULT 0.1,
//     min_redeem_points     INTEGER        NOT NULL DEFAULT 50,
//     updated_at            TIMESTAMPTZ    NOT NULL DEFAULT now()
//   );

export async function updateLoyaltySettings(
  restaurantId: string,
  rupees_per_point: number,
  rupees_per_redemption: number,
  min_redeem_points: number,
): Promise<{
  restaurant_id: string;
  rupees_per_point: number;
  rupees_per_redemption: number;
  min_redeem_points: number;
}> {
  if (rupees_per_point < 1 || rupees_per_point > 100) {
    throw Object.assign(new Error('rupees_per_point must be between 1 and 100'), { statusCode: 422 });
  }
  if (rupees_per_redemption <= 0) {
    throw Object.assign(new Error('rupees_per_redemption must be > 0'), { statusCode: 422 });
  }
  if (!Number.isInteger(min_redeem_points) || min_redeem_points < 1) {
    throw Object.assign(new Error('min_redeem_points must be a positive integer'), { statusCode: 422 });
  }

  const payload = {
    restaurant_id: restaurantId,
    rupees_per_point,
    rupees_per_redemption,
    min_redeem_points,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('loyalty_settings')
    .upsert(payload, { onConflict: 'restaurant_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── getLoyaltyLeaderboard ────────────────────────────────────────────────────
// Returns top N customers for a restaurant sorted by current points_balance,
// including first_name and last visit date derived from latest transaction.

export async function getLoyaltyLeaderboard(
  restaurantId: string,
  limit: number = 10,
): Promise<Array<{
  user_id: string;
  first_name: string;
  points_balance: number;
  total_earned: number;
  last_visit: string | null;
}>> {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));

  const { data: accounts, error: accErr } = await supabaseAdmin
    .from('loyalty_accounts')
    .select('id, user_id, points_balance, total_earned')
    .eq('restaurant_id', restaurantId)
    .order('points_balance', { ascending: false })
    .limit(safeLimit);

  if (accErr) throw accErr;
  if (!accounts?.length) return [];

  const accountIds = accounts.map((a) => a.id);
  const userIds = accounts.map((a) => a.user_id);

  const { data: users, error: userErr } = await supabaseAdmin
    .from('users')
    .select('id, first_name')
    .in('id', userIds);

  if (userErr) throw userErr;

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.first_name]));

  const { data: txns, error: txnErr } = await supabaseAdmin
    .from('loyalty_transactions')
    .select('loyalty_account_id, created_at')
    .in('loyalty_account_id', accountIds)
    .order('created_at', { ascending: false });

  if (txnErr) throw txnErr;

  const lastVisitMap: Record<string, string> = {};
  for (const txn of txns ?? []) {
    if (!lastVisitMap[txn.loyalty_account_id]) {
      lastVisitMap[txn.loyalty_account_id] = txn.created_at;
    }
  }

  return accounts.map((acc) => ({
    user_id:       acc.user_id,
    first_name:    userMap[acc.user_id] ?? 'Member',
    points_balance: acc.points_balance,
    total_earned:  acc.total_earned,
    last_visit:    lastVisitMap[acc.id] ?? null,
  }));
}

// ─── adminAdjustPoints ────────────────────────────────────────────────────────
// Looks up a customer by phone number within this restaurant's user base,
// then credits (or debits if points is negative) their loyalty account.
// Records the adjustment in loyalty_transactions with reason = 'admin_adjustment'.

export async function adminAdjustPoints(
  restaurantId: string,
  phone: string,
  points: number,
  reason: string,
): Promise<{
  user_id: string;
  first_name: string;
  new_balance: number;
  points_change: number;
}> {
  if (!phone?.trim()) {
    throw Object.assign(new Error('phone is required'), { statusCode: 400 });
  }
  if (!Number.isInteger(points) || points === 0) {
    throw Object.assign(new Error('points must be a non-zero integer'), { statusCode: 400 });
  }
  if (!reason?.trim()) {
    throw Object.assign(new Error('reason is required for admin adjustments'), { statusCode: 400 });
  }

  const { data: user, error: userErr } = await supabaseAdmin
    .from('users')
    .select('id, first_name')
    .eq('phone', phone.trim())
    .maybeSingle();

  if (userErr) throw userErr;
  if (!user) {
    throw Object.assign(
      new Error(`No customer found with phone ${phone}`),
      { statusCode: 404 },
    );
  }

  const account = await getOrCreateAccount(user.id, restaurantId);

  if (points < 0 && account.points_balance + points < 0) {
    throw Object.assign(
      new Error(
        `Cannot deduct ${Math.abs(points)} points — balance is only ${account.points_balance}`,
      ),
      { statusCode: 422 },
    );
  }

  const { error: txErr } = await supabaseAdmin.from('loyalty_transactions').insert({
    loyalty_account_id: account.id,
    points_change: points,
    reason: 'admin_adjustment',
    reference_id: null,
    notes: reason.trim(),
  });

  if (txErr) throw txErr;

  const newBalance = account.points_balance + points;
  const newTotalEarned =
    points > 0 ? account.total_earned + points : account.total_earned;

  const { error: updateErr } = await supabaseAdmin
    .from('loyalty_accounts')
    .update({ points_balance: newBalance, total_earned: newTotalEarned })
    .eq('id', account.id);

  if (updateErr) throw updateErr;

  return {
    user_id:      user.id,
    first_name:   user.first_name,
    new_balance:  newBalance,
    points_change: points,
  };
}