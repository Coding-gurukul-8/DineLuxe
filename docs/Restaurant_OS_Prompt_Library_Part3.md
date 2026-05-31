# 🍽️ Restaurant OS — Prompt Library PART 3
## Final Deep Analysis — All Remaining Gaps Closed
**Priyanshu Kumar Gupta & Ronit Gupta | Version 2.0 — 2025**

---

## 🔬 PART 3 — FINAL GAP ANALYSIS FINDINGS

This is the **exhaustive final pass** — scanning every individual file, every API call, every component import, and every backend route to find the last remaining gaps that Parts 1 & 2 didn't cover.

---

## 📋 PART 3 GAP ANALYSIS SUMMARY

### 🚨 CONFIRMED MISSING: Backend Endpoints Called by Frontend

| Frontend Call | Current Backend Status | Fix |
|---|---|---|
| `POST /orders/:orderId/apply-coupon` | ❌ Route does NOT exist in orders.routes.ts | Prompt P3-1 |
| `GET /tables/branch/:branchId` | ✅ Exists (confirmed) | — |
| `GET /orders/table/:tableId` | Need to verify | Prompt P3-1 |
| `GET /delivery/partner/stats` | ❌ Route does NOT exist | Prompt P3-2 |
| `GET /loyalty/leaderboard` | ❌ Route does NOT exist | Prompt P3-3 |
| `PATCH /loyalty/settings` | ❌ Route does NOT exist | Prompt P3-3 |
| `POST /loyalty/admin/adjust` | ❌ Route does NOT exist | Prompt P3-3 |

### ❌ CONFIRMED MISSING: Frontend Pages

| Page | Importance | Prompt |
|---|---|---|
| `app/customer/profile/bookings/page.tsx` | HIGH — users expect to see booking history | P3-4 |
| `app/customer/profile/orders/page.tsx` | HIGH — users expect order history in profile | P3-4 |
| `app/staff/waiter/dashboard/page.tsx` | HIGH — waiter role needs a dashboard | P3-5 |
| `app/staff/cashier/dashboard/page.tsx` | HIGH — cashier role needs a dashboard | P3-5 |
| `app/staff/host/dashboard/page.tsx` | MEDIUM — host landing | P3-5 |
| `app/delivery/active/page.tsx` | MEDIUM — active delivery detail view | P3-6 |

### ⚠️ CONFIRMED INCOMPLETE: Critical Existing Files

| File | Issue | Prompt |
|---|---|---|
| `components/payment/PaymentModal.tsx` | Calls `/orders/:id/apply-coupon` — backend route missing | P3-1 |
| `app/staff/dasboard/page.tsx` *(typo!)* | Exists as a 146-byte file with a typo in path | P3-5 |
| `app/auth/signup/step-2/page.tsx` | 150 bytes — just renders `<SignupWizard initialStep={1}>` — is this correct? | Verify only |
| `lib/constants.ts` | PAYMENT_METHODS used in PaymentModal — verify it has correct values | P3-1 |

### 🔍 DEEP CODE REVIEW FINDINGS

1. **PaymentModal split payment** — calls `POST /payments/split` with a `splits` array. Backend `splitSchema` needs to match this exact shape.
2. **Delivery partner `is_online` toggle** — no frontend toggle exists. Partners can't go online/offline. Prompt P3-6 covers this.
3. **`GET /orders/branch/:branchId/active`** — called by cashier page. Verify this route exists and returns correct shape.
4. **Table-test page** (`app/table-test/page.tsx`) — 494 bytes, likely a dev test page that should NOT exist in production. Prompt P3-7 covers cleanup.
5. **`app/staff/dasboard/page.tsx`** (typo: "dasboard") — should redirect to correct `dashboard`. Prompt P3-5 fixes this.

---

## 📁 PART 3 — NEW FILES TO CREATE

```
backend/src/modules/
├── ✏️ orders/orders.routes.ts        (add apply-coupon endpoint — P3-1)
├── ✏️ orders/orders.service.ts       (add applyCoupon + getOrderByTable — P3-1)
├── ✏️ delivery/delivery.routes.ts    (add partner/stats — P3-2)
├── ✏️ delivery/delivery.service.ts   (add getPartnerStats — P3-2)
├── ✏️ loyalty/loyalty.routes.ts      (add leaderboard, settings, admin/adjust — P3-3)
└── ✏️ loyalty/loyalty.service.ts     (add 3 new functions — P3-3)

frontend/
├── app/customer/profile/
│   ├── 🆕 bookings/page.tsx          (P3-4)
│   └── 🆕 orders/page.tsx            (P3-4)
├── app/staff/
│   ├── 🆕 waiter/dashboard/page.tsx  (P3-5)
│   ├── 🆕 cashier/dashboard/page.tsx (P3-5)
│   ├── 🆕 host/dashboard/page.tsx    (P3-5)
│   └── ✏️ dasboard/page.tsx          (fix typo — P3-5)
├── app/delivery/
│   └── 🆕 active/page.tsx            (P3-6)
└── components/
    ├── ✏️ payment/PaymentModal.tsx    (add Razorpay + UPI tabs — P3-7)
    └── 🆕 delivery/OnlineToggle.tsx   (P3-6)
```

---

# ═══════════════════════════════════════════════
# GROUP P3-A: MISSING BACKEND ENDPOINTS
# ═══════════════════════════════════════════════

---

## PROMPT P3-1 — Add apply-coupon + getOrderByTable to Orders Module

### 📂 Files to Provide to Claude

```
backend/src/modules/orders/orders.service.ts
backend/src/modules/orders/orders.routes.ts
backend/src/modules/orders/orders.schema.ts
backend/src/modules/orders/orders.controller.ts
backend/src/modules/coupons/coupons.service.ts    (from Part 1 Prompt 26)
backend/src/config/supabase.ts
backend/src/middleware/auth.middleware.ts
backend/src/middleware/tenant.middleware.ts
backend/src/utils/response.ts
```

### 🎯 Task for Claude

```
You are adding two missing endpoints to the Restaurant OS orders module.

=== GAP CONFIRMED ===
The frontend PaymentModal.tsx calls:
  POST /orders/:orderId/apply-coupon  { code: string }
  Expected response: { discount: number }

This route DOES NOT EXIST in orders.routes.ts.

Also, the waiter app (app/staff/waiter/page.tsx) calls:
  GET /orders/table/:tableId
  Expected: single active order for that table (or null)

Verify this route exists and if not, add it.

=== ADD TO orders.service.ts ===

FUNCTION: applyCoupon(orderId: string, couponCode: string, userId: string, restaurantId: string):
  Returns: { discount: number, coupon_id: string, new_total: number }
  
  1. Fetch the order: SELECT id, total_amount, branch_id, order_type FROM orders WHERE id = orderId
  2. Verify the order belongs to restaurantId (via branch)
  3. Verify order status is NOT 'paid' or 'cancelled' (can only apply coupon to active orders)
  4. Check if coupon already applied: SELECT coupon_id FROM orders WHERE id = orderId
     If already applied: throw 409 { code: 'COUPON_ALREADY_APPLIED', message: 'A coupon is already applied' }
  5. Call validateCoupon from coupons.service:
     import { validateCoupon } from '../coupons/coupons.service'
     const result = await validateCoupon(couponCode, orderId, total_amount, order_type, userId, restaurantId)
     If not valid: throw 400 with result.error_code
  6. Apply discount:
     UPDATE orders SET 
       discount_amount = result.discount_amount,
       coupon_id = result.coupon_id,
       final_amount = total_amount - result.discount_amount
     WHERE id = orderId
  7. Return { discount: result.discount_amount, coupon_id: result.coupon_id, new_total: total_amount - result.discount_amount }

FUNCTION: getOrderByTable(tableId: string, branchId: string):
  Returns the ACTIVE order for a table (status NOT IN ['paid', 'cancelled', 'closed']) or null
  
  SELECT o.*, 
    json_agg(json_build_object(
      'id', oi.id, 'menu_item_id', oi.menu_item_id, 'name', mi.name,
      'quantity', oi.quantity, 'unit_price', oi.unit_price, 'status', oi.status
    )) as items
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  JOIN menu_items mi ON oi.menu_item_id = mi.id
  WHERE o.table_id = tableId 
    AND o.branch_id = branchId
    AND o.status NOT IN ('paid', 'cancelled', 'closed')
  GROUP BY o.id
  ORDER BY o.created_at DESC
  LIMIT 1

=== ADD TO orders.controller.ts ===

applyCoupon controller: POST handler, uses req.params.orderId, req.body.code, req.user.id
getOrderByTable controller: GET handler, uses req.params.tableId, req.branchId

=== ADD TO orders.routes.ts ===

APPEND at the end (keep ALL existing routes unchanged):

// Apply coupon to an order (customer or cashier)
router.post(
  '/:orderId/apply-coupon',
  injectTenant,
  requireRole('customer', 'cashier', 'manager', 'owner'),
  validate({ body: z.object({ code: z.string().min(1).toUpperCase() }) }),
  handleApplyCoupon   // new controller
);

// Get active order for a table (waiter app)
// Note: verify if GET /orders/table/:tableId already exists
// If it DOES exist: return the existing route as-is
// If it does NOT exist: add it here
router.get(
  '/table/:tableId',
  injectTenant,
  requireRole('waiter', 'cashier', 'manager', 'owner'),
  handleGetOrderByTable  // new controller
);

Return all 4 updated order module files with full paths.
Mark all additions with // P3-1 ADDITION comments.
```

### 📤 Expected Output
- ✏️ `backend/src/modules/orders/orders.service.ts` (2 new functions)
- ✏️ `backend/src/modules/orders/orders.controller.ts` (2 new controllers)
- ✏️ `backend/src/modules/orders/orders.routes.ts` (2 new routes)

---

## PROMPT P3-2 — Delivery Partner Stats + Online Toggle Endpoints

### 📂 Files to Provide to Claude

```
backend/src/modules/delivery/delivery.service.ts   (full file — updated from P2-6)
backend/src/modules/delivery/delivery.routes.ts    (full file — updated from P2-6)
backend/src/modules/delivery/delivery.controller.ts
backend/src/config/supabase.ts
backend/src/utils/response.ts
```

### 🎯 Task for Claude

```
You are adding the missing endpoints to the delivery module.

=== MISSING ENDPOINTS CONFIRMED ===

The frontend app/delivery/earnings/page.tsx calls:
  GET /delivery/partner/earnings?period=today  (partially exists)

The Part 2 delivery history page calls:
  GET /delivery/partner/stats  ← MISSING — does NOT exist in routes

The frontend delivery page has no online/offline toggle button yet.
The Part 2 update added PATCH /delivery/partner/status but needs verification.

=== ADD TO delivery.service.ts ===

FUNCTION: getPartnerStats(partnerId: string):
  Returns lifetime and weekly aggregated stats for the delivery partner.
  
  Query in a single round-trip using parallel promises:
  
  const [lifetime, thisWeek, thisMonth, rating] = await Promise.all([
    // Lifetime totals
    supabaseAdmin.from('delivery_assignments')
      .select('id, status, distance_km')
      .eq('partner_id', partnerId)
      .eq('status', 'delivered'),
    
    // This week (Mon to now)
    supabaseAdmin.from('delivery_assignments')
      .select('id, status')
      .eq('partner_id', partnerId)
      .eq('status', 'delivered')
      .gte('completed_at', getStartOfWeek()),
    
    // This month
    supabaseAdmin.from('delivery_assignments')
      .select('id, status')
      .eq('partner_id', partnerId)
      .eq('status', 'delivered')
      .gte('completed_at', getStartOfMonth()),
    
    // Average rating (from reviews with delivery reference)
    supabaseAdmin.from('reviews')
      .select('delivery_rating')
      .eq('delivery_partner_id', partnerId)
      .not('delivery_rating', 'is', null)
  ])
  
  Calculate:
  - total_lifetime_deliveries = lifetime.data.length
  - lifetime_earnings = lifetime.data.reduce((sum, d) => sum + (30 + (d.distance_km || 0) * 5), 0)
  - total_distance_km = lifetime.data.reduce((sum, d) => sum + (d.distance_km || 0), 0)
  - weekly_deliveries = thisWeek.data.length
  - monthly_deliveries = thisMonth.data.length
  - avg_rating = rating.data.length > 0 ? 
      (rating.data.reduce((s, r) => s + r.delivery_rating, 0) / rating.data.length).toFixed(1) : null
  
  Return all computed stats as a single object.

FUNCTION: toggleOnlineStatus(partnerId: string, isOnline: boolean):
  UPDATE delivery_partners SET is_online = isOnline, updated_at = NOW()
  WHERE id = partnerId
  
  If going online: emit 'partner_available' to the branch's manager room
  If going offline: check if partner has active_delivery_id — if yes, throw 400:
    'Cannot go offline with an active delivery. Complete or hand off the delivery first.'

=== ADD TO delivery.routes.ts ===

APPEND (keep all existing routes unchanged):

// GET /delivery/partner/stats — lifetime + weekly stats
router.get(
  '/partner/stats',
  requireRole('delivery_partner'),
  handleGetPartnerStats    // new controller
);

// PATCH /delivery/partner/online — toggle online/offline (check if already added in P2-6)
// If NOT already there from P2-6, add it here:
router.patch(
  '/partner/online',
  requireRole('delivery_partner'),
  validate({ body: z.object({ is_online: z.boolean() }) }),
  handleToggleOnlineStatus
);

ADD the corresponding controllers to delivery.controller.ts.

Return all 3 updated delivery module files.
Mark all additions with // P3-2 ADDITION comments.
```

### 📤 Expected Output
- ✏️ `backend/src/modules/delivery/delivery.service.ts`
- ✏️ `backend/src/modules/delivery/delivery.routes.ts`
- ✏️ `backend/src/modules/delivery/delivery.controller.ts`

---

## PROMPT P3-3 — Loyalty Module: Leaderboard, Settings, Admin Adjust

### 📂 Files to Provide to Claude

```
backend/src/modules/loyalty/loyalty.service.ts    (full file — 13KB)
backend/src/modules/loyalty/loyalty.routes.ts     (full file)
backend/src/modules/loyalty/loyalty.controller.ts (full file)
backend/src/config/supabase.ts
backend/src/config/redis.ts
backend/src/middleware/auth.middleware.ts
backend/src/middleware/rbac.middleware.ts
backend/src/middleware/tenant.middleware.ts
backend/src/utils/response.ts
```

### 🎯 Task for Claude

```
You are adding three missing loyalty endpoints to Restaurant OS.

The Owner Loyalty Config page (from P2-9) calls three endpoints that 
DO NOT EXIST in loyalty.routes.ts:
  GET  /loyalty/leaderboard?restaurant_id=&limit=
  PATCH /loyalty/settings
  POST /loyalty/admin/adjust

Also, the loyalty stats endpoint needs verification.

=== VERIFY FIRST ===
Read loyalty.routes.ts carefully.
Check if these exist:
  GET /loyalty/stats?restaurant_id=
  
If /loyalty/stats exists → keep it. If not → add it.

=== ADD TO loyalty.service.ts ===

FUNCTION: getLeaderboard(restaurantId: string, limit: number = 10):
  Returns top N loyalty members for a restaurant.
  
  SELECT 
    u.id, u.name,
    la.points_balance,
    la.total_earned,
    la.tier,  -- (if tier column exists; calculate from points if not)
    MAX(lt.created_at) as last_activity
  FROM loyalty_accounts la
  JOIN users u ON la.user_id = u.id
  LEFT JOIN loyalty_transactions lt ON la.id = lt.loyalty_account_id
  WHERE la.restaurant_id = restaurantId
    AND la.points_balance > 0
  GROUP BY u.id, u.name, la.points_balance, la.total_earned
  ORDER BY la.points_balance DESC
  LIMIT limit
  
  For each member, calculate tier from points:
    function getTier(points: number): 'bronze' | 'silver' | 'gold' | 'platinum' {
      if (points >= 5000) return 'platinum'
      if (points >= 2000) return 'gold'
      if (points >= 500) return 'silver'
      return 'bronze'
    }
  
  Return only first name + last initial for privacy (e.g., "Rahul K.")

FUNCTION: getLoyaltyStats(restaurantId: string):
  Returns aggregate loyalty stats for the owner dashboard.
  
  const [totalMembers, activeThisMonth, totalIssued, totalRedeemed] = await Promise.all([
    supabaseAdmin.from('loyalty_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
    
    supabaseAdmin.from('loyalty_transactions')
      .select('loyalty_account_id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .gte('created_at', startOfMonth),
    
    supabaseAdmin.from('loyalty_transactions')
      .select('points')
      .eq('restaurant_id', restaurantId)
      .eq('type', 'earned'),
    
    supabaseAdmin.from('loyalty_transactions')
      .select('points')
      .eq('restaurant_id', restaurantId)
      .eq('type', 'redeemed')
  ])
  
  Return: {
    total_enrolled: totalMembers.count,
    active_this_month: activeThisMonth.count,
    total_points_issued: sum of earned points,
    total_points_redeemed: sum of redeemed points,
    outstanding_liability_rupees: (outstanding_points * RUPEES_PER_POINT)
  }

FUNCTION: updateLoyaltySettings(restaurantId: string, settings: {
  points_per_rupee?: number, rupees_per_point?: number, min_redeem_points?: number
}):
  Store in a loyalty_settings table (or in restaurant record or Redis config):
  
  Check if 'loyalty_settings' table exists in schema:
    - If it exists: UPSERT into loyalty_settings
    - If it DOES NOT exist: store in Redis as JSON key 'loyalty_settings:{restaurantId}'
      AND add a comment: "TODO: Create loyalty_settings table for persistent storage"
  
  Return: { success: true, settings }

FUNCTION: adminAdjustPoints(restaurantId: string, adminId: string, input: {
  phone: string, points: number, reason: string
}):
  Manual points adjustment by owner/manager.
  
  1. Find customer by phone: SELECT id FROM users WHERE phone = phone AND role = 'customer'
  2. Find their loyalty account for this restaurant
  3. If account not found: create one (call getOrCreateAccount)
  4. UPDATE loyalty_accounts SET points_balance = points_balance + input.points
  5. INSERT loyalty_transaction: { 
       type: 'admin_adjustment', points: input.points, 
       description: `Admin adjustment: ${input.reason}`, adjusted_by: adminId 
     }
  6. Return: { user_id, new_balance, transaction_id }

=== ADD TO loyalty.routes.ts ===

APPEND (keep all existing routes unchanged):

// Stats overview (for owner dashboard)
router.get(
  '/stats',
  authenticate, injectTenant, requireRole('owner', 'manager'),
  handleGetLoyaltyStats
);

// Leaderboard (top members)
router.get(
  '/leaderboard',
  authenticate, injectTenant, requireRole('owner', 'manager'),
  handleGetLeaderboard
);

// Update loyalty program settings
router.patch(
  '/settings',
  authenticate, injectTenant, requireRole('owner'),
  validate({ body: z.object({
    points_per_rupee: z.number().positive().optional(),
    rupees_per_point: z.number().positive().optional(),
    min_redeem_points: z.number().int().positive().optional()
  }).refine(d => Object.keys(d).length > 0) }),
  handleUpdateSettings
);

// Admin manual points adjustment
router.post(
  '/admin/adjust',
  authenticate, injectTenant, requireRole('owner', 'manager'),
  validate({ body: z.object({
    phone: z.string().min(10).max(15),
    points: z.number().int().refine(n => n !== 0, 'Points cannot be zero'),
    reason: z.string().min(3).max(200)
  }) }),
  handleAdminAdjust
);

Return all 3 updated loyalty module files with full paths.
```

### 📤 Expected Output
- ✏️ `backend/src/modules/loyalty/loyalty.service.ts`
- ✏️ `backend/src/modules/loyalty/loyalty.routes.ts`
- ✏️ `backend/src/modules/loyalty/loyalty.controller.ts`

---

# ═══════════════════════════════════════════════
# GROUP P3-B: MISSING CUSTOMER PROFILE PAGES
# ═══════════════════════════════════════════════

---

## PROMPT P3-4 — Customer Profile: Bookings + Orders History Pages

### 📂 Files to Provide to Claude

```
app/customer/profile/page.tsx              (full — 12.4KB)
app/customer/profile/loyalty/page.tsx      (full — 10.3KB, for style reference)
app/customer/profile/favorites/page.tsx    (full — 9.9KB, for style reference)
app/customer/order/history/page.tsx        (full — 4.8KB, separate order history)
lib/api-client.ts
types/api.ts
hooks/useAuth.ts
components/shared/StatusBadge.tsx
components/shared/EmptyState.tsx
```

### 🎯 Task for Claude

```
You are creating two MISSING customer profile sub-pages for Restaurant OS.

Both pages are under /customer/profile/ and are linked from profile/page.tsx.
They are MISSING from the codebase entirely.

Read the existing profile pages (loyalty, favorites) carefully to understand:
- The visual style and component patterns used
- Navigation structure (back button, header style)
- How API calls are structured with useQuery

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 1: app/customer/profile/bookings/page.tsx
Purpose: Customer's booking history — all past and upcoming bookings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"use client"

API: GET /api/v1/bookings?customer_id=me&limit=50
(Check the bookings routes — the exact query param may differ)

PAGE LAYOUT (match the visual style of loyalty/page.tsx):

  Header: Back arrow + "My Bookings"

  Filter tabs:
    Upcoming | Past | Cancelled

  Booking cards (upcoming — sorted by date asc):
    - Restaurant name + branch name
    - Date: "Saturday, 15 June 2025"
    - Time: "7:30 PM"
    - Party size: "👥 4 guests"
    - Status badge: Pending (amber) | Confirmed (green) | Arrived (blue)
    - "View QR" button → shows booking QR code in a modal
    - "Cancel Booking" button (only if status=pending and > 2 hours away)
    
  Booking cards (past — sorted by date desc):
    - Same info as above
    - Status badge: Completed (gray) | No-Show (red) | Cancelled (red-outline)
    - "Book Again" button → opens /customer/booking pre-filled with same restaurant
    - "Leave Review" button → only if no review exists for that visit

  Empty state by tab:
    Upcoming: "No upcoming bookings. Book a table to dine in style!"
               [Find Restaurants] button → /customer/home
    Past: "No past bookings yet."
    Cancelled: "No cancelled bookings."

  Pagination: "Load more" for past bookings (past can be many)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 2: app/customer/profile/orders/page.tsx
Purpose: Customer's full order history (different from order tracking page)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"use client"

NOTE: Read app/customer/order/history/page.tsx first.
That page (4.8KB) already shows order history at /customer/order/history.
This profile sub-page at /customer/profile/orders should either:
  A) Be a redirect to /customer/order/history if the features are the same
  B) Be a richer version with more profile-specific features

Decision: Make it a REDIRECT wrapper that goes to /customer/order/history
but only if the history page covers: restaurant name, items ordered, amount, status.
If it does NOT cover all these, create a full implementation here.

Read app/customer/order/history/page.tsx to decide. Then:
  - If redirect: create a 10-line redirect file
  - If full implementation: build it with the same style as bookings page

Full implementation spec (if needed):
  API: GET /api/v1/orders?customer_id=me&limit=30
  
  Filter tabs: All | Dine-In | Delivery | Takeaway
  
  Order cards:
    - Restaurant name + order type badge
    - Order date: "15 Jun 2025, 8:45 PM"
    - Items summary: "Butter Chicken, Dal Makhani, Naan (+2 more)"
    - Total: "₹480"
    - Status badge
    - "Reorder" button → adds same items to cart for the same restaurant
    - "View Receipt" → /customer/payment/:orderId/receipt
    - "Rate Order" button (if not yet rated)

Return both files with their full paths.
```

### 📤 Expected Output
- 🆕 `app/customer/profile/bookings/page.tsx`
- 🆕 `app/customer/profile/orders/page.tsx`

---

# ═══════════════════════════════════════════════
# GROUP P3-C: MISSING STAFF DASHBOARDS
# ═══════════════════════════════════════════════

---

## PROMPT P3-5 — Staff Role Dashboards: Waiter, Cashier, Host

### 📂 Files to Provide to Claude

```
app/staff/waiter/page.tsx               (full waiter home — 20.5KB)
app/staff/cashier/page.tsx              (full cashier home — 17.2KB)
app/staff/host/page.tsx                 (full host home — 27.8KB)
app/staff/manager/dashboard/page.tsx    (full manager dashboard — for reference)
app/staff/dashboard/page.tsx            (the role-redirect we built in P1)
app/staff/dasboard/page.tsx             (TYPO FILE — 146 bytes)
hooks/useAuth.ts
lib/api-client.ts
types/api.ts
```

### 🎯 Task for Claude

```
You are creating missing staff dashboard pages for Restaurant OS.

Read all provided staff pages carefully. They are LARGE files (20-27KB each)
meaning the main functional pages already exist. The missing pieces are
the /dashboard sub-routes for each role.

=== ANALYSIS NEEDED ===
The product document describes a role-specific dashboard as a quick overview
shown when staff first logs in — separate from the detailed work pages.

Waiter's work is at: /staff/waiter (waiter/page.tsx — the main waiter interface)
Waiter's dashboard at: /staff/waiter/dashboard — THIS IS MISSING

Read waiter/page.tsx. Does it already serve as a dashboard? If yes:
  → Create a minimal redirect: /staff/waiter/dashboard → redirect to /staff/waiter
  
Read cashier/page.tsx. Same analysis.
Read host/page.tsx. Same analysis.

=== DECISION LOGIC ===

If the existing role page (waiter/page.tsx etc.) IS a full-featured dashboard:
  Create a simple redirect page (10-15 lines).

If the existing role page is just a work interface (e.g., table list) and
NOT a dashboard overview, create a PROPER dashboard with:
  - Today's stats: orders handled, tips if any, hours worked
  - Quick action buttons to the main work interface
  - Shift info: start time, scheduled end time

=== FOR EACH, CREATE THE FILE ===

FILE 1: app/staff/waiter/dashboard/page.tsx
  Based on your analysis of waiter/page.tsx:
  - If redirect: "use client" + useRouter().replace('/staff/waiter')
  - If full dashboard: 
    Header: "Good morning, [name]! 👋"
    Today's stats: Tables served | Orders taken | Avg table time
    Quick action: [View My Tables] → /staff/waiter
    Shift info card

FILE 2: app/staff/cashier/dashboard/page.tsx
  Based on your analysis of cashier/page.tsx:
  - If redirect: "use client" + useRouter().replace('/staff/cashier')
  - If full dashboard:
    Header: "Good morning, [name]! 💳"
    Today's stats: Payments processed | Total amount processed | Pending payments
    Quick action: [Go to Billing] → /staff/cashier
    Shift info card

FILE 3: app/staff/host/dashboard/page.tsx
  Based on your analysis of host/page.tsx:
  - If redirect: "use client" + useRouter().replace('/staff/host')
  - If full dashboard:
    Header: "Good morning, [name]! 🎩"
    Today's stats: Guests checked in | Queue length | Bookings today
    Quick action: [View Queue] → /staff/host/queue
    Upcoming bookings list (next 2 hours)

FILE 4: app/staff/dasboard/page.tsx (FIX THE TYPO FILE)
  Current content is 146 bytes (just a RouteShell or similar).
  This file should REDIRECT to /staff/dashboard (the correct path).
  
  "use client"
  import { useEffect } from 'react'
  import { useRouter } from 'next/navigation'
  export default function DasBoardTypoRedirect() {
    const router = useRouter()
    useEffect(() => { router.replace('/staff/dashboard') }, [router])
    return null
  }

Return all 4 files with full paths.
Clearly state your analysis decision (redirect vs full dashboard) for each role.
```

### 📤 Expected Output
- 🆕 `app/staff/waiter/dashboard/page.tsx`
- 🆕 `app/staff/cashier/dashboard/page.tsx`
- 🆕 `app/staff/host/dashboard/page.tsx`
- ✏️ `app/staff/dasboard/page.tsx` (typo fix)

---

# ═══════════════════════════════════════════════
# GROUP P3-D: DELIVERY ACTIVE PAGE + ONLINE TOGGLE
# ═══════════════════════════════════════════════

---

## PROMPT P3-6 — Delivery Active Page + Online Toggle Component

### 📂 Files to Provide to Claude

```
app/delivery/page.tsx               (full delivery home — 6.9KB)
app/delivery/earnings/page.tsx      (full earnings — 3.4KB, for style reference)
lib/api-client.ts
lib/socket.ts
types/api.ts
hooks/useAuth.ts
```

### 🎯 Task for Claude

```
You are creating missing delivery partner features for Restaurant OS.

=== MISSING 1: app/delivery/active/page.tsx ===

This page shows the DETAIL VIEW of the current active delivery.
The delivery home (page.tsx) shows a list, but clicking into a specific
delivery needs its own dedicated page.

"use client"
Props: none (reads from URL: /delivery/active?id={deliveryId})
Or: /delivery/active/[deliveryId]/page.tsx — check the link pattern in delivery/page.tsx

API: GET /api/v1/delivery/:deliveryId  (partner views their delivery)

PAGE LAYOUT:

  Status Banner (top, navy color):
    - Delivery ID: #ABC12345
    - Status badge (large): Accepted | Picked Up | Out for Delivery
    - Time elapsed since acceptance: "Started 12 min ago"

  Progress Steps:
    Step 1: ✅ Order Accepted
    Step 2: 🔵 At Restaurant (current — mark as "Picked Up" button)
    Step 3: ⬜ Delivering
    Step 4: ⬜ Delivered

  Restaurant Pickup Card:
    - Restaurant name + address
    - Items to pick up (list from order)
    - "Navigate" button (opens Google Maps with restaurant address)
    - Order items count: "3 items to pick up"

  Customer Delivery Card:
    - Customer name (first name only for privacy)
    - Delivery address (show in parts: area, landmark, pincode)
    - "Navigate" button (opens Google Maps with delivery address)
    - Distance: "2.4 km away"

  Action Buttons (based on current status):
    - Status = 'accepted': [Mark as Picked Up] → PATCH /:id/status { status: 'picked_up' }
    - Status = 'picked_up': [Start Delivery] → PATCH /:id/status { status: 'out_for_delivery' }
                            [Report Issue] → opens problem sheet
    - Status = 'out_for_delivery': [Mark as Delivered] → PATCH /:id/status { status: 'delivered' }
                                   [Take Photo Proof] (placeholder — phase 2)

  GPS Location Auto-Update:
    navigator.geolocation.watchPosition((pos) => {
      POST /delivery/location { lat, lon, delivery_id }
    }, null, { maximumAge: 5000 })
    Clean up on unmount.

=== MISSING 2: components/delivery/OnlineToggle.tsx ===

A reusable component used in the delivery home page to toggle online/offline status.

Props: { partnerId: string; initialStatus: boolean; className?: string }

Design:
  - Large toggle switch with text: "ONLINE" / "OFFLINE"
  - When ONLINE: green background, pulsing green dot
  - When OFFLINE: gray background
  - On toggle: show confirmation dialog:
    "Go offline? You won't receive new deliveries while offline."
    [Stay Online] | [Go Offline]
  - API call: PATCH /delivery/partner/online { is_online: boolean }
  - On error: revert the toggle, show toast error

Add this component to the delivery home page (app/delivery/page.tsx):
  - Show it in the header section of the delivery page
  - Position: top-right of the hero section
  - Currently the delivery/page.tsx shows no online toggle

Return:
- New app/delivery/active/page.tsx (or /delivery/active/[deliveryId]/page.tsx — decide based on link pattern in delivery/page.tsx)
- New components/delivery/OnlineToggle.tsx
- Updated app/delivery/page.tsx (with OnlineToggle added)
```

### 📤 Expected Output
- 🆕 `app/delivery/active/page.tsx` or `app/delivery/active/[deliveryId]/page.tsx`
- 🆕 `components/delivery/OnlineToggle.tsx`
- ✏️ `app/delivery/page.tsx` (with OnlineToggle added)

---

# ═══════════════════════════════════════════════
# GROUP P3-E: PAYMENT MODAL ENHANCEMENT
# ═══════════════════════════════════════════════

---

## PROMPT P3-7 — Enhance PaymentModal with Razorpay + UPI Tabs

### 📂 Files to Provide to Claude

```
components/payment/PaymentModal.tsx          (full existing — 6.9KB)
components/payment/RazorpayCheckout.tsx      (from Part 2 Prompt P2-4)
components/payment/UPIQRSheet.tsx            (from Part 2 Prompt P2-4)
components/payment/SplitBillSheet.tsx        (from Part 2 Prompt P2-4)
lib/constants.ts
lib/api-client.ts
types/api.ts
```

### 🎯 Task for Claude

```
You are enhancing the existing PaymentModal component in Restaurant OS.

The current PaymentModal.tsx handles: cash, card, UPI (basic), split.
After Parts 1 & 2, we now have proper Razorpay + UPI QR components.

The current UPI payment just calls /payments/initiate with method='upi' which
processes an offline UPI (waiter records manually that customer paid via UPI).

We need to UPGRADE the modal to offer REAL digital payment options.

=== UPGRADE PLAN ===

Read the existing PaymentModal.tsx carefully.
Understand the payment method tabs: cash | card | upi | split

ENHANCEMENT 1 — Add "Online" payment methods for customer-facing flow:

Add a new section to the method selector:
  [Cash] [Card] [UPI QR] [Online] [Split]

For the new "UPI QR" tab:
  - Don't replace the existing UPI (offline recording) — that's for cashier's use
  - Add a sub-tab inside UPI:
    - "Offline UPI" (waiter records customer paid via their UPI app — existing)
    - "Show QR Code" → renders <UPIQRSheet /> inline inside the modal

For the new "Online" tab:
  - Renders <RazorpayCheckout /> inside the modal
  - Only show this tab if NEXT_PUBLIC_RAZORPAY_KEY_ID env var is set
    (check: typeof window !== 'undefined' && process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID)
  - If Razorpay not configured: hide this tab entirely

For the "Split" tab:
  - Keep existing split bill input
  - Add a "Use Split QR" option → renders <SplitBillSheet /> inline

ENHANCEMENT 2 — Fix the coupon application:

Current code calls: POST /orders/:orderId/apply-coupon
This endpoint now exists (from Prompt P3-1).

Verify the response shape:
  Backend returns: { discount: number, coupon_id: string, new_total: number }
  Frontend expects: { discount: number }
  
  Update the onSuccess handler to use new_total if available:
    setDiscount(data.discount)
    if (data.new_total) setFinalTotal(data.new_total)  // use server-calculated total

ENHANCEMENT 3 — Show payment method icons properly:

The modal currently imports icons but the icon for 'upi' is Smartphone.
Update the METHOD_META to include better icons and colors:
  cash:   { icon: Banknote, label: 'Cash', color: 'text-green-600' }
  card:   { icon: CreditCard, label: 'Card', color: 'text-blue-600' }
  upi:    { icon: Smartphone, label: 'UPI', color: 'text-purple-600' }
  online: { icon: Globe, label: 'Online', color: 'text-indigo-600' }  // new
  split:  { icon: Split, label: 'Split', color: 'text-orange-600' }

Return the complete updated PaymentModal.tsx.
Keep ALL existing functionality intact — only ADD the new payment method options.
Mark all additions with // P3-7 ENHANCEMENT comments.
```

### 📤 Expected Output
- ✏️ `components/payment/PaymentModal.tsx` (enhanced with Razorpay + UPI QR tabs)

---

# ═══════════════════════════════════════════════
# GROUP P3-F: CODE QUALITY & CLEANUP
# ═══════════════════════════════════════════════

---

## PROMPT P3-8 — Remove Dev Files + Production Cleanup

### 📂 Files to Provide to Claude

```
app/table-test/page.tsx         (494 bytes — suspected dev test page)
app/page.tsx                    (686 bytes — root landing page)
app/staff/dasboard/page.tsx     (146 bytes — typo file, already fixed in P3-5)
backend/src/modules/admin/admin.schema.ts
backend/src/server.ts
```

### 🎯 Task for Claude

```
You are cleaning up Restaurant OS for production readiness.

=== TASK 1: Audit dev/test files ===

Read app/table-test/page.tsx.
If it's a debug/test page:
  - It should NOT exist in production
  - Either delete it OR add a guard:
    if (process.env.NODE_ENV === 'production') redirect('/');
    
Read app/page.tsx (686 bytes).
This is the root landing page (/).
It should redirect non-logged-in users to /auth/login and logged-in users to their dashboard.
Verify this logic is correct.

If root page just shows a generic landing: UPDATE it to:
  - Check if user is authenticated (check cookie/localStorage for JWT)
  - If authenticated: redirect to the role-appropriate dashboard
  - If not authenticated: redirect to /auth/login
  - If it's the first visit (no role yet): show a nice landing page

=== TASK 2: Remove debug logging from production services ===

Review backend/src/server.ts for any debug console.log statements.
Wrap them in: if (process.env.NODE_ENV !== 'production') { console.log(...) }

=== TASK 3: Add production security headers ===

In backend/src/app.ts (or wherever cors/helmet is configured), ensure:
  - helmet() is applied (if not already)
  - CORS origins are from env var (not hardcoded)
  - X-Powered-By header is removed (helmet does this)
  - Content-Security-Policy is configured

Add to app.ts if not present:
  import helmet from 'helmet';
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
        connectSrc: ["'self'", process.env.SUPABASE_URL, "wss:"],
        imgSrc: ["'self'", "data:", "https:"],
      }
    }
  }));

=== TASK 4: Verify JWT token expiry ===

Check auth.service.ts for JWT token configuration.
Product doc specifies: access token 15min, refresh token 7 days.
If these aren't set correctly, update them.

Return:
- Updated app/table-test/page.tsx (with prod guard or deletion note)
- Updated app/page.tsx (correct root redirect logic)
- Updated backend/src/app.ts (security headers)
```

### 📤 Expected Output
- ✏️ `app/table-test/page.tsx` (production guard)
- ✏️ `app/page.tsx` (correct root redirect)
- ✏️ `backend/src/app.ts` (security headers)

---

# ═══════════════════════════════════════════════
# GROUP P3-G: SHARED LIBRARY UPDATES
# ═══════════════════════════════════════════════

---

## PROMPT P3-9 — Complete lib/constants.ts Verification + Update

### 📂 Files to Provide to Claude

```
lib/constants.ts
lib/utils.ts
hooks/useAuth.ts
types/api.ts
```

### 🎯 Task for Claude

```
You are verifying and completing the lib/constants.ts file for Restaurant OS.

The PaymentModal imports PAYMENT_METHODS from '@/lib/constants'.
Multiple other files reference constants from this file.

=== AUDIT TASK ===

Read lib/constants.ts. Verify it contains:

1. PAYMENT_METHODS array:
   Should include: 'cash', 'card', 'upi', 'online', 'split'
   If missing 'online': add it.

2. ORDER_STATUSES with display labels:
   created, confirmed, preparing, ready, served, paid, closed, cancelled
   Each with: { label: string, color: string }

3. BOOKING_STATUSES:
   pending, confirmed, arrived, seated, completed, no_show, cancelled
   Each with: { label: string, color: string }

4. TABLE_STATUSES:
   available, reserved, occupied, cleaning, maintenance
   Each with: { label: string, color: string, bgColor: string }

5. USER_ROLES with display names:
   owner, manager, waiter, chef, cashier, host, delivery_partner, customer, super_admin, admin
   Each with: { label: string, color: string }

6. CUISINE_TYPES array (for restaurant filtering):
   [ 'North Indian', 'South Indian', 'Chinese', 'Italian', 'Mexican', 'Continental',
     'Thai', 'Japanese', 'Fast Food', 'Cafe', 'Bakery', 'Street Food', 'Seafood',
     'Mughlai', 'Mediterranean', 'Korean', 'American', 'Fine Dining' ]

7. DIETARY_LABELS (for DietaryProfile component):
   Map from key to display label + icon:
   { vegan: { label: 'Vegan', icon: '🌱' }, vegetarian: {...}, halal: {...}, ... }

8. ALLERGEN_LABELS:
   { nuts: { label: 'Nuts', icon: '🥜' }, dairy: {...}, ... }

9. INDIAN_STATES array for address forms:
   ['Andhra Pradesh', 'Assam', ..., 'West Bengal']

10. NOTIFICATION_TYPES with icons:
    order, booking, payment, loyalty, system, delivery
    Each with icon name (lucide-react icon)

For any that are MISSING from the current file: ADD them.
For any that are PRESENT but incomplete: FIX them.

Also check lib/utils.ts:
  - Verify formatCurrency formats with ₹ symbol and Indian number system (1,00,000 not 100,000)
  - Verify timeAgo function exists and works for Indian IST timezone
  - Add if missing: getStartOfWeek(), getStartOfMonth() helper functions

Return the complete updated lib/constants.ts and lib/utils.ts.
```

### 📤 Expected Output
- ✏️ `lib/constants.ts` (complete and verified)
- ✏️ `lib/utils.ts` (with missing helpers)

---

## PROMPT P3-10 — Complete Frontend Type Safety Audit

### 📂 Files to Provide to Claude

```
types/api.ts                    (full file — updated from Part 1 Prompt 18)
hooks/useAuth.ts
lib/api-client.ts
```

### 🎯 Task for Claude

```
You are performing a type safety audit on Restaurant OS frontend.

=== AUDIT TASK ===

Read types/api.ts carefully.

1. Check that User interface has ALL fields used across the codebase:
   Required fields (commonly used but may be missing):
   - branch_id: string | null       (for staff with a single branch)
   - employee_id: string | null      (staff employee code)
   - profile_pic_url: string | null
   - force_password_change: boolean  (first login flag)
   - created_by_restaurant: boolean  (POS-created customers)
   - notification_preferences: object | null
   - last_login: string | null

2. Check that Order interface has:
   - waiter_id: string | null
   - waiter_name?: string            (joined field)
   - table_label?: string            (joined field)
   - coupon_id: string | null
   - discount_amount: number
   - final_amount: number
   - items: OrderItem[]              (joined field, populated in detail views)

3. Check that Branch interface has:
   - manager_id: string | null
   - manager?: Pick<User, 'id' | 'name'>  (joined)
   - is_active: boolean
   - operating_hours: object | null
   - seating_capacity: number
   - lat: number | null
   - lon: number | null

4. Verify MenuItem interface has:
   - category_id: string
   - category_name?: string          (joined field)
   - is_available: boolean
   - prep_time_minutes: number | null
   - allergens: string[] | null

5. Add MISSING union types:
   - OrderStatus: 'created' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'closed' | 'cancelled'
   - BookingStatus: 'pending' | 'confirmed' | 'arrived' | 'seated' | 'completed' | 'no_show' | 'cancelled'
   - TableStatus: 'available' | 'reserved' | 'occupied' | 'cleaning' | 'maintenance'
   - DeliveryStatus: 'assigned' | 'accepted' | 'rejected' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'failed'
   - UserRole: 'owner' | 'manager' | 'waiter' | 'chef' | 'cashier' | 'host' | 'delivery_partner' | 'customer' | 'super_admin' | 'admin'
   - PaymentMethod: 'cash' | 'card' | 'upi' | 'online'
   - PaymentStatus: 'pending' | 'completed' | 'failed' | 'refunded' | 'refund_requested'
   
   Apply these unions to their respective interface fields.

6. Add ApiResponse<T> generic wrapper type:
   interface ApiResponse<T> {
     success: boolean
     data: T
     error?: { code: string; message: string }
     pagination?: { page: number; limit: number; total: number; pages: number }
   }

7. Verify the useAuth hook returns correct typed shape.
   Check that authUser.role is typed as UserRole (not just string).

Return the complete updated types/api.ts with all fixes and additions.
```

### 📤 Expected Output
- ✏️ `types/api.ts` (complete type safety audit)
- ✏️ `hooks/useAuth.ts` (if role typing needs fix)

---

# ═══════════════════════════════════════════════
# GROUP P3-H: BACKEND COMPREHENSIVE AUDIT
# ═══════════════════════════════════════════════

---

## PROMPT P3-11 — Backend API Response Shape Consistency Audit

### 📂 Files to Provide to Claude

```
backend/src/utils/response.ts
backend/src/modules/orders/orders.controller.ts
backend/src/modules/bookings/bookings.controller.ts
backend/src/modules/payments/payments.controller.ts
backend/src/modules/menu/menu.controller.ts
backend/src/middleware/error.middleware.ts  (if exists)
```

### 🎯 Task for Claude

```
You are performing a backend API response consistency audit for Restaurant OS.

The product document specifies ALL API responses must follow this shape:
  Success: { success: true, data: <payload>, pagination?: {...} }
  Error:   { success: false, error: { code: string, message: string } }

=== AUDIT TASK ===

Read all provided controller files.
For each controller function, verify:
  1. Success responses use the success() helper from utils/response.ts
  2. Error responses use the error() helper (not raw res.json({...}))
  3. HTTP status codes are correct (201 for POST creates, 200 for updates, etc.)
  4. Pagination is included where lists are returned

Check the response.ts utility:
  - Does the success() function return { success: true, data, ... }?
  - Does the error() function return { success: false, error: {...} }?
  - Is there a paginate() or paginatedSuccess() helper?

=== FIX TASK ===

1. If any controller uses raw res.json() instead of the helper: fix it
2. If the response.ts helpers are missing pagination support: add it
3. Ensure error codes are consistent SCREAMING_SNAKE_CASE strings:
   NOT_FOUND, UNAUTHORIZED, VALIDATION_ERROR, CONFLICT, INTERNAL_ERROR, etc.

4. Create/update backend/src/middleware/error.middleware.ts:
   Global error handler that catches all unhandled errors and returns:
   { success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }
   
   In development: include error.stack in the response
   In production: never expose the stack trace
   
   Special handling:
   - Zod validation errors → 400 with VALIDATION_ERROR code + field errors
   - Supabase unique constraint violations → 409 with CONFLICT code
   - JWT expired → 401 with TOKEN_EXPIRED code

5. Ensure app.ts uses this global error handler:
   app.use(errorMiddleware)  // MUST be the LAST app.use()

Return all audited/fixed files.
```

### 📤 Expected Output
- ✏️ `backend/src/utils/response.ts` (if pagination helper missing)
- ✏️ `backend/src/middleware/error.middleware.ts` (create or update)
- ✏️ Any controllers that have inconsistent response shapes

---

## PROMPT P3-12 — Missing Supabase SQL: Additional RPCs for Admin

### 📂 Files to Provide to Claude

```
backend/src/modules/admin/admin.service.ts   (full file — including P2-8 updates)
supabase/rpc_functions.sql                   (from P2-1 — all existing RPCs)
backend/prisma/schema.prisma
```

### 🎯 Task for Claude

```
You are adding the final missing Supabase SQL for Restaurant OS.

=== MISSING 1: get_top_restaurants_by_revenue RPC ===
Already created in P2-1. But admin.service.ts calls it BEFORE it existed.
Verify the SQL in rpc_functions.sql matches EXACTLY what admin.service.ts passes.

Check admin.service.ts call:
  supabaseAdmin.rpc('get_top_restaurants_by_revenue', { p_since: thirtyDaysAgo, p_limit: 5 })

The RPC MUST accept parameters named exactly p_since and p_limit.
Verify this in rpc_functions.sql. If the parameter names differ, fix the SQL.

=== MISSING 2: refresh_materialized_views ===
This was referenced in P2-19 app.ts but the SQL was only noted, not properly defined.
Add to rpc_functions.sql:

  CREATE OR REPLACE FUNCTION refresh_materialized_views()
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    -- Only refresh if views exist (graceful degradation)
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_branch_daily_stats') THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_branch_daily_stats;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_menu_item_performance') THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_menu_item_performance;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_restaurant_monthly_summary') THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY mv_restaurant_monthly_summary;
    END IF;
  END; $$;
  
  GRANT EXECUTE ON FUNCTION refresh_materialized_views() TO service_role;

=== MISSING 3: get_db_metrics — use a safer version ===
The previous get_db_metrics used pg_stat_activity which may not be accessible
on Supabase's managed PostgreSQL. Replace with a safer version:

  CREATE OR REPLACE FUNCTION get_db_metrics()
  RETURNS json LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT json_build_object(
      'database_size_mb', ROUND(pg_database_size(current_database()) / 1048576.0, 2),
      'total_tables', (SELECT COUNT(*) FROM information_schema.tables 
                       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
      'cache_hit_ratio', (
        SELECT ROUND(100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0), 2)
        FROM pg_statio_user_tables
      ),
      'generated_at', NOW()
    );
  $$;

=== MISSING 4: Supabase Storage bucket setup ===
For the async report export (P2-7), we need a Supabase Storage bucket.
Add SQL/instructions:

  -- Run this to create the reports storage bucket:
  -- (Cannot be done via SQL — must use Supabase Dashboard or API)
  -- Instructions:
  --   1. Go to Supabase Dashboard → Storage → Create bucket
  --   2. Name: 'reports'
  --   3. Public: NO (private bucket — use signed URLs)
  --   4. File size limit: 50MB
  --   5. Allowed MIME types: text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/pdf

  -- Storage policy for reports bucket:
  -- Allow service_role full access (already default)
  -- No public read access

=== MISSING 5: Audit Log INSERT shortcut function ===
The insertAuditLog utility is called in many places.
Verify it works correctly by creating a Supabase function shortcut:

  CREATE OR REPLACE FUNCTION log_audit_event(
    p_actor_id UUID, p_action TEXT, p_resource_type TEXT, p_resource_id UUID,
    p_ip_address TEXT DEFAULT NULL, p_meta JSONB DEFAULT NULL
  )
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, ip_address, meta, created_at)
    VALUES (p_actor_id, p_action, p_resource_type, p_resource_id, p_ip_address, p_meta, NOW());
  EXCEPTION WHEN OTHERS THEN
    -- Audit log failures should never block the main operation
    RAISE WARNING 'Audit log failed: %', SQLERRM;
  END; $$;
  
  GRANT EXECUTE ON FUNCTION log_audit_event TO service_role;

Return the complete UPDATED supabase/rpc_functions.sql file with all additions and fixes.
```

### 📤 Expected Output
- ✏️ `supabase/rpc_functions.sql` (with all verified and additional SQL)

---

# ═══════════════════════════════════════════════
# GROUP P3-I: ADVANCED INTEGRATION PROMPTS
# ═══════════════════════════════════════════════

---

## PROMPT P3-13 — Customer Restaurant Page: Full Feature Integration

### 📂 Files to Provide to Claude

```
app/customer/restaurant/[restaurantId]/page.tsx       (full — 22.7KB)
app/customer/restaurant/[restaurantId]/book/page.tsx  (full — 20KB)
components/ai/ChatbotWidget.tsx                       (from P2-14)
components/customer/SocialDining.tsx                  (from P1 Prompt 15)
components/customer/DietaryProfile.tsx                (from P1 Prompt 16)
lib/api-client.ts
types/api.ts
```

### 🎯 Task for Claude

```
You are performing a deep integration review of the customer restaurant pages.

The restaurant detail page (22.7KB) and booking page (20KB) are LARGE files
meaning they're likely feature-complete. However, several new components from
Parts 1 & 2 need to be integrated into them.

=== ANALYSIS PASS ===

Read both files carefully and identify:

1. Does the restaurant page show:
   - Happy hour / dynamic pricing badges on menu items? (needs dynamic-pricing integration)
   - Allergen warning icons based on customer's dietary profile? (needs DietaryProfile integration)
   - Mood/ambiance tags?
   - Real-time queue wait time?

2. Does the booking page support:
   - Social dining group creation after booking? (needs SocialDining integration)
   - Table preference pre-selection based on CustomerPreference API?
   - Coupon/discount code field on booking?

=== INTEGRATION TASKS ===

TASK 1 — Restaurant page: Add dynamic pricing badges

Find where menu items are displayed.
For each item, check if a dynamic pricing rule applies NOW:
  GET /api/v1/dynamic-pricing/branch/:branchId/active
  
  If an item's id is in the active rules:
  - Show a badge: "🔥 Happy Hour — 20% off" in amber
  - Show discounted price with strikethrough original

TASK 2 — Restaurant page: Add allergen warnings

If customer has a dietary profile (from user context or localStorage):
  For each menu item, check if item's allergens overlap with user's allergies.
  If overlap: show a small ⚠️ warning icon with tooltip "Contains [allergen]"

TASK 3 — Booking page: Add Social Dining option

After booking confirmation (the success state), show:
  "Want to pre-order with friends? Create a group for your table →"
  Button: [Create Dining Group] → renders <SocialDining bookingId={confirmedBookingId} isOrganizer={true} />

TASK 4 — Booking page: Pre-select preferred table

Before the table selector is shown, call:
  GET /api/v1/customer-preferences/tables/:branchId
  If preference exists: pre-select that table + show chip: "Your usual table ❤️"

Return:
- Updated restaurant/[restaurantId]/page.tsx (with dynamic pricing + allergens)
- Updated restaurant/[restaurantId]/book/page.tsx (with social dining + table preference)

Mark all additions with // INTEGRATION ADDITION comments.
Keep ALL existing code intact — only add new functionality.
```

### 📤 Expected Output
- ✏️ `app/customer/restaurant/[restaurantId]/page.tsx`
- ✏️ `app/customer/restaurant/[restaurantId]/book/page.tsx`

---

## PROMPT P3-14 — Manager Dashboard: Complete AI Integration

### 📂 Files to Provide to Claude

```
app/staff/manager/dashboard/page.tsx          (full — 20KB)
components/ai/DemandPrediction.tsx            (from P1 Prompt 14)
components/ai/SmartPricingWidget.tsx          (from P1 Prompt 15)
```

### 🎯 Task for Claude

```
You are completing the AI feature integration in the manager dashboard.

The manager dashboard (20KB) is a large, functional page.
From Part 1 Prompt 17, we added the DemandPrediction widget.

Do a deep review of the manager dashboard and ensure ALL AI widgets are 
correctly integrated, not just noted.

=== VERIFY THESE INTEGRATIONS ===

1. DemandPrediction widget:
   - Is it actually rendered in the dashboard? Or just imported?
   - Is it in the correct position (below KPI cards, above recent orders)?
   - Does it receive the correct branchId prop?

2. Waiter Workload section:
   The product doc specifies the manager dashboard shows a live 
   waiter workload overview.
   
   Check if this exists. If NOT:
   
   Add a "Staff Workload" section using the waiter-assignment API:
   GET /api/v1/waiter-assignment/workloads?branch_id={branchId}
   
   Display as a small table:
   | Waiter Name | Tables | Active Orders | Pending Serves | Score |
   | Ravi Kumar  | 3      | 2             | 1              | 🟡 10.5 |
   
   Color coding for score:
   - 0-8: 🟢 green (light workload)
   - 9-15: 🟡 yellow (moderate)
   - 16+: 🔴 red (heavy — consider reassigning)
   
   Auto-refreshes every 30 seconds.

3. Inventory Alert section:
   Check if the dashboard shows low inventory alerts.
   The backend sends 'inventory_low' WebSocket events.
   
   If NOT displayed: add an alert card:
   Fetches GET /api/v1/inventory/branch/{branchId}/alerts
   Shows: "⚠️ 3 items running low: Chicken Breast, Basmati Rice, Cooking Oil"

4. Kitchen Performance quick stat:
   Show today's avg prep time vs target:
   GET /api/v1/reports/kitchen-performance?branch_id=&from=today&to=today
   Display: "Avg Prep Time: 18 min (Target: 15 min)" with a color indicator

Return the complete updated manager dashboard page.
Mark all additions with // AI INTEGRATION comments.
```

### 📤 Expected Output
- ✏️ `app/staff/manager/dashboard/page.tsx` (with all AI integrations complete)

---

# ═══════════════════════════════════════════════
# PART 3 — FINAL WIRING PROMPT
# ═══════════════════════════════════════════════

---

## PROMPT P3-15 — Final app.ts + navigation complete sync

### 📂 Files to Provide to Claude

```
backend/src/app.ts                    (fully updated from all previous prompts)
components/layout/Sidebar.tsx         (fully updated from P2-20)
components/layout/BottomNav.tsx       (fully updated from P2-20)
app/customer/profile/page.tsx         (to verify it links to new sub-pages)
```

### 🎯 Task for Claude

```
You are doing the FINAL sync check for Restaurant OS to ensure everything is wired.

=== BACKEND app.ts FINAL AUDIT ===

Read app.ts carefully.
Verify ALL modules from Parts 1, 2, 3 are registered:

Checklist of all modules that must be in app.ts:
  ✅ auth, users, restaurants, branches, branding (existing)
  ✅ tables, floor-layout, menu, orders, order-items (existing)
  ✅ kitchen, payments, bookings, queue, delivery (existing)
  ✅ reviews, inventory, staff, reports, analytics (existing)
  ✅ geo, loyalty, support, notifications, admin (existing)
  ── Part 1 additions:
  ? recipe-ingredients
  ? shifts
  ? dynamic-pricing
  ? customer-preferences
  ? staff-feedback
  ? recommendations
  ? chatbot
  ? staffing
  ? social-dining
  ? coupons
  ── Part 2 additions:
  ? waiter-assignment
  ? payment-gateway
  ? owner-crm  (mounts as /owner/customers)
  
For any that are MISSING: add the import + registration.

=== FRONTEND NAVIGATION FINAL AUDIT ===

Check app/customer/profile/page.tsx:
  - Does it link to /customer/profile/bookings? If not, add it.
  - Does it link to /customer/profile/orders? If not, add it.

Check Sidebar.tsx:
  - Does the owner sidebar have: Dashboard, Menu, Inventory, Staff, Shifts, 
    Reports, Branding, Floor Layout, Loyalty, Customers, Settings?
  - Does the admin sidebar have: Dashboard, Restaurants, Customers, 
    Approvals, Staff Reviews, Refunds, Reports, Platform Health?

Check BottomNav.tsx (customer):
  - Does it have: Home, Scan, Bookings, Orders, Profile?
  - Is there a notifications bell icon?

For any missing links or nav items: add them.

Return:
1. The final verified backend/src/app.ts
2. The final verified components/layout/Sidebar.tsx  
3. The final verified components/layout/BottomNav.tsx
4. app/customer/profile/page.tsx if profile links need updating
```

### 📤 Expected Output
- ✏️ `backend/src/app.ts` (final complete version)
- ✏️ `components/layout/Sidebar.tsx` (final complete navigation)
- ✏️ `components/layout/BottomNav.tsx` (final complete navigation)

---

# ═══════════════════════════════════════════════
# COMPLETE PART 3 CHECKLIST
# ═══════════════════════════════════════════════

## 📂 PART 3 ALL FILES (15 New + 28 Modified)

### New Frontend Pages (6)
```
app/customer/profile/bookings/page.tsx    ← P3-4
app/customer/profile/orders/page.tsx      ← P3-4
app/staff/waiter/dashboard/page.tsx       ← P3-5
app/staff/cashier/dashboard/page.tsx      ← P3-5
app/staff/host/dashboard/page.tsx         ← P3-5
app/delivery/active/page.tsx              ← P3-6
```

### New Frontend Components (2)
```
components/delivery/OnlineToggle.tsx      ← P3-6
(supabase/rpc_functions.sql additions)    ← P3-12
```

### Modified Backend Files (9)
```
backend/src/modules/orders/orders.service.ts     ← P3-1
backend/src/modules/orders/orders.controller.ts  ← P3-1
backend/src/modules/orders/orders.routes.ts      ← P3-1
backend/src/modules/delivery/delivery.service.ts ← P3-2
backend/src/modules/delivery/delivery.routes.ts  ← P3-2
backend/src/modules/delivery/delivery.controller.ts ← P3-2
backend/src/modules/loyalty/loyalty.service.ts   ← P3-3
backend/src/modules/loyalty/loyalty.routes.ts    ← P3-3
backend/src/modules/loyalty/loyalty.controller.ts ← P3-3
backend/src/utils/response.ts                    ← P3-11
backend/src/middleware/error.middleware.ts        ← P3-11
backend/src/app.ts                               ← P3-15
supabase/rpc_functions.sql                       ← P3-12
```

### Modified Frontend Files (10)
```
app/staff/dasboard/page.tsx                          ← P3-5 (typo fix)
app/delivery/page.tsx                                ← P3-6
components/payment/PaymentModal.tsx                  ← P3-7
app/table-test/page.tsx                              ← P3-8
app/page.tsx                                         ← P3-8
app/customer/restaurant/[restaurantId]/page.tsx      ← P3-13
app/customer/restaurant/[restaurantId]/book/page.tsx ← P3-13
app/staff/manager/dashboard/page.tsx                 ← P3-14
lib/constants.ts                                     ← P3-9
lib/utils.ts                                         ← P3-9
types/api.ts                                         ← P3-10
hooks/useAuth.ts                                     ← P3-10
components/layout/Sidebar.tsx                        ← P3-15
components/layout/BottomNav.tsx                      ← P3-15
backend/src/app.ts                                   ← P3-8, P3-15
```

---

## 📊 GRAND TOTAL — ALL 3 PARTS COMBINED

| Category | Part 1 | Part 2 | Part 3 | **TOTAL** |
|---|---|---|---|---|
| Detailed Prompts | 38 | 20 | 15 | **73** |
| New Backend Modules | 10 | 3 | 0 | **13 modules** |
| New DB SQL Functions | 4 RPCs | 9 RPCs + 3 views | 4 RPCs | **20 SQL objects** |
| New Frontend Pages | 8 | 4 | 6 | **18 pages** |
| New Components | 12 | 10 | 2 | **24 components** |
| Modified Files | ~30 | ~18 | ~28 | **~76 changes** |
| New Files Total | ~90 | 32 | 15 | **~137 files** |

---

## 🔴 PRIORITY EXECUTION ORDER — ALL 3 PARTS

```
CRITICAL FIRST (things are BROKEN without these):
  P2-1  → Missing RPC SQL (admin/reports crash)
  P3-1  → apply-coupon route (PaymentModal crashes)
  P2-12 → Owner reports path mismatch (404s)
  P3-3  → Loyalty endpoints (LoyaltyConfig crashes)
  P3-2  → Delivery stats endpoint (DeliveryHistory crashes)

HIGH PRIORITY (core features incomplete):
  P2-2  → RLS policies (security)
  P2-4  → Razorpay + UPI payment integration
  P2-3  → Waiter auto-assignment
  P2-8  → Restaurant approval workflow
  P1-2  → Recipe ingredients
  P1-3  → Shifts module
  P3-11 → Error handling consistency

MEDIUM PRIORITY (complete the product):
  P1-4  → Dynamic pricing
  P1-5  → Recommendations + staff feedback
  P1-6  → Chatbot + staffing prediction
  P1-8  → Floor layout designer
  P2-5  → Owner customer CRM
  P2-9  → Loyalty config page
  P3-4  → Customer bookings + orders profile pages
  P3-5  → Staff role dashboards
  P3-6  → Delivery active page + online toggle
  P3-7  → PaymentModal with Razorpay

POLISH (production readiness):
  P2-13 → Enhanced white-label branding
  P2-15 → Error boundaries
  P2-16 → Rate limiting hardening
  P3-8  → Production cleanup
  P3-9  → Constants + utils completeness
  P3-10 → Type safety audit
  P3-12 → Final SQL verification
  P3-13 → Restaurant page AI integration
  P3-14 → Manager dashboard AI integration
  P3-15 → Final wiring sync
```

---

*Restaurant OS — Implementation Prompt Library PART 3 (Final)*
*Priyanshu Kumar Gupta & Ronit Gupta | Deep Analysis — All Gaps Closed | 2025*
*73 total prompts across 3 parts — every prompt returns production-grade working code*
