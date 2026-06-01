import { supabaseAdmin } from '../../config/supabase';
import { insertAuditLog } from '../../utils/audit-log';
import { buildPaginationMeta } from '../../utils/pagination';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ListCustomersOptions {
  search?: string;
  sort?: 'visits' | 'spend' | 'last_visit';
  page: number;
  limit: number;
}

// ─── List Restaurant Customers ───────────────────────────────────────────────
/**
 * Returns paginated list of customers who have placed at least 1 non-cancelled
 * order at any branch belonging to this restaurant.
 *
 * Privacy: phone_masked (last 4 digits) is always returned;
 * phone_full is returned for the controller to selectively expose based on role.
 */
export async function listRestaurantCustomers(
  restaurantId: string,
  options: ListCustomersOptions,
) {
  const { search, sort = 'last_visit', page, limit } = options;
  const offset = (page - 1) * limit;

  // Map sort param → actual column expression used in ORDER BY
  const sortColumnMap: Record<string, string> = {
    visits:     'visit_count',
    spend:      'total_spent',
    last_visit: 'last_visit',
  };
  const orderColumn = sortColumnMap[sort] ?? 'last_visit';

  // Build search filter clause
  const searchClause = search
    ? `AND u.name ILIKE '%${search.replace(/'/g, "''")}%'`
    : '';

  // Count query — used for pagination meta
  const countSql = `
    SELECT COUNT(DISTINCT u.id)::int AS total
    FROM users u
    JOIN orders o ON u.id = o.customer_id
    JOIN branches b ON o.branch_id = b.id
    WHERE b.restaurant_id = '${restaurantId}'
      AND u.role = 'customer'
      AND o.status NOT IN ('cancelled')
      ${searchClause}
  `;

  // Data query
  const dataSql = `
    SELECT
      u.id,
      u.name                                            AS display_name,
      '****' || RIGHT(u.phone, 4)                       AS phone_masked,
      u.phone                                            AS phone_full,
      COUNT(DISTINCT o.id)::int                          AS visit_count,
      MAX(o.created_at)                                  AS last_visit,
      COALESCE(
        SUM(p.amount) FILTER (WHERE p.status = 'completed'),
        0
      )::numeric                                         AS total_spent,
      u.created_by_restaurant
    FROM users u
    JOIN orders o ON u.id = o.customer_id
    JOIN branches b ON o.branch_id = b.id
    LEFT JOIN payments p ON o.id = p.order_id
    WHERE b.restaurant_id = '${restaurantId}'
      AND u.role = 'customer'
      AND o.status NOT IN ('cancelled')
      ${searchClause}
    GROUP BY u.id, u.name, u.phone, u.created_by_restaurant
    ORDER BY ${orderColumn} DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [countResult, dataResult] = await Promise.all([
    supabaseAdmin.rpc('run_sql', { query: countSql }).single(),
    supabaseAdmin.rpc('run_sql', { query: dataSql }),
  ]);

  // Fallback: if run_sql RPC is not available, use Supabase query builder
  // with a join approach. run_sql is preferred for complex GROUP BY queries.
  if (countResult.error || dataResult.error) {
    return listRestaurantCustomersFallback(restaurantId, options);
  }

  const total: number = (countResult.data as any)?.total ?? 0;
  const customers: any[] = Array.isArray(dataResult.data) ? dataResult.data : [];

  return {
    data: customers,
    meta: buildPaginationMeta(total, page, limit),
  };
}

/**
 * Fallback implementation using Supabase query builder.
 * Trades some SQL expressiveness for compatibility with hosted Supabase
 * instances that do not expose an arbitrary-SQL RPC.
 */
async function listRestaurantCustomersFallback(
  restaurantId: string,
  options: ListCustomersOptions,
) {
  const { search, sort = 'last_visit', page, limit } = options;
  const offset = (page - 1) * limit;

  // Step 1: get all branch IDs for this restaurant
  const { data: branches, error: branchErr } = await supabaseAdmin
    .from('branches')
    .select('id')
    .eq('restaurant_id', restaurantId);

  if (branchErr) throw new Error(`Failed to fetch branches: ${branchErr.message}`);

  const branchIds = (branches ?? []).map((b: any) => b.id);
  if (branchIds.length === 0) {
    return { data: [], meta: buildPaginationMeta(0, page, limit) };
  }

  // Step 2: get distinct customer IDs from orders at those branches
  const { data: orders, error: ordersErr } = await supabaseAdmin
    .from('orders')
    .select('customer_id, id, created_at, branch_id')
    .in('branch_id', branchIds)
    .not('status', 'eq', 'cancelled');

  if (ordersErr) throw new Error(`Failed to fetch orders: ${ordersErr.message}`);

  const orderList = orders ?? [];
  const customerOrderMap = new Map<string, { orderIds: string[]; lastVisit: string }>();

  for (const o of orderList) {
    if (!o.customer_id) continue;
    const existing = customerOrderMap.get(o.customer_id);
    if (!existing) {
      customerOrderMap.set(o.customer_id, { orderIds: [o.id], lastVisit: o.created_at });
    } else {
      existing.orderIds.push(o.id);
      if (o.created_at > existing.lastVisit) existing.lastVisit = o.created_at;
    }
  }

  const customerIds = Array.from(customerOrderMap.keys());
  if (customerIds.length === 0) {
    return { data: [], meta: buildPaginationMeta(0, page, limit) };
  }

  // Step 3: fetch user records
  let userQuery = supabaseAdmin
    .from('users')
    .select('id, name, phone, created_by_restaurant, role')
    .in('id', customerIds)
    .eq('role', 'customer');

  if (search) {
    userQuery = userQuery.ilike('name', `%${search}%`);
  }

  const { data: users, error: usersErr } = await userQuery;
  if (usersErr) throw new Error(`Failed to fetch customers: ${usersErr.message}`);

  const userList = users ?? [];

  // Step 4: fetch payments for all relevant orders
  const allOrderIds = orderList.map((o: any) => o.id);
  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('order_id, amount, status')
    .in('order_id', allOrderIds)
    .eq('status', 'completed');

  const paymentMap = new Map<string, number>();
  for (const p of payments ?? []) {
    paymentMap.set(p.order_id, (paymentMap.get(p.order_id) ?? 0) + (p.amount ?? 0));
  }

  // Step 5: assemble result
  const assembled = userList.map((u: any) => {
    const meta = customerOrderMap.get(u.id)!;
    const totalSpent = meta.orderIds.reduce(
      (sum, oid) => sum + (paymentMap.get(oid) ?? 0),
      0,
    );
    const phone: string = u.phone ?? '';
    return {
      id: u.id,
      display_name: u.name,
      phone_masked: phone.length >= 4 ? `****${phone.slice(-4)}` : '****',
      phone_full: phone,
      visit_count: meta.orderIds.length,
      last_visit: meta.lastVisit,
      total_spent: Math.round(totalSpent * 100) / 100,
      created_by_restaurant: u.created_by_restaurant ?? false,
    };
  });

  // Sort
  assembled.sort((a, b) => {
    if (sort === 'visits') return b.visit_count - a.visit_count;
    if (sort === 'spend')  return b.total_spent - a.total_spent;
    // last_visit (default)
    return new Date(b.last_visit).getTime() - new Date(a.last_visit).getTime();
  });

  const total = assembled.length;
  const paginated = assembled.slice(offset, offset + limit);

  return {
    data: paginated,
    meta: buildPaginationMeta(total, page, limit),
  };
}

// ─── Create Customer By Restaurant ──────────────────────────────────────────
/**
 * Creates a lightweight customer record from the POS (no Supabase Auth user,
 * no password). If a user with the same phone already exists, links them
 * (returns existing ID).
 */
export async function createCustomerByRestaurant(
  restaurantId: string,
  name: string,
  phone: string,
  createdBy: string,
  ipAddress?: string,
) {
  const now = new Date().toISOString();

  // Check if a user with this phone already exists
  const { data: existing, error: lookupErr } = await supabaseAdmin
    .from('users')
    .select('id, name, phone, role')
    .eq('phone', phone)
    .limit(1)
    .maybeSingle();

  if (lookupErr) throw new Error(`Phone lookup failed: ${lookupErr.message}`);

  if (existing) {
    // User already exists — link by returning their id
    // (their order history will naturally associate them with this restaurant)
    await insertAuditLog({
      actorId: createdBy,
      action: 'CUSTOMER_LINKED_BY_RESTAURANT',
      targetType: 'user',
      targetId: existing.id,
      newValue: { restaurant_id: restaurantId, linked_phone: phone },
      ipAddress,
    });

    return {
      user_id: existing.id,
      is_existing: true,
      message: 'Customer linked to restaurant',
    };
  }

  // User does NOT exist — create a new one (no Supabase Auth, no password)
  const { data: newUser, error: createErr } = await supabaseAdmin
    .from('users')
    .insert({
      name:                   name.trim(),
      phone,
      email:                  null,
      password_hash:          null,
      role:                   'customer',
      created_by_restaurant:  true,
      is_active:              true,
      force_password_change:  false,
      created_at:             now,
      updated_at:             now,
    })
    .select('id')
    .single();

  if (createErr) throw new Error(`Customer creation failed: ${createErr.message}`);

  await insertAuditLog({
    actorId: createdBy,
    action: 'CUSTOMER_CREATED_BY_RESTAURANT',
    targetType: 'user',
    targetId: newUser.id,
    newValue: { name: name.trim(), phone, restaurant_id: restaurantId },
    ipAddress,
  });

  return {
    user_id: newUser.id,
    is_existing: false,
    message: 'Customer created successfully',
  };
}

// ─── Get Customer History ────────────────────────────────────────────────────
/**
 * Returns full visit history for a specific customer, scoped to this restaurant.
 * Includes order line items, payment details, and top-3 favourite items.
 *
 * Security: verifies the customer has actually visited this restaurant before
 * returning any data (prevents cross-tenant data leakage).
 */
export async function getCustomerHistory(customerId: string, restaurantId: string) {
  // ── Security check: verify customer has visited this restaurant ──────────
  const { data: verification, error: verifyErr } = await supabaseAdmin
    .from('orders')
    .select('id, branches!inner(restaurant_id)')
    .eq('customer_id', customerId)
    .eq('branches.restaurant_id', restaurantId)
    .not('status', 'eq', 'cancelled')
    .limit(1)
    .maybeSingle();

  if (verifyErr) throw new Error(`Verification failed: ${verifyErr.message}`);
  if (!verification) {
    throw Object.assign(new Error('Customer not found at this restaurant'), { statusCode: 404 });
  }

  // ── Fetch customer profile ────────────────────────────────────────────────
  const { data: customer, error: customerErr } = await supabaseAdmin
    .from('users')
    .select('id, name, phone, created_at')
    .eq('id', customerId)
    .single();

  if (customerErr) throw new Error(`Customer not found: ${customerErr.message}`);

  // ── Fetch orders at this restaurant (excluding cancelled) ─────────────────
  const { data: orders, error: ordersErr } = await supabaseAdmin
    .from('orders')
    .select(`
      id,
      status,
      order_type,
      total_amount,
      created_at,
      branches!inner(restaurant_id, name)
    `)
    .eq('customer_id', customerId)
    .eq('branches.restaurant_id', restaurantId)
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(50);

  if (ordersErr) throw new Error(`Failed to fetch orders: ${ordersErr.message}`);

  const orderList = orders ?? [];
  const orderIds  = orderList.map((o: any) => o.id);

  if (orderIds.length === 0) {
    const phone: string = customer.phone ?? '';
    return {
      customer: {
        id:           customer.id,
        name:         customer.name,
        phone_masked: phone.length >= 4 ? `****${phone.slice(-4)}` : '****',
        visit_count:  0,
        total_spent:  0,
        first_visit:  null,
        last_visit:   null,
      },
      orders:         [],
      favorite_items: [],
    };
  }

  // ── Fetch order items + menu item names ───────────────────────────────────
  const { data: orderItems, error: itemsErr } = await supabaseAdmin
    .from('order_items')
    .select('order_id, quantity, menu_item_id, menu_items(name)')
    .in('order_id', orderIds);

  if (itemsErr) throw new Error(`Failed to fetch order items: ${itemsErr.message}`);

  // ── Fetch payments ────────────────────────────────────────────────────────
  const { data: payments, error: paymentsErr } = await supabaseAdmin
    .from('payments')
    .select('order_id, amount, method, status')
    .in('order_id', orderIds)
    .eq('status', 'completed');

  if (paymentsErr) throw new Error(`Failed to fetch payments: ${paymentsErr.message}`);

  // ── Build lookup maps ─────────────────────────────────────────────────────
  const itemsByOrder = new Map<string, Array<{ name: string; quantity: number }>>();
  const itemFrequency = new Map<string, { name: string; count: number }>();

  for (const oi of orderItems ?? []) {
    const name = (oi as any).menu_items?.name ?? 'Unknown item';
    const qty  = oi.quantity ?? 1;

    if (!itemsByOrder.has(oi.order_id)) itemsByOrder.set(oi.order_id, []);
    itemsByOrder.get(oi.order_id)!.push({ name, quantity: qty });

    const freq = itemFrequency.get(oi.menu_item_id);
    if (!freq) {
      itemFrequency.set(oi.menu_item_id, { name, count: qty });
    } else {
      freq.count += qty;
    }
  }

  const paymentByOrder = new Map<string, { amount: number; method: string | null }>();
  for (const p of payments ?? []) {
    paymentByOrder.set(p.order_id, { amount: p.amount ?? 0, method: p.method ?? null });
  }

  // ── Assemble enriched orders ──────────────────────────────────────────────
  let totalSpent = 0;

  const enrichedOrders = orderList.map((o: any) => {
    const payment = paymentByOrder.get(o.id);
    if (payment) totalSpent += payment.amount;

    return {
      id:             o.id,
      status:         o.status,
      order_type:     o.order_type,
      total_amount:   o.total_amount,
      created_at:     o.created_at,
      branch_name:    o.branches?.name ?? null,
      items:          itemsByOrder.get(o.id) ?? [],
      payment_amount: payment?.amount ?? null,
      payment_method: payment?.method ?? null,
    };
  });

  // ── Compute favourite items (top 3 by frequency) ──────────────────────────
  const favoriteItems = Array.from(itemFrequency.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((f) => ({ name: f.name, order_count: f.count }));

  // ── Build customer summary ────────────────────────────────────────────────
  const sortedDates = orderList
    .map((o: any) => o.created_at as string)
    .sort();

  const phone: string = customer.phone ?? '';

  return {
    customer: {
      id:           customer.id,
      name:         customer.name,
      phone_masked: phone.length >= 4 ? `****${phone.slice(-4)}` : '****',
      visit_count:  orderList.length,
      total_spent:  Math.round(totalSpent * 100) / 100,
      first_visit:  sortedDates[0] ?? null,
      last_visit:   sortedDates[sortedDates.length - 1] ?? null,
    },
    orders:         enrichedOrders,
    favorite_items: favoriteItems,
  };
}