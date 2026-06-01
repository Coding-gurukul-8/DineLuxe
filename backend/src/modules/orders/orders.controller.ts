import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import { buildPaginationMeta } from '../../utils/pagination';
import {
  createOrder,
  getOrderById,
  getOrdersByTable,
  getMyOrders,
  getStaffOrders,
  getActiveBranchOrders,
  cancelOrder,
  applyCoupon, // P3-1 ADDITION
  getOrderByTable, // P3-1 ADDITION
} from './orders.service';
import { callWaiter } from './waiter-call.service';
import type { CreateOrderInput } from './orders.schema';

const STAFF_ORDER_ROLES = ['waiter', 'manager', 'owner', 'cashier', 'host'];

export async function handleCreateOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as Record<string, unknown>;
    const rawCustomerId = body.customer_id;
    const { customer_id: _c, ...orderPayload } = body;
    void _c;

    const customerIdOverride =
      STAFF_ORDER_ROLES.includes(req.user!.role) && typeof rawCustomerId === 'string'
        ? rawCustomerId
        : undefined;

    const order = await createOrder(
      orderPayload as CreateOrderInput,
      req.restaurantId!,
      req.branchId!,
      req.user!.id,
      customerIdOverride
    );
    res.status(201).json(success(order, 'Order created successfully'));
  } catch (err) {
    next(err);
  }
}

export async function handleGetMyOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, total, page, limit } = await getMyOrders(
      req.user!.id,
      req.branchId,
      req.query as Record<string, string | undefined>
    );
    res.json(success(data, buildPaginationMeta(total, page, limit)));
  } catch (err) {
    next(err);
  }
}

export async function handleGetStaffOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const { data, total, page, limit } = await getStaffOrders(
      req.branchId ?? '',
      req.query as Record<string, string | undefined>
    );
    res.json(success(data, buildPaginationMeta(total, page, limit)));
  } catch (err) {
    next(err);
  }
}

export async function handleGetOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await getOrderById(req.params.id, req.branchId, req.user?.id);
    res.json(success(order));
  } catch (err) {
    next(err);
  }
}

export async function handleGetOrdersByTable(req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await getOrdersByTable(req.params.tableId, req.branchId!);
    res.json(success(orders));
  } catch (err) {
    next(err);
  }
}

export async function handleGetActiveBranchOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await getActiveBranchOrders(req.params.branchId);
    res.json(success(orders));
  } catch (err) {
    next(err);
  }
}

export async function handleCancelOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await cancelOrder(req.params.id, req.branchId!, req.body.reason);
    res.json(success(order, 'Order cancelled'));
  } catch (err) {
    next(err);
  }
}

export async function handleCallWaiter(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await callWaiter(req.params.orderId, req.user?.id);
    res.status(201).json(success(data, 'Waiter called'));
  } catch (err) {
    next(err);
  }
}

// ─── Apply coupon to an order (customer or cashier) ─────────────────────
// P3-1 ADDITION
export async function handleApplyCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = req.params.orderId;
    const couponCode = String(req.body?.code ?? '');
    const userId = req.user!.id;
    const restaurantId = req.restaurantId!;

    const result = await applyCoupon(orderId, couponCode, userId, restaurantId);

    // Frontend expects: { discount: number }
    res.json(success({ discount: result.discount }));
  } catch (err) {
    next(err);
  }
}

// ─── Get active order for a table (waiter app) ─────────────────────────
// P3-1 ADDITION
export async function handleGetOrderByTable(req: Request, res: Response, next: NextFunction) {
  try {
    const tableId = req.params.tableId;
    const branchId = req.branchId!;

    const order = await getOrderByTable(tableId, branchId);

    // Either single active order payload or null
    res.json(success(order));
  } catch (err) {
    next(err);
  }
}
