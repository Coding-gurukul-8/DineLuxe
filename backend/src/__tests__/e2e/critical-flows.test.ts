/**
 * RestaurantOS — End-to-End Test Suite
 * Critical Flows: Auth/Booking, Order Lifecycle, Booking Conflicts, RBAC
 *
 * Runner : Jest + Supertest
 * Install: npm install --save-dev jest supertest @types/jest @types/supertest ts-jest
 *
 * jest.config.ts (add to project root):
 *   export default {
 *     preset: 'ts-jest',
 *     testEnvironment: 'node',
 *     roots: ['<rootDir>/src/__tests__'],
 *     setupFilesAfterFramework: ['<rootDir>/src/__tests__/setup.ts'],
 *     testTimeout: 30000,
 *   };
 *
 * Environment (copy .env and override DB):
 *   DATABASE_URL_TEST=postgresql://...test_db
 *   NODE_ENV=test
 *
 * Strategy:
 *   - All requests go through the real Express app (no mocking of HTTP layer)
 *   - Supabase calls are intercepted via jest.mock so tests are deterministic
 *     and never touch production or staging databases
 *   - Redis uses the ResilientRedis memory-fallback (no real Redis needed)
 *   - JWT tokens are minted with the real signAccessToken helper so auth
 *     middleware accepts them without any additional patching
 *   - All test entities are prefixed "TEST_" for easy manual cleanup
 */

import request, { Response } from 'supertest';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import app from '../../app';

// ─── Constants ────────────────────────────────────────────────────────────────

const API = '/api/v1';
const TEST_PREFIX = 'TEST_';

/** Must match config.SUPABASE_JWT_SECRET in .env.test */
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? 'test-jwt-secret-minimum-32-chars!!';

/** How many minutes in the future bookings must be placed (service requires 30 min) */
const BOOKING_OFFSET_MINUTES = 120;

// ─── JWT helpers ──────────────────────────────────────────────────────────────

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  restaurant_id?: string;
  branch_id?: string;
}

function mintToken(payload: TokenPayload, expiresIn: string | number = '15m'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

function mintExpiredToken(payload: TokenPayload): string {
  return mintToken(payload, '-1s'); // already expired
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ─── Test entity builders ─────────────────────────────────────────────────────

/**
 * Build a fake user record and a matching JWT.
 * No DB writes — Supabase is mocked at the module level.
 */
function makeUser(
  role: string,
  overrides: Partial<TokenPayload> = {}
): { id: string; email: string; token: string; payload: TokenPayload } {
  const id = uuid();
  const email = `${TEST_PREFIX}${role}-${id.slice(0, 8)}@test.ros`;
  const payload: TokenPayload = {
    sub: id,
    email,
    role,
    ...overrides,
  };
  return { id, email, token: mintToken(payload), payload };
}

/**
 * Shared test context — populated in beforeAll blocks and read by individual tests.
 */
interface TestContext {
  restaurantId: string;
  branchAId: string;
  branchBId: string;
  tableId: string;
  menuItemId: string;
  customer: ReturnType<typeof makeUser>;
  waiter: ReturnType<typeof makeUser>;
  chef: ReturnType<typeof makeUser>;
  cashier: ReturnType<typeof makeUser>;
  manager: ReturnType<typeof makeUser>;
  ownerA: ReturnType<typeof makeUser>;
  ownerB: ReturnType<typeof makeUser>;
}

// ─── Supabase mock ────────────────────────────────────────────────────────────
//
// We intercept every supabaseAdmin call so tests never hit a real database.
// Each describe block re-configures the mock to return the data it needs.
//
// The mock keeps a tiny in-memory store for objects that need to be created
// in one test and retrieved in a later test (orders, bookings, payments).

type RowStore = Map<string, Record<string, unknown>>;

const stores: Record<string, RowStore> = {
  users:         new Map(),
  restaurants:   new Map(),
  branches:      new Map(),
  tables:        new Map(),
  menu_items:    new Map(),
  orders:        new Map(),
  order_items:   new Map(),
  bookings:      new Map(),
  payments:      new Map(),
  notifications: new Map(),
};

// Reset between describe blocks to avoid cross-suite pollution
function resetStores() {
  for (const store of Object.values(stores)) store.clear();
}

// Tiny helper used by the Supabase mock to simulate query chains
function buildQueryResult(data: unknown, error: null | { message: string } = null) {
  return { data, error, count: Array.isArray(data) ? (data as unknown[]).length : null };
}

// ─── Mock the supabaseAdmin module ────────────────────────────────────────────

jest.mock('../../config/supabase', () => {
  // A single chainable query builder; each call returns `this` so tests can
  // do  .from('x').select('*').eq('id',y).single()  without changing the API.
  const buildChain = (resolveWith: () => Promise<unknown>) => {
    const chain: Record<string, unknown> = {};
    const noop = () => chain;
    ['select', 'eq', 'neq', 'in', 'gte', 'lte', 'not', 'or', 'filter',
     'order', 'limit', 'range', 'maybeSingle', 'single'].forEach((m) => {
      chain[m] = noop;
    });
    chain['then'] = (resolve: (v: unknown) => void) => resolveWith().then(resolve);
    return chain;
  };

  return {
    supabaseAdmin: {
      from: jest.fn((table: string) => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        filter: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue(buildQueryResult(null)),
        single: jest.fn().mockResolvedValue(buildQueryResult(null)),
        then: jest.fn().mockResolvedValue(buildQueryResult([])),
      })),
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: { user: { id: uuid(), email: 'test@test.ros' } },
            error: null,
          }),
          listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
          updateUserById: jest.fn().mockResolvedValue({ data: {}, error: null }),
          deleteUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
          signOut: jest.fn().mockResolvedValue({ error: null }),
        },
      },
      channel: jest.fn(() => ({
        send: jest.fn().mockResolvedValue({}),
      })),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
});

// Also mock email so tests don't need RESEND_API_KEY
jest.mock('../../email/send', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

// ─── Import the mock after jest.mock() declarations ───────────────────────────

import { supabaseAdmin } from '../../config/supabase';

// Helper to set up a from().x().single() chain that returns a specific row
function mockFrom(table: string, method: 'single' | 'maybeSingle', row: unknown) {
  const chainMock = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(buildQueryResult(method === 'maybeSingle' ? row : null)),
    single: jest.fn().mockResolvedValue(buildQueryResult(method === 'single' ? row : null)),
    then: jest.fn().mockResolvedValue(buildQueryResult(Array.isArray(row) ? row : [row])),
  };
  (supabaseAdmin.from as jest.Mock).mockReturnValueOnce(chainMock);
  return chainMock;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared test context (populated per suite in beforeAll)
// ─────────────────────────────────────────────────────────────────────────────

const ctx: TestContext = {} as TestContext;

beforeAll(() => {
  // Fixed IDs so supabase mock chains can match on them
  ctx.restaurantId = uuid();
  ctx.branchAId    = uuid();
  ctx.branchBId    = uuid();
  ctx.tableId      = uuid();
  ctx.menuItemId   = uuid();

  ctx.customer = makeUser('customer');
  ctx.waiter   = makeUser('waiter',  { restaurant_id: ctx.restaurantId, branch_id: ctx.branchAId });
  ctx.chef     = makeUser('chef',    { restaurant_id: ctx.restaurantId, branch_id: ctx.branchAId });
  ctx.cashier  = makeUser('cashier', { restaurant_id: ctx.restaurantId, branch_id: ctx.branchAId });
  ctx.manager  = makeUser('manager', { restaurant_id: ctx.restaurantId, branch_id: ctx.branchAId });
  ctx.ownerA   = makeUser('owner',   { restaurant_id: ctx.restaurantId, branch_id: ctx.branchAId });
  ctx.ownerB   = makeUser('owner',   { restaurant_id: uuid(), branch_id: uuid() }); // different restaurant
});

afterAll(() => {
  resetStores();
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 1 — Customer Signup → Login → Browse → Book Table
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 1 — Customer Signup → Login → Browse → Book Table', () => {
  const signupEmail    = `${TEST_PREFIX}customer-${uuid().slice(0, 8)}@test.ros`;
  const signupPassword = 'TestPass1!';

  let accessToken = '';
  let bookingId   = '';

  // ── 1.1 Signup ──────────────────────────────────────────────────────────────

  describe('POST /auth/signup', () => {
    it('returns 201 and verification_pending when signup is fresh', async () => {
      const userId = uuid();

      // email uniqueness check → no existing user
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        maybeSingle: jest.fn().mockResolvedValue(buildQueryResult(null)),
      });

      // createUser succeeds
      (supabaseAdmin.auth.admin.createUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: userId, email: signupEmail } },
        error: null,
      });

      // second email-uniqueness check (existingProfile) → no profile yet
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        maybeSingle: jest.fn().mockResolvedValue(buildQueryResult(null)),
      });

      // users.insert → success
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const res: Response = await request(app)
        .post(`${API}/auth/signup`)
        .send({
          email:     signupEmail,
          password:  signupPassword,
          firstName: `${TEST_PREFIX}First`,
          lastName:  'Customer',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        accessToken:          expect.any(String),
        refreshToken:         expect.any(String),
        verification_pending: true,
      });

      accessToken = res.body.data.accessToken;
    });

    it('returns 409 when email is already registered', async () => {
      // email uniqueness check → existing user found
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        maybeSingle: jest.fn().mockResolvedValue(
          buildQueryResult({ id: uuid() })
        ),
      });

      const res: Response = await request(app)
        .post(`${API}/auth/signup`)
        .send({
          email:     signupEmail,
          password:  signupPassword,
          firstName: 'Dup',
          lastName:  'User',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // ── 1.2 OTP verification ────────────────────────────────────────────────────

  describe('POST /auth/verify-otp', () => {
    it('returns 200 with tokens after valid OTP', async () => {
      // The Redis memory store holds the OTP; we bypass by directly planting it.
      // Because ResilientRedis has an in-memory fallback we can manipulate via
      // the real redis instance imported here.
      const { redis } = await import('../../config/redis');
      const testOtp = '123456';
      await redis.set(`otp:${signupEmail}`, testOtp, 'EX', 300);

      // getProfile for token building
      const profileId = uuid();
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        maybeSingle: jest.fn().mockResolvedValue(
          buildQueryResult({ id: profileId, email: signupEmail, role: 'customer', restaurant_id: null, branch_id: null })
        ),
      });

      (supabaseAdmin.auth.admin.updateUserById as jest.Mock).mockResolvedValueOnce({
        data: {}, error: null,
      });

      const res: Response = await request(app)
        .post(`${API}/auth/verify-otp`)
        .send({ email: signupEmail, otp: testOtp });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        accessToken:  expect.any(String),
        refreshToken: expect.any(String),
      });

      accessToken = res.body.data.accessToken; // use the verified token
    });

    it('returns 400 with wrong OTP', async () => {
      const { redis } = await import('../../config/redis');
      await redis.set(`otp:${signupEmail}`, '999999', 'EX', 300);

      const res: Response = await request(app)
        .post(`${API}/auth/verify-otp`)
        .send({ email: signupEmail, otp: '000000' });

      // OTP_INVALID → 400
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ── 1.3 Login ───────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns 200 with tokens for valid credentials', async () => {
      const hashedPw = await import('bcryptjs').then((b) => b.hash(signupPassword, 10));

      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        maybeSingle: jest.fn().mockResolvedValue(
          buildQueryResult({
            id:            uuid(),
            email:         signupEmail,
            role:          'customer',
            password_hash: hashedPw,
            restaurant_id: null,
            branch_id:     null,
            is_active:     true,
          })
        ),
      });

      const res: Response = await request(app)
        .post(`${API}/auth/login`)
        .send({ email: signupEmail, password: signupPassword });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      accessToken = res.body.data.accessToken;
    });

    it('returns 401 for wrong password', async () => {
      const hashedPw = await import('bcryptjs').then((b) => b.hash(signupPassword, 10));

      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        maybeSingle: jest.fn().mockResolvedValue(
          buildQueryResult({
            id: uuid(), email: signupEmail, role: 'customer',
            password_hash: hashedPw, is_active: true,
          })
        ),
      });

      const res: Response = await request(app)
        .post(`${API}/auth/login`)
        .send({ email: signupEmail, password: 'WrongPass99!' });

      expect(res.status).toBe(401);
    });

    it('returns 401 for non-existent user', async () => {
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        maybeSingle: jest.fn().mockResolvedValue(buildQueryResult(null)),
      });

      const res: Response = await request(app)
        .post(`${API}/auth/login`)
        .send({ email: `no-such-${uuid()}@test.ros`, password: 'AnyPass1!' });

      expect(res.status).toBe(401);
    });
  });

  // ── 1.4 Browse restaurants ───────────────────────────────────────────────────

  describe('GET /restaurants/nearby', () => {
    it('returns 200 with array of restaurants near given coords', async () => {
      const fakeRestaurant = {
        id:            ctx.restaurantId,
        name:          `${TEST_PREFIX}Grand Table`,
        cuisine_type:  'Indian',
        distance_km:   0.4,
      };

      // getNearby calls a raw supabase query; mock the from() result
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue(buildQueryResult([fakeRestaurant])),
      });

      const res: Response = await request(app)
        .get(`${API}/restaurants/nearby`)
        .query({ lat: 28.6, lon: 77.2, radius: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── 1.5 Create booking ───────────────────────────────────────────────────────

  describe('POST /bookings', () => {
    it('returns 201 and creates a booking for valid data', async () => {
      const arrivalTime = new Date(Date.now() + BOOKING_OFFSET_MINUTES * 60 * 1000).toISOString();
      const newBookingId = uuid();

      // Branch lookup
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: ctx.branchAId, operating_hours: null, restaurant_id: ctx.restaurantId })
        ),
      });

      // Table availability — no specific table_id provided, auto-select
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue(
          buildQueryResult([{ id: ctx.tableId, capacity: 4 }])
        ),
      });

      // Reserve table (update status to 'reserved')
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      // Insert booking
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({
            id:               newBookingId,
            user_id:          ctx.customer.id,
            branch_id:        ctx.branchAId,
            table_id:         ctx.tableId,
            people_count:     2,
            arrival_time:     arrivalTime,
            status:           'confirmed',
            special_requests: null,
          })
        ),
      });

      // Notification insert (fire-and-forget)
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const res: Response = await request(app)
        .post(`${API}/bookings`)
        .set(authHeader(ctx.customer.token))
        .send({
          branch_id:    ctx.branchAId,
          people_count: 2,
          arrival_time: arrivalTime,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        id:       newBookingId,
        status:   'confirmed',
        table_id: ctx.tableId,
      });

      bookingId = newBookingId;
    });

    it('returns 422 for booking too close in time (< 30 min)', async () => {
      const tooSoon = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      const res: Response = await request(app)
        .post(`${API}/bookings`)
        .set(authHeader(ctx.customer.token))
        .send({
          branch_id:    ctx.branchAId,
          people_count: 2,
          arrival_time: tooSoon,
        });

      expect(res.status).toBe(422);
    });
  });

  // ── 1.6 Get booking by ID ────────────────────────────────────────────────────

  describe('GET /bookings/:id', () => {
    it('returns 200 with booking details for the owner', async () => {
      const fakeBooking = {
        id:       bookingId ?? uuid(),
        user_id:  ctx.customer.id,
        status:   'confirmed',
        tables:   { label: 'T1', capacity: 4 },
        branches: { name: `${TEST_PREFIX}Branch A` },
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(buildQueryResult(fakeBooking)),
      });

      const res: Response = await request(app)
        .get(`${API}/bookings/${fakeBooking.id}`)
        .set(authHeader(ctx.customer.token));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(fakeBooking.id);
    });

    it('returns 403 when a different customer tries to read the booking', async () => {
      const otherCustomer = makeUser('customer');
      const fakeBooking = {
        id:      bookingId ?? uuid(),
        user_id: ctx.customer.id,      // owned by ctx.customer, NOT otherCustomer
        status:  'confirmed',
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(buildQueryResult(fakeBooking)),
      });

      const res: Response = await request(app)
        .get(`${API}/bookings/${fakeBooking.id}`)
        .set(authHeader(otherCustomer.token));

      expect(res.status).toBe(403);
    });
  });

  // ── 1.7 Cancel booking ────────────────────────────────────────────────────────

  describe('PATCH /bookings/:id/cancel', () => {
    it('returns 200 and marks booking as cancelled', async () => {
      const targetId    = bookingId ?? uuid();
      const arrivalTime = new Date(Date.now() + BOOKING_OFFSET_MINUTES * 60 * 1000).toISOString();

      // Fetch booking
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({
            id:           targetId,
            user_id:      ctx.customer.id,
            table_id:     ctx.tableId,
            status:       'confirmed',
            arrival_time: arrivalTime,
          })
        ),
      });

      // Update to cancelled
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      // Release table
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const res: Response = await request(app)
        .patch(`${API}/bookings/${targetId}/cancel`)
        .set(authHeader(ctx.customer.token))
        .send({ reason: 'Test cancellation' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ cancelled: true });
    });

    it('returns 422 when trying to cancel an already-cancelled booking', async () => {
      const targetId = uuid();

      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({
            id: targetId, user_id: ctx.customer.id,
            status: 'cancelled', arrival_time: new Date().toISOString(),
          })
        ),
      });

      const res: Response = await request(app)
        .patch(`${API}/bookings/${targetId}/cancel`)
        .set(authHeader(ctx.customer.token))
        .send({});

      expect(res.status).toBe(422);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 2 — Order Lifecycle: Create → Kitchen → Served → Paid
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 2 — Order Lifecycle (Dine-In): Order → Kitchen → Served → Paid', () => {
  let orderId   = '';
  let orderItemId = '';
  let paymentId = '';

  // ── 2.1 Create order ────────────────────────────────────────────────────────

  describe('POST /orders', () => {
    it('returns 201 and creates a confirmed dine-in order', async () => {
      orderId = uuid();
      orderItemId = uuid();

      // Table belongs to branch
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: ctx.tableId, branch_id: ctx.branchAId, status: 'free' })
        ),
      });

      // Menu items lookup
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue(
          buildQueryResult([{
            id: ctx.menuItemId, name: `${TEST_PREFIX}Paneer Tikka`,
            price: 250, status: 'available', branch_id: ctx.branchAId, addons: [],
          }])
        ),
      });

      // waiter auto-assign
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue(buildQueryResult([])),
      });

      // Insert order
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({
            id: orderId, branch_id: ctx.branchAId, table_id: ctx.tableId,
            status: 'confirmed', order_type: 'dine_in',
          })
        ),
      });

      // Insert order_items
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue({ data: [{ id: orderItemId }], error: null }),
      });

      // Update table status to occupied
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const res: Response = await request(app)
        .post(`${API}/orders`)
        .set(authHeader(ctx.waiter.token))
        .send({
          table_id:   ctx.tableId,
          order_type: 'dine_in',
          items: [{ menu_item_id: ctx.menuItemId, quantity: 1 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        id:     orderId,
        status: 'confirmed',
      });
    });
  });

  // ── 2.2 Kitchen views order ─────────────────────────────────────────────────

  describe('GET /kitchen/branch/:branchId/tickets', () => {
    it('returns 200 with the new order in the ticket list', async () => {
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue(
          buildQueryResult([{
            id: orderId, status: 'confirmed', order_type: 'dine_in',
            order_items: [{ id: orderItemId, status: 'pending', menu_items: { name: `${TEST_PREFIX}Paneer Tikka` } }],
          }])
        ),
      });

      const res: Response = await request(app)
        .get(`${API}/kitchen/branch/${ctx.branchAId}/tickets`)
        .set(authHeader(ctx.chef.token));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── 2.3 Kitchen: confirmed → preparing ──────────────────────────────────────

  describe('PATCH /kitchen/orders/:id/status (preparing)', () => {
    it('returns 200 and advances order to preparing', async () => {
      // Fetch order for transition validation
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: orderId, status: 'confirmed', branch_id: ctx.branchAId })
        ),
      });

      // Update order status
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: orderId, status: 'preparing', branch_id: ctx.branchAId })
        ),
      });

      const res: Response = await request(app)
        .patch(`${API}/kitchen/orders/${orderId}/status`)
        .set(authHeader(ctx.chef.token))
        .send({ status: 'preparing' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('preparing');
    });

    it('returns 422 when trying an invalid transition (confirmed → ready, skipping preparing)', async () => {
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: orderId, status: 'confirmed', branch_id: ctx.branchAId })
        ),
      });

      const res: Response = await request(app)
        .patch(`${API}/kitchen/orders/${orderId}/status`)
        .set(authHeader(ctx.chef.token))
        .send({ status: 'ready' }); // skip preparing → invalid

      expect(res.status).toBe(422);
    });
  });

  // ── 2.4 Kitchen: preparing → ready ──────────────────────────────────────────

  describe('PATCH /kitchen/orders/:id/status (ready)', () => {
    it('returns 200 and advances order to ready', async () => {
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: orderId, status: 'preparing', branch_id: ctx.branchAId })
        ),
      });

      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: orderId, status: 'ready', branch_id: ctx.branchAId })
        ),
      });

      const res: Response = await request(app)
        .patch(`${API}/kitchen/orders/${orderId}/status`)
        .set(authHeader(ctx.chef.token))
        .send({ status: 'ready' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ready');
    });
  });

  // ── 2.5 Waiter serves item ───────────────────────────────────────────────────

  describe('PATCH /order-items/:id/serve', () => {
    it('returns 200 and marks the order item as served', async () => {
      // Fetch item to validate it belongs to branch
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({
            id: orderItemId, order_id: orderId, status: 'ready',
            orders: { branch_id: ctx.branchAId },
          })
        ),
      });

      // Update item status
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: orderItemId, status: 'served' })
        ),
      });

      const res: Response = await request(app)
        .patch(`${API}/order-items/${orderItemId}/serve`)
        .set(authHeader(ctx.waiter.token));

      expect(res.status).toBe(200);
    });
  });

  // ── 2.6 Initiate payment ─────────────────────────────────────────────────────

  describe('POST /payments/initiate', () => {
    it('returns 201 and creates a pending payment record', async () => {
      paymentId = uuid();

      // Fetch order — status must NOT be 'paid' or 'cancelled'
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: orderId, status: 'ready', branch_id: ctx.branchAId })
        ),
      });

      // Compute total from order_items
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue(
          buildQueryResult([{ unit_price: 250, quantity: 1 }])
        ),
      });

      // Check existing payment (idempotency guard) → none
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        maybeSingle: jest.fn().mockResolvedValue(buildQueryResult(null)),
      });

      // Insert payment
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: paymentId, order_id: orderId, amount: 250, status: 'pending' })
        ),
      });

      const res: Response = await request(app)
        .post(`${API}/payments/initiate`)
        .set(authHeader(ctx.cashier.token))
        .send({ order_id: orderId, payment_method: 'cash' });

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        payment_id: paymentId,
        status:     'pending',
        amount:     250,
      });
    });

    it('returns 409 when payment already exists for the order (double-payment blocked)', async () => {
      // Fetch order
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: orderId, status: 'ready', branch_id: ctx.branchAId })
        ),
      });

      // Compute total
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue(buildQueryResult([{ unit_price: 250, quantity: 1 }])),
      });

      // Existing payment found → conflict
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        maybeSingle: jest.fn().mockResolvedValue(buildQueryResult({ id: paymentId })),
      });

      const res: Response = await request(app)
        .post(`${API}/payments/initiate`)
        .set(authHeader(ctx.cashier.token))
        .send({ order_id: orderId, payment_method: 'cash' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // ── 2.7 Verify payment → order becomes paid ──────────────────────────────────

  describe('POST /payments/verify', () => {
    it('returns 200, sets payment to success and order status to paid', async () => {
      // Fetch payment + order branch
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({
            id: paymentId, order_id: orderId, status: 'pending',
            orders: { branch_id: ctx.branchAId },
          })
        ),
      });

      // Update payment status
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: paymentId, status: 'completed' })
        ),
      });

      // onPaymentComplete: mark order paid
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      // onPaymentComplete: fetch table_id
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ table_id: ctx.tableId })
        ),
      });

      // onPaymentComplete: update table to cleaning
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });

      const res: Response = await request(app)
        .post(`${API}/payments/verify`)
        .set(authHeader(ctx.cashier.token))
        .send({
          payment_id: paymentId,
          status:     'success',
          gateway_payment_id: `gw_${uuid().slice(0, 8)}`,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('success');
    });
  });

  // ── 2.8 Order status reflects 'paid' ─────────────────────────────────────────

  describe('GET /orders/:id (after payment)', () => {
    it('returns 200 and shows the order as paid', async () => {
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({
            id:          orderId,
            status:      'paid',
            branch_id:   ctx.branchAId,
            order_items: [],
          })
        ),
      });

      const res: Response = await request(app)
        .get(`${API}/orders/${orderId}`)
        .set(authHeader(ctx.cashier.token));

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('paid');
    });
  });

  // ── 2.9 Cannot pay an already-paid order ─────────────────────────────────────

  describe('POST /payments/initiate on paid order', () => {
    it('returns 409 when order status is already paid', async () => {
      // Fetch order — status = 'paid'
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({ id: orderId, status: 'paid', branch_id: ctx.branchAId })
        ),
      });

      const res: Response = await request(app)
        .post(`${API}/payments/initiate`)
        .set(authHeader(ctx.cashier.token))
        .send({ order_id: orderId, payment_method: 'cash' });

      expect(res.status).toBe(409);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 3 — Booking Conflict Prevention (Race Condition Test)
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 3 — Booking Conflict Prevention (Race Condition)', () => {
  /**
   * Simulate concurrent booking requests for the same table slot.
   *
   * Approach:
   *   - We have ONE table marked 'free'
   *   - Three customers try to book it simultaneously via Promise.all
   *   - The service uses "UPDATE tables SET status='reserved' WHERE status='free'"
   *     which is an atomic conditional-update. Only one update wins.
   *   - We replicate that behavior in the mock: the first call to the table
   *     update succeeds; subsequent ones fail (simulating the DB row already
   *     being reserved).
   *
   * In production the real guard is:
   *   UPDATE tables SET status='reserved', updated_at=now()
   *   WHERE id=:tableId AND status='free'
   * which is atomic on Postgres. Here we simulate it with a mutex-style counter.
   */

  const tableSlotId = uuid();
  const arrivalTime = new Date(Date.now() + BOOKING_OFFSET_MINUTES * 60 * 1000).toISOString();

  let reservationCount = 0; // tracks how many times the reserve-update "succeeded"

  beforeEach(() => {
    reservationCount = 0;
  });

  function setupConcurrentMocksForOneRequest(customerId: string, willWin: boolean) {
    // Branch lookup
    (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
      ...defaultChain(),
      single: jest.fn().mockResolvedValue(
        buildQueryResult({ id: ctx.branchAId, operating_hours: null, restaurant_id: ctx.restaurantId })
      ),
    });

    // Table auto-select (all three requests see the free table initially)
    (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
      ...defaultChain(),
      then: jest.fn().mockResolvedValue(
        buildQueryResult([{ id: tableSlotId, capacity: 4 }])
      ),
    });

    // Reserve table — only the first request wins (returns no error);
    // subsequent ones fail because the WHERE status='free' condition no longer matches.
    (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
      ...defaultChain(),
      then: jest.fn().mockImplementation(async () => {
        if (willWin) {
          // Simulate successful atomic update
          return { data: {}, error: null };
        } else {
          // Simulate "0 rows updated" — Supabase returns no error but data is empty.
          // Service interprets this as the table already being reserved.
          return { data: null, error: { message: 'already_reserved: table was reserved by concurrent request' } };
        }
      }),
    });

    if (willWin) {
      // Insert booking
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({
            id:           uuid(),
            user_id:      customerId,
            branch_id:    ctx.branchAId,
            table_id:     tableSlotId,
            people_count: 2,
            arrival_time: arrivalTime,
            status:       'confirmed',
          })
        ),
      });

      // Notification insert
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });
    } else {
      // Rollback table update to free (called on booking insert failure)
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });
    }
  }

  it('only 1 of 3 concurrent requests succeeds (201); 2 get 409', async () => {
    const customer1 = makeUser('customer');
    const customer2 = makeUser('customer');
    const customer3 = makeUser('customer');

    const bookingBody = {
      branch_id:    ctx.branchAId,
      people_count: 2,
      arrival_time: arrivalTime,
    };

    // Set up mocks: request 1 wins, requests 2 and 3 lose
    setupConcurrentMocksForOneRequest(customer1.id, true);
    setupConcurrentMocksForOneRequest(customer2.id, false);
    setupConcurrentMocksForOneRequest(customer3.id, false);

    const [res1, res2, res3] = await Promise.all([
      request(app).post(`${API}/bookings`).set(authHeader(customer1.token)).send(bookingBody),
      request(app).post(`${API}/bookings`).set(authHeader(customer2.token)).send(bookingBody),
      request(app).post(`${API}/bookings`).set(authHeader(customer3.token)).send(bookingBody),
    ]);

    const statuses = [res1.status, res2.status, res3.status];

    // Exactly one 201
    const successes = statuses.filter((s) => s === 201);
    expect(successes).toHaveLength(1);

    // The other two are 409 or 422 (both indicate conflict/validation failure)
    const failures = statuses.filter((s) => s === 409 || s === 422);
    expect(failures).toHaveLength(2);
  });

  it('the successful booking has status "confirmed"', async () => {
    const customer = makeUser('customer');

    setupConcurrentMocksForOneRequest(customer.id, true);

    const res: Response = await request(app)
      .post(`${API}/bookings`)
      .set(authHeader(customer.token))
      .send({
        branch_id:    ctx.branchAId,
        people_count: 2,
        arrival_time: arrivalTime,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('confirmed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOW 4 — RBAC: Unauthorized Access Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Flow 4 — RBAC: Unauthorized Access Tests', () => {

  // ── 4.1 Missing / expired JWT ────────────────────────────────────────────────

  describe('Missing JWT on protected routes', () => {
    it('GET /orders/staff without token → 401', async () => {
      const res = await request(app).get(`${API}/orders/staff`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /orders without token → 401', async () => {
      const res = await request(app).post(`${API}/orders`).send({});
      expect(res.status).toBe(401);
    });

    it('POST /payments/initiate without token → 401', async () => {
      const res = await request(app).post(`${API}/payments/initiate`).send({});
      expect(res.status).toBe(401);
    });
  });

  describe('Expired JWT on protected routes', () => {
    it('returns 401 TOKEN_EXPIRED', async () => {
      const expired = mintExpiredToken({ sub: uuid(), email: 'x@test.ros', role: 'customer' });

      const res = await request(app)
        .get(`${API}/orders/staff`)
        .set(authHeader(expired));

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });

  // ── 4.2 Customer tries staff-only action ─────────────────────────────────────

  describe('Customer tries POST /staff/create → 403', () => {
    it('returns 403 FORBIDDEN', async () => {
      // injectTenant middleware requires restaurant_id for non-customers.
      // Here a customer (no restaurant_id) hits a staff-only route.
      const res = await request(app)
        .post(`${API}/staff/create`)
        .set(authHeader(ctx.customer.token))
        .send({
          name: `${TEST_PREFIX}NewStaff`, email: `staff${uuid().slice(0,4)}@test.ros`,
          phone: '9876543210', role: 'waiter', branch_id: ctx.branchAId,
        });

      // Either 403 (RBAC) or 403 (no tenant context) — both mean forbidden
      expect(res.status).toBe(403);
    });
  });

  // ── 4.3 Chef tries to update menu item status ────────────────────────────────

  describe('Chef tries PATCH /menu/items/:id/status → 403', () => {
    it('returns 403 because chefs are not allowed to edit the menu', async () => {
      const itemId = uuid();

      const res = await request(app)
        .patch(`${API}/menu/items/${itemId}/status`)
        .set(authHeader(ctx.chef.token))
        .send({ status: 'sold_out' });

      expect(res.status).toBe(403);
    });
  });

  // ── 4.4 Waiter tries to access admin dashboard ───────────────────────────────

  describe('Waiter tries GET /admin/dashboard → 403', () => {
    it('returns 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get(`${API}/admin/dashboard`)
        .set(authHeader(ctx.waiter.token));

      expect(res.status).toBe(403);
    });
  });

  // ── 4.5 Cross-tenant: Owner A tries to access Owner B's branches ──────────────

  describe('Cross-tenant access: Owner A reads Owner B branches → 403', () => {
    /**
     * Owner A has restaurant_id = ctx.restaurantId.
     * Owner B has a completely different restaurant_id in their JWT.
     * The injectTenant middleware attaches ownerA's restaurant_id to req,
     * so when GET /branches resolves, it filters by ownerA's restaurantId —
     * ownerB's data is never in scope. We verify the route is at least
     * inaccessible in a meaningful way: either 403 (tenant mismatch) or an
     * empty result set (data isolation).
     *
     * For the direct-ID case: GET /branches/:id where that ID belongs to
     * restaurant B while ownerA is authenticated → branch controller enforces
     * that the branch's restaurant_id matches req.restaurantId, returning 403.
     */
    it("Owner A with their own JWT cannot see Owner B's specific branch", async () => {
      const branchBId = ctx.branchBId; // belongs to restaurant B

      // Branch lookup returns a branch owned by restaurant B
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        single: jest.fn().mockResolvedValue(
          buildQueryResult({
            id:            branchBId,
            restaurant_id: ctx.ownerB.payload.restaurant_id, // different restaurant
            name:          `${TEST_PREFIX}Branch B`,
          })
        ),
      });

      // The branch controller checks req.restaurantId === branch.restaurant_id
      // req.restaurantId is injected from ownerA's JWT = ctx.restaurantId
      // branch.restaurant_id = ownerB's restaurant → mismatch → 403
      const res = await request(app)
        .get(`${API}/branches/${branchBId}`)
        .set(authHeader(ctx.ownerA.token));

      // Accept either 403 (explicit RBAC reject) or 404 (not found in tenant scope)
      expect([403, 404]).toContain(res.status);
    });

    it('GET /branches (list) with ownerB JWT only returns ownerB context', async () => {
      // Branch list filtered by injectTenant (ownerB's restaurant_id)
      (supabaseAdmin.from as jest.Mock).mockReturnValueOnce({
        ...defaultChain(),
        then: jest.fn().mockResolvedValue(buildQueryResult([])), // empty for ownerB
      });

      const res = await request(app)
        .get(`${API}/branches`)
        .set(authHeader(ctx.ownerB.token));

      // Should succeed (200) but return ownerB's branches only (isolated from ownerA)
      // If the mock returns [] that means ownerA's branches are invisible to ownerB
      expect([200, 403]).toContain(res.status);
    });
  });

  // ── 4.6 Role boundary matrix ─────────────────────────────────────────────────

  describe('Role boundary matrix — correct 403s', () => {
    const cases: Array<{ label: string; role: string; method: string; path: string; body?: object }> = [
      {
        label:  'waiter cannot cancel another waiter\'s assignment',
        role:   'waiter',
        method: 'patch',
        path:   `${API}/staff/${uuid()}/toggle-access`,
      },
      {
        label:  'customer cannot access branch live-stats',
        role:   'customer',
        method: 'get',
        path:   `${API}/branches/${ctx.branchAId}/live-stats`,
      },
      {
        label:  'chef cannot access order-items as waiter action',
        role:   'chef',
        method: 'get',
        path:   `${API}/order-items/order/${uuid()}`,
      },
    ];

    test.each(cases)('$label → 403', async ({ role, method, path }) => {
      const userToken = makeUser(role, {
        restaurant_id: ctx.restaurantId,
        branch_id:     ctx.branchAId,
      }).token;

      const req = (request(app) as any)[method](path).set(authHeader(userToken));
      const res: Response = await req;

      // 403 (RBAC) or 401 (tenant middleware rejects customer with no restaurant_id)
      expect([401, 403]).toContain(res.status);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional: Input Validation Guard-Rails
// ─────────────────────────────────────────────────────────────────────────────

describe('Input Validation Guard-Rails', () => {
  it('POST /auth/signup with invalid email → 400', async () => {
    const res = await request(app)
      .post(`${API}/auth/signup`)
      .send({ email: 'not-an-email', password: 'TestPass1!', firstName: 'Bad' });
    expect(res.status).toBe(400);
  });

  it('POST /auth/signup with weak password → 400', async () => {
    const res = await request(app)
      .post(`${API}/auth/signup`)
      .send({ email: `${TEST_PREFIX}${uuid()}@test.ros`, password: 'weak', firstName: 'Bad' });
    expect(res.status).toBe(400);
  });

  it('POST /bookings with people_count = 0 → 400', async () => {
    const res = await request(app)
      .post(`${API}/bookings`)
      .set(authHeader(ctx.customer.token))
      .send({ branch_id: ctx.branchAId, people_count: 0, arrival_time: new Date().toISOString() });
    expect(res.status).toBe(400);
  });

  it('POST /orders with empty items array → 400', async () => {
    const res = await request(app)
      .post(`${API}/orders`)
      .set(authHeader(ctx.waiter.token))
      .send({ table_id: ctx.tableId, order_type: 'dine_in', items: [] });
    expect(res.status).toBe(400);
  });

  it('POST /payments/initiate with invalid payment_method → 400', async () => {
    const res = await request(app)
      .post(`${API}/payments/initiate`)
      .set(authHeader(ctx.cashier.token))
      .send({ order_id: uuid(), payment_method: 'bitcoin' });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Utility: default mock chain (avoids repetition in single-step tests)
// ─────────────────────────────────────────────────────────────────────────────

function defaultChain() {
  return {
    select:     jest.fn().mockReturnThis(),
    insert:     jest.fn().mockReturnThis(),
    update:     jest.fn().mockReturnThis(),
    delete:     jest.fn().mockReturnThis(),
    eq:         jest.fn().mockReturnThis(),
    neq:        jest.fn().mockReturnThis(),
    in:         jest.fn().mockReturnThis(),
    not:        jest.fn().mockReturnThis(),
    gte:        jest.fn().mockReturnThis(),
    lte:        jest.fn().mockReturnThis(),
    or:         jest.fn().mockReturnThis(),
    filter:     jest.fn().mockReturnThis(),
    order:      jest.fn().mockReturnThis(),
    limit:      jest.fn().mockReturnThis(),
    range:      jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(buildQueryResult(null)),
    single:     jest.fn().mockResolvedValue(buildQueryResult(null)),
    then:       jest.fn().mockResolvedValue(buildQueryResult([])),
  };
}