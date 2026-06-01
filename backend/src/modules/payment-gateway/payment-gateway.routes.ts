/**
 * Payment Gateway Routes
 *
 * Mounts under /api/v1/payment-gateway in app.ts.
 *
 * IMPORTANT — webhook route:
 *   Razorpay sends a raw JSON body that must be verified byte-for-byte via
 *   HMAC. Use express.raw() on this route BEFORE the global express.json()
 *   parser. In app.ts add:
 *
 *     app.use(
 *       '/api/v1/payment-gateway/webhook',
 *       express.raw({ type: 'application/json' }),
 *     );
 *
 *   and mount this router AFTER that line.
 */

import { Router } from 'express';
import express from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import {
  handleCreateRazorpayOrder,
  handleConfirmPayment,
  handleGenerateUPIQR,
  handlePollUPIStatus,
  handleRazorpayWebhookController,
  handleCalculateSplitBill,
  handleProcessPartialPayment,
} from './payment-gateway.controller';

const router: Router = Router();

// ─── Public — no auth ─────────────────────────────────────────────────────────

// Razorpay calls this; must receive the raw body as a Buffer for HMAC.
// The express.raw() middleware is applied at the app level for this path —
// see the jsdoc above.
router.post('/webhook', handleRazorpayWebhookController);

// UPI status polling is called by the customer's browser every 3 s and
// should not require a token so the QR screen works without auth.
router.get('/upi-status/:ref', handlePollUPIStatus);

// ─── Authenticated routes ─────────────────────────────────────────────────────
router.use(authenticate, injectTenant);

// POST /payment-gateway/create-order
// Cashier, customer or manager initiates the Razorpay order.
router.post(
  '/create-order',
  requireRole('cashier', 'customer', 'manager', 'owner'),
  handleCreateRazorpayOrder,
);

// POST /payment-gateway/verify
// Client calls this after Razorpay checkout modal fires handler().
router.post(
  '/verify',
  requireRole('cashier', 'customer', 'manager', 'owner'),
  handleConfirmPayment,
);

// POST /payment-gateway/upi-qr
// Generate a UPI deep-link QR for the order.
router.post(
  '/upi-qr',
  requireRole('cashier', 'customer', 'manager', 'owner'),
  handleGenerateUPIQR,
);

// GET /payment-gateway/split/:orderId?split_by=N
// Calculate even-split amounts (no body write; safe for GET).
router.get(
  '/split/:orderId',
  requireRole('cashier', 'customer', 'manager', 'owner'),
  handleCalculateSplitBill,
);

// POST /payment-gateway/partial-payment
// Record one portion of a split-bill payment.
router.post(
  '/partial-payment',
  requireRole('cashier', 'customer', 'manager', 'owner'),
  handleProcessPartialPayment,
);

export default router;