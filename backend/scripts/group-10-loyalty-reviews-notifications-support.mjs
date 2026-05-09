/**
 * Group 10 automated runner — aligns with docs/Testing/10-loyalty-reviews-notifications-support.md
 * Prerequisites: seeded accounts (docs/Testing/00-create-all-accounts-5001.md), backend on port 5001.
 */
const BASE = process.env.BASE ?? 'http://localhost:5001/api/v1';

function jwtSub(token) {
  try {
    const p = token.split('.')[1];
    return JSON.parse(Buffer.from(p, 'base64').toString()).sub ?? null;
  } catch {
    return null;
  }
}

async function request(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }
  return { status: res.status, data };
}

async function login(emailOrUsername, password) {
  const { data } = await request('POST', '/auth/login', null, { emailOrUsername, password });
  return data?.data?.accessToken ?? null;
}

function dataArray(payload) {
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function firstId(res) {
  return res?.data?.data?.id ?? res?.data?.id ?? null;
}

async function runStep(results, expectedStatuses, step) {
  const res = await request(step.method, step.path, step.token, step.body);
  const passed = expectedStatuses.includes(res.status);
  results.push({
    step: step.label,
    method: step.method,
    path: step.path,
    expectedStatuses,
    status: res.status,
    passed,
    message: res.data?.error?.message ?? res.data?.message ?? null,
  });
  return res;
}

async function bootstrap() {
  const ownerToken =
    (await login('priya.mehta1@restaurant.com', 'Owner@1234')) ??
    (await login('priya.mehta@restaurant.com', 'Owner@1234'));
  const managerToken = await login('arjun.manager@spicegarden.com', '15051988');
  const waiterToken = await login('ravi.waiter1@spicegarden.com', '20081999');
  const chefToken = await login('sanjay.chef@spicegarden.com', '10031985');
  const cashierToken = await login('sneha.cashier@spicegarden.com', '25111995');
  const customerToken = await login('rahul.sharma@gmail.com', 'Customer@123');
  const adminToken = await login('priyanshuguptaworkprofile@gmail.com', 'Priyanshu85%');

  return {
    ownerToken,
    managerToken,
    waiterToken,
    chefToken,
    cashierToken,
    customerToken,
    adminToken,
    customerId: jwtSub(customerToken ?? ''),
  };
}

function restaurantIdFromJwt(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).restaurant_id ?? null;
  } catch {
    return null;
  }
}

async function ensureTable(managerToken, branchId, suffix) {
  const tablesRes = await request('GET', `/tables/branch/${branchId}`, managerToken);
  const existing = dataArray(tablesRes.data)[0];
  if (existing?.id) return existing.id;

  const created = await request('POST', '/tables', managerToken, {
    branch_id: branchId,
    label: `G10-${suffix}`,
    capacity: 4,
    floor_number: 1,
    shape: 'square',
    zone: 'indoor',
  });
  return firstId({ data: created.data });
}

async function createMenuItem(managerToken, suffix, name, price) {
  const category = await request('POST', '/menu/categories', managerToken, {
    name: `G10 cat ${suffix}`,
    description: 'Group 10 test',
    display_order: 90,
    is_active: true,
  });
  const categoryId = firstId({ data: category.data });
  if (!categoryId) throw new Error('category failed');

  const item = await request('POST', '/menu/items', managerToken, {
    category_id: categoryId,
    name,
    description: 'G10 item',
    price,
    is_veg: true,
    status: 'available',
  });
  const itemId = firstId({ data: item.data });
  if (!itemId) throw new Error('item failed');
  return itemId;
}

async function createCustomerOrder(managerToken, branchId, tableId, menuItemIds, customerId, totalTarget = 850) {
  /** Build quantities so line total ~= totalTarget when using first item price * qty + second */
  const p1 = menuItemIds[0];
  const order = await request('POST', '/orders', managerToken, {
    table_id: tableId,
    order_type: 'dine_in',
    customer_id: customerId,
    items: [
      { menu_item_id: p1, quantity: Math.max(2, Math.ceil(totalTarget / 400)) },
      ...(menuItemIds[1]
        ? [{ menu_item_id: menuItemIds[1], quantity: 1 }]
        : []),
    ],
  });
  return firstId({ data: order.data });
}

async function completeOrderAndPay({ orderId, branchId, waiterToken, chefToken, cashierToken }) {
  const itemsRes = await request('GET', `/order-items/order/${orderId}`, waiterToken);
  const orderItems = dataArray(itemsRes.data);
  const itemIds = orderItems.map((i) => i.id).filter(Boolean);

  await request('PATCH', `/kitchen/orders/${orderId}/status`, chefToken, { status: 'preparing' });
  for (const id of itemIds) {
    await request('PATCH', `/order-items/${id}/status`, chefToken, { status: 'preparing' });
  }
  for (const id of itemIds) {
    await request('PATCH', `/order-items/${id}/status`, chefToken, { status: 'ready' });
  }
  await request('PATCH', `/kitchen/orders/${orderId}/status`, chefToken, { status: 'ready' });
  for (const id of itemIds) {
    await request('PATCH', `/order-items/${id}/serve`, waiterToken);
  }

  const init = await request('POST', '/payments/initiate', cashierToken, {
    order_id: orderId,
    payment_method: 'cash',
  });
  const pid = init.data?.data?.payment_id ?? init.data?.data?.id;
  if (!pid) return { paid: false, amount: null };
  await request('POST', '/payments/verify', cashierToken, {
    payment_id: pid,
    status: 'success',
  });

  const orderRes = await request('GET', `/orders/${orderId}`, cashierToken);
  const ord = orderRes.data?.data;
  let amount = ord?.computed_total != null ? Number(ord.computed_total) : null;
  const itemsAgain = ord?.order_items ?? [];
  if ((!amount || Number.isNaN(amount)) && Array.isArray(itemsAgain)) {
    amount = itemsAgain.reduce(
      (s, it) => s + Number(it.unit_price) * Number(it.quantity),
      0,
    );
  }
  return { paid: true, amount: amount && !Number.isNaN(amount) ? amount : null };
}

async function main() {
  const t = await bootstrap();
  const results = [];

  const missing = [];
  if (!t.customerToken || !t.customerId) missing.push('customerToken');
  if (!t.adminToken) missing.push('adminToken');
  if (!t.managerToken) missing.push('managerToken');
  if (!t.waiterToken || !t.chefToken || !t.cashierToken) missing.push('staffTokens');
  if (!t.ownerToken) missing.push('ownerToken');

  if (missing.length) {
    console.log(JSON.stringify({ ok: false, reason: 'missing_auth', missing }, null, 2));
    process.exit(1);
  }

  let restaurantId = restaurantIdFromJwt(t.ownerToken);
  const branchesRes = await request('GET', '/branches', t.ownerToken);
  const branches = dataArray(branchesRes.data);
  const branch = branches[0];
  const branchId = branch?.id;
  if (branch?.restaurant_id) restaurantId = branch.restaurant_id;

  if (!branchId || !restaurantId) {
    console.log(
      JSON.stringify({ ok: false, reason: 'no_branch_restaurant', branchesRes }, null, 2),
    );
    process.exit(1);
  }

  const suffix = `${Date.now()}`;
  const tableId = await ensureTable(t.managerToken, branchId, suffix);
  const itemA = await createMenuItem(t.managerToken, suffix, `G10 A ${suffix}`, 300);
  const itemB = await createMenuItem(t.managerToken, `${suffix}b`, `G10 B ${suffix}`, 250);

  /** Large enough subtotal so floor(amount*0.1) >= 120 (redeem tests use 100+ pts). */
  const ORDER_ID = await createCustomerOrder(
    t.managerToken,
    branchId,
    tableId,
    [itemA, itemB],
    t.customerId,
    1500,
  );
  if (!ORDER_ID) {
    console.log(JSON.stringify({ ok: false, reason: 'order_create_failed', results }, null, 2));
    process.exit(1);
  }

  const paid1 = await completeOrderAndPay({
    orderId: ORDER_ID,
    branchId,
    waiterToken: t.waiterToken,
    chefToken: t.chefToken,
    cashierToken: t.cashierToken,
  });
  const amountPaid = Math.max(1, Math.round(Number(paid1.amount) || 850));

  await runStep(results, [200], {
    label: 'STEP 1 Loyalty balance (before)',
    method: 'GET',
    token: t.customerToken,
    path: '/loyalty/balance',
  });

  await runStep(results, [200], {
    label: 'STEP 2 Loyalty earn',
    method: 'POST',
    token: t.customerToken,
    path: '/loyalty/earn',
    body: { order_id: ORDER_ID, amount_paid: amountPaid, restaurant_id: restaurantId },
  });

  await runStep(results, [200], {
    label: 'STEP 3 Loyalty balance (after earn)',
    method: 'GET',
    token: t.customerToken,
    path: '/loyalty/balance',
  });

  await runStep(results, [200], {
    label: 'STEP 4 Loyalty history',
    method: 'GET',
    token: t.customerToken,
    path: '/loyalty/history',
  });

  await runStep(results, [409], {
    label: 'STEP 5 Duplicate earn → 409',
    method: 'POST',
    token: t.customerToken,
    path: '/loyalty/earn',
    body: { order_id: ORDER_ID, amount_paid: amountPaid, restaurant_id: restaurantId },
  });

  const NEW_ORDER_ID = await createCustomerOrder(
    t.managerToken,
    branchId,
    tableId,
    [itemA, itemB],
    t.customerId,
    850,
  );

  /** Redeem BEFORE payment (discount applies to `payments` row when it exists). */
  await runStep(results, [200], {
    label: 'STEP 6 Loyalty redeem (100 pts, matches LOYALTY_MIN_REDEEM_POINTS default/server env)',
    method: 'POST',
    token: t.customerToken,
    path: '/loyalty/redeem',
    body: {
      order_id: NEW_ORDER_ID,
      points_to_redeem: 100,
      restaurant_id: restaurantId,
    },
  });

  await runStep(results, [200], {
    label: 'STEP 7 Loyalty history (earn + redeem)',
    method: 'GET',
    token: t.customerToken,
    path: '/loyalty/history',
  });

  const reviewCreate = await runStep(results, [201], {
    label: 'STEP 8 POST review',
    method: 'POST',
    token: t.customerToken,
    path: '/reviews',
    body: {
      order_id: ORDER_ID,
      restaurant_id: restaurantId,
      overall_rating: 5,
      text_review: 'Absolutely loved the Paneer Tikka!',
    },
  });

  let REVIEW_ID =
    reviewCreate.data?.data?.id ??
    reviewCreate.data?.id ??
    reviewCreate.data?.data?.data?.id ??
    null;

  const reviewList = await request('GET', `/reviews/order/${ORDER_ID}`, t.customerToken);
  if (!REVIEW_ID) REVIEW_ID = reviewList.data?.data?.id ?? reviewList.data?.id ?? null;

  await runStep(results, [200], {
    label: 'STEP 9 Review by order id',
    method: 'GET',
    token: t.customerToken,
    path: `/reviews/order/${ORDER_ID}`,
  });

  await runStep(results, [200], {
    label: 'STEP 10 Reviews by restaurant',
    method: 'GET',
    token: null,
    path: `/reviews/restaurant/${encodeURIComponent(restaurantId)}?page=1&limit=10`,
  });

  await runStep(results, [200], {
    label: 'STEP 11 Reviews by branch',
    method: 'GET',
    token: null,
    path: `/reviews/branch/${encodeURIComponent(branchId)}?page=1&limit=10`,
  });

  await runStep(results, [409], {
    label: 'STEP 12 Duplicate review → 409',
    method: 'POST',
    token: t.customerToken,
    path: '/reviews',
    body: {
      order_id: ORDER_ID,
      restaurant_id: restaurantId,
      overall_rating: 3,
      text_review: 'Duplicate',
    },
  });

  if (!REVIEW_ID) {
    const list = await request(
      'GET',
      `/reviews/restaurant/${restaurantId}?page=1&limit=10`,
      null,
    );
    const rows = Array.isArray(list.data?.data?.data) ? list.data.data.data : list.data?.data ?? [];
    REVIEW_ID = rows[0]?.id ?? null;
  }

  if (REVIEW_ID) {
    await runStep(results, [200], {
      label: 'STEP 13 Admin delete review',
      method: 'DELETE',
      token: t.adminToken,
      path: `/reviews/${REVIEW_ID}`,
    });
  } else {
    results.push({
      step: 'STEP 13 Admin delete review',
      method: 'DELETE',
      path: '(skipped)',
      expectedStatuses: [200],
      status: null,
      passed: false,
      message: 'No review id — STEP 8 failed',
    });
  }

  await runStep(results, [200, 201], {
    label: 'STEP 14 Register Android device',
    method: 'POST',
    token: t.customerToken,
    path: '/notifications/register-device',
    body: { token: 'FCM_DEVICE_TOKEN_CUSTOMER_001', platform: 'android' },
  });

  await runStep(results, [200, 201], {
    label: 'STEP 15 Register iOS device',
    method: 'POST',
    token: t.customerToken,
    path: '/notifications/register-device',
    body: { token: 'APNS_DEVICE_TOKEN_IOS_001', platform: 'ios' },
  });

  await runStep(results, [200], {
    label: 'STEP 16 List notifications',
    method: 'GET',
    token: t.customerToken,
    path: '/notifications',
  });

  const listNotifs = await request('GET', '/notifications?page=1&limit=20', t.customerToken);
  const notificationRows =
    listNotifs.data?.data?.data ??
    (Array.isArray(listNotifs.data?.data) ? listNotifs.data.data : []);

  const NOTIF_ID = notificationRows[0]?.id ?? null;

  if (NOTIF_ID) {
    await runStep(results, [200], {
      label: 'STEP 17 Mark one notification read',
      method: 'PATCH',
      token: t.customerToken,
      path: `/notifications/${NOTIF_ID}/read`,
    });
  } else {
    results.push({
      step: 'STEP 17 Mark one notification read',
      method: 'PATCH',
      path: '(skipped)',
      expectedStatuses: [200],
      status: null,
      passed: true,
      message:
        'No notifications returned — skipping single read per doc STEP 17 (nothing to mark)',
    });
  }

  await runStep(results, [200], {
    label: 'STEP 18 Read all notifications',
    method: 'PATCH',
    token: t.customerToken,
    path: '/notifications/read-all',
  });

  await runStep(results, [200], {
    label: 'STEP 19 Remove device token',
    method: 'DELETE',
    token: t.customerToken,
    path: '/notifications/device/' + encodeURIComponent('FCM_DEVICE_TOKEN_CUSTOMER_001'),
  });

  const ticketRes = await runStep(results, [201], {
    label: 'STEP 20 Support ticket',
    method: 'POST',
    token: t.customerToken,
    path: '/support/tickets',
    body: {
      subject: 'Wrong order delivered',
      description: 'Ordered paneer tikka received chicken tikka — vegetarian.',
      category: 'order',
      order_id: ORDER_ID,
      priority: 'high',
    },
  });

  const TICKET_ID = ticketRes.data?.data?.id ?? ticketRes.data?.id;

  const ticket2 = await runStep(results, [201], {
    label: 'STEP 21 Second support ticket',
    method: 'POST',
    token: t.customerToken,
    path: '/support/tickets',
    body: {
      subject: 'App not showing my booking',
      description: 'I made a booking 2 days ago but it does not appear in history.',
      category: 'other',
      priority: 'medium',
    },
  });
  const TICKET_ID_2 = ticket2.data?.data?.id ?? ticket2.data?.id;

  await runStep(results, [200], {
    label: 'STEP 22 Support tickets (customer)',
    method: 'GET',
    token: t.customerToken,
    path: '/support/tickets',
  });

  await runStep(results, [200], {
    label: 'STEP 23 Support tickets (admin)',
    method: 'GET',
    token: t.adminToken,
    path: '/support/tickets',
  });

  await runStep(results, [200], {
    label: 'STEP 24 Support ticket by id',
    method: 'GET',
    token: t.customerToken,
    path: `/support/tickets/${TICKET_ID}`,
  });

  await runStep(results, [201], {
    label: 'STEP 25 Customer message',
    method: 'POST',
    token: t.customerToken,
    path: `/support/tickets/${TICKET_ID}/messages`,
    body: { message: 'Please refund or redeliver. I have proof of the mistake.' },
  });

  await runStep(results, [201], {
    label: 'STEP 26 Admin message',
    method: 'POST',
    token: t.adminToken,
    path: `/support/tickets/${TICKET_ID}/messages`,
    body: {
      message: 'We sincerely apologize — we will process a full refund within 2–3 business days.',
    },
  });

  await runStep(results, [200], {
    label: 'STEP 27 List ticket messages',
    method: 'GET',
    token: t.customerToken,
    path: `/support/tickets/${TICKET_ID}/messages`,
  });

  await runStep(results, [200], {
    label: 'STEP 28 Admin resolve ticket',
    method: 'PATCH',
    token: t.adminToken,
    path: `/support/tickets/${TICKET_ID}/status`,
    body: { status: 'resolved' },
  });

  await runStep(results, [200], {
    label: 'STEP 29 Close second ticket',
    method: 'PATCH',
    token: t.adminToken,
    path: `/support/tickets/${TICKET_ID_2}/status`,
    body: { status: 'closed' },
  });

  await runStep(results, [422], {
    label: 'NEG Redeem insane points → 422',
    method: 'POST',
    token: t.customerToken,
    path: '/loyalty/redeem',
    body: {
      order_id: NEW_ORDER_ID,
      points_to_redeem: 99999,
      restaurant_id: restaurantId,
    },
  });

  await runStep(results, [400], {
    label: 'NEG Review rating >5 → 400',
    method: 'POST',
    token: t.customerToken,
    path: '/reviews',
    body: {
      order_id: ORDER_ID,
      restaurant_id: restaurantId,
      overall_rating: 6,
      text_review: 'Too high',
    },
  });

  await runStep(results, [403], {
    label: 'NEG Customer patch ticket status → 403',
    method: 'PATCH',
    token: t.customerToken,
    path: `/support/tickets/${TICKET_ID}/status`,
    body: { status: 'closed' },
  });

  await runStep(results, [400], {
    label: 'NEG Empty device token → 400',
    method: 'POST',
    token: t.customerToken,
    path: '/notifications/register-device',
    body: { token: '', platform: 'android' },
  });

  await runStep(results, [403], {
    label: 'NEG Earn with manager token (not customer order)',
    method: 'POST',
    token: t.managerToken,
    path: '/loyalty/earn',
    body: { order_id: ORDER_ID, amount_paid: amountPaid, restaurant_id: restaurantId },
  });

  const failed = results.filter((r) => !r.passed);

  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        base: BASE,
        ids: {
          ORDER_ID,
          NEW_ORDER_ID,
          restaurantId,
          branchId,
          REVIEW_ID,
          TICKET_ID,
          TICKET_ID_2,
        },
        summary: `${results.length - failed.length}/${results.length} passed`,
        failed,
        results,
      },
      null,
      2,
    ),
  );

  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
