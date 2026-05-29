"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.getOrderById = getOrderById;
exports.getOrdersByTable = getOrdersByTable;
exports.getMyOrders = getMyOrders;
exports.getStaffOrders = getStaffOrders;
exports.getActiveBranchOrders = getActiveBranchOrders;
exports.cancelOrder = cancelOrder;
const supabase_1 = require("../../config/supabase");
const redis_1 = require("../../config/redis");
const pagination_1 = require("../../utils/pagination");
const waiter_assign_1 = require("../../utils/waiter-assign");
const ACTIVE_CUSTOMER_STATUSES = ['created', 'confirmed', 'preparing', 'ready'];
const PAST_CUSTOMER_STATUSES = ['served', 'paid', 'closed', 'cancelled'];
const ACTIVE_STAFF_STATUSES = ['created', 'confirmed', 'preparing', 'ready', 'served'];
function normalizeOrderItems(items) {
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
async function createOrder(input, restaurantId, branchId, createdBy, customerIdOverride) {
    const { table_id, order_type, items, special_instructions } = input;
    const customerId = customerIdOverride ?? createdBy;
    // 1. Validate table belongs to this branch
    const { data: table, error: tableErr } = await supabase_1.supabaseAdmin
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
    const { data: menuItems, error: menuErr } = await supabase_1.supabaseAdmin
        .from('menu_items')
        .select('id, name, price, status, branch_id, addons')
        .in('id', menuItemIds)
        .eq('branch_id', branchId);
    if (menuErr)
        throw menuErr;
    if (!menuItems || menuItems.length !== menuItemIds.length) {
        throw Object.assign(new Error('One or more menu items not found in this branch'), { statusCode: 422 });
    }
    const unavailable = menuItems.filter((m) => m.status !== 'available');
    if (unavailable.length > 0) {
        throw Object.assign(new Error(`Items not available: ${unavailable.map((m) => m.name).join(', ')}`), { statusCode: 422 });
    }
    // 3. Build price map + per-item addon price maps keyed by lowercase name
    // FIX: no separate menu_addons table — addons live as JSONB on menu_items.
    // Match by name (case-insensitive) to resolve prices.
    const priceMap = Object.fromEntries(menuItems.map((m) => [m.id, Number(m.price)]));
    const addonMap = {};
    for (const menuItem of menuItems) {
        const addonsJson = menuItem.addons ?? [];
        addonMap[menuItem.id] = Object.fromEntries(addonsJson.map((a) => [String(a.name).toLowerCase(), Number(a.price) || 0]));
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
    const assignedWaiterId = await (0, waiter_assign_1.findLeastBusyWaiter)(branchId);
    // 6. Insert order — FIX: status 'confirmed' not 'created'
    // BUG FIX: also added created_at/updated_at — both are NOT NULL in schema.
    const now = new Date().toISOString();
    const { data: order, error: orderErr } = await supabase_1.supabaseAdmin
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
    if (orderErr || !order)
        throw orderErr ?? new Error('Failed to create order');
    // 7. Insert order items
    // The live Supabase order_items table has created_at, but not updated_at.
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
    const { error: itemsErr } = await supabase_1.supabaseAdmin.from('order_items').insert(orderItemsPayload);
    if (itemsErr) {
        await supabase_1.supabaseAdmin.from('orders').delete().eq('id', order.id);
        throw itemsErr;
    }
    // 8. Mark table as occupied
    await supabase_1.supabaseAdmin
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
        await supabase_1.supabaseAdmin.channel(`branch:${branchId}:kitchen`).send({
            type: 'broadcast', event: 'order_created', payload: realtimePayload,
        });
        await supabase_1.supabaseAdmin.channel(`branch:${branchId}:cashier`).send({
            type: 'broadcast', event: 'order_created', payload: realtimePayload,
        });
    }
    catch {
        // Realtime is best-effort — never fail the HTTP response
    }
    // 10. Inventory deduction (fire-and-forget)
    deductInventory(branchId, items).catch((err) => console.error('[inventory] deduction failed:', err));
    return { ...order, computed_total: total, items: orderItemsPayload };
}
// ─── Inventory Deduction (internal) ─────────────────────────────────────────
async function deductInventory(branchId, items) {
    for (const item of items) {
        await supabase_1.supabaseAdmin.rpc('deduct_inventory_for_item', {
            p_branch_id: branchId,
            p_menu_item_id: item.menu_item_id,
            p_quantity: item.quantity,
        });
    }
}
// ─── Get Order by ID ─────────────────────────────────────────────────────────
async function getOrderById(orderId, branchId, userId) {
    let query = supabase_1.supabaseAdmin
        .from('orders')
        .select('*, order_items(*, menu_items(name, price))')
        .eq('id', orderId);
    if (branchId) {
        query = query.eq('branch_id', branchId);
    }
    else if (userId) {
        query = query.eq('customer_id', userId);
    }
    const { data, error } = await query.single();
    if (error || !data) {
        throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    }
    return data;
}
// ─── Get Active Orders for Table ─────────────────────────────────────────────
async function getOrdersByTable(tableId, branchId) {
    const { data, error } = await supabase_1.supabaseAdmin
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
    if (error)
        throw error;
    return data ?? [];
}
// ─── Get orders for current customer ─────────────────────────────────────────
async function getMyOrders(userId, branchId, query) {
    const { page, limit, offset } = (0, pagination_1.parsePagination)(query);
    let request = supabase_1.supabaseAdmin
        .from('orders')
        .select('*, tables(label), branches(name), order_items(id, quantity, unit_price, notes, status, menu_items(name, price))', { count: 'exact' })
        .eq('customer_id', userId);
    if (branchId) {
        request = request.eq('branch_id', branchId);
    }
    const status = query.status;
    if (status === 'active') {
        request = request.in('status', ACTIVE_CUSTOMER_STATUSES);
    }
    else if (status === 'past') {
        request = request.in('status', PAST_CUSTOMER_STATUSES);
    }
    else if (status) {
        request = request.eq('status', status);
    }
    const { data, error, count } = await request
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error)
        throw error;
    const normalized = (data ?? []).map((order) => {
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
async function getStaffOrders(branchId, query) {
    const { page, limit, offset } = (0, pagination_1.parsePagination)(query);
    if (!branchId) {
        return { data: [], total: 0, page, limit };
    }
    let request = supabase_1.supabaseAdmin
        .from('orders')
        .select('*, tables(label), order_items(id, quantity, unit_price, notes, status, menu_items(name, price))', { count: 'exact' })
        .eq('branch_id', branchId);
    const status = query.status;
    if (!status || status === 'active') {
        request = request.in('status', ACTIVE_STAFF_STATUSES);
    }
    else if (status === 'past') {
        request = request.in('status', PAST_CUSTOMER_STATUSES);
    }
    else {
        request = request.eq('status', status);
    }
    const { data, error, count } = await request
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error)
        throw error;
    const customerIds = Array.from(new Set((data ?? []).map((order) => order.customer_id).filter(Boolean)));
    let customerNameById = {};
    if (customerIds.length > 0) {
        const { data: customers } = await supabase_1.supabaseAdmin
            .from('users')
            .select('id, name')
            .in('id', customerIds);
        customerNameById = Object.fromEntries((customers ?? []).map((user) => [user.id, user.name]));
    }
    const normalized = (data ?? []).map((order) => {
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
async function getActiveBranchOrders(branchId) {
    const { data, error } = await supabase_1.supabaseAdmin
        .from('orders')
        .select('*, order_items(id, status, menu_items(name)), tables(label)')
        .eq('branch_id', branchId)
        // BUG FIX: same whitelist fix — avoid casting 'cancelled' against DB enum
        .in('status', ['created', 'confirmed', 'preparing', 'ready', 'served'])
        .order('created_at', { ascending: true });
    if (error)
        throw error;
    return data ?? [];
}
// ─── Cancel Order ─────────────────────────────────────────────────────────────
async function cancelOrder(orderId, branchId, reason) {
    const { data: order, error: fetchErr } = await supabase_1.supabaseAdmin
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
    const servedItems = (order.order_items ?? []).filter((i) => i.status === 'served');
    if (servedItems.length > 0) {
        throw Object.assign(new Error('Cannot cancel order — some items have already been served'), { statusCode: 422 });
    }
    // FIX: 'cancelled' added to OrderStatus enum via migration (ALTER TYPE)
    const { data: updated, error: updateErr } = await supabase_1.supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select()
        .single();
    if (updateErr)
        throw updateErr;
    if (reason) {
        await redis_1.redis.setex(`order_cancel_reason:${orderId}`, 60 * 60 * 24, reason);
    }
    return updated;
}
//# sourceMappingURL=orders.service.js.map