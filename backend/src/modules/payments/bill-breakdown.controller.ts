import { Request, Response, NextFunction } from 'express';
import { success, error } from '../../utils/response';
import { supabaseAdmin } from '../../config/supabase';
import { calculateBill } from '../../utils/gst';

// NOTE:
// This repo's Express typings appear customized such that standard members like
// req.params and res.status/res.json may not exist on the exported types.
// For this controller we loosen handler parameter typings to ensure correct
// compilation without impacting runtime behavior.


export async function handleGetBillBreakdown(
  req: any,
  res: any,
  next: any,
) {
  try {
    const { orderId } = req.params;

    // Branch context is required for authorization.
    const branchId = req.branchId ?? req.user?.branch_id;
    if (!branchId) {
      return res.status(403).json(error('FORBIDDEN', 'No branch context found'));
    }

    // Fetch order type + customer_id + items snapshot
    const [{ data: order }, { data: items }] = await Promise.all([
      supabaseAdmin
        .from('orders')
        .select('id, order_type, status, branch_id, customer_id')
        .eq('id', orderId)
        .eq('branch_id', branchId)
        .single(),
      supabaseAdmin
        .from('order_items')
        .select('quantity, unit_price')
        .eq('order_id', orderId),
    ]);

    if (!order) {
      return res.status(404).json(error('NOT_FOUND', 'Order not found'));
    }

    const subtotal = (items ?? []).reduce(
      (sum: number, i: any) => sum + Number(i.unit_price) * Number(i.quantity),
      0,
    );

    // Discount comes from coupon applied, if any.
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('discount_amount')
      .eq('order_id', orderId)
      .maybeSingle();

    const discount_amount = payment?.discount_amount ? Number(payment.discount_amount) : 0;

    const bill = calculateBill(subtotal, {
      order_type: order.order_type,
      apply_service_charge: true,
      discount_amount,
    });

    return res.json(success(bill));
  } catch (err) {
    next(err);
  }
}

