import { Router } from 'express';
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
  handleCancelOrder,
} from './orders.controller';

const router: import('express').Router = Router();

// All order routes require authentication + tenant injection
router.use(authenticate, injectTenant);

// POST /orders — waiter or customer via QR
router.post(
  '/',
  requireRole('waiter', 'customer', 'manager', 'owner', 'cashier'),
  // BUG FIX: validate({ body: schema }) passes a plain object — middleware calls
  // schema.safeParse() which doesn't exist on a plain object. Pass schema directly.
  validate(createOrderSchema),
  handleCreateOrder
);

// GET /orders/table/:tableId — FIX: must be BEFORE /:id (else 'table' parsed as order id)
router.get(
  '/table/:tableId',
  requireRole('waiter', 'cashier', 'manager', 'owner'),
  handleGetOrdersByTable
);

// GET /orders/branch/:branchId/active — FIX: must be BEFORE /:id
router.get(
  '/branch/:branchId/active',
  requireRole('manager', 'owner', 'cashier'),
  handleGetActiveBranchOrders
);

// GET /orders/:id — any authenticated user
router.get('/:id', handleGetOrder);

// PATCH /orders/:id/cancel — manager/owner only
router.patch(
  '/:id/cancel',
  requireRole('manager', 'owner'),
  validate(cancelOrderSchema),
  handleCancelOrder
);

export default router;
