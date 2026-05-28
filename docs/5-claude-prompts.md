# 5 Claude Prompts — Codebase Fix Division

Each prompt is self-contained and can be pasted into a fresh Claude conversation along with the relevant zip upload. All prompts share this context block — paste it at the top of every conversation:

---

## Shared Context (paste at top of every prompt)

```
This is a full-stack restaurant management platform called DineLuxe.

Tech stack:
- Backend: Node.js + Express + TypeScript, Supabase (Postgres), Redis, Resend email
- Frontend: Next.js 14 (App Router), React Query (@tanstack/react-query), Tailwind CSS, Framer Motion, Recharts, Lucide icons
- Auth: JWT tokens stored in localStorage via lib/auth-storage.ts
- API client: lib/api-client.ts — use apiClient.get/post/patch/delete
- Shared components: PageWrapper, KPICard, DataTable, RouteShell, StatusBadge
- Stubs: Any page that only contains <RouteShell /> needs to be replaced with real implementation
- Pattern: Pages use useQuery() from @tanstack/react-query + apiClient, follow the pattern in app/admin/dashboard/page.tsx and app/owner/dashboard/page.tsx
```

---

## Prompt 1 — Admin Panel: Platform Health, Reports & Settings pages

**Paste with:** `frontend.zip`

```
I have a Next.js frontend for a restaurant SaaS platform. Three admin pages are stubs (they just render <RouteShell /> and do nothing). I need you to replace them with fully working implementations.

The working reference pattern to follow is app/admin/dashboard/page.tsx and app/admin/restaurants/page.tsx — they use:
- "use client" directive
- useQuery from @tanstack/react-query
- apiClient from @/lib/api-client
- PageWrapper from @/components/layout/PageWrapper
- KPICard from @/components/shared/KPICard
- Recharts for charts
- Framer Motion for animations (motion.div, AnimatePresence)
- Lucide icons

Files to implement (currently stubs with just <RouteShell />):

1. app/admin/platform-health/page.tsx
   - Calls GET /admin/health (public) and GET /admin/health/detailed (admin JWT)
   - API returns: { status, db_latency_ms, redis_latency_ms, timestamp, redis_hit_rate_percent, db_metrics }
   - Show: overall status badge (ok/degraded), DB latency gauge, Redis latency gauge, Redis cache hit rate, auto-refresh every 30s, last-checked timestamp
   - If status === "degraded" show a red AlertBanner at the top

2. app/admin/reports/page.tsx
   - Calls GET /reports/platform (admin JWT) — returns revenue_total, orders_total, avg_order_value, period breakdowns
   - Calls GET /analytics/overview (admin JWT)
   - Show: date-range selector (7d / 30d / 90d), KPI cards row, a LineChart of daily revenue, a BarChart of orders by day, an export CSV button (download JSON as CSV client-side)

3. app/admin/settings/page.tsx
   - Super-admin account settings page
   - GET /users/me to load current profile
   - PATCH /users/me to save changes (name, phone fields only)
   - Show: profile form (name, email read-only, phone), save button with loading state, success toast via sonner
   - Section for "Change password": old_password, new_password, confirm fields → POST /auth/change-password

For each file write the complete replacement page.tsx. Use the exact same visual style as the existing admin pages (dark navy #1A3C5E primary, amber #E8A020 accent, white cards with shadow-sm, rounded-lg borders).
```

---

## Prompt 2 — Owner Panel: Staff CRUD, Shifts & Customer pages

**Paste with:** `frontend.zip`

```
I have a Next.js frontend for a restaurant SaaS platform. Several owner-panel pages are stubs (just <RouteShell />) or incomplete. I need full implementations.

Reference pattern: app/owner/dashboard/page.tsx and components/owner/StaffManagement.tsx.
- "use client" with useQuery / useMutation from @tanstack/react-query
- apiClient from @/lib/api-client
- useAuth from @/hooks/useAuth (gives user.branch_id, user.restaurant_id)
- PageWrapper, KPICard, DataTable from shared components

Files to implement:

1. app/owner/staff/new/page.tsx  (currently stub)
   - Form to create a new staff member
   - Fields: first_name, last_name, email, phone, role (select: waiter/chef/cashier/host/manager), branch_id (pre-filled from useAuth)
   - POST /staff with { first_name, last_name, email, phone, role, branch_id }
   - On success: toast "Staff member created" + redirect to /owner/staff
   - Show PasswordStrengthMeter component from @/components/auth/PasswordStrengthMeter for a generated temp password field

2. app/owner/staff/[staffId]/page.tsx  (currently stub)
   - Staff detail / edit page
   - GET /staff/:staffId → load staff record
   - PATCH /staff/:staffId → save changes (name, phone, role)
   - PATCH /staff/:staffId/toggle-access → toggle is_active (button: "Suspend" / "Reactivate")
   - Show: staff info card, edit form, access toggle button, back link to /owner/staff

3. app/owner/shifts/page.tsx  (currently stub)
   - Shift schedule view for the branch
   - GET /staff/branch/:branchId (use user.branch_id from useAuth)
   - Display a weekly calendar grid (Mon–Sun × staff rows) with shift blocks
   - Each cell shows shift start–end time if a shift exists, else empty
   - "Add shift" button per cell opens a small modal: staff_id (pre-filled), date, start_time, end_time → POST /staff/:staffId/shifts
   - Use a simple HTML table for the grid (no external calendar lib)

4. app/owner/customers/page.tsx  (currently stub)
   - Customer list for this restaurant
   - GET /users?role=customer&restaurant_id=:restaurantId (use user.restaurant_id from useAuth)
   - Show DataTable with columns: name, email, phone, created_at, is_active
   - Filter bar: search by name/email, filter by active/inactive
   - Click row → show a side sheet with full profile + order count

5. app/owner/branches/[branchId]/hours/page.tsx  (currently stub)
   - Operating hours editor for a branch
   - GET /branches/:branchId → load branch.operating_hours (JSON: { mon: {open, close, closed}, tue: ..., ... })
   - PATCH /branches/:branchId with { operating_hours: {...} } to save
   - Show a form with one row per day (Monday–Sunday): day label, "Closed" toggle, open time input, close time input
   - Save button with loading state, success toast

Write the complete file for each. Match the existing owner panel style (same Tailwind classes, navy primary, white cards).
```

---

## Prompt 3 — Staff Portals: Waiter, Host, Manager & Cashier stub pages

**Paste with:** `frontend.zip`

```
I have a Next.js frontend for a restaurant SaaS platform. The staff portal has many stub pages (just <RouteShell />) that need real implementations.

Auth context: useAuth() gives { user: { id, role, branch_id, restaurant_id } }.
API client: apiClient from @/lib/api-client.
Reference page: app/staff/chef/kitchen/page.tsx — well-implemented kitchen display.
Realtime hook: useRealtime from @/hooks/useRealtime (joins a socket room for live updates).
Table status hook: useTableStatus from @/hooks/useTableStatus (use branchId).

Files to implement:

1. app/staff/waiter/tables/page.tsx
   - Waiter's table view for their assigned branch
   - GET /branch/:branchId/tables?status=occupied — list tables waiter is responsible for
   - Show a card grid: each card = table number, status badge, current order summary (items count, total), "View Order" button
   - "View Order" navigates to /staff/waiter/order/:tableId
   - Real-time updates via useRealtime({ room: `branch:${branchId}`, role: "waiter" }) listening for "table:status" events

2. app/staff/waiter/order/[tableId]/page.tsx
   - Waiter order management for a specific table
   - GET /tables/:tableId/current-order → load current order
   - Show: order items list (name, qty, status), "Add Items" section with menu search (GET /menu/items?branch_id=:branchId)
   - POST /orders/:orderId/items to add items
   - PATCH /orders/:orderId/items/:itemId with { quantity } to update
   - "Request Payment" button → POST /orders/:orderId/payment with { method: "cash" }
   - Status badges on each item: pending/preparing/ready/served

3. app/staff/waiter/performance/page.tsx
   - Waiter's own performance metrics
   - GET /staff/:staffId/performance → { orders_served, avg_rating, tips_collected, tables_turned }
   - Show KPI cards + a simple bar chart (orders per day last 7 days using Recharts)

4. app/staff/host/queue/page.tsx
   - Host queue management board
   - GET /queue/branch/:branchId → list of queue entries
   - Show QueueEntryCard components from @/components/queue/QueueEntryCard
   - Each card has: guest name, party size, wait time, status, buttons: "Mark Arrived" (PATCH /queue/:id/arrive), "Assign Table" (opens table selector modal → PATCH /queue/:id/assign-table), "No Show" (PATCH /queue/:id/no-show)
   - Auto-refresh every 15s with useQuery refetchInterval

5. app/staff/host/floor/page.tsx
   - Host floor map view
   - Render FloorMap component from @/components/floor/FloorMap, passing branchId from useAuth
   - Add a legend: available (green), occupied (red), cleaning (yellow), reserved (blue)
   - Table click opens a sidebar: table details + "Change Status" dropdown (available/occupied/cleaning/reserved) → PATCH /tables/:tableId/status

6. app/staff/cashier/tables/page.tsx
   - Cashier's billing queue
   - GET /branch/:branchId/orders/active → orders needing payment
   - Show a list: table number, order total, items count, "Process Payment" button
   - "Process Payment" opens PaymentModal from @/components/payment/PaymentModal passing orderId

7. app/staff/manager/orders/page.tsx
   - Manager live orders overview
   - GET /orders/branch/:branchId?status=active (use user.branch_id)
   - Show OrderTicket cards from @/components/orders/OrderTicket, filterable by status (pending/preparing/ready/served/all)
   - PATCH /orders/:orderId/status to update status inline from the card

8. app/staff/manager/queue/page.tsx
   - Same as host queue but with additional manager controls
   - Same data source as host queue
   - Extra: "Clear Queue" button (DELETE /queue/branch/:branchId/clear, confirm dialog), aggregate stats bar (total waiting, avg wait, peak time)

9. app/staff/manager/staff-duty/page.tsx
   - Which staff are on duty right now
   - GET /staff/branch/:branchId?on_duty=true
   - Show a list grouped by role (waiters, chefs, hosts, cashiers)
   - Each row: name, role badge, start time, "Mark Off Duty" button → PATCH /staff/:staffId/duty with { on_duty: false }

10. app/staff/manager/menu-status/page.tsx
    - Quick item availability toggle for kitchen prep
    - GET /menu/items?branch_id=:branchId
    - Show a list with each item's name, category, and an "Available / Sold Out" toggle
    - PATCH /menu/items/:itemId with { is_available: boolean } on toggle

Write complete file for each. Use the same style as app/staff/chef/kitchen/page.tsx.
```

---

## Prompt 4 — Customer Portal: Stub pages (Receipt, Addresses, Favorites, Loyalty, Support, Gallery, Queue)

**Paste with:** `frontend.zip`

```
I have a Next.js frontend for a restaurant SaaS platform. The customer-facing portal has many stub pages (just <RouteShell />) that need real implementations.

Auth: useAuth() hook, apiClient from @/lib/api-client, Lucide icons, Tailwind CSS.
Style reference: match the mobile-first card style in app/customer/home/page.tsx or app/customer/booking/page.tsx.

Files to implement:

1. app/customer/order/[orderId]/receipt/page.tsx
   - GET /orders/:orderId → load order with items, total, payment info
   - Show a styled receipt: restaurant name (from order.restaurant_name), date/time, itemized list (name, qty, price), subtotal, tax, tip, grand total
   - "Download PDF" button — client-side: window.print() with a print-only CSS class that shows only the receipt div
   - "Rate Order" section: 1-5 star rating + optional text review → POST /reviews with { order_id, rating, comment }

2. app/customer/profile/addresses/page.tsx
   - Manage saved delivery addresses
   - GET /users/me/addresses
   - List existing addresses as cards with "Default" badge on the primary one
   - "Add Address" form: label, address_line1, city, pincode, set_as_default checkbox → POST /users/me/addresses
   - "Delete" button → DELETE /users/me/addresses/:addressId
   - "Set Default" button → PATCH /users/me/addresses/:addressId/default

3. app/customer/profile/favorites/page.tsx
   - Customer's saved restaurants + menu items
   - GET /users/me/favorites → { restaurants: [...], items: [...] }
   - Two tabs: "Restaurants" and "Items"
   - Show RestaurantCard from @/components/customer/RestaurantCard for restaurants
   - Show FoodCard from @/components/shared/FoodCard for items
   - Heart icon to unfavorite → DELETE /users/me/favorites/:type/:id

4. app/customer/profile/loyalty/page.tsx
   - Loyalty points dashboard
   - GET /loyalty/me → { points_balance, tier, next_tier, points_to_next, history: [...] }
   - Show: current tier badge (Bronze/Silver/Gold), points balance large number, progress bar to next tier
   - Points history table: date, description, points_earned/redeemed, balance

5. app/customer/profile/support/page.tsx
   - Customer support tickets
   - GET /support/me → list of tickets { id, subject, status, created_at }
   - "New Ticket" form: subject, category (select: order_issue/billing/other), message → POST /support
   - Ticket list with status badges (open/in_progress/resolved)
   - Click ticket → expand to show thread of messages, "Add Reply" textarea → POST /support/:ticketId/reply

6. app/customer/restaurant/[restaurantId]/gallery/page.tsx
   - Restaurant photo gallery
   - GET /restaurants/:restaurantId → load restaurant.gallery_images (array of URLs)
   - Show a responsive CSS grid of images (3 cols desktop, 2 cols mobile)
   - Click image → lightbox (simple modal showing the image full-size with prev/next navigation)
   - If no images: EmptyState component with message "No photos yet"

7. app/customer/restaurant/[restaurantId]/queue/page.tsx
   - Customer queue join + status view
   - If not in queue: form to join — party_size (1-10) selector → POST /queue with { branch_id, people_count }
   - If in queue: show queue position, estimated wait time, status badge
   - Poll GET /queue/:queueId every 10s for live updates (useQuery refetchInterval)
   - "Leave Queue" button → DELETE /queue/:queueId

Write complete file for each. Mobile-first design. Use framer-motion AnimatePresence for tab/panel transitions.
```

---

## Prompt 5 — Backend: Missing/Incomplete Service Functions + Frontend First-Login & Auth Onboarding

**Paste with:** `backend.zip` and `frontend.zip`

```
I have a full-stack restaurant platform. This task covers two backend gaps and two frontend stubs.

---
BACKEND — file: backend/src/hooks/useQueueStatus.ts is actually a frontend hook but was written as a placeholder. More importantly, fix these backend gaps:

1. backend/src/modules/delivery/delivery.service.ts
   The service has assignDelivery, updateLocation, updateStatus already.
   MISSING functions needed by delivery.controller.ts:
   - getDeliveryStatus(deliveryId: string) — GET single delivery with partner info
   - getActiveDeliveriesForBranch(branchId: string) — list all active deliveries for a branch
   - completeDelivery(deliveryId: string) — set status to 'delivered', update partner.active_delivery_id = null
   
   Add these three functions to the file, following the same Supabase pattern.

2. backend/src/modules/loyalty/loyalty.service.ts
   Check the file — some functions are likely stubs. Add any missing:
   - getCustomerLoyalty(userId: string) — get points_balance, tier, next_tier, history
   - awardPoints(userId: string, orderId: string, amount: number) — calculate and award points (1 point per ₹10 spent), insert into loyalty_transactions
   - redeemPoints(userId: string, points: number, orderId: string) — deduct points, validate sufficient balance
   
   Match the existing code style in the file.

3. backend/src/modules/analytics/analytics.service.ts
   The admin analytics endpoint needs a getRestaurantAnalytics(restaurantId, period) function that queries:
   - revenue totals (sum of payments.amount grouped by day)
   - order counts (grouped by day)
   - avg order value
   - top items by order count
   Return shape: { revenue_by_day: [{date, amount}], orders_by_day: [{date, count}], avg_order_value, top_items: [{name, count}] }
   If this function already exists, verify it's complete and fix any obvious bugs.

---
FRONTEND — files in frontend/frontend/app:

4. app/first-login/page.tsx  (currently stub)
   - First login password change screen for staff who were created by owner/admin
   - The existing component for this logic is: components/auth/FirstLoginForm.tsx — just render it
   - Show a centered card with the form, no sidebar/nav (staff haven't fully logged in yet)
   - Style: full-screen centered layout, navy brand color header "Welcome — Please set your password"

5. app/auth/onboarding/page.tsx and steps 2–5  (all stubs)
   - These are the restaurant owner multi-step onboarding wizard
   - The wizard component already exists: components/auth/RestaurantSignupWizard.tsx
   - app/auth/onboarding/page.tsx → render <RestaurantSignupWizard initialStep={1} />
   - app/auth/onboarding/step-2/page.tsx → render <RestaurantSignupWizard initialStep={2} />
   - app/auth/onboarding/step-3/page.tsx → render <RestaurantSignupWizard initialStep={3} />
   - app/auth/onboarding/step-4/page.tsx → render <RestaurantSignupWizard initialStep={4} />
   - app/auth/onboarding/step-5/page.tsx → render <RestaurantSignupWizard initialStep={5} />
   - Each page is just a thin wrapper — the wizard component handles all state and navigation internally

6. app/auth/signup/step-2/page.tsx and step-3/page.tsx  (stubs)
   - Customer signup wizard steps
   - The wizard: components/auth/SignupWizard.tsx
   - app/auth/signup/step-2/page.tsx → render <SignupWizard initialStep={2} />
   - app/auth/signup/step-3/page.tsx → render <SignupWizard initialStep={3} />

For all backend additions, follow the exact same import/style pattern already in the file. For frontend, write minimal thin wrapper pages — the heavy logic is already in the components.
```

---

## Summary of what each prompt covers

| Prompt | Area | Key files |
|--------|------|-----------|
| 1 | Admin pages | platform-health, reports, settings |
| 2 | Owner panel | staff CRUD, shifts, customers, branch hours |
| 3 | Staff portals | waiter (3), host (2), cashier (1), manager (4) = 10 pages |
| 4 | Customer portal | receipt, addresses, favorites, loyalty, support, gallery, queue = 7 pages |
| 5 | Backend gaps + auth stubs | delivery/loyalty/analytics services + first-login + onboarding wizard pages |

**Total:** ~35 stub pages replaced + 3 backend service gaps filled.
