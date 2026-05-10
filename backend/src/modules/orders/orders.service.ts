import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import { findLeastBusyWaiter } from '../../utils/waiter-assign';
import type { CreateOrderInput } from './orders.schema';

// ─── Create Order ────────────────────────────────────────────────────────────
export async function createOrder(
  input: CreateOrderInput,
  restaurantId: string,
  branchId: string,
  createdBy: string,
  customerIdOverride?: string | null
) {
  const { table_id, order_type, items, special_instructions } = input;
  const customerId = customerIdOverride ?? createdBy;

  // 1. Validate table belongs to this branch
  const { data: table, error: tableErr } = await supabaseAdmin
    .from('tables')
    .select('id, branch_id, status')
    .eq('id', table_id)
    .eq('branch_id', branchId)
    .single();

  if (tableErr || !table) {
    throw Object.assign(new Error('Table not found or does not belong to this branch'), { statusCode: 404 });
  }

  // 2. Validate all menu items belong to this branch and are available
  // FIX: fetch addons JSONB so we can resolve addon prices by name
  const menuItemIds = items.map((i) => i.menu_item_id);
  const { data: menuItems, error: menuErr } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, price, status, branch_id, addons')
    .in('id', menuItemIds)
    .eq('branch_id', branchId);

  if (menuErr) throw menuErr;

  if (!menuItems || menuItems.length !== menuItemIds.length) {
    throw Object.assign(new Error('One or more menu items not found in this branch'), { statusCode: 422 });
  }

  const unavailable = menuItems.filter((m) => m.status !== 'available');
  if (unavailable.length > 0) {
    throw Object.assign(
      new Error(`Items not available: ${unavailable.map((m) => m.name).join(', ')}`),
      { statusCode: 422 }
    );
  }

  // 3. Build price map + per-item addon price maps keyed by lowercase name
  // FIX: no separate menu_addons table — addons live as JSONB on menu_items.
  // Match by name (case-insensitive) to resolve prices.
  const priceMap = Object.fromEntries(menuItems.map((m) => [m.id, Number(m.price)]));

  const addonMap: Record<string, Record<string, number>> = {};
  for (const menuItem of menuItems) {
    const addonsJson = (menuItem.addons as any[]) ?? [];
    addonMap[menuItem.id] = Object.fromEntries(
      addonsJson.map((a: any) => [String(a.name).toLowerCase(), Number(a.price) || 0])
    );
  }

  // 4. Calculate total
  let total = 0;
  for (const item of items) {
    const unitPrice = priceMap[item.menu_item_id] || 0;
    let addonTotal = 0;
    for (const addon of item.addons ?? []) {
      const addonPrice = addonMap[item.menu_item_id]?.[addon.name.toLowerCase()] ?? 0;
      addonTotal += addonPrice * addon.quantity;
    }
    total += (unitPrice + addonTotal) * item.quantity;
  }

  // 5. Auto-assign waiter
  const assignedWaiterId = await findLeastBusyWaiter(branchId);

  // 6. Insert order — FIX: status 'confirmed' not 'created'
  // BUG FIX: also added created_at/updated_at — both are NOT NULL in schema.
  const now = new Date().toISOString();
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .insert({
      branch_id: branchId,
      table_id: table_id ?? null,
      customer_id: customerId,
      waiter_id: assignedWaiterId ?? null,
      order_type,
      special_instructions: special_instructions ?? null,
      status: 'confirmed',
      confirmed_at: now,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (orderErr || !order) throw orderErr ?? new Error('Failed to create order');

  // 7. Insert order items
  // BUG FIX: added created_at/updated_at — both are NOT NULL in order_items schema.
  const orderItemsPayload = items.map((item) => ({
    order_id: order.id,
    menu_item_id: item.menu_item_id,
    quantity: item.quantity,
    unit_price: priceMap[item.menu_item_id] || 0,
    notes: item.notes ?? null,
    status: 'pending',
    addons: item.addons?.length ? item.addons : null,
    created_at: now,
    updated_at: now,
  }));

  const { error: itemsErr } = await supabaseAdmin.from('order_items').insert(orderItemsPayload);
  if (itemsErr) {
    await supabaseAdmin.from('orders').delete().eq('id', order.id);
    throw itemsErr;
  }

  // 8. Mark table as occupied
  await supabaseAdmin
    .from('tables')
    .update({ status: 'occupied', updated_at: new Date().toISOString() })
    .eq('id', table_id);

  // 9. Broadcast to kitchen and cashier (non-fatal)
  const realtimePayload = {
    event: 'order_created',
    order_id: order.id,
    branch_id: branchId,
    table_id,
    computed_total: total,
    status: 'confirmed',
  };

  try {
    await supabaseAdmin.channel(`branch:${branchId}:kitchen`).send({
      type: 'broadcast', event: 'order_created', payload: realtimePayload,
    });
    await supabaseAdmin.channel(`branch:${branchId}:cashier`).send({
      type: 'broadcast', event: 'order_created', payload: realtimePayload,
    });
  } catch {
    // Realtime is best-effort — never fail the HTTP response
  }

  // 10. Inventory deduction (fire-and-forget)
  deductInventory(branchId, items).catch((err) =>
    console.error('[inventory] deduction failed:', err)
  );

  return { ...order, computed_total: total, items: orderItemsPayload };
}

// ─── Inventory Deduction (internal) ─────────────────────────────────────────
async function deductInventory(branchId: string, items: CreateOrderInput['items']) {
  for (const item of items) {
    await supabaseAdmin.rpc('deduct_inventory_for_item', {
      p_branch_id: branchId,
      p_menu_item_id: item.menu_item_id,
      p_quantity: item.quantity,
    });
  }
}

// ─── Get Order by ID ─────────────────────────────────────────────────────────
export async function getOrderById(orderId: string, branchId: string) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*, menu_items(name, price))')
    .eq('id', orderId)
    .eq('branch_id', branchId)
    .single();

  if (error || !data) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }
  return data;
}

// ─── Get Active Orders for Table ─────────────────────────────────────────────
export async function getOrdersByTable(tableId: string, branchId: string) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*, menu_items(name, price))')
    .eq('table_id', tableId)
    .eq('branch_id', branchId)
    // BUG FIX: .not() forces Postgres to cast every value against the OrderStatus
    // enum. If 'cancelled' hasn't been added to the live DB enum yet, Postgres
    // throws "invalid input value for enum". Use .in() whitelist of statuses
    // confirmed to exist in the DB so the filter never touches unknown enum values.
    .in('status', ['created', 'confirmed', 'preparing', 'ready', 'served'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ─── Get Active Orders for Branch ────────────────────────────────────────────
export async function getActiveBranchOrders(branchId: string) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(id, status, menu_items(name)), tables(label)')
    .eq('branch_id', branchId)
    // BUG FIX: same whitelist fix — avoid casting 'cancelled' against DB enum
    .in('status', ['created', 'confirmed', 'preparing', 'ready', 'served'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Cancel Order ─────────────────────────────────────────────────────────────
export async function cancelOrder(orderId: string, branchId: string, reason?: string) {
  const { data: order, error: fetchErr } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(id, status)')
    .eq('id', orderId)
    .eq('branch_id', branchId)
    .single();

  if (fetchErr || !order) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  if (['paid', 'closed', 'cancelled'].includes(order.status)) {
    throw Object.assign(new Error(`Cannot cancel order with status: ${order.status}`), { statusCode: 422 });
  }

  const servedItems = (order.order_items ?? []).filter(
    (i: { status: string }) => i.status === 'served'
  );
  if (servedItems.length > 0) {
    throw Object.assign(
      new Error('Cannot cancel order — some items have already been served'),
      { statusCode: 422 }
    );
  }

  // FIX: 'cancelled' added to OrderStatus enum via migration (ALTER TYPE)
  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single();

  if (updateErr) throw updateErr;

  if (reason) {
    await redis.setex(`order_cancel_reason:${orderId}`, 60 * 60 * 24, reason);
  }

  return updated;
}
