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
