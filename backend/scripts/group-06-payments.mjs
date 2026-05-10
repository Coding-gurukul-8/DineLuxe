/**
 * Group 06 automated runner - aligns with docs/Testing/06-payments.md.
 * Prerequisites: seeded accounts, backend on port 5001.
 */
const BASE = process.env.BASE ?? 'http://localhost:5001/api/v1';

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
  const { status, data } = await request('POST', '/auth/login', null, {
    emailOrUsername,
    password,
  });

  return {
    status,
    token: data?.data?.accessToken ?? null,
    data,
  };
}

async function firstSuccessfulLogin(candidates) {
  for (const [email, password] of candidates) {
    const result = await login(email, password);
    if (result.token) return result;
  }
  return { status: null, token: null, data: null };
}

function firstId(res) {
  return res?.data?.data?.id ?? res?.data?.id ?? null;
}

function dataArray(payload) {
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function jwtSub(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).sub ?? null;
  } catch {
    return null;
  }
}

async function bootstrap() {
  const owner = await firstSuccessfulLogin([
    ['priya.mehta1@restaurant.com', 'Owner@1234'],
    ['priya.mehta@restaurant.com', 'Owner@1234'],
  ]);
  const manager = await login('arjun.manager@spicegarden.com', '15051988');
  const waiter = await firstSuccessfulLogin([
    ['ravi.waiter@spicegarden.com', '20081999'],
    ['ravi.waiter1@spicegarden.com', '20081999'],
  ]);
  const chef = await login('sanjay.chef@spicegarden.com', '10031985');
  const cashier = await login('sneha.cashier@spicegarden.com', '25111995');
  const customer = await login('rahul.sharma@gmail.com', 'Customer@123');

  return {
    ownerToken: owner.token,
    managerToken: manager.token,
    waiterToken: waiter.token,
    chefToken: chef.token,
    cashierToken: cashier.token,
    customerToken: customer.token,
    customerId: jwtSub(customer.token ?? ''),
    loginDebug: {
      owner: owner.status,
      manager: manager.status,
      waiter: waiter.status,
      chef: chef.status,
      cashier: cashier.status,
      customer: customer.status,
    },
  };
}

async function ensureTable(managerToken, branchId, suffix) {
  const tablesRes = await request('GET', `/tables/branch/${branchId}`, managerToken);
  const existing = dataArray(tablesRes.data)[0];
  if (existing?.id) return existing.id;

  const created = await request('POST', '/tables', managerToken, {
    branch_id: branchId,
    label: `G06-${suffix}`,
    capacity: 4,
    floor_number: 1,
    shape: 'square',
    zone: 'indoor',
  });
  return firstId({ data: created.data });
}

async function createMenuItem(managerToken, suffix, name, price) {
  const category = await request('POST', '/menu/categories', managerToken, {
    name: `G06 cat ${suffix}`,
    description: 'Group 06 payments test',
    display_order: 60,
    is_active: true,
  });
  const categoryId = firstId({ data: category.data });
  if (!categoryId) throw new Error(`Menu category create failed: ${JSON.stringify(category)}`);

  const item = await request('POST', '/menu/items', managerToken, {
    category_id: categoryId,
    name,
    description: 'Group 06 item',
    price,
    is_veg: true,
    status: 'available',
  });
  const itemId = firstId({ data: item.data });
  if (!itemId) throw new Error(`Menu item create failed: ${JSON.stringify(item)}`);
  return itemId;
}

async function createOrder({ token, tableId, menuItems, customerId, target = 847 }) {
  const body = {
    table_id: tableId,
    order_type: 'dine_in',
    items: [
      { menu_item_id: menuItems[0], quantity: Math.max(1, Math.floor(target / 300)) },
      { menu_item_id: menuItems[1], quantity: 1 },
    ],
  };
  if (customerId) body.customer_id = customerId;

  const res = await request('POST', '/orders', token, body);
  const id = firstId({ data: res.data });
  if (!id) throw new Error(`Order create failed: ${JSON.stringify(res)}`);
  return id;
}

async function serveOrder(orderId, waiterToken, chefToken) {
  const itemsRes = await request('GET', `/order-items/order/${orderId}`, waiterToken);
  const itemIds = dataArray(itemsRes.data).map((item) => item.id).filter(Boolean);

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
    data: step.keepData ? res.data : undefined,
  });

  return res;
}

async function main() {
  const tokens = await bootstrap();
  const missing = [];
  for (const [name, value] of Object.entries(tokens)) {
    if (name.endsWith('Token') && !value) missing.push(name);
  }
  if (!tokens.customerId) missing.push('customerId');
  if (missing.length) {
    console.log(JSON.stringify({ ok: false, reason: 'missing_auth', missing, loginDebug: tokens.loginDebug }, null, 2));
    process.exit(1);
  }

  const branchesRes = await request('GET', '/branches', tokens.ownerToken);
  const branchId = dataArray(branchesRes.data)[0]?.id;
  if (!branchId) {
    console.log(JSON.stringify({ ok: false, reason: 'branch_not_found', branchesRes }, null, 2));
    process.exit(1);
  }

  const suffix = String(Date.now());
  const tableId = await ensureTable(tokens.managerToken, branchId, suffix);
  const itemA = await createMenuItem(tokens.managerToken, `${suffix}a`, `G06 Paneer ${suffix}`, 300);
  const itemB = await createMenuItem(tokens.managerToken, `${suffix}b`, `G06 Naan ${suffix}`, 247);

  const orderIds = {};
  orderIds.ORDER_ID = await createOrder({
    token: tokens.waiterToken,
    tableId,
    menuItems: [itemA, itemB],
    customerId: tokens.customerId,
    target: 847,
  });
  await serveOrder(orderIds.ORDER_ID, tokens.waiterToken, tokens.chefToken);

  orderIds.UPI_ORDER_ID = await createOrder({
    token: tokens.waiterToken,
    tableId,
    menuItems: [itemA, itemB],
    customerId: tokens.customerId,
    target: 847,
  });
  await serveOrder(orderIds.UPI_ORDER_ID, tokens.waiterToken, tokens.chefToken);

  orderIds.CARD_ORDER_ID = await createOrder({
    token: tokens.cashierToken,
    tableId,
    menuItems: [itemA, itemB],
    customerId: tokens.customerId,
    target: 847,
  });
  await serveOrder(orderIds.CARD_ORDER_ID, tokens.waiterToken, tokens.chefToken);

  orderIds.SPLIT_ORDER_ID = await createOrder({
    token: tokens.waiterToken,
    tableId,
    menuItems: [itemA, itemB],
    customerId: tokens.customerId,
    target: 847,
  });
  await serveOrder(orderIds.SPLIT_ORDER_ID, tokens.waiterToken, tokens.chefToken);

  const results = [];

  const cashInit = await runStep(results, [201], {
    label: 'STEP 1 Initiate Cash Payment',
    method: 'POST',
    token: tokens.cashierToken,
    path: '/payments/initiate',
    body: { order_id: orderIds.ORDER_ID, payment_method: 'cash' },
    keepData: true,
  });
  const PAYMENT_ID = cashInit.data?.data?.payment_id ?? cashInit.data?.data?.id;

  await runStep(results, [200], {
    label: 'STEP 2 Verify Cash Payment',
    method: 'POST',
    token: tokens.cashierToken,
    path: '/payments/verify',
    body: { payment_id: PAYMENT_ID, status: 'success' },
  });

  await runStep(results, [200], {
    label: 'STEP 3 Get Receipt',
    method: 'GET',
    token: tokens.cashierToken,
    path: `/payments/receipt/${orderIds.ORDER_ID}`,
  });

  const qr = await runStep(results, [200], {
    label: 'STEP 4 Generate UPI QR Code',
    method: 'POST',
    token: tokens.cashierToken,
    path: '/payments/upi/generate-qr',
    body: { order_id: orderIds.UPI_ORDER_ID },
    keepData: true,
  });
  const UPI_REF =
    qr.data?.data?.upiRef ??
    qr.data?.data?.upi_ref ??
    qr.data?.data?.transaction_ref ??
    qr.data?.data?.ref;

  await runStep(results, [200], {
    label: 'STEP 5 Poll UPI Payment Status',
    method: 'GET',
    token: tokens.cashierToken,
    path: `/payments/upi/status/${UPI_REF}`,
  });

  const upiInit = await runStep(results, [201], {
    label: 'STEP 6 Initiate UPI Payment',
    method: 'POST',
    token: tokens.cashierToken,
    path: '/payments/initiate',
    body: { order_id: orderIds.UPI_ORDER_ID, payment_method: 'upi' },
    keepData: true,
  });
  const UPI_PAYMENT_ID = upiInit.data?.data?.payment_id ?? upiInit.data?.data?.id;

  await runStep(results, [200], {
    label: 'STEP 7 Verify UPI Payment',
    method: 'POST',
    token: tokens.cashierToken,
    path: '/payments/verify',
    body: {
      payment_id: UPI_PAYMENT_ID,
      gateway_payment_id: 'RAZORPAY_PAY_TEST_001',
      status: 'success',
      gateway_signature: 'test_sig_abc123',
    },
  });

  const cardInit = await runStep(results, [201], {
    label: 'STEP 8 Initiate Card Payment',
    method: 'POST',
    token: tokens.cashierToken,
    path: '/payments/initiate',
    body: { order_id: orderIds.CARD_ORDER_ID, payment_method: 'card' },
    keepData: true,
  });
  const CARD_PAYMENT_ID = cardInit.data?.data?.payment_id ?? cardInit.data?.data?.id;

  await runStep(results, [200], {
    label: 'STEP 9 Verify Card Payment',
    method: 'POST',
    token: tokens.cashierToken,
    path: '/payments/verify',
    body: {
      payment_id: CARD_PAYMENT_ID,
      gateway_payment_id: 'GATEWAY_CARD_001',
      status: 'success',
    },
  });

  await runStep(results, [200], {
    label: 'STEP 10 Split Bill Between 3 People',
    method: 'POST',
    token: tokens.cashierToken,
    path: '/payments/split',
    body: {
      order_id: orderIds.SPLIT_ORDER_ID,
      splits: [
        { label: 'Person 1', amount: 300, payment_method: 'upi' },
        { label: 'Person 2', amount: 300, payment_method: 'card' },
        { label: 'Person 3', amount: 247, payment_method: 'cash' },
      ],
    },
  });

  await runStep(results, [200], {
    label: 'STEP 11 Partial UPI Amount',
    method: 'POST',
    token: tokens.cashierToken,
    path: '/payments/upi/generate-qr',
    body: { order_id: orderIds.SPLIT_ORDER_ID, amount: 300 },
  });

  await runStep(results, [200], {
    label: 'STEP 12 Simulate Gateway Webhook',
    method: 'POST',
    token: null,
    path: '/payments/webhook',
    body: {
      event: 'payment.success',
      payment_id: 'WEBHOOK_PAY_001',
      order_id: orderIds.ORDER_ID,
      status: 'success',
      amount: 850,
      gateway_signature: 'sha256_signature_here',
    },
  });

  await runStep(results, [200], {
    label: 'STEP 13 Customer Gets Their Receipt',
    method: 'GET',
    token: tokens.customerToken,
    path: `/payments/receipt/${orderIds.ORDER_ID}`,
  });

  await runStep(results, [200], {
    label: 'STEP 14 Waiter Gets Receipt',
    method: 'GET',
    token: tokens.waiterToken,
    path: `/payments/receipt/${orderIds.ORDER_ID}`,
  });

  await runStep(results, [409], {
    label: 'NEG Initiate already-paid order',
    method: 'POST',
    token: tokens.cashierToken,
    path: '/payments/initiate',
    body: { order_id: orderIds.ORDER_ID, payment_method: 'cash' },
  });

  await runStep(results, [400], {
    label: 'NEG Split with only 1 person',
    method: 'POST',
    token: tokens.cashierToken,
    path: '/payments/split',
    body: {
      order_id: orderIds.SPLIT_ORDER_ID,
      splits: [{ label: 'Solo', amount: 500, payment_method: 'cash' }],
    },
  });

  await runStep(results, [403], {
    label: 'NEG Customer initiating split bill',
    method: 'POST',
    token: tokens.customerToken,
    path: '/payments/split',
    body: {
      order_id: orderIds.SPLIT_ORDER_ID,
      splits: [
        { label: 'P1', amount: 250, payment_method: 'cash' },
        { label: 'P2', amount: 250, payment_method: 'upi' },
      ],
    },
  });

  await runStep(results, [400], {
    label: 'NEG Verify with invalid status',
    method: 'POST',
    token: tokens.cashierToken,
    path: '/payments/verify',
    body: { payment_id: PAYMENT_ID, status: 'refunded' },
  });

  await runStep(results, [401], {
    label: 'NEG No auth on receipt',
    method: 'GET',
    token: null,
    path: `/payments/receipt/${orderIds.ORDER_ID}`,
  });

  const failed = results.filter((result) => !result.passed);

  console.log(JSON.stringify({
    ok: failed.length === 0,
    base: BASE,
    ids: {
      ...orderIds,
      PAYMENT_ID,
      UPI_REF,
      UPI_PAYMENT_ID,
      CARD_PAYMENT_ID,
      branchId,
      tableId,
    },
    summary: `${results.length - failed.length}/${results.length} passed`,
    failed,
    results,
  }, null, 2));

  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
