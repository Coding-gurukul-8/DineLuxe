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
import { sendPush, createInApp, sendEmailNotification } from '../notifications/notifications.service';
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

  // GST / Service charge calculation
  const { calculateBill } = await import('../../utils/gst');
  // NOTE: For now, service charge is always applied.
  // If your restaurant settings exist for service_charge, wire it here.
  const bill = calculateBill(amount, {
    order_type: order.order_type as any,
    apply_service_charge: true,
    discount_amount: discountAmount,
  });

  const gatewayOrderId: string | null = null; // TODO: replace with real gateway order ID

  // FIX: use correct column name 'method' not 'payment_method'; no branch_id/restaurant_id
  const { data: payment, error: payErr } = await supabaseAdmin
    .from('payments')
    .insert({
      order_id,
      amount: bill.grand_total,
      tax_amount: bill.gst_total,
      service_charge: bill.service_charge,
      discount_amount: bill.discount_amount || null,
      breakdown: bill.breakdown_lines,
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

    // Queue receipt generation (non-blocking)
    // (Repo currently doesn't have Bull workers wired, so we run the job
    // fire-and-forget style.)
    void import('../../jobs/receipt-pdf').then(async (mod) => {
      try {
        await mod.runReceiptPdfJob({
          payment_id: payment_id,
          order_id: payment.order_id,
          branch_id: ctx.branchId,
          restaurant_id: ctx.restaurantId,
          customer_email: (payment as any)?.customer_email ?? null,
          customer_phone: (payment as any)?.customer_phone ?? null,
        });
      } catch (err) {
        console.error('[receipt-pdf] Failed to generate receipt:', err);
      }
    });
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

// ─── Request Refund ───────────────────────────────────────────────────────────
// Called by customer via POST /payments/:orderId/refund-request
export async function requestRefund(
  orderId: string,
  userId: string,
  reason: string,
  items?: string[],
) {
  // 1. Verify order belongs to this user
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select('id, status, customer_id, branch_id')
    .eq('id', orderId)
    .single();

  if (orderErr || !order) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  if (order.customer_id !== userId) {
    throw Object.assign(new Error('Forbidden: order does not belong to you'), { statusCode: 403 });
  }

  // 2. Verify order is in a refundable state
  if (order.status !== 'paid' && order.status !== 'closed') {
    throw Object.assign(
      new Error(`Refund can only be requested for paid or closed orders. Current status: ${order.status}`),
      { statusCode: 422 },
    );
  }

  // 3. Check no existing pending refund ticket for this order
  // Support tickets store order_id inside the conversation meta; we check via a
  // status query filtering on the metadata stored in the first conversation entry.
  // Since support_tickets may not have a reference_id column we store order_id
  // in the conversation meta and use a reference_type field if available.
  const { data: existingTickets } = await supabaseAdmin
    .from('support_tickets')
    .select('id, status')
    .eq('user_id', userId)
    .in('status', ['open', 'assigned']);

  // Filter in JS — avoids dependency on a reference_id column that may not exist
  const existingRefund = (existingTickets ?? []).find((t: any) => {
    const conv = Array.isArray(t.conversation) ? t.conversation : [];
    const meta = conv[0]?.meta ?? {};
    return meta.reference_type === 'refund' && meta.order_id === orderId;
  });

  if (existingRefund) {
    throw Object.assign(
      new Error('A refund request for this order is already pending'),
      { statusCode: 409 },
    );
  }

  const now = new Date().toISOString();

  // 4. Fetch payment to mark refund_requested
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id, amount, status')
    .eq('order_id', orderId)
    .maybeSingle();

  // 5. Create support ticket for the refund request
  const { data: ticket, error: ticketErr } = await supabaseAdmin
    .from('support_tickets')
    .insert({
      user_id: userId,
      subject: `Refund Request - Order #${orderId.slice(-8).toUpperCase()}`,
      conversation: [
        {
          sender_id: userId,
          sender_role: 'customer',
          message: reason,
          created_at: now,
          attachments: [],
          meta: {
            category: 'payment',
            priority: 'medium',
            reference_type: 'refund',
            order_id: orderId,
            payment_id: payment?.id ?? null,
            items: items ?? [],
          },
        },
      ],
      status: 'open',
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (ticketErr || !ticket) {
    throw ticketErr ?? new Error('Failed to create refund support ticket');
  }

  // 6. Mark the payment as refund_requested using status
  // The payments table has a 'status' column; we update it to signal the refund.
  if (payment?.id) {
    await supabaseAdmin
      .from('payments')
      .update({
        status: 'refund_requested',
        updated_at: now,
      })
      .eq('id', payment.id);
  }

  // 7. Notify super admins
  const { data: superAdmins } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('role', 'super_admin');

  for (const admin of superAdmins ?? []) {
    createInApp(
      admin.id,
      'payment',
      'New Refund Request',
      `Customer requested a refund for Order #${orderId.slice(-8).toUpperCase()}`,
      ticket.id,
      'support_ticket',
    ).catch(() => {});

    sendPush(
      admin.id,
      'New Refund Request',
      `Order #${orderId.slice(-8).toUpperCase()} — ${reason.slice(0, 80)}`,
      { ticket_id: ticket.id, type: 'refund_request', order_id: orderId },
    );
  }

  // 8. Notify customer of submission
  createInApp(
    userId,
    'payment',
    'Refund Request Submitted',
    `Your refund request for Order #${orderId.slice(-8).toUpperCase()} has been received.`,
    ticket.id,
    'support_ticket',
  ).catch(() => {});

  return {
    ticket_id: ticket.id,
    message: 'Refund request submitted. We will review within 24 hours.',
  };
}

// ─── Process Refund (approve / reject) ───────────────────────────────────────
// Called by super_admin via PATCH /payments/:paymentId/process-refund
export async function processRefund(
  paymentId: string,
  adminId: string,
  action: 'approve' | 'reject',
  notes?: string,
) {
  // 1. Fetch the payment
  const { data: payment, error: payErr } = await supabaseAdmin
    .from('payments')
    .select('id, order_id, amount, status')
    .eq('id', paymentId)
    .single();

  if (payErr || !payment) {
    throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  }

  if (payment.status !== 'refund_requested') {
    throw Object.assign(
      new Error(`Payment is not in refund_requested state. Current status: ${payment.status}`),
      { statusCode: 422 },
    );
  }

  const now = new Date().toISOString();

  // 2. Find the linked support ticket
  // We look for open/assigned tickets whose conversation[0].meta.order_id matches
  const { data: allTickets } = await supabaseAdmin
    .from('support_tickets')
    .select('id, user_id, conversation')
    .in('status', ['open', 'assigned']);

  const ticket = (allTickets ?? []).find((t: any) => {
    const conv = Array.isArray(t.conversation) ? t.conversation : [];
    const meta = conv[0]?.meta ?? {};
    return meta.reference_type === 'refund' && meta.payment_id === paymentId;
  });

  // 3. Handle approve
  if (action === 'approve') {
    // Update payment status to refunded
    const { error: updateErr } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'refunded',
        refunded_at: now,
        refunded_by: adminId,
        updated_at: now,
      })
      .eq('id', paymentId);

    if (updateErr) {
      // Fallback: try without refunded_at/refunded_by if columns don't exist
      await supabaseAdmin
        .from('payments')
        .update({ status: 'refunded', updated_at: now })
        .eq('id', paymentId);
    }

    // Update support ticket to resolved
    if (ticket) {
      const conv = Array.isArray(ticket.conversation) ? ticket.conversation : [];
      await supabaseAdmin
        .from('support_tickets')
        .update({
          status: 'resolved',
          resolved_at: now,
          updated_at: now,
          conversation: [
            ...conv,
            {
              sender_id: adminId,
              sender_role: 'admin',
              message: notes ?? 'Your refund has been approved and will be processed shortly.',
              created_at: now,
              attachments: [],
            },
          ],
        })
        .eq('id', ticket.id);
    }

    // Fetch customer info for email
    if (ticket?.user_id) {
      const { data: customer } = await supabaseAdmin
        .from('users')
        .select('name, email')
        .eq('id', ticket.user_id)
        .single();

      // Fetch restaurant name via order → branch
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('branch_id, branches(restaurant_id, restaurants(name))')
        .eq('id', payment.order_id)
        .single();

      const restaurantName =
        (order?.branches as any)?.restaurants?.name ?? 'DineLuxe';

      // Send refund initiated email
      sendEmailNotification(ticket.user_id, 'refund-initiated', {
        customerName: customer?.name ?? 'Customer',
        orderId: payment.order_id,
        amount: Number(payment.amount),
        restaurantName,
        estimatedDays: 5,
      }).catch(() => {});

      // In-app notification
      createInApp(
        ticket.user_id,
        'payment',
        'Refund Approved 🎉',
        `Your refund of ₹${Number(payment.amount).toFixed(2)} has been approved. Expect it within 5–7 business days.`,
        paymentId,
        'payment',
      ).catch(() => {});

      sendPush(
        ticket.user_id,
        'Refund Approved',
        `₹${Number(payment.amount).toFixed(2)} will be credited within 5–7 business days.`,
        { type: 'refund_approved', payment_id: paymentId },
      );
    }

    return { success: true, action: 'approved', payment_id: paymentId };
  }

  // 4. Handle reject
  if (action === 'reject') {
    await supabaseAdmin
      .from('payments')
      .update({ status: 'refund_rejected', updated_at: now })
      .eq('id', paymentId);

    if (ticket) {
      const conv = Array.isArray(ticket.conversation) ? ticket.conversation : [];
      await supabaseAdmin
        .from('support_tickets')
        .update({
          status: 'resolved',
          resolved_at: now,
          updated_at: now,
          conversation: [
            ...conv,
            {
              sender_id: adminId,
              sender_role: 'admin',
              message: notes ?? 'Your refund request has been reviewed and unfortunately rejected.',
              created_at: now,
              attachments: [],
            },
          ],
        })
        .eq('id', ticket.id);

      // Notify customer of rejection
      if (ticket.user_id) {
        createInApp(
          ticket.user_id,
          'payment',
          'Refund Request Update',
          notes ?? 'Your refund request has been reviewed and rejected. Contact support for details.',
          paymentId,
          'payment',
        ).catch(() => {});

        sendPush(
          ticket.user_id,
          'Refund Request Rejected',
          notes ?? 'Your refund request was not approved. Tap to view details.',
          { type: 'refund_rejected', payment_id: paymentId },
        );
      }
    }

    return { success: true, action: 'rejected', payment_id: paymentId };
  }

  throw Object.assign(new Error('Invalid action. Must be approve or reject.'), { statusCode: 400 });
}

// ─── Get Refund Status for Customer (Spec §9.7) ───────────────────────────────
// Called by customer via GET /payments/my-refunds
// Returns all refund requests for the authenticated customer, each annotated
// with a 4-stage lifecycle: submitted | under_review | approved | rejected

export type RefundStage = 'submitted' | 'under_review' | 'approved' | 'rejected';

export interface RefundStatusItem {
  order_id:         string;
  restaurant_name:  string;
  amount:           number;
  stage:            RefundStage;
  requested_at:     string | null;
  last_updated:     string | null;
  estimated_days:   number | null;   // null when approved, 3 otherwise
  rejection_reason: string | null;
  ticket_id:        string | null;
}

/**
 * Maps raw DB statuses to a 4-stage lifecycle enum.
 *
 * Priority order (most-specific first):
 *   payment.status = 'refunded'                                    → 'approved'
 *   ticket.status  = 'resolved' AND payment.status != 'refunded'  → 'rejected'
 *   ticket.status  = 'in_progress'                                 → 'under_review'
 *   everything else (refund_requested / open ticket)               → 'submitted'
 */
function mapToRefundStage(
  paymentStatus: string | null,
  ticketStatus:  string | null,
): RefundStage {
  if (paymentStatus === 'refunded') return 'approved';
  if (ticketStatus  === 'resolved' && paymentStatus !== 'refunded') return 'rejected';
  if (ticketStatus  === 'in_progress') return 'under_review';
  return 'submitted';
}

export async function getRefundStatusForCustomer(
  userId: string,
): Promise<RefundStatusItem[]> {
  // ── Step 1: fetch all orders for this customer that have a refund-state payment
  //           OR a refund-type support ticket ──────────────────────────────────

  // Fetch payments in refund lifecycle states for this customer's orders
  const { data: refundPayments, error: paymentsErr } = await supabaseAdmin
    .from('payments')
    .select(
      `id,
       order_id,
       amount,
       status,
       refund_requested_at,
       refunded_at,
       orders!inner (
         id,
         created_at,
         customer_id,
         branch_id,
         branches!inner (
           restaurant_id,
           restaurants!inner ( name )
         )
       )`,
    )
    .in('status', ['refund_requested', 'refunded', 'refund_rejected', 'failed'])
    .eq('orders.customer_id', userId);

  if (paymentsErr) throw paymentsErr;

  // Fetch open/assigned/resolved refund support tickets for this customer
  // (covers cases where a ticket exists but payment status hasn't been updated yet)
  const { data: refundTickets, error: ticketsErr } = await supabaseAdmin
    .from('support_tickets')
    .select('id, status, created_at, updated_at, conversation')
    .eq('user_id', userId)
    .in('status', ['open', 'assigned', 'in_progress', 'resolved']);

  if (ticketsErr) throw ticketsErr;

  // Filter tickets to only refund-type (by meta stored in first conversation entry)
  const refundTicketsByOrderId = new Map<
    string,
    { id: string; status: string; created_at: string; updated_at: string; rejection_reason: string | null }
  >();

  for (const ticket of refundTickets ?? []) {
    const conv = Array.isArray(ticket.conversation) ? ticket.conversation : [];
    const meta = conv[0]?.meta ?? {};
    if (meta.reference_type === 'refund' && meta.order_id) {
      // Extract rejection reason from last admin message (if rejected)
      let rejectionReason: string | null = null;
      if (ticket.status === 'resolved') {
        const adminMsg = [...conv].reverse().find((m: any) => m.sender_role === 'admin');
        if (adminMsg?.message) rejectionReason = adminMsg.message;
      }
      refundTicketsByOrderId.set(meta.order_id, {
        id:               ticket.id,
        status:           ticket.status,
        created_at:       ticket.created_at,
        updated_at:       ticket.updated_at,
        rejection_reason: rejectionReason,
      });
    }
  }

  // ── Step 2: merge — for every payment row, join its ticket; then add any
  //           tickets whose order_id didn't appear in the payments query ────────

  const seenOrderIds = new Set<string>();
  const results: RefundStatusItem[] = [];

  for (const pmt of refundPayments ?? []) {
    const order = pmt.orders as any;
    if (!order) continue;

    seenOrderIds.add(order.id);

    const ticket = refundTicketsByOrderId.get(order.id) ?? null;

    const stage = mapToRefundStage(pmt.status, ticket?.status ?? null);

    const restaurantName: string =
      (order.branches as any)?.restaurants?.name ?? 'Unknown Restaurant';

    results.push({
      order_id:         order.id,
      restaurant_name:  restaurantName,
      amount:           Number(pmt.amount),
      stage,
      requested_at:     ticket?.created_at ?? pmt.refund_requested_at ?? null,
      last_updated:     ticket?.updated_at ?? pmt.refunded_at        ?? null,
      estimated_days:   stage === 'approved' ? null : 3,
      rejection_reason: ticket?.rejection_reason ?? null,
      ticket_id:        ticket?.id ?? null,
    });
  }

  // Add any ticket-only entries (payment status not yet updated)
  for (const [orderId, ticket] of refundTicketsByOrderId.entries()) {
    if (seenOrderIds.has(orderId)) continue;

    // Fetch the order + payment details for this ticket-only entry
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select(`id, branches!inner ( restaurants!inner ( name ) )`)
      .eq('id', orderId)
      .single();

    const { data: pmt } = await supabaseAdmin
      .from('payments')
      .select('id, amount, status')
      .eq('order_id', orderId)
      .maybeSingle();

    const stage = mapToRefundStage(pmt?.status ?? null, ticket.status);

    results.push({
      order_id:         orderId,
      restaurant_name:  (order?.branches as any)?.restaurants?.name ?? 'Unknown Restaurant',
      amount:           Number(pmt?.amount ?? 0),
      stage,
      requested_at:     ticket.created_at,
      last_updated:     ticket.updated_at,
      estimated_days:   stage === 'approved' ? null : 3,
      rejection_reason: ticket.rejection_reason,
      ticket_id:        ticket.id,
    });
  }

  // Sort by most-recent first (requested_at DESC)
  results.sort((a, b) => {
    const tA = a.requested_at ? new Date(a.requested_at).getTime() : 0;
    const tB = b.requested_at ? new Date(b.requested_at).getTime() : 0;
    return tB - tA;
  });

  return results;
}