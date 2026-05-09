import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import {
  createOrder,
  getOrderById,
  getOrdersByTable,
  getActiveBranchOrders,
  cancelOrder,
} from './orders.service';
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

export async function handleGetOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const order = await getOrderById(req.params.id, req.branchId!);
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
