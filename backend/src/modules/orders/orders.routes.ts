import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createOrderSchema, cancelOrderSchema } from './orders.schema';
import {
  handleCreateOrder,
  handleGetOrder,
  handleGetOrdersByTable,
  handleGetActiveBranchOrders,
  handleGetMyOrders,
  handleGetStaffOrders,
  handleCancelOrder,
  handleCallWaiter,
  handleApplyCoupon, // P3-1 ADDITION
  handleGetOrderByTable, // P3-1 ADDITION
} from './orders.controller';

const router: import('express').Router = Router();

// All order routes require authentication
router.use(authenticate);

// POST /orders — waiter or customer via QR
router.post(
  '/',
  injectTenant,
  requireRole('waiter', 'customer', 'manager', 'owner', 'cashier'),
  // BUG FIX: validate({ body: schema }) passes a plain object — middleware calls
  // schema.safeParse() which doesn't exist on a plain object. Pass schema directly.
  validate(createOrderSchema),
  handleCreateOrder
);

// GET /orders/user/me — customer's own active/recent orders (must be BEFORE /:id)
router.get(
  '/user/me',
  requireRole('customer'),
  handleGetMyOrders
);

// GET /orders/staff — waiter/cashier view of orders on their branch (must be BEFORE /:id)
router.get(
  '/staff',
  injectTenant,
  requireRole('waiter', 'cashier', 'manager', 'owner'),
  handleGetStaffOrders
);

// GET /orders/table/:tableId — FIX: must be BEFORE /:id (else 'table' parsed as order id)
router.get(
  '/table/:tableId',
  injectTenant,
  requireRole('waiter', 'cashier', 'manager', 'owner'),
  handleGetOrderByTable
);

// GET /orders/branch/:branchId/active — FIX: must be BEFORE /:id
router.get(
  '/branch/:branchId/active',
  injectTenant,
  requireRole('manager', 'owner', 'cashier'),
  handleGetActiveBranchOrders
);

// GET /orders/:id — any authenticated user
router.get('/:id', injectTenant, handleGetOrder);

// PATCH /orders/:id/cancel — manager/owner only
router.patch(
  '/:id/cancel',
  injectTenant,
  requireRole('manager', 'owner'),
  validate(cancelOrderSchema),
  handleCancelOrder
);

// POST /orders/:orderId/call-waiter — customer or staff call the waiter
router.post(
  '/:orderId/call-waiter',
  injectTenant,
  requireRole('customer', 'waiter', 'manager', 'owner'),
  handleCallWaiter
);

// P3-1 ADDITION: Apply coupon to an order (customer or cashier)
router.post(
  '/:orderId/apply-coupon',
  injectTenant,
  requireRole('customer', 'cashier', 'manager', 'owner'),
  validate({ body: z.object({ code: z.string().min(1).toUpperCase() }) }),
  handleApplyCoupon
);

export default router;
