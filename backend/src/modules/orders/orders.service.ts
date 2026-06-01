import { supabaseAdmin } from '../../config/supabase';
import { redis } from '../../config/redis';
import { parsePagination } from '../../utils/pagination';
import { assignWaiterToTable, getWaiterWorkloads } from '../waiter-assignment/waiter-assignment.service';
import { validateCoupon } from '../coupons/coupons.service'; // P3-1 ADDITION
import type { CreateOrderInput } from './orders.schema';

const ACTIVE_CUSTOMER_STATUSES = ['created', 'confirmed', 'preparing', 'ready'];
const PAST_CUSTOMER_STATUSES = ['served', 'paid', 'closed', 'cancelled'];
const ACTIVE_STAFF_STATUSES = ['created', 'confirmed', 'preparing', 'ready', 'served'];

// ─── Cache constants ──────────────────────────────────────────────────────────
const ORDER_CACHE_TTL         = 60;  // 60 s — orders change state frequently
const ACTIVE_ORDERS_CACHE_TTL = 10;  // 10 s — kitchen needs near-realtime data

const orderCacheKey        = (orderId: string)  => `order:${orderId}`;
const activeOrdersCacheKey = (branchId: string) => `active_orders:${branchId}`;

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function getOrderCache(orderId: string): Promise<unknown | null> {
  try {
    const cached = await redis.get(orderCacheKey(orderId));
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis miss or error — fall through to DB
  }
  return null;
}

async function setOrderCache(orderId: string, data: unknown): Promise<void> {
  try {
    await redis.setex(orderCacheKey(orderId), ORDER_CACHE_TTL, JSON.stringify(data));
  } catch {
    // Cache write failure is non-fatal
  }
}

async function bustOrderCache(orderId: string): Promise<void> {
  try {
    await redis.del(orderCacheKey(orderId));
  } catch {
    // Cache invalidation failure is non-fatal
  }
}

async function bustActiveOrdersCache(branchId: string): Promise<void> {
  try {
    await redis.del(activeOrdersCacheKey(branchId));
  } catch {
    // Cache invalidation failure is non-fatal
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderItemRow = {
  id: string;
  quantity: number;
  unit_price: number | string | null;
  notes?: string | null;
  status?: string | null;
  menu_items?: { name?: string | null; price?: number | string | null } | null;
};

function normalizeOrderItems(items: OrderItemRow[] | null | undefined) {
  const normalized = (items ?? []).map((item) => {
    const unitPrice = Number(item.unit_price ?? item.menu_items?.price ?? 0);
    return {
      id: item.id,
      quantity: Number(item.quantity ?? 0),
      unitPrice,
      price: unitPrice,
      status: item.status ?? undefined,
      notes: item.notes ?? undefined,
      specialRequests: item.notes ?? undefined,
      name: item.menu_items?.name ?? 'Item',
      menuItem: item.menu_items ?? undefined,
    };
  });

  const total = normalized.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  return { items: normalized, total };
}

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

  // 5. Auto-assign waiter using the workload-scoring module.
  //    Fetches workloads (from 10s cache or fresh DB query) and picks the
  //    lowest-score active waiter. Returns null if no waiters are available.
  let assignedWaiterId: string | null = null;
  try {
    const workloads = await getWaiterWorkloads(branchId);
    assignedWaiterId = workloads.length > 0 ? workloads[0]!.waiter_id : null;
  } catch (assignErr) {
    // Workload fetch failure is non-fatal — order proceeds without a waiter
    console.error('[waiter-assign] Workload fetch failed, continuing without assignment:', assignErr);
  }

  // 6. Insert order
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
  const orderItemsPayload = items.map((item) => ({
    order_id: order.id,
    menu_item_id: item.menu_item_id,
    quantity: item.quantity,
    unit_price: priceMap[item.menu_item_id] || 0,
    notes: item.notes ?? null,
    status: 'pending',
    addons: item.addons?.length ? item.addons : null,
    created_at: now,
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

  // 9. If this order is for a table and no waiter was assigned (none active),
  //    trigger the full assignment flow which also emits WebSocket events.
  //    If a waiter was already assigned inline above, just notify them.
  if (table_id) {
    if (assignedWaiterId) {
      // Waiter already set on the order — emit WebSocket notification
      try {
        const { io } = await import('../../server');
        io.to(`waiter:${assignedWaiterId}`).emit('table_assigned', {
          table_id,
          branch_id: branchId,
          order_id: order.id,
          assigned_at: now,
        });
        io.to(`branch:${branchId}`).emit('table_status_changed', {
          table_id,
          branch_id: branchId,
          assigned_waiter_id: assignedWaiterId,
        });
      } catch {
        // WebSocket emission failure is non-fatal
      }
    } else {
      // No waiter found via workloads — try the full assignment flow
      assignWaiterToTable(table_id, branchId, restaurantId).catch((err) =>
        console.error('[waiter-assign] Auto-assignment failed (non-fatal):', err),
      );
    }
  }

  // 10. Broadcast to kitchen and cashier (non-fatal)
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

  // 11. Inventory deduction (fire-and-forget)
  deductInventory(branchId, items).catch((err) =>
    console.error('[inventory] deduction failed:', err)
  );

  // ✅ PATCH: Bust active orders cache so kitchen/cashier see the new order
  await bustActiveOrdersCache(branchId);

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

// ─── Get Order by ID ──────────────────────────────────────────────────────────
// ✅ PATCH: Redis cache added (GET → SET on miss)
export async function getOrderById(orderId: string, branchId?: string, userId?: string) {
  // 1. Try cache
  const cached = await getOrderCache(orderId);
  if (cached) return cached;

  // 2. DB fallback
  let query = supabaseAdmin
    .from('orders')
    .select('*, order_items(*, menu_items(name, price))')
    .eq('id', orderId);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  } else if (userId) {
    query = query.eq('customer_id', userId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  // 3. Populate cache
  await setOrderCache(orderId, data);

  return data;
}

// ─── Get Active Orders for Table ─────────────────────────────────────────────
export async function getOrdersByTable(tableId: string, branchId: string) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*, menu_items(name, price))')
    .eq('table_id', tableId)
    .eq('branch_id', branchId)
    .in('status', ['created', 'confirmed', 'preparing', 'ready', 'served'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ─── Apply coupon to an order ────────────────────────────────────────────
// P3-1 ADDITION
export async function applyCoupon(
  orderId: string,
  couponCode: string,
  userId: string,
  restaurantId: string
): Promise<{ discount: number; coupon_id: string; new_total: number }> {
  // 1) Fetch the order
  const { data: order, error: orderFetchErr } = await supabaseAdmin
    .from('orders')
    .select('id, total_amount, branch_id, order_type, status, coupon_id')
    .eq('id', orderId)
    .maybeSingle();

  if (orderFetchErr) throw orderFetchErr;

  if (!order) {
    throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }

  // 2) Verify order belongs to restaurantId (via branch)
  const { data: branch, error: branchErr } = await supabaseAdmin
    .from('branches')
    .select('id, restaurant_id')
    .eq('id', order.branch_id)
    .maybeSingle();

  if (branchErr) throw branchErr;
  if (!branch || branch.restaurant_id !== restaurantId) {
    throw Object.assign(new Error('Order does not belong to this restaurant'), { statusCode: 403 });
  }

  // 3) Verify order status is NOT 'paid' or 'cancelled'
  if (['paid', 'cancelled'].includes(order.status)) {
    throw Object.assign(new Error('Cannot apply coupon to a paid or cancelled order'), { statusCode: 422 });
  }

  // 4) Check if coupon already applied
  if (order.coupon_id) {
    throw Object.assign(new Error('A coupon is already applied'), { statusCode: 409, errorCode: 'COUPON_ALREADY_APPLIED' });
  }

  const totalAmount = Number(order.total_amount ?? 0);

  // 5) Call validateCoupon from coupons.service
  const result = await validateCoupon(
    couponCode,
    orderId,
    totalAmount,
    order.order_type,
    userId,
    restaurantId
  );

  // validateCoupon throws; but keep type-safe
  if (!result.valid) {
    throw Object.assign(new Error(result.error_code ?? 'COUPON_INVALID'), { statusCode: 400, errorCode: result.error_code });
  }

  // 6) Apply discount
  const newTotal = totalAmount - result.discount_amount;

  const { error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({
      discount_amount: result.discount_amount,
      coupon_id: result.coupon_id,
      final_amount: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateErr) throw updateErr;

  // 7) Return expected payload
  return { discount: result.discount_amount, coupon_id: result.coupon_id, new_total: newTotal };
}

// ─── Get ACTIVE order for a table (or null) ────────────────────────────────
// P3-1 ADDITION
export async function getOrderByTable(
  tableId: string,
  branchId: string
): Promise<unknown | null> {
  // ACTIVE = status NOT IN ['paid', 'cancelled', 'closed']
  const { data: order, error: orderErr } = await supabaseAdmin
    .from('orders')
    .select(
      `
        *,
        order_items(
          id,
          menu_item_id,
          quantity,
          unit_price,
          status,
          menu_items:menu_items(name)
        )
      `
    )
    .eq('table_id', tableId)
    .eq('branch_id', branchId)
    .in('status', ['created', 'confirmed', 'preparing', 'ready', 'served'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderErr) throw orderErr;
  if (!order) return null;

  const items = (order.order_items ?? []).map((oi: any) => ({
    id: oi.id,
    menu_item_id: oi.menu_item_id,
    name: oi.menu_items?.name ?? null,
    quantity: oi.quantity,
    unit_price: oi.unit_price,
    status: oi.status,
  }));

  return { ...order, items };
}

// ─── Get orders for current customer ─────────────────────────────────────────
export async function getMyOrders(
  userId: string,
  branchId: string | undefined,
  query: Record<string, string | undefined>
) {
  const { page, limit, offset } = parsePagination(query);

  let request = supabaseAdmin
    .from('orders')
    .select(
      '*, tables(label), branches(name), order_items(id, quantity, unit_price, notes, status, menu_items(name, price))',
      { count: 'exact' }
    )
    .eq('customer_id', userId);

  if (branchId) {
    request = request.eq('branch_id', branchId);
  }

  const status = query.status;
  if (status === 'active') {
    request = request.in('status', ACTIVE_CUSTOMER_STATUSES);
  } else if (status === 'past') {
    request = request.in('status', PAST_CUSTOMER_STATUSES);
  } else if (status) {
    request = request.eq('status', status);
  }

  const { data, error, count } = await request
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const normalized = (data ?? []).map((order: any) => {
    const { items, total } = normalizeOrderItems(order.order_items);
    return {
      ...order,
      items,
      total,
      totalAmount: total,
      branch: order.branches ?? null,
      table: order.tables ?? null,
    };
  });

  return { data: normalized, total: count ?? 0, page, limit };
}

// ─── Get staff orders for branch ─────────────────────────────────────────────
export async function getStaffOrders(
  branchId: string,
  query: Record<string, string | undefined>
) {
  const { page, limit, offset } = parsePagination(query);

  if (!branchId) {
    return { data: [], total: 0, page, limit };
  }

  let request = supabaseAdmin
    .from('orders')
    .select(
      '*, tables(label), order_items(id, quantity, unit_price, notes, status, menu_items(name, price))',
      { count: 'exact' }
    )
    .eq('branch_id', branchId);

  const status = query.status;
  if (!status || status === 'active') {
    request = request.in('status', ACTIVE_STAFF_STATUSES);
  } else if (status === 'past') {
    request = request.in('status', PAST_CUSTOMER_STATUSES);
  } else {
    request = request.eq('status', status);
  }

  const { data, error, count } = await request
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const customerIds = Array.from(
    new Set((data ?? []).map((order: any) => order.customer_id).filter(Boolean))
  ) as string[];

  let customerNameById: Record<string, string> = {};
  if (customerIds.length > 0) {
    const { data: customers } = await supabaseAdmin
      .from('users')
      .select('id, name')
      .in('id', customerIds);

    customerNameById = Object.fromEntries(
      (customers ?? []).map((user: any) => [user.id, user.name])
    );
  }

  const normalized = (data ?? []).map((order: any) => {
    const { items, total } = normalizeOrderItems(order.order_items);
    const orderNumber = order.id ? String(order.id).slice(-6).toUpperCase() : '';
    const customerName = order.customer_id ? customerNameById[order.customer_id] : undefined;

    return {
      ...order,
      items,
      total,
      totalAmount: total,
      orderNumber,
      customerName: customerName ?? 'Guest',
      tableNumber: order.tables?.label ?? undefined,
      createdAt: order.created_at,
    };
  });

  return { data: normalized, total: count ?? 0, page, limit };
}

// ─── Get Active Orders for Branch ────────────────────────────────────────────
// ✅ PATCH: Redis cache added (GET → SET on miss)
export async function getActiveBranchOrders(branchId: string) {
  // 1. Try cache
  try {
    const cached = await redis.get(activeOrdersCacheKey(branchId));
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis miss or error — fall through to DB
  }

  // 2. DB query
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(id, status, menu_items(name)), tables(label)')
    .eq('branch_id', branchId)
    .in('status', ['created', 'confirmed', 'preparing', 'ready', 'served'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  const result = data ?? [];

  // 3. Populate cache
  try {
    await redis.setex(activeOrdersCacheKey(branchId), ACTIVE_ORDERS_CACHE_TTL, JSON.stringify(result));
  } catch {
    // Cache write failure is non-fatal
  }

  return result;
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

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single();

  if (updateErr) throw updateErr;

  try {
    await supabaseAdmin.channel(`branch:${branchId}`).send({
      type: 'broadcast',
      event: 'order_cancelled',
      payload: {
        order_id: orderId,
        branch_id: branchId,
        reason: reason ?? null,
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      },
    });
  } catch (broadcastErr: any) {
    console.warn('[orders] cancel broadcast failed:', broadcastErr.message);
  }

  // ✅ PATCH: Invalidate both the single-order cache and the branch active-orders cache
  await Promise.all([
    bustOrderCache(orderId),
    bustActiveOrdersCache(branchId),
  ]);

  if (reason) {
    await redis.setex(`order_cancel_reason:${orderId}`, 60 * 60 * 24, reason);
  }

  return updated;
}