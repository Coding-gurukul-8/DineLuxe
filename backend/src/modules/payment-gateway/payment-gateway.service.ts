/**
 * Payment Gateway Service — Razorpay Integration
 *
 * Wraps existing payments.service.ts (coupon, split, receipt logic) with real
 * Razorpay order creation, HMAC signature verification, UPI QR generation, and
 * webhook handling.
 *
 * Column contract (payments table):
 *   order_id, amount, tax_amount, service_charge, discount_amount,
 *   method, status, transaction_ref, gateway_order_id, gateway_payment_id,
 *   receipt_url, coupon_id, split_details
 *
 * No branch_id / restaurant_id on payments table.
 */

import crypto from 'crypto';
import QRCode from 'qrcode';

import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import { onPaymentComplete } from '../payments/payments.service';
import { config } from '../../config/env';

// ── Razorpay client (lazily initialised so missing keys don't crash the server) ──
function getRazorpayClient() {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    throw Object.assign(
      new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'),
      { statusCode: 503 },
    );
  }

  // Load Razorpay lazily so API startup still works even when the package is
  // absent in environments that do not use the payment gateway.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Razorpay = require('razorpay');

  return new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET,
  });
}

// ─── 1. Create Razorpay Order ─────────────────────────────────────────────────
/**
 * Creates a Razorpay order and stores the gateway_order_id on the existing
 * payments row (or inserts a new pending row if none exists).
 *
 * @param orderId       Internal DineLuxe order UUID
 * @param amountInPaise Already-converted paise value (₹ × 100, rounded)
 * @param currency      Defaults to 'INR'
 */
export async function createRazorpayOrder(
  orderId: string,
  amountInPaise: number,
  currency = 'INR',
) {
  const rzp = getRazorpayClient();

  const rzpOrder = await rzp.orders.create({
    amount: Math.round(amountInPaise),
    currency,
    receipt: `ros_${orderId.slice(-8)}`,
    notes: { order_id: orderId },
  });

  // Upsert the gateway_order_id into the payments row
  const { data: existingPayment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existingPayment?.id) {
    await supabaseAdmin
      .from('payments')
      .update({ gateway_order_id: rzpOrder.id })
      .eq('id', existingPayment.id);
  } else {
    // No prior payment row — create one so we have a record to verify against
    await supabaseAdmin.from('payments').insert({
      order_id: orderId,
      amount: Math.round(amountInPaise) / 100,
      method: 'card',
      status: 'pending',
      gateway_order_id: rzpOrder.id,
    });
  }

  return {
    razorpay_order_id: rzpOrder.id as string,
    amount: rzpOrder.amount as number,
    currency: rzpOrder.currency as string,
    key_id: config.RAZORPAY_KEY_ID!,
  };
}

// ─── 2. Verify Razorpay Signature ─────────────────────────────────────────────
/**
 * Verifies the HMAC-SHA256 signature that Razorpay sends back after a
 * successful payment. Throws 400 on mismatch.
 */
export function verifyRazorpayPayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
): true {
  if (!config.RAZORPAY_KEY_SECRET) {
    throw Object.assign(new Error('Razorpay secret not configured'), { statusCode: 503 });
  }

  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  let isValid: boolean;
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(razorpaySignature, 'hex'),
    );
  } catch {
    // Buffer lengths differ → definitely not equal
    isValid = false;
  }

  if (!isValid) {
    throw Object.assign(new Error('Payment signature verification failed'), { statusCode: 400 });
  }

  return true;
}

// ─── 3. Confirm Payment ───────────────────────────────────────────────────────
/**
 * Full confirmation flow:
 *   1. Verify HMAC signature
 *   2. Update payments row → status=completed, transaction_ref=paymentId
 *   3. Call shared onPaymentComplete (marks order paid, table cleaning, Realtime)
 */
export async function confirmPayment(
  orderId: string,
  razorpayPaymentId: string,
  razorpayOrderId: string,
  razorpaySignature: string,
) {
  // Step 1 — signature check (throws on failure)
  verifyRazorpayPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);

  // Step 2 — find the payment row via gateway_order_id
  const { data: payment, error: fetchErr } = await supabaseAdmin
    .from('payments')
    .select('id, order_id')
    .eq('gateway_order_id', razorpayOrderId)
    .maybeSingle();

  if (fetchErr || !payment) {
    throw Object.assign(
      new Error('Payment record not found for this Razorpay order'),
      { statusCode: 404 },
    );
  }

  // Step 3 — mark completed
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('payments')
    .update({
      status: 'completed',
      gateway_payment_id: razorpayPaymentId,
      transaction_ref: razorpayPaymentId,
    })
    .eq('id', payment.id)
    .select()
    .single();

  if (updateErr) throw updateErr;

  // Step 4 — pull branch/restaurant context (stored by initiatePayment)
  const ctxRaw = await redis.get(`payment_ctx:${payment.id}`);
  const ctx: { branchId: string; restaurantId: string } = ctxRaw
    ? JSON.parse(ctxRaw)
    : { branchId: '', restaurantId: '' };

  // Step 5 — shared completion side-effects (order paid, table cleaning, Realtime)
  await onPaymentComplete(orderId, ctx.branchId, ctx.restaurantId);

  return {
    success: true,
    payment_id: payment.id,
    receipt_url: updated.receipt_url ?? null,
  };
}

// ─── 4. Generate UPI QR ───────────────────────────────────────────────────────
/**
 * Builds a UPI deep-link, converts it to a data-URL QR image, and caches the
 * transactionRef → orderId mapping in Redis (TTL 15 min) for polling.
 */
export async function generateUPIQR(
  orderId: string,
  amount: number,
  branchName: string,
) {
  const merchantUpiId = config.MERCHANT_UPI_ID;
  if (!merchantUpiId) {
    throw Object.assign(
      new Error('Merchant UPI ID not configured. Set MERCHANT_UPI_ID.'),
      { statusCode: 503 },
    );
  }

  const transactionRef = `ROS${Date.now()}`;
  const upiLink = [
    `upi://pay?pa=${encodeURIComponent(merchantUpiId)}`,
    `&pn=${encodeURIComponent(branchName)}`,
    `&am=${amount.toFixed(2)}`,
    `&tr=${transactionRef}`,
    `&tn=${encodeURIComponent(`Order ${orderId.slice(-8).toUpperCase()}`)}`,
    `&cu=INR`,
  ].join('');

  const qrDataUrl: string = await QRCode.toDataURL(upiLink, { width: 300 });

  // Cache for polling (TTL = 15 minutes)
  await redis.setex(`upi_pending:${transactionRef}`, 900, orderId);

  return {
    qr_data_url: qrDataUrl,
    transaction_ref: transactionRef,
    upi_link: upiLink,
    amount,
    upi_id: merchantUpiId,
  };
}

// ─── 5. Poll UPI Payment Status ───────────────────────────────────────────────
/**
 * Checks Redis for the UPI pending key (set on QR generation) and the
 * confirmed key (set by webhook handler). Returns 'expired' when the 15-min
 * TTL has lapsed.
 */
export async function pollUPIPaymentStatus(transactionRef: string) {
  // If pending key is gone the QR has expired
  const pendingKey = await redis.get(`upi_pending:${transactionRef}`);
  if (!pendingKey) {
    return { status: 'expired', transaction_ref: transactionRef };
  }

  // Check whether the webhook already confirmed this payment
  const confirmedKey = await redis.get(`upi_confirmed:${transactionRef}`);
  if (confirmedKey) {
    return { status: 'completed', transaction_ref: transactionRef };
  }

  // Check for a failed flag set by the webhook
  const failedKey = await redis.get(`upi_failed:${transactionRef}`);
  if (failedKey) {
    return { status: 'failed', transaction_ref: transactionRef };
  }

  return { status: 'pending', transaction_ref: transactionRef };
}

// ─── 6. Razorpay Webhook Handler ──────────────────────────────────────────────
/**
 * Verifies the X-Razorpay-Signature header and dispatches events.
 *
 * NOTE: Express must NOT parse the body of this route through JSON middleware
 * before reaching this handler — the raw bytes are needed for HMAC.
 * Use express.raw({ type: 'application/json' }) on the /payment-gateway/webhook
 * route so req.body is a Buffer, then JSON.parse it here.
 */
export async function handleRazorpayWebhook(
  rawBody: Buffer | string,
  signature: string,
) {
  if (!config.RAZORPAY_WEBHOOK_SECRET) {
    throw Object.assign(
      new Error('Razorpay webhook secret not configured'),
      { statusCode: 503 },
    );
  }

  const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expectedSignature = crypto
    .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
    .update(bodyStr)
    .digest('hex');

  let isValid: boolean;
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  } catch {
    isValid = false;
  }

  if (!isValid) {
    throw Object.assign(new Error('Invalid webhook signature'), { statusCode: 400 });
  }

  const body = JSON.parse(bodyStr) as Record<string, any>;
  const event = body.event as string;
  const paymentEntity = body?.payload?.payment?.entity ?? {};
  const razorpayPaymentId: string = paymentEntity.id ?? '';
  const razorpayOrderId: string = paymentEntity.order_id ?? '';
  const notes = paymentEntity.notes ?? {};

  console.log(`[payment-gateway/webhook] event=${event} razorpay_order_id=${razorpayOrderId}`);

  if (event === 'payment.captured') {
    // Find internal payment via gateway_order_id
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, order_id')
      .eq('gateway_order_id', razorpayOrderId)
      .maybeSingle();

    if (payment) {
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'completed',
          gateway_payment_id: razorpayPaymentId,
          transaction_ref: razorpayPaymentId,
        })
        .eq('id', payment.id);

      const ctxRaw = await redis.get(`payment_ctx:${payment.id}`);
      const ctx = ctxRaw ? JSON.parse(ctxRaw) : { branchId: '', restaurantId: '' };

      await onPaymentComplete(payment.order_id, ctx.branchId, ctx.restaurantId);
    }

    // Also handle UPI QR flow — transactionRef stored in notes
    const transactionRef = notes?.transaction_ref as string | undefined;
    if (transactionRef) {
      await redis.setex(`upi_confirmed:${transactionRef}`, 3600, razorpayPaymentId);
      await redis.del(`upi_pending:${transactionRef}`);
    }
  }

  if (event === 'payment.failed') {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('gateway_order_id', razorpayOrderId)
      .maybeSingle();

    if (payment) {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id);
    }

    const transactionRef = notes?.transaction_ref as string | undefined;
    if (transactionRef) {
      await redis.setex(`upi_failed:${transactionRef}`, 3600, '1');
    }
  }

  if (event === 'refund.created') {
    const refundEntity = body?.payload?.refund?.entity ?? {};
    const refundPaymentId = refundEntity.payment_id as string | undefined;

    if (refundPaymentId) {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'refunded' })
        .eq('gateway_payment_id', refundPaymentId);
    }
  }

  return { received: true, event };
}

// ─── 7. Calculate Split Bill ──────────────────────────────────────────────────
/**
 * Fetches the order total from order_items and returns even-split amounts.
 * Uses Math.ceil to avoid under-collection due to rounding.
 */
export async function calculateSplitBill(orderId: string, splitBy: number) {
  if (splitBy < 2 || splitBy > 20) {
    throw Object.assign(
      new Error('splitBy must be between 2 and 20'),
      { statusCode: 400 },
    );
  }

  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('unit_price, quantity')
    .eq('order_id', orderId);

  const total = (items ?? []).reduce(
    (sum: number, i: any) => sum + Number(i.unit_price) * Number(i.quantity),
    0,
  );

  const perPersonPaise = Math.ceil((total * 100) / splitBy);
  const perPerson = perPersonPaise / 100;

  return {
    order_id: orderId,
    total,
    per_person: perPerson,
    split_count: splitBy,
    total_paise: Math.round(total * 100),
    per_person_paise: perPersonPaise,
  };
}

// ─── 8. Process Partial Payment ───────────────────────────────────────────────
/**
 * Records a partial payment portion for a split-bill flow.
 * Stores portions as JSONB inside the payments row's split_details field.
 * When all portions are paid the main payment row is marked completed.
 */
export async function processPartialPayment(
  orderId: string,
  paymentId: string,
  portion: number,
  personIndex: number,
) {
  const { data: payment, error: fetchErr } = await supabaseAdmin
    .from('payments')
    .select('id, amount, split_details')
    .eq('id', paymentId)
    .single();

  if (fetchErr || !payment) {
    throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  }

  const splitDetails = (payment.split_details as Record<string, any>) ?? {};
  const paid: Record<string, any> = splitDetails.paid ?? {};
  paid[`person_${personIndex}`] = { amount: portion, paid_at: new Date().toISOString() };

  const totalPortions: number = splitDetails.total_parts ?? 1;
  const portionsPaid = Object.keys(paid).length;
  const totalPaid = Object.values(paid).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const remainingAmount = Math.max(0, Number(payment.amount) - totalPaid);
  const allPaid = portionsPaid >= totalPortions;

  const newSplitDetails = { ...splitDetails, paid };

  await supabaseAdmin
    .from('payments')
    .update({
      split_details: newSplitDetails,
      ...(allPaid ? { status: 'completed' } : {}),
    })
    .eq('id', paymentId);

  if (allPaid) {
    const ctxRaw = await redis.get(`payment_ctx:${paymentId}`);
    const ctx = ctxRaw ? JSON.parse(ctxRaw) : { branchId: '', restaurantId: '' };
    await onPaymentComplete(orderId, ctx.branchId, ctx.restaurantId);
  }

  return {
    payment_id: paymentId,
    portions_paid: portionsPaid,
    total_portions: totalPortions,
    remaining_amount: remainingAmount,
    all_paid: allPaid,
  };
}