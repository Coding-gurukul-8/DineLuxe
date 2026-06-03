// ─────────────────────────────────────────────────────────────────────────────
// payments.controller.ts  —  AUDITED & FIXED
// ─────────────────────────────────────────────────────────────────────────────


import { success } from '../../utils/response';
import type { Request, Response, NextFunction } from 'express';

import {
  initiatePayment,
  verifyPayment,
  generateUPIQR,
  pollUPIStatus,
  splitBill,
  getReceipt,
  handleGatewayWebhook,
  requestRefund,
  processRefund,
} from './payments.service';

// ── POST /payments/initiate ───────────────────────────────────────────────────

export async function handleInitiatePayment(
  req: any,
  res: any,
  next: any,
) {


  try {
    const result = await initiatePayment(
      req.body,
      req.branchId!,
      req.restaurantId!,
    );
    // 201 — creates a new payment record
    res.status(201).json(success(result, 'Payment initiated'));
  } catch (err) {
    next(err);
  }
}

// ── POST /payments/verify ─────────────────────────────────────────────────────

export async function handleVerifyPayment(
  req: any,
  res: any,
  next: any,
) {

  try {
    const result = await verifyPayment(req.body, req.branchId!);
    res.json(success(result, 'Payment verified'));
  } catch (err) {
    next(err);
  }
}

// ── POST /payments/upi/qr ─────────────────────────────────────────────────────

export async function handleGenerateUPIQR(
  req: any,
  res: any,
  next: any,
) {

  try {
    const result = await generateUPIQR(req.body, req.branchId!);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

// ── GET /payments/upi/status/:ref ────────────────────────────────────────────

export async function handlePollUPIStatus(
  req: any,
  res: any,
  next: any,
) {

  try {
    const result = await pollUPIStatus(req.params.ref, req.branchId!);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

// ── POST /payments/split ──────────────────────────────────────────────────────

export async function handleSplitBill(
  req: any,
  res: any,
  next: any,
) {

  try {
    const result = await splitBill(req.body, req.branchId!, req.restaurantId!);
    res.json(success(result, 'Split created'));
  } catch (err) {
    next(err);
  }
}

// ── GET /payments/receipt/:orderId ────────────────────────────────────────────

export async function handleGetReceipt(
  req: any,
  res: any,
  next: any,
) {

  try {
    const result = await getReceipt(
      req.params.orderId,
      req.branchId ?? req.user?.branch_id ?? '',
      req.user?.id,
      req.user?.role,
    );
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

// ── POST /payments/webhook ────────────────────────────────────────────────────
//
// NOTE: Express must be configured to pass the raw body to this handler so the
// payment gateway signature can be verified. In app.ts, register the raw body
// parser BEFORE express.json() for this specific route:
//
//   app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
//
// Then apply express.json() to all other routes.

export async function handleGatewayWebhookController(
  req: any,
  res: any,
  next: any,
) {

  try {
    const result = await handleGatewayWebhook(req.body);
    // FIX: was res.json(result) — naked object, no envelope.
    // Wrap in success() for response shape consistency.
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

// ── POST /payments/orders/:orderId/refund ─────────────────────────────────────

export async function handleRefundRequest(
  req: any,
  res: any,
  next: any,
) {

  try {
    const { orderId } = req.params;
    const { reason, items } = req.body;
    const userId = req.user!.id;

    const result = await requestRefund(orderId, userId, reason, items);
    // 201 — creates a new refund record
    res.status(201).json(success(result, result.message));
  } catch (err) {
    next(err);
  }
}

// ── PATCH /payments/:paymentId/refund ─────────────────────────────────────────

export async function handleProcessRefund(
  req: any,
  res: any,
  next: any,
) {

  try {
    const { paymentId } = req.params;
    const { action, notes } = req.body;
    const adminId = req.user!.id;

    const result = await processRefund(paymentId, adminId, action, notes);
    // 200 — updates an existing payment/refund record
    res.json(success(result, `Refund ${action}d successfully`));
  } catch (err) {
    next(err);
  }
}

