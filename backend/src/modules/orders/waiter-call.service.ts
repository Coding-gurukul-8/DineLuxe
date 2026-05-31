import { supabaseAdmin } from '../../config/supabase';

export async function callWaiter(orderId: string, requestedBy?: string) {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, branch_id, table_id, status')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  const payload = {
    order_id: order.id,
    branch_id: order.branch_id,
    table_id: order.table_id,
    requested_by: requestedBy ?? null,
    created_at: new Date().toISOString(),
  };

  try {
    await supabaseAdmin.channel(`branch:${order.branch_id}`).send({
      type: 'broadcast',
      event: 'customer_call_waiter',
      payload,
    });
  } catch (broadcastErr: any) {
    console.warn('[waiter-call] broadcast failed:', broadcastErr.message);
  }

  return { requested: true, ...payload };
}