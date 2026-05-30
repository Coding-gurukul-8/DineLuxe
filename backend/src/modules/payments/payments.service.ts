/**
 * Payments Service
 *
 * TODO markers indicate where real payment gateway integration goes.
 * Currently implements stub logic for development & testing.
 *
 * Gateway candidates: Razorpay (recommended for INR), Stripe (international)
 */

import QRCode from 'qrcode';
import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import type { InitiateInput, VerifyInput, SplitInput, UPIQRInput } from './payments.schema';

interface CouponRow {
  id: string;
  restaurant_id: string;
  code: string;
  discount_type: string;
  discount_value: string | number;
  min_order_amount: string | number | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
}

interface CouponValidationResult {
  valid: boolean;
  discount_amount: number;
  coupon_id: string;
  error_code?: string;
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function couponError(errorCode: string, message: string): never {
  throw Object.assign(new Error(message), { statusCode: 422, errorCode });
}

function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

async function fetchCoupon(code: string, restaurantId: string): Promise<CouponRow | null> {
  const { data, error } = await supabaseAdmin
    .from('coupons')
    .select('id, restaurant_id, code, discount_type, discount_value, min_order_amount, max_uses, used_count, expires_at, is_active')
    .eq('code', normalizeCouponCode(code))
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error) throw error;
  return (data as CouponRow | null) ?? null;
}

async function validateCoupon(
  code: string,
  orderId: string,
  orderAmount: number,
  orderType: string,
  userId: string,
  restaurantId: string,
): Promise<CouponValidationResult> {
  const coupon = await fetchCoupon(code, restaurantId);

  if (!coupon) {
    couponError('COUPON_NOT_FOUND', 'Coupon not found');
  }

  if (!coupon.is_active) {
    couponError('COUPON_INACTIVE', 'Coupon is inactive');
  }

  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    couponError('COUPON_EXPIRED', 'Coupon has expired');
  }

  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    couponError('COUPON_EXHAUSTED', 'Coupon has reached its usage limit');
  }

  const minimumOrderAmount = coupon.min_order_amount === null ? null : Number(coupon.min_order_amount);
  if (minimumOrderAmount !== null && orderAmount < minimumOrderAmount) {
    couponError('MINIMUM_NOT_MET', `Minimum order amount of ${minimumOrderAmount} is required`);
  }

  const discountValue = Number(coupon.discount_value);
  const discountType = coupon.discount_type.toLowerCase();
  let discountAmount = 0;

  if (discountType === 'percent' || discountType === 'percentage') {
    discountAmount = (discountValue / 100) * orderAmount;
  } else {
    discountAmount = discountValue;
  }

  discountAmount = roundMoney(Math.min(discountAmount, orderAmount));

  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    couponError('COUPON_INVALID', 'Coupon could not be applied');
  }

  return {
    valid: true,
    discount_amount: discountAmount,
    coupon_id: coupon.id,
  };
}

async function redeemCoupon(couponId: string, userId: string, orderId: string): Promise<void> {
  const redemptionKey = `coupon_redeemed:${couponId}:${orderId}`;
  const alreadyRedeemed = await redis.get(redemptionKey);

  if (alreadyRedeemed) return;

  const { data: coupon, error: fetchError } = await supabaseAdmin
    .from('coupons')
    .select('used_count')
    .eq('id', couponId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const nextCount = Number(coupon?.used_count ?? 0) + 1;
  const { error: updateError } = await supabaseAdmin
    .from('coupons')
    .update({ used_count: nextCount })
    .eq('id', couponId);

  if (updateError) throw updateError;

  await redis.set(redemptionKey, JSON.stringify({ couponId, userId, orderId, redeemed_at: new Date().toISOString() }));
}

function toDbPaymentStatus(status: VerifyInput['status']): 'pending' | 'completed' | 'failed' {
  return status === 'success' ? 'completed' : status;
}

function toApiPaymentStatus(status: string): 'pending' | 'success' | 'failed' | string {
  return status === 'completed' ? 'success' : status;
}

// ─── Compute order total from order_items (orders table has no total_amount) ──
async function computeOrderTotal(orderId: string): Promise<number> {
  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('unit_price, quantity')
    .eq('order_id', orderId);
  return (items ?? []).reduce(
    (sum: number, i: any) => sum + Number(i.unit_price) * Number(i.quantity),
    0
  );
}

// ─── Initiate Payment ─────────────────────────────────────────────────────────
// FIX: payments table columns: order_id, amount, tax_amount, service_charge, discount_amount,
//      method (not payment_method), status, transaction_ref, gateway_order_id, gateway_payment_id,
//      receipt_url, coupon_id, split_details.
//      NO branch_id, NO restaurant_id on payments table.
export async function initiatePayment(
  input: InitiateInput,
  branchId: string,
  restaurantId: string
) {
  const { order_id, payment_method, coupon_code } = input;

  // FIX: orders has no total_amount - fetch status + compute total from items
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('id, status, branch_id, customer_id, order_type')
    .eq('id', order_id)
    .eq('branch_id', branchId)
    .single();

  if (orderErr || !order) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  if (order.status === 'paid') {
    throw Object.assign(new Error('Order is already paid'), { statusCode: 409 });
  }

  if (order.status === 'cancelled') {
    throw Object.assign(new Error('Cannot pay for a cancelled order'), { statusCode: 422 });
  }

  const amount = await computeOrderTotal(order_id);

  const { data: existingPayment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('order_id', order_id)
    .maybeSingle();

  if (existingPayment?.id) {
    throw Object.assign(new Error('Payment already exists for this order'), { statusCode: 409 });
  }

  let discountAmount = 0;
  let couponId: string | null = null;

  if (coupon_code) {
    const validation = await validateCoupon(
      coupon_code,
      order_id,
      amount,
      order.order_type,
      order.customer_id ?? '',
      restaurantId,
    );

    if (!validation.valid) {
      throw Object.assign(new Error(validation.error_code ?? 'Coupon could not be applied'), {
        statusCode: 422,
      });
    }

    discountAmount = validation.discount_amount;
    couponId = validation.coupon_id;
  }

  const finalAmount = roundMoney(Math.max(0, amount - discountAmount));

  const gatewayOrderId: string | null = null; // TODO: replace with real gateway order ID

  // FIX: use correct column name 'method' not 'payment_method'; no branch_id/restaurant_id
  const { data: payment, error: payErr } = await supabaseAdmin
    .from('payments')
    .insert({
      order_id,
      amount: finalAmount,
      discount_amount: discountAmount || null,
      method: payment_method,
      status: 'pending',
      gateway_order_id: gatewayOrderId,
      coupon_id: couponId,
    })
    .select()
    .single();

  if (payErr || !payment) throw payErr ?? new Error('Failed to create payment record');

  // Cache branch + restaurant context in Redis for webhook lookup
  await redis.setex(`payment_ctx:${payment.id}`, 3600, JSON.stringify({ branchId, restaurantId }));

  return {
    payment_id: payment.id,
    amount: payment.amount,
    discount_amount: discountAmount,
    coupon_id: couponId,
    status: 'pending',
    gateway_order_id: gatewayOrderId,
  };
}

// ─── Verify Payment ───────────────────────────────────────────────────────────
export async function verifyPayment(input: VerifyInput, branchId: string) {
  const { payment_id, status, gateway_payment_id, gateway_signature } = input;
  const dbStatus = toDbPaymentStatus(status);

  const { data: payment, error: fetchErr } = await supabaseAdmin
    .from('payments')
    .select('*, orders(branch_id)')
    .eq('id', payment_id)
    .single();

  if (fetchErr || !payment) {
    throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  }

  if ((payment.orders as { branch_id: string }).branch_id !== branchId) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }

  // FIX: payments table has no gateway_signature or verified_at — store in transaction_ref
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('payments')
    .update({
      status: dbStatus,
      gateway_payment_id: gateway_payment_id ?? null,
      transaction_ref: gateway_signature ?? null,
    })
    .eq('id', payment_id)
    .select()
    .single();

  if (updateErr) throw updateErr;

  if (status === 'success') {
    const ctxRaw = await redis.get(`payment_ctx:${payment_id}`);
    const ctx = ctxRaw ? JSON.parse(ctxRaw) : { branchId, restaurantId: '' };
    await onPaymentComplete(payment.order_id, ctx.branchId, ctx.restaurantId);
  }

  return { ...updated, status: toApiPaymentStatus(updated.status) };
}

// ─── Generate UPI QR ──────────────────────────────────────────────────────────
// FIX: orders has no total_amount and no join to restaurants
export async function generateUPIQR(input: UPIQRInput, branchId: string) {
  const { order_id, amount: overrideAmount } = input;

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, status, branch_id')
    .eq('id', order_id)
    .eq('branch_id', branchId)
    .single();

  if (error || !order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

  // Get restaurant via branch
  const { data: branch } = await supabaseAdmin
    .from('branches')
    .select('restaurant_id, restaurant_branding:restaurant_branding(app_name_display)')
    .eq('id', branchId)
    .single();

  const restaurantName =
    (branch?.restaurant_branding as any)?.[0]?.app_name_display ?? 'Restaurant';

  const amount = overrideAmount ?? (await computeOrderTotal(order_id));
  const transactionRef = `ROS-${order_id.split('-')[0].toUpperCase()}`;
  const description = `Payment for order ${transactionRef}`;

  // TODO: get real UPI ID from restaurant settings
  const upiId = process.env.DEFAULT_UPI_ID ?? 'restaurant@upi';
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(restaurantName)}&am=${amount}&tr=${transactionRef}&tn=${encodeURIComponent(description)}&cu=INR`;

  const qrBase64 = await QRCode.toDataURL(upiLink, {
    type: 'image/png',
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });

  return {
    qrCode: qrBase64,
    upiRef: transactionRef,
    upi_link: upiLink,
    qr_base64: qrBase64,
    amount,
    transaction_ref: transactionRef,
    upi_id: upiId,
  };
}

// ─── Poll UPI Status ──────────────────────────────────────────────────────────
export async function pollUPIStatus(transactionRef: string, branchId: string) {
  const redisKey = `upi_payment:${transactionRef}`;
  const testStatus = await redis.get(redisKey);

  if (testStatus) {
    return { status: testStatus, ref: transactionRef, source: 'manual_test' };
  }

  return { status: 'pending', ref: transactionRef, source: 'poll' };
}

// ─── Split Bill ───────────────────────────────────────────────────────────────
// FIX: payments table has no branch_id, restaurant_id, or meta; uses 'method' not 'payment_method'
export async function splitBill(input: SplitInput, branchId: string, restaurantId: string) {
  const { order_id, splits } = input;

  const totalSplit = splits.reduce((acc, s) => acc + s.amount, 0);
  const orderTotal = await computeOrderTotal(order_id);

  // Allow ±1 rupee rounding tolerance
  if (Math.abs(totalSplit - orderTotal) > 1) {
    throw Object.assign(
      new Error(`Split amounts (${totalSplit}) do not match order total (${orderTotal})`),
      { statusCode: 422 }
    );
  }

  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('id, status, branch_id')
    .eq('id', order_id)
    .eq('branch_id', branchId)
    .single();

  if (orderErr || !order) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  if (order.status === 'paid') {
    throw Object.assign(new Error('Order is already paid'), { statusCode: 409 });
  }

  const { data: existingPayment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('order_id', order_id)
    .maybeSingle();

  if (existingPayment?.id) {
    throw Object.assign(new Error('Payment already exists for this order'), { statusCode: 409 });
  }

  // The live schema has a unique payment per order, so store the split parts as
  // JSON while returning the three logical split records the API contract expects.
  const { data: payment, error: insertErr } = await supabaseAdmin
    .from('payments')
    .insert({
      order_id,
      amount: totalSplit,
      method: 'split',
      status: 'pending',
      split_details: {
        is_split: true,
        total_parts: splits.length,
        splits,
      },
    })
    .select()
    .single();

  if (insertErr) throw insertErr;

  await redis.setex(`payment_ctx:${payment.id}`, 3600, JSON.stringify({ branchId, restaurantId }));

  return splits.map((split, index) => ({
    id: `${payment.id}:${index + 1}`,
    payment_id: payment.id,
    order_id,
    amount: split.amount,
    method: split.payment_method,
    status: 'pending',
    split_details: {
      label: split.label,
      is_split: true,
      part: index + 1,
      total_parts: splits.length,
    },
  }));
}

// ─── Get Receipt ─────────────────────────────────────────────────────────────
// FIX: orders has no join to restaurants; branches are separate
export async function getReceipt(orderId: string, branchId: string, userId?: string, role?: string) {
  const orderQuery = supabaseAdmin
    .from('orders')
    .select('*, order_items(*, menu_items(name, price)), tables(label), branches(name, address)')
    .eq('id', orderId);

  if (branchId) {
    orderQuery.eq('branch_id', branchId);
  } else if (role === 'customer' && userId) {
    orderQuery.eq('customer_id', userId);
  } else {
    throw Object.assign(new Error('No branch context found'), { statusCode: 403 });
  }

  const [orderRes, paymentsRes] = await Promise.all([
    orderQuery.single(),
    supabaseAdmin
      .from('payments')
      .select('id, amount, method, status, transaction_ref, gateway_payment_id, created_at')
      .eq('order_id', orderId),
  ]);

  if (orderRes.error || !orderRes.data) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  const computedTotal = await computeOrderTotal(orderId);

  return {
    receipt_type: 'json',
    order_id: orderId,
    computed_total: computedTotal,
    data: orderRes.data,
    payments: (paymentsRes.data ?? []).map((payment) => ({
      ...payment,
      status: toApiPaymentStatus(payment.status),
    })),
  };
}

// ─── On Payment Complete (internal) ──────────────────────────────────────────
export async function onPaymentComplete(orderId: string, branchId: string, restaurantId: string) {
  // 1. Mark order as paid
  await supabaseAdmin
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', orderId);

  // 2. Update table status to 'cleaning' and redeem any applied coupon
  const [{ data: order }, { data: payment }] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('table_id, customer_id')
      .eq('id', orderId)
      .single(),
    supabaseAdmin
      .from('payments')
      .select('coupon_id')
      .eq('order_id', orderId)
      .maybeSingle(),
  ]);

  if (order?.table_id) {
    await supabaseAdmin
      .from('tables')
      .update({ status: 'cleaning', updated_at: new Date().toISOString() })
      .eq('id', order.table_id);
  }

  if (payment?.coupon_id) {
    try {
      await redeemCoupon(payment.coupon_id, order?.customer_id ?? '', orderId);
    } catch (redeemErr) {
      console.warn('[payments] coupon redemption failed:', redeemErr);
    }
  }

  // 3. Emit 'payment_confirmed' Realtime event
  const payload = {
    event: 'payment_confirmed',
    order_id: orderId,
    branch_id: branchId,
    paid_at: new Date().toISOString(),
  };

  await supabaseAdmin.channel(`branch:${branchId}:cashier`).send({
    type: 'broadcast',
    event: 'payment_confirmed',
    payload,
  });

  await supabaseAdmin.channel(`branch:${branchId}:manager`).send({
    type: 'broadcast',
    event: 'payment_confirmed',
    payload,
  });
}

// ─── Webhook Handler ──────────────────────────────────────────────────────────
export async function handleGatewayWebhook(body: Record<string, unknown>) {
  // TODO: Implement real webhook signature verification
  console.log('[webhook] Received gateway event:', body.event);
  return { received: true };
}
