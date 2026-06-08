// ─────────────────────────────────────────────────────────────────────────────
// orders.controller.ts  —  AUDITED & FIXED
//
// Changes vs original:
//   • handleGetMyOrders / handleGetStaffOrders: replaced success(data, paginationMeta)
//     with paginatedSuccess(data, paginationMeta) so pagination appears at the
//     top-level `pagination` key instead of being smuggled into `meta`.
//   • All error paths use next(err) — no inline raw error responses.
//   • HTTP status codes verified:
//       POST creates → 201  ✓
//       GET / PATCH  → 200  ✓
//       handleCallWaiter (creates a call record) → 201  ✓
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { success, paginatedSuccess } from '../../utils/response';
import { buildPaginationMeta } from '../../utils/pagination';
import {
  createOrder,
  getOrderById,
  getOrdersByTable,
  getMyOrders,
  getStaffOrders,
  getActiveBranchOrders,
  cancelOrder,
  applyCoupon,
  getOrderByTable,
  getLastThreeOrders, // QUICK REORDER ADDITION
  reorder,            // QUICK REORDER ADDITION
} from './orders.service';
import { callWaiter, acknowledgeWaiterCall } from './waiter-call.service';
import type { CreateOrderInput } from './orders.schema';

const STAFF_ORDER_ROLES = ['waiter', 'manager', 'owner', 'cashier', 'host'];

// ── POST /orders ──────────────────────────────────────────────────────────────

export async function handleCreateOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = req.body as Record<string, unknown>;
    const rawCustomerId = body.customer_id;
    const { customer_id: _c, ...orderPayload } = body;
    void _c;

    const customerIdOverride =
      STAFF_ORDER_ROLES.includes(req.user!.role) &&
      typeof rawCustomerId === 'string'
        ? rawCustomerId
        : undefined;

    const order = await createOrder(
      orderPayload as CreateOrderInput,
      req.restaurantId!,
      req.branchId!,
      req.user!.id,
      customerIdOverride,
    );
    // 201 — resource created
    res.status(201).json(success(order, 'Order created successfully'));
  } catch (err) {
    next(err);
  }
}

// ── GET /orders/my ────────────────────────────────────────────────────────────

export async function handleGetMyOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { data, total, page, limit } = await getMyOrders(
      req.user!.id,
      req.branchId,
      req.query as Record<string, string | undefined>,
    );
    // FIX: use paginatedSuccess so `pagination` is a top-level key
    res.json(paginatedSuccess(data, buildPaginationMeta(total, page, limit)));
  } catch (err) {
    next(err);
  }
}

// ── GET /orders (staff) ───────────────────────────────────────────────────────

export async function handleGetStaffOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { data, total, page, limit } = await getStaffOrders(
      req.branchId ?? '',
      req.query as Record<string, string | undefined>,
    );
    // FIX: use paginatedSuccess so `pagination` is a top-level key
    res.json(paginatedSuccess(data, buildPaginationMeta(total, page, limit)));
  } catch (err) {
    next(err);
  }
}

// ── GET /orders/:id ───────────────────────────────────────────────────────────

export async function handleGetOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const order = await getOrderById(req.params.id, req.branchId, req.user?.id);
    res.json(success(order));
  } catch (err) {
    next(err);
  }
}

// ── GET /orders/table/:tableId ────────────────────────────────────────────────

export async function handleGetOrdersByTable(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const orders = await getOrdersByTable(req.params.tableId, req.branchId!);
    res.json(success(orders));
  } catch (err) {
    next(err);
  }
}

// ── GET /orders/branch/:branchId/active ───────────────────────────────────────

export async function handleGetActiveBranchOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const orders = await getActiveBranchOrders(req.params.branchId);
    res.json(success(orders));
  } catch (err) {
    next(err);
  }
}

// ── PATCH /orders/:id/cancel ──────────────────────────────────────────────────

export async function handleCancelOrder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const order = await cancelOrder(
      req.params.id,
      req.branchId!,
      req.body.reason,
    );
    // 200 — update, not a new resource
    res.json(success(order, 'Order cancelled'));
  } catch (err) {
    next(err);
  }
}

// ── POST /orders/call-waiter ──────────────────────────────────────────────────
// Customer taps "Call Waiter" on the dine-in view.
// Body: { table_id, branch_id }

export async function handleCallWaiter(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { table_id, branch_id } = req.body as { table_id: string; branch_id: string };
    await callWaiter(table_id, branch_id, req.user!.id);
    res.status(201).json(success(null, 'Waiter notified'));
  } catch (err) {
    next(err);
  }
}

// ── POST /orders/acknowledge-call ─────────────────────────────────────────────
// Waiter taps "On My Way" on the persistent alert.
// Body: { table_id }

export async function handleAcknowledgeCall(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { table_id } = req.body as { table_id: string };
    await acknowledgeWaiterCall(table_id, req.user!.id);
    res.json(success(null, 'Acknowledged'));
  } catch (err) {
    next(err);
  }
}

// ── POST /orders/:orderId/coupon ──────────────────────────────────────────────

export async function handleApplyCoupon(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const orderId = req.params.orderId;
    const couponCode = String(req.body?.code ?? '');
    const userId = req.user!.id;
    const restaurantId = req.restaurantId!;

    const result = await applyCoupon(orderId, couponCode, userId, restaurantId);
    // 200 — modifies existing order (not a new resource)
    res.json(success({ discount: result.discount }));
  } catch (err) {
    next(err);
  }
}

// ── GET /orders/table/:tableId/active ─────────────────────────────────────────

export async function handleGetOrderByTable(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const tableId = req.params.tableId;
    const branchId = req.branchId!;

    const order = await getOrderByTable(tableId, branchId);
    res.json(success(order));
  } catch (err) {
    next(err);
  }
}

// QUICK REORDER ADDITION ──────────────────────────────────────────────────────

// ── GET /orders/customer/last-three ──────────────────────────────────────────
export async function handleGetLastThreeOrders(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const orders = await getLastThreeOrders(req.user!.id);
    res.json(success(orders));
  } catch (err) {
    next(err);
  }
}

// ── POST /orders/:orderId/reorder ─────────────────────────────────────────────
export async function handleReorder(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await reorder(req.params.orderId, req.user!.id);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}
// END QUICK REORDER ADDITION ──────────────────────────────────────────────────