import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  initiateSchema,
  verifySchema,
  splitSchema,
  upiQRSchema,
  webhookSchema,
  refundRequestSchema,
  processRefundSchema,
} from './payments.schema';
import {
  handleInitiatePayment,
  handleVerifyPayment,
  handleGenerateUPIQR,
  handlePollUPIStatus,
  handleSplitBill,
  handleGetReceipt,
  handleGatewayWebhookController,
  handleRefundRequest,
  handleProcessRefund,
} from './payments.controller';

const router: import('express').Router = Router();

// ─── Public Webhook (no auth — gateway calls this) ────────────────────────────
// NOTE: Must use express.raw() middleware on this route for signature verification
// TODO: Add gateway signature verification middleware before handler
router.post('/webhook', validate({ body: webhookSchema }), handleGatewayWebhookController);

// ─── Protected Payment Routes ─────────────────────────────────────────────────

// GET /payments/receipt/:orderId - customers may not have tenant claims, so
// the service enforces order ownership/branch access instead of injectTenant.
router.get(
  '/receipt/:orderId',
  authenticate,
  requireRole('customer', 'cashier', 'manager', 'owner', 'waiter'),
  handleGetReceipt
);

// ─── Refund Request (customer) ────────────────────────────────────────────────
// POST /payments/:orderId/refund-request
// Customers submit a refund request for a paid/closed order.
router.post(
  '/:orderId/refund-request',
  authenticate,
  requireRole('customer'),
  validate({ body: refundRequestSchema }),
  handleRefundRequest,
);

// ─── Process Refund (super_admin only) ───────────────────────────────────────
// PATCH /payments/:paymentId/process-refund
// Super admin approves or rejects a pending refund request.
router.patch(
  '/:paymentId/process-refund',
  authenticate,
  requireRole('super_admin'),
  validate({ body: processRefundSchema }),
  handleProcessRefund,
);

router.use(authenticate, injectTenant);

// POST /payments/initiate — cashier or customer
router.post(
  '/initiate',
  requireRole('cashier', 'customer', 'manager', 'owner'),
  validate({ body: initiateSchema }),
  handleInitiatePayment,
);

// POST /payments/verify — webhook + manual verification
router.post(
  '/verify',
  requireRole('cashier', 'manager', 'owner'),
  validate({ body: verifySchema }),
  handleVerifyPayment,
);

// POST /payments/upi/generate-qr — cashier or customer
router.post(
  '/upi/generate-qr',
  requireRole('cashier', 'customer', 'manager', 'owner'),
  validate({ body: upiQRSchema }),
  handleGenerateUPIQR,
);

// GET /payments/upi/status/:ref — cashier or customer — poll for status
router.get(
  '/upi/status/:ref',
  requireRole('cashier', 'customer', 'manager', 'owner'),
  handlePollUPIStatus,
);

// POST /payments/split — cashier — split bill
router.post(
  '/split',
  requireRole('cashier', 'manager', 'owner'),
  validate({ body: splitSchema }),
  handleSplitBill,
);

// GET /payments/receipt/:orderId — customer, cashier (duplicate under injectTenant context)
router.get(
  '/receipt/:orderId',
  requireRole('customer', 'cashier', 'manager', 'owner', 'waiter'),
  handleGetReceipt,
);

export default router;
