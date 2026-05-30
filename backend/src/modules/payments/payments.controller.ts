import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
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

export async function handleInitiatePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await initiatePayment(req.body, req.branchId!, req.restaurantId!);
    res.status(201).json(success(result, 'Payment initiated'));
  } catch (err) {
    next(err);
  }
}

export async function handleVerifyPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await verifyPayment(req.body, req.branchId!);
    res.json(success(result, 'Payment verified'));
  } catch (err) {
    next(err);
  }
}

export async function handleGenerateUPIQR(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await generateUPIQR(req.body, req.branchId!);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function handlePollUPIStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pollUPIStatus(req.params.ref, req.branchId!);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function handleSplitBill(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await splitBill(req.body, req.branchId!, req.restaurantId!);
    res.json(success(result, 'Split created'));
  } catch (err) {
    next(err);
  }
}

export async function handleGetReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getReceipt(
      req.params.orderId,
      req.branchId ?? req.user?.branch_id ?? '',
      req.user?.id,
      req.user?.role
    );
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

export async function handleGatewayWebhookController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // TODO: Pass raw body for signature verification (configure express.raw() on this route)
    const result = await handleGatewayWebhook(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ─── Refund Request ───────────────────────────────────────────────────────────

export async function handleRefundRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderId } = req.params;
    const { reason, items } = req.body;
    const userId = req.user!.id;

    const result = await requestRefund(orderId, userId, reason, items);
    res.status(201).json(success(result, result.message));
  } catch (err) {
    next(err);
  }
}

export async function handleProcessRefund(req: Request, res: Response, next: NextFunction) {
  try {
    const { paymentId } = req.params;
    const { action, notes } = req.body;
    const adminId = req.user!.id;

    const result = await processRefund(paymentId, adminId, action, notes);
    res.json(success(result, `Refund ${action}d successfully`));
  } catch (err) {
    next(err);
  }
}
