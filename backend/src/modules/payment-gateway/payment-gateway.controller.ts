/**
 * Payment Gateway Controller
 *
 * Thin Express controller layer wrapping payment-gateway.service.ts.
 * All business logic lives in the service; controllers only parse request
 * inputs, call the service, and format responses using utils/response.ts.
 */

import type { Request, Response, NextFunction } from 'express';
import { success, error } from '../../utils/response';
import {
  createRazorpayOrder,
  confirmPayment,
  generateUPIQR,
  pollUPIPaymentStatus,
  handleRazorpayWebhook,
  calculateSplitBill,
  processPartialPayment,
} from './payment-gateway.service';

// ─── POST /payment-gateway/create-order ──────────────────────────────────────
export async function handleCreateRazorpayOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { order_id, amount } = req.body as { order_id: string; amount: number };
    // amount from client is in rupees; convert to paise for Razorpay
    const result = await createRazorpayOrder(order_id, Math.round(amount * 100));
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

// ─── POST /payment-gateway/verify ────────────────────────────────────────────
export async function handleConfirmPayment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      order_id,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body as {
      order_id: string;
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
    };

    const result = await confirmPayment(
      order_id,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    );
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

// ─── POST /payment-gateway/upi-qr ────────────────────────────────────────────
export async function handleGenerateUPIQR(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { order_id, amount, branch_name } = req.body as {
      order_id: string;
      amount: number;
      branch_name: string;
    };
    const result = await generateUPIQR(order_id, amount, branch_name);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

// ─── GET /payment-gateway/upi-status/:ref ────────────────────────────────────
export async function handlePollUPIStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { ref } = req.params;
    const result = await pollUPIPaymentStatus(ref);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

// ─── POST /payment-gateway/webhook ───────────────────────────────────────────
// IMPORTANT: This route must use express.raw({ type: 'application/json' }) so
// the body is a Buffer (not already-parsed JSON) for HMAC verification.
export async function handleRazorpayWebhookController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    if (!signature) {
      res.status(400).json(error('MISSING_SIGNATURE', 'X-Razorpay-Signature header is required'));
      return;
    }
    // req.body is a Buffer when express.raw() is used
    const result = await handleRazorpayWebhook(req.body as Buffer, signature);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ─── GET /payment-gateway/split/:orderId ─────────────────────────────────────
export async function handleCalculateSplitBill(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { orderId } = req.params;
    const splitBy = parseInt(req.query['split_by'] as string, 10);
    if (isNaN(splitBy)) {
      res.status(400).json(error('INVALID_PARAM', 'split_by must be a number'));
      return;
    }
    const result = await calculateSplitBill(orderId, splitBy);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}

// ─── POST /payment-gateway/partial-payment ───────────────────────────────────
export async function handleProcessPartialPayment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { order_id, payment_id, portion, person_index } = req.body as {
      order_id: string;
      payment_id: string;
      portion: number;
      person_index: number;
    };
    const result = await processPartialPayment(order_id, payment_id, portion, person_index);
    res.status(200).json(success(result));
  } catch (err) {
    next(err);
  }
}