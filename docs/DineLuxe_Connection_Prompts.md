# DineLuxe — Full Backend ↔ Frontend Connection Prompts
## How to Use This Guide
Each **Profile** below is a self-contained prompt. Paste the entire block (including all the context inside it) into a **fresh Claude conversation**, one profile at a time. Claude will fix that slice of the integration cleanly.

Work **top to bottom** — later profiles sometimes depend on patterns established in earlier ones.

---

## Architecture Summary (read once, not a prompt)

| Layer | Stack |
|---|---|
| Backend | Node/Express + TypeScript, `/api/v1` prefix, JWT auth (custom, not Supabase session), Prisma + Supabase Postgres, Redis, Socket.io |
| Frontend | Next.js 14 App Router, TailwindCSS, `@tanstack/react-query`, `apiClient` wrapper in `lib/api-client.ts` |
| Auth flow | Custom JWT: `POST /auth/login` → `{accessToken, refreshToken}` stored in localStorage + cookies. Every protected request sends `Authorization: Bearer <accessToken>`. Refresh via `POST /auth/refresh`. |
| Shared | `@repo/shared` package with types (`ApiResponse<T>`, `ApiError`, enums) |

The `apiClient` in `lib/api-client.ts` already handles auth headers, 401 retry with refresh, and error throwing. **All fetch calls in the frontend must go through `apiClient`, never raw `fetch`.**

---

---

## PROFILE 1 — Environment & API Client Foundation

**Paste this entire block into Claude:**

```
I have a Next.js 14 (App Router) frontend and an Express/TypeScript backend for a restaurant SaaS called DineLuxe. The backend runs at a URL stored in NEXT_PUBLIC_API_URL and exposes all routes under /api/v1.

My frontend has a central API client at lib/api-client.ts that:
- Reads NEXT_PUBLIC_API_URL and normalises it so all calls go to /api/v1/*
- Attaches Authorization: Bearer <accessToken> from localStorage (key: "dineluxe_access_token")
- On 401 response, attempts a token refresh via POST /auth/refresh with the refreshToken (key: "dineluxe_refresh_token") before retrying once
- Throws ApiError (from @repo/shared) on any non-2xx

TASK 1 — .env files
Create two .env files with clear placeholders and comments:

backend/.env.example:
  NODE_ENV=development
  PORT=4000
  DATABASE_URL=postgresql://...
  SUPABASE_URL=https://<project>.supabase.co
  SUPABASE_SERVICE_KEY=<service-role key>
  SUPABASE_JWT_SECRET=<jwt-secret from supabase dashboard>
  REDIS_URL=redis://localhost:6379
  FRONTEND_URL=http://localhost:3000
  FRONTEND_URLS=http://localhost:3000
  RESEND_API_KEY=re_...
  RAZORPAY_KEY_ID=rzp_test_...
  RAZORPAY_KEY_SECRET=...

frontend/.env.local.example:
  NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
  NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

TASK 2 — Verify api-client.ts is production-ready
The current lib/api-client.ts normalises the base URL, injects auth headers, and retries on 401. Ensure:
  a) If NEXT_PUBLIC_API_URL is undefined it falls back to "/api/v1" (relative, for same-host deploys)
  b) On refresh failure it calls clearAuthTokens() and redirects to /auth/login using window.location.href (not Next router, to break any render loop)
  c) The exported apiClient object has: get<T>(path), post<T>(path, body), patch<T>(path, body), put<T>(path, body), delete<T>(path)
  d) Add a helper: apiClient.postForm<T>(path, formData: FormData) that sends FormData without Content-Type header (browser sets multipart boundary automatically)

TASK 3 — CORS
In backend/src/config/cors.ts ensure:
  - The allowedOrigins list is built from FRONTEND_URLS (comma-separated) and FRONTEND_URL env vars
  - credentials: true is set
  - Methods include GET, POST, PUT, PATCH, DELETE, OPTIONS
  - Headers include Authorization, Content-Type, X-Requested-With

Show me the final versions of both files.
```

---

## PROFILE 2 — Auth: Login, Signup, OTP, Refresh, Logout

**Paste this entire block into Claude:**

```
I am connecting the auth flows in a DineLuxe Next.js frontend to an Express backend.

BACKEND AUTH ENDPOINTS (already built, do NOT change routes):
  POST /api/v1/auth/signup      body: { email, password, firstName, lastName, phone? }
                                returns: { accessToken, refreshToken, verification_pending: bool }
  POST /api/v1/auth/verify-otp  body: { email, otp }  returns: { accessToken, refreshToken }
  POST /api/v1/auth/login       body: { email, password }  returns: { accessToken, refreshToken }
  POST /api/v1/auth/logout      (authenticated)
  POST /api/v1/auth/refresh     body: { refreshToken }  returns: { accessToken, refreshToken }
  POST /api/v1/auth/forgot-password  body: { email }
  POST /api/v1/auth/reset-password   body: { email, otp, newPassword }
  POST /api/v1/auth/change-password  (authenticated) body: { currentPassword, newPassword }
  POST /api/v1/auth/send-otp    body: { email }
  GET  /api/v1/auth/check-email?email=...   returns: { exists: bool }

FRONTEND FILES (current state):
  - lib/auth-client.ts   — already calls apiClient correctly for all auth flows
  - lib/auth-storage.ts  — stores tokens in localStorage + cookie (key: "dineluxe_access_token")
  - hooks/useAuth.ts     — calls GET /api/v1/users/me on mount to hydrate user state
  - components/auth/LoginForm.tsx
  - components/auth/SignupWizard.tsx
  - components/auth/OTPInput.tsx
  - components/auth/ForgotPasswordForm.tsx

TASKS:

1. components/auth/LoginForm.tsx
   - On submit call: import { login } from "@/lib/auth-client"
   - After success, get user from result. Route based on role:
       admin → /admin/dashboard
       owner → /owner/dashboard
       manager → /staff/manager
       waiter → /staff/waiter
       cashier → /staff/cashier
       host → /staff/host
       chef → /staff/chef
       customer → /customer/home
       delivery → /delivery
   - Show error message from ApiError.message under the form
   - Disable button and show spinner while loading

2. components/auth/SignupWizard.tsx (customer self-registration)
   - Step 1: collect firstName, lastName, email, phone, password, confirmPassword
   - On submit call: import { signup } from "@/lib/auth-client"
   - If response.verification_pending === true → redirect to /auth/verify-otp?email=<email>
   - Else → redirect to /customer/home

3. app/auth/verify-otp/page.tsx
   - Read ?email= from searchParams
   - Use OTPInput component (6 boxes)
   - On submit call: import { verifyOtp } from "@/lib/auth-client"
   - Show resend link that calls: import { resendSignupOtp } from "@/lib/auth-client"
   - After verify success redirect to role-based route (same map as login)

4. app/auth/forgot-password/page.tsx and app/auth/reset-password/page.tsx
   - Forgot: POST /auth/forgot-password with email, then show "Check your email" state
   - Reset: collect email + OTP + newPassword, call resetPassword from auth-client, redirect to /auth/login

5. hooks/useAuth.ts
   - Confirm it exports: { user, role, isAuthenticated, loading, logout, restaurantId, branchId }
   - logout() must call: import { logout as authLogout } from "@/lib/auth-client" then redirect to /auth/login
   - Expose setUser(user) for external hydration after OTP verify

Show me the complete updated file for each task above.
```

---

## PROFILE 3 — Middleware: Auth Guard & Role-Based Route Protection

**Paste this entire block into Claude:**

```
I have a Next.js 14 App Router frontend for DineLuxe. I need a robust middleware.ts that protects routes.

AUTH STORAGE: 
  Access token is stored as cookie named "dineluxe_access_token" (set by lib/auth-storage.ts with path=/, SameSite=Lax).
  Middleware reads this cookie to decide if user is authenticated.
  The actual role comes from GET /api/v1/users/me — middleware cannot call the backend (edge runtime), so it must rely on a separate "userRole" cookie OR a decoded JWT claim.

DECISION: Since the backend signs JWTs with SUPABASE_JWT_SECRET, add a second lightweight cookie "dineluxe_user_role" (value = role string, e.g. "owner") written by lib/auth-storage.ts whenever setAuthTokens is called. The middleware reads both cookies.

ROUTE PROTECTION MAP:
  /admin/*       → requires role: admin
  /owner/*       → requires role: owner
  /staff/*       → requires role: manager | waiter | cashier | host | chef
  /delivery/*    → requires role: delivery
  /customer/*    → requires role: customer
  /auth/*        → public (redirect to dashboard if already authenticated)
  /              → public
  /api/*         → always pass through (backend handles its own auth)

TASKS:

1. Update lib/auth-storage.ts
   - In setAuthTokens(), also write cookie "dineluxe_user_role" with value tokens.role (add role to AuthTokens type if missing, OR fetch role separately after login and call a new setUserRole(role) function)
   - Actually simpler: export function setUserRole(role: string) { setCookie("dineluxe_user_role", role, REFRESH_TOKEN_MAX_AGE) }
   - In clearAuthTokens() also call clearCookie("dineluxe_user_role")

2. Update lib/auth-client.ts
   - After login() gets the tokens back, call GET /api/v1/users/me to get the profile, then call setUserRole(profile.role)
   - Same after verifyOtp()

3. Create middleware.ts at root:
   - Use NextResponse from next/server
   - Read request.cookies.get("dineluxe_access_token")?.value and request.cookies.get("dineluxe_user_role")?.value
   - If accessing protected route without access token → redirect to /auth/login?redirect=<currentPath>
   - If accessing protected route with wrong role → redirect to their correct dashboard
   - If accessing /auth/* WITH access token → redirect to correct dashboard
   - Export config.matcher to cover all routes except _next/static, _next/image, favicon.ico, and /api/*

4. In each role-based layout file (app/owner/layout.tsx, app/admin/layout.tsx, app/customer/layout.tsx, etc.), add a client-side guard using useAuth():
   - If !loading && !isAuthenticated → redirect to /auth/login
   - If !loading && role !== expectedRole → redirect to correct dashboard
   - While loading → show a centered spinner

Show me all updated files with full code.
```

---

## PROFILE 4 — Restaurant & Branch APIs (Owner Panel)

**Paste this entire block into Claude:**

```
I need to connect the Owner Panel frontend pages to the DineLuxe backend. All API calls use apiClient from "@/lib/api-client". All backend routes are under /api/v1. Owner JWT contains restaurant_id and branch_id claims.

BACKEND ENDPOINTS:
  Restaurants:
    GET  /restaurants/:id               → public, get restaurant by id
    PATCH /restaurants/:id              → owner auth, update restaurant info
    GET  /restaurants/:id/live-status   → public

  Branches:
    GET  /branches                      → owner auth, list own branches
    POST /branches                      → owner auth, create branch body: { name, address, city, phone, lat?, lng?, capacity?, opening_time?, closing_time? }
    GET  /branches/:id                  → owner/manager auth
    PATCH /branches/:id                 → owner/manager auth
    GET  /branches/:id/live-stats       → owner/manager auth, returns { tables_total, tables_occupied, queue_length, active_orders }
    PATCH /branches/:id/status          → owner auth, body: { is_active: bool }

  Branding:
    GET  /restaurants/:id/branding      → public
    PUT  /restaurants/:id/branding      → owner auth, body: { primary_color, secondary_color, logo_url, banner_url, tagline }

FRONTEND PAGES TO FIX:

1. app/owner/branches/page.tsx
   - Fetch: apiClient.get<Branch[]>("/branches")
   - Show each branch as a card with name, address, status badge, live-stats
   - "Edit" button → /owner/branches/:id/edit
   - "View" button → /owner/branches/:id
   - "Add Branch" button → /owner/branches/new

2. app/owner/branches/new/page.tsx
   - Form with fields: name, address, city, phone, capacity, opening_time, closing_time
   - On submit: apiClient.post("/branches", formData)
   - On success redirect to /owner/branches

3. app/owner/branches/[branchId]/page.tsx
   - Fetch branch: apiClient.get<Branch>(`/branches/${branchId}`)
   - Fetch live stats: apiClient.get<LiveStats>(`/branches/${branchId}/live-stats`) — refetch every 30s
   - Display stats as KPI cards: Tables Occupied, Queue Length, Active Orders

4. app/owner/branches/[branchId]/edit/page.tsx
   - Pre-fill form from GET /branches/:id
   - On submit: apiClient.patch(`/branches/${branchId}`, changes)

5. app/owner/branding/page.tsx
   - Get restaurantId from useAuth() hook
   - Fetch: apiClient.get(`/restaurants/${restaurantId}/branding`)
   - Form: primary_color (color picker), secondary_color, logo_url (text), tagline
   - Save: apiClient.put(`/restaurants/${restaurantId}/branding`, data)

For all pages:
  - Use @tanstack/react-query useQuery for fetches, useMutation for writes
  - Show loading skeleton (use existing SkeletonCard component)
  - Show error with retry button
  - Show success toast on mutation success (use window.alert or a toast library already in the project)
  - TypeScript types for all API responses

Show me the complete code for each page.
```

---

## PROFILE 5 — Menu Management (Owner Panel)

**Paste this entire block into Claude:**

```
I need to wire up the menu management pages in the DineLuxe owner panel to the live backend.

BACKEND ENDPOINTS:
  GET  /menu/branch/:branchId              → public, returns { categories: [{id, name, items:[{id,name,price,description,image_url,is_available,dietary_tags}]}] }
  GET  /menu/branch/:branchId/categories   → owner/manager auth
  POST /menu/categories                    → owner/manager auth, body: { name, branch_id, sort_order? }
  PATCH /menu/categories/:id              → owner/manager auth, body: { name?, sort_order? }
  DELETE /menu/categories/:id             → owner/manager auth
  PATCH /menu/categories/reorder          → owner/manager auth, body: { categories: [{id, sort_order}] }
  
  GET  /menu/items/:id                     → public
  POST /menu/items                         → owner/manager auth, body: { name, price, description?, image_url?, category_id, branch_id, dietary_tags?, prep_time_minutes? }
  PATCH /menu/items/:id                   → owner/manager auth
  PATCH /menu/items/:id/status            → owner/manager auth, body: { is_available: bool }
  DELETE /menu/items/:id                  → owner/manager auth
  PATCH /menu/items/bulk-price-update     → owner/manager auth, body: { item_ids: string[], price_delta: number, type: "fixed"|"percentage" }

FRONTEND:
  useAuth() gives: { restaurantId, branchId, role }
  components/owner/MenuManagement.tsx is the main component used in the dashboard page

TASKS:

1. Rewrite components/owner/MenuManagement.tsx to be fully wired:
   - State: selectedBranchId (default to branchId from useAuth)
   - Fetch categories: GET /menu/branch/:branchId/categories
   - Render accordion: each category shows its items
   - "Add Category" button → inline form, POST /menu/categories
   - "Delete Category" icon → DELETE /menu/categories/:id with confirm dialog
   - Within each category show items as rows with: name, price, status toggle (PATCH /menu/items/:id/status), edit icon, delete icon

2. app/owner/menu/items/new/page.tsx
   - Form: name, description, price (number), category (select from GET /menu/branch/:branchId/categories), dietary_tags (checkboxes: veg, vegan, gluten-free), prep_time_minutes, image_url
   - Submit: POST /menu/items with { ...fields, branch_id: branchId }
   - Redirect to /owner/menu/items on success

3. app/owner/menu/items/[itemId]/edit/page.tsx
   - Pre-fill from GET /menu/items/:id
   - Submit: PATCH /menu/items/:itemId
   - Delete button → DELETE /menu/items/:itemId then redirect

4. app/owner/menu/categories/page.tsx
   - Show categories in a drag-sortable list (use @dnd-kit or simple up/down buttons)
   - On reorder: PATCH /menu/categories/reorder with updated sort_orders
   - Add/Edit/Delete inline

Use React Query useMutation with onSuccess invalidating the categories query.
Show full TypeScript code for each file.
```

---

## PROFILE 6 — Staff Management (Owner Panel)

**Paste this entire block into Claude:**

```
Wire up staff management pages in the DineLuxe owner panel.

BACKEND ENDPOINTS:
  GET  /staff/branch/:branchId            → manager/owner auth, returns staff array
  POST /staff/create                      → manager/owner auth
                                            body: { email, first_name, last_name, role, branch_id, phone? }
                                            roles allowed: manager | waiter | cashier | host | chef | delivery
  GET  /staff/:id                         → manager/owner auth
  PATCH /staff/:id                        → manager/owner auth, body: { first_name?, last_name?, role?, phone? }
  PATCH /staff/:id/toggle-access          → manager/owner auth, toggles is_active

FRONTEND:
  useAuth() gives branchId and restaurantId.

TASKS:

1. Rewrite components/owner/StaffManagement.tsx:
   - Fetch: GET /staff/branch/:branchId using useQuery
   - Render DataTable (use existing DataTable component) with columns: Name, Role (RoleBadge), Status (active/inactive toggle), Actions
   - "Add Staff" button opens a modal/slide-over with the create form
   - Toggle access: PATCH /staff/:id/toggle-access, optimistic update
   - Role filter dropdown above table

2. Staff Create Form (modal inside StaffManagement):
   - Fields: first_name, last_name, email, phone, role (select: manager/waiter/cashier/host/chef/delivery)
   - branch_id is auto-filled from branchId
   - POST /staff/create
   - On 409 conflict show "Email already exists" error

3. Staff Edit modal:
   - PATCH /staff/:id for name/phone/role changes
   - Show current employee_id (read-only) and joining date

All mutations use useMutation + invalidate staff query on success.
Show full code.
```

---

## PROFILE 7 — Customer: Restaurant Discovery & Menu Browsing

**Paste this entire block into Claude:**

```
Wire up the customer-facing restaurant and menu pages in DineLuxe (Next.js frontend → Express backend).

BACKEND ENDPOINTS:
  GET /restaurants/nearby?lat=&lng=&radius=   → public, returns Restaurant[]
  GET /restaurants/:id                         → public, returns Restaurant with branches[]
  GET /restaurants/:id/live-status            → public, returns { is_open, queue_length, wait_minutes }
  GET /menu/branch/:branchId                  → public, returns { categories:[{id,name,items:[...]}] }
  GET /menu/branch/:branchId/items?limit=5    → public, returns items[]

TYPES TO USE:
  Restaurant: { id, name, description, logo_url, banner_url, cuisine_type, avg_rating, total_reviews, branches: Branch[] }
  Branch: { id, name, address, city, phone, lat, lng, opening_time, closing_time, is_active }

TASKS:

1. app/customer/home/page.tsx — already has structure, fix the data fetching:
   - GET /restaurants/nearby using browser geolocation (navigator.geolocation.getCurrentPosition)
     If geolocation denied, fall back to GET /restaurants/nearby?lat=20.5937&lng=78.9629&radius=50 (India center)
   - Show restaurants as RestaurantCard components (already exists in components/customer/RestaurantCard.tsx)
   - Featured items section: use branchId from useAuth(). If no branchId, skip this section.
   - Active orders: GET /orders/user/me?status=active — show progress bar for each
   - Loyalty points: GET /loyalty/me → show points badge

2. app/customer/restaurant/[restaurantId]/page.tsx:
   - Fetch restaurant: GET /restaurants/:restaurantId
   - Fetch live status: GET /restaurants/:restaurantId/live-status (refetch every 30s)
   - Show: banner image (or gradient), name, cuisine, rating, open/closed badge, wait time
   - Tab bar: Menu | Reviews | Info
   - Menu tab: fetch GET /menu/branch/:branchId (use first active branch from restaurant.branches)
   - Render categories with horizontal scroll for category nav, vertical list of FoodCard items
   - "Add to Cart" on FoodCard should call addItem from useCart hook

3. app/customer/menu/page.tsx (standalone menu, when user is at a restaurant via QR):
   - branchId from useAuth() or from ?branchId= query param
   - Fetch full menu: GET /menu/branch/:branchId
   - Category sticky nav, item cards with Add/Remove quantity controls
   - Cart FAB showing item count and total — links to /customer/order/cart

4. useCart hook (hooks/useCart.ts — already exists, verify it):
   - Stores { items:[{id, name, price, quantity, image_url}], branchId } in localStorage key "dineluxe_cart"
   - Exposes: addItem(item), removeItem(id), updateQty(id, qty), clearCart(), total, itemCount

Show full updated code for all files.
```

---

## PROFILE 8 — Customer: Cart, Orders & Payment

**Paste this entire block into Claude:**

```
Wire up the cart, ordering and payment flow for DineLuxe customers.

BACKEND ENDPOINTS:
  POST /orders                  → authenticated customer/waiter
                                  body: { branch_id, table_id?, items:[{menu_item_id, quantity, notes?}], order_type: "dine-in"|"takeaway"|"delivery", notes? }
                                  returns: Order with id

  GET  /orders/user/me          → customer auth, returns Order[] (optionally ?status=active)
  GET  /orders/:id              → any auth, returns Order with items and status
  POST /payments/initiate       → customer auth
                                  body: { order_id, payment_method: "cash"|"card"|"upi" }
                                  returns: { payment_id, razorpay_order_id?, amount, currency }
  
  (Razorpay webhook handled on backend; frontend just polls order status after payment)

ORDER STATUS FLOW: pending → confirmed → preparing → ready → served → completed | cancelled

TASKS:

1. app/customer/order/cart/page.tsx:
   - Read cart from useCart()
   - Show CartItem components with qty controls
   - Order summary: subtotal, tax (5%), total
   - "Place Order" button: POST /orders with { branch_id: cart.branchId, items: cart.items.map(i=>({menu_item_id:i.id, quantity:i.quantity})), order_type:"dine-in" }
   - On success: clearCart(), redirect to /customer/order/:orderId

2. app/customer/order/[orderId]/page.tsx:
   - Fetch: GET /orders/:orderId, refetch every 10s (or use useOrderStatus hook)
   - Show progress stepper: Placed → Confirmed → Preparing → Ready → Served
   - Show order items list with prices
   - If status === "ready" show "Pay Now" button → /customer/payment/:orderId

3. app/customer/payment/[orderId]/page.tsx:
   - Fetch order: GET /orders/:orderId
   - Show order total
   - Payment method selector: Cash / Card / UPI
   - On "Pay": POST /payments/initiate → { order_id, payment_method }
   - For UPI: show QR or payment link from response
   - For Cash: show "Pay at counter" confirmation
   - Poll GET /orders/:orderId every 5s until status changes, then redirect to /customer/payment/success?orderId=:id

4. app/customer/payment/success/page.tsx:
   - Read orderId from searchParams
   - Show success animation (use Lottie or simple CSS)
   - Display order summary from GET /orders/:orderId
   - Buttons: "View Order" → /customer/order/:orderId | "Back to Home" → /customer/home

5. app/customer/order/history/page.tsx:
   - Fetch: GET /orders/user/me (all statuses)
   - List with StatusBadge, date, total, "Reorder" button
   - "Reorder" puts same items back in cart and redirects to cart

Show full code for all files.
```

---

## PROFILE 9 — Customer: Booking & Queue

**Paste this entire block into Claude:**

```
Wire up table booking and walk-in queue pages for DineLuxe customers.

BACKEND ENDPOINTS:
  POST /bookings                          → customer auth
                                            body: { branch_id, people_count, booking_date (ISO), booking_time (HH:mm), notes? }
                                            returns: Booking

  GET  /bookings/user/me                  → customer auth, returns Booking[]
  GET  /bookings/:id                      → any auth, returns Booking
  PATCH /bookings/:id/cancel              → customer auth, body: { reason? }

  POST /queue                             → customer auth
                                            body: { branch_id, people_count }
                                            returns: QueueEntry with { position, estimated_wait_minutes }
  GET  /queue/branch/:branchId            → any auth (public queue board)
  GET  /queue/me?branch_id=              → customer auth, returns own QueueEntry if exists

TYPES:
  Booking: { id, branch_id, booking_date, booking_time, people_count, status: "pending"|"confirmed"|"seated"|"cancelled"|"no_show", notes? }
  QueueEntry: { id, position, people_count, status: "waiting"|"called"|"seated"|"no_show", estimated_wait_minutes }

TASKS:

1. app/customer/booking/page.tsx (new booking wizard):
   - Step 1: Pick restaurant/branch (show nearby from GET /restaurants/nearby or use current branch)
   - Step 2: Pick date (react-day-picker, allow only today + 30 days) and time (HH:mm selects)
   - Step 3: People count (1-20 stepper), special notes textarea
   - Step 4: Confirmation summary
   - On confirm: POST /bookings
   - On success: redirect to /customer/booking/:bookingId

2. app/customer/booking/[bookingId]/page.tsx:
   - Fetch: GET /bookings/:bookingId
   - Show: date, time, people count, status badge (StatusBadge)
   - "Cancel" button if status is pending/confirmed → PATCH /bookings/:id/cancel with confirm dialog

3. app/customer/booking/history/page.tsx:
   - Fetch: GET /bookings/user/me
   - Show list with date, time, branch, status badge
   - Link each to /customer/booking/:id

4. app/customer/restaurant/[restaurantId]/queue/page.tsx:
   - Show current queue: GET /queue/branch/:branchId (refetch every 30s)
   - Show user's own position: GET /queue/me?branch_id=:branchId
   - If user not in queue → "Join Queue" form (people_count input) → POST /queue
   - If user in queue → show position, estimated wait, "Leave Queue" button

5. app/customer/restaurant/[restaurantId]/book/page.tsx:
   - Shortcut booking page for a specific restaurant
   - Pre-fill branch_id from restaurant.branches[0].id
   - Same 4-step form as above but branch is pre-selected

Show full code.
```

---

## PROFILE 10 — Staff: Manager Dashboard & Floor Map

**Paste this entire block into Claude:**

```
Wire up the manager/host staff interfaces in DineLuxe.

BACKEND ENDPOINTS:
  GET /branches/:branchId/live-stats      → manager/owner auth
                                            returns: { tables_total, tables_occupied, queue_length, active_orders, revenue_today }

  GET /tables/branch/:branchId            → manager/waiter/host auth, returns Table[]
                                            Table: { id, table_number, capacity, status: "available"|"occupied"|"reserved"|"cleaning", floor, shape, x, y, width, height }

  GET /queue/branch/:branchId             → any auth, returns QueueEntry[]
  PATCH /queue/:id/arrive                 → host/manager auth
  PATCH /queue/:id/assign-table           → host/manager auth, body: { table_id }
  PATCH /queue/:id/no-show               → host/manager auth

  GET /bookings/branch/:branchId          → host/manager auth, ?date=today
  PATCH /bookings/:id/arrived            → host/manager auth
  PATCH /bookings/:id/seat               → host/manager auth
  PATCH /bookings/:id/no-show            → host/manager auth

  GET /orders/branch/:branchId/active    → manager/waiter auth, returns active Order[]
  GET /kitchen/branch/:branchId/tickets  → chef/manager auth, returns KitchenTicket[]

STAFF ROLES AND PAGES:
  manager → app/staff/manager/page.tsx
  host → app/staff/host/page.tsx (find this file path, or create if missing)

TASKS:

1. app/staff/manager/page.tsx (main manager dashboard):
   - Get branchId from useAuth()
   - KPI row: fetch live-stats every 30s → show Tables Occupied, Queue Length, Active Orders, Revenue Today
   - Floor map section: use FloorMap component (components/floor/FloorMap.tsx) with tables data
   - Active orders section: fetch /orders/branch/:branchId/active every 15s, show as OrderTicketCard
   - Event feed (right column): show queue entries and recent status changes

2. Find or create app/staff/host/page.tsx:
   - Queue board: GET /queue/branch/:branchId refetch every 20s
   - For each queue entry show: QueueEntryCard with position, name, people count, wait time, action buttons
     - "Arrived" → PATCH /queue/:id/arrive
     - "No Show" → PATCH /queue/:id/no-show
     - "Seat" → opens modal to pick available table → PATCH /queue/:id/assign-table { table_id }
   - Bookings column: GET /bookings/branch/:branchId?date=today
     - "Seated" → PATCH /bookings/:id/seat
     - "No Show" → PATCH /bookings/:id/no-show
   - Table map using FloorMap (read-only, shows which tables are occupied)

3. components/floor/FloorMap.tsx verification:
   - Confirm it accepts: tables: Table[], onTableClick?: (table: Table) => void, readOnly?: boolean
   - Table colors: available=green, occupied=red, reserved=yellow, cleaning=gray
   - If it's broken or missing these props, rewrite it

Use useQuery with appropriate refetchIntervals. All mutations invalidate relevant queries.
Show full code for all changed/created files.
```

---

## PROFILE 11 — Staff: Waiter, Chef (KDS) & Cashier

**Paste this entire block into Claude:**

```
Wire up waiter, chef, and cashier pages in DineLuxe staff portal.

BACKEND ENDPOINTS:
  Waiter:
    GET  /tables/branch/:branchId          → waiter auth, get tables
    GET  /orders/table/:tableId            → waiter auth, get current order for table
    POST /orders                           → waiter auth, create order (same body as customer)
    GET  /orders/staff                     → waiter auth, get own branch orders
    PATCH /orders/:id/cancel               → manager/owner only

  Chef (KDS):
    GET  /kitchen/branch/:branchId/tickets → chef/manager auth
                                             returns KitchenTicket[]: { id, order_id, items:[{name,qty,notes,status}], created_at, priority }
    PATCH /kitchen/orders/:orderId/status  → chef/manager auth, body: { status: "preparing"|"ready" }

  Cashier:
    GET  /orders/branch/:branchId/active   → cashier auth
    POST /payments/initiate                → cashier auth (same endpoint as customer)
    GET  /orders/:id                       → cashier auth

TASKS:

1. Find/create app/staff/waiter/page.tsx:
   - Left panel: Table grid from GET /tables/branch/:branchId — click a table to view its order
   - Right panel: Selected table's current order from GET /orders/table/:tableId
   - "New Order" on a table → mini order form: search menu items (GET /menu/branch/:branchId), add to draft, POST /orders
   - Show order status badge for each table's order

2. Find/create app/staff/chef/page.tsx (KDS — Kitchen Display System):
   - Dark theme (bg-gray-900 text-white — it's a KDS screen)
   - Fetch tickets: GET /kitchen/branch/:branchId/tickets every 15s
   - Show tickets in a grid: each is OrderTicketCard
   - Color coding: new=red border, preparing=yellow border, ready=green border
   - "Start" button → PATCH /kitchen/orders/:orderId/status { status:"preparing" }
   - "Ready" button → PATCH /kitchen/orders/:orderId/status { status:"ready" }
   - Sort by created_at ASC (oldest first)

3. Find/create app/staff/cashier/page.tsx:
   - Table of active orders (GET /orders/branch/:branchId/active)
   - Click row → expand with order details and total
   - Payment panel: method selector (Cash/Card/UPI) → POST /payments/initiate → confirm
   - "Print Receipt" button (just window.print() for now)

Show full code. Use useAuth() for branchId. Use React Query.
```

---

## PROFILE 12 — Inventory, Notifications & Reviews

**Paste this entire block into Claude:**

```
Wire up inventory management, customer reviews, and notifications in DineLuxe.

BACKEND ENDPOINTS:

Inventory:
  GET  /inventory/branch/:branchId         → manager/owner auth, returns InventoryItem[]
                                             InventoryItem: { id, name, unit, quantity, min_quantity, is_low_stock }
  POST /inventory                          → manager/owner auth, body: { branch_id, name, unit, quantity, min_quantity }
  PATCH /inventory/:id                     → manager/owner auth, body: { quantity?, min_quantity?, name? }
  DELETE /inventory/:id                    → manager/owner auth

Reviews:
  GET  /reviews/restaurant/:restaurantId   → public, returns Review[]
                                             Review: { id, rating, comment, created_at, user: {name} }
  POST /reviews                            → customer auth, body: { restaurant_id, rating (1-5), comment? }
  DELETE /reviews/:id                      → customer auth (own review) or admin

Notifications:
  GET  /notifications                      → any auth, returns Notification[]
  PATCH /notifications/:id/read           → auth, mark one read
  PATCH /notifications/read-all           → auth, mark all read

TASKS:

1. Create app/owner/inventory/page.tsx:
   - Fetch: GET /inventory/branch/:branchId
   - Table: name, unit, quantity, min_quantity, is_low_stock badge (red if low)
   - "Add Item" button → modal with create form → POST /inventory
   - Inline quantity edit: input + "Update" → PATCH /inventory/:id
   - Delete with confirm → DELETE /inventory/:id
   - Sort low-stock items to top

2. Add reviews to app/customer/restaurant/[restaurantId]/page.tsx (Reviews tab):
   - Fetch: GET /reviews/restaurant/:restaurantId
   - Show star rating (filled stars), comment, user name, date
   - If isAuthenticated and role==="customer": show "Write a Review" button
   - Review form: star picker (1-5), textarea → POST /reviews
   - Invalidate reviews query after submit

3. Create components/notifications/NotificationPanel.tsx:
   - Triggered by bell icon in TopBar
   - Fetch: GET /notifications
   - Show list: icon by type, message, time (date-fns formatDistanceToNow)
   - Click → PATCH /notifications/:id/read
   - "Mark All Read" button → PATCH /notifications/read-all
   - Unread count badge on bell (count of unread items)

4. Update components/layout/TopBar.tsx:
   - Import NotificationPanel
   - Fetch notifications count for badge: useQuery(["notifications"], () => apiClient.get("/notifications"), { refetchInterval: 60_000 })
   - Show badge with unread count (filter items where !is_read)
   - Click bell → toggle NotificationPanel visibility

Show full code for each file.
```

---

## PROFILE 13 — Analytics, Reports & Admin Panel

**Paste this entire block into Claude:**

```
Wire up analytics, reports, and the super-admin panel in DineLuxe.

BACKEND ENDPOINTS:

Analytics (owner/admin auth):
  GET /analytics/restaurant/:restaurantId/overview    → { revenue_today, revenue_week, orders_today, avg_order_value, top_items:[], occupancy_rate }
  GET /analytics/branch/:branchId/hourly             → { hours:[{hour, orders, revenue}] }

Reports (owner/admin auth):
  GET /reports/revenue?branch_id=&from=&to=           → { total, breakdown:[{date,amount}] }
  GET /reports/orders?branch_id=&from=&to=            → { total_orders, by_type:{dine_in,takeaway,delivery} }
  GET /reports/menu?branch_id=&from=&to=              → { top_items:[{name,count,revenue}] }
  GET /reports/staff?branch_id=&from=&to=             → { staff_performance:[{name,orders,avg_time}] }

Admin (admin role only):
  GET /admin/restaurants                              → all restaurants (paginated)
  GET /admin/users                                    → all users
  GET /admin/analytics/platform                       → platform-wide stats
  PATCH /restaurants/:id/status                       → { status: "active"|"suspended" }

TASKS:

1. app/owner/dashboard/page.tsx — add analytics:
   - Get restaurantId from useAuth()
   - Fetch overview: GET /analytics/restaurant/:restaurantId/overview
   - Show KPICard components: Revenue Today, Orders Today, Avg Order Value, Occupancy %
   - Fetch hourly: GET /analytics/branch/:branchId/hourly
   - Show bar chart (use recharts BarChart or existing chart components)

2. components/owner/ReportsDashboard.tsx — wire it up:
   - Date range picker (from/to using react-day-picker or two date inputs)
   - Tab selector: Revenue | Orders | Menu | Staff
   - On each tab fetch the relevant /reports/* endpoint with date params
   - Revenue tab: line chart of breakdown data
   - Orders tab: pie/donut chart of by_type
   - Menu tab: horizontal bar chart of top_items
   - Staff tab: table of staff_performance

3. app/admin/dashboard/page.tsx:
   - Fetch: GET /admin/analytics/platform
   - Show platform KPIs: total restaurants, total users, total orders today, total revenue today

4. app/admin/restaurants/page.tsx:
   - Fetch: GET /admin/restaurants (pass ?page=1&limit=20)
   - DataTable: name, owner email, city, status badge, created_at
   - "Suspend" / "Activate" button → PATCH /restaurants/:id/status

5. app/admin/customers/page.tsx:
   - Fetch: GET /admin/users?role=customer
   - DataTable: name, email, created_at, total_orders

All charts use recharts (already installed). Use React Query. Show TypeScript code.
```

---

## PROFILE 14 — Real-time WebSocket Integration

**Paste this entire block into Claude:**

```
Wire up real-time Socket.io events in the DineLuxe frontend. The backend runs a Socket.io server on the same Express port.

BACKEND SOCKET EVENTS EMITTED:
  Room pattern: "branch:{branchId}:host", "branch:{branchId}:kitchen", "branch:{branchId}:manager"
  Events:
    order:new          → { order }
    order:status       → { orderId, status }
    kitchen:ticket     → { ticket }
    kitchen:status     → { orderId, status }
    queue:update       → { queue: QueueEntry[] }
    table:status       → { tableId, status }
    booking:update     → { booking }

FRONTEND:
  hooks/useRealtime.ts already exists. Socket.io client should be in lib/socket.ts (create if missing).
  NEXT_PUBLIC_API_URL = "http://localhost:4000/api/v1" → socket connects to "http://localhost:4000" (strip /api/v1)

TASKS:

1. Create lib/socket.ts:
   - Import { io } from "socket.io-client"
   - Derive socket URL: strip "/api/v1" suffix from NEXT_PUBLIC_API_URL
   - Create singleton socket: io(socketUrl, { transports: ["polling","websocket"], autoConnect: false, withCredentials: true })
   - Export: getSocket() — connects if not already connected and returns socket instance
   - Export: disconnectSocket() — disconnect and cleanup

2. Rewrite hooks/useRealtime.ts:
   - Accept: { branchId: string, role: "host"|"kitchen"|"manager"|"waiter" }
   - On mount: getSocket().connect(), join room "branch:{branchId}:{role}"
   - On unmount: leave room, disconnectSocket() only if no other rooms active
   - Return: { on(event, handler), off(event, handler) }

3. hooks/useOrderStatus.ts:
   - Accept orderId
   - Subscribe to order:status events where event.orderId === orderId
   - Also poll GET /orders/:orderId every 30s as fallback
   - Return: { status, order }

4. hooks/useTableStatus.ts:
   - Accept branchId
   - Subscribe to table:status events
   - Maintain local Map of tableId → status
   - Return: { tableStatuses: Record<string, TableStatus> }

5. hooks/useQueuePosition.ts:
   - Accept branchId
   - Subscribe to queue:update events
   - Also call GET /queue/me?branch_id=:branchId on mount
   - Return: { position, estimatedWait, entry }

6. components/layout/RealtimeToastHandler.tsx:
   - If user is authenticated and has a branchId:
     Subscribe to order:new (show toast: "New order placed!") and order:status (show toast: "Order #{id} is now {status}")
   - Use a simple toast (can use window alert as fallback, or shadcn toast)

Show full code for all files.
```

---

## PROFILE 15 — Error Handling, Loading States & Final Polish

**Paste this entire block into Claude:**

```
Do a final pass on the DineLuxe frontend to ensure consistent error handling and loading states across all pages.

PATTERNS TO ENFORCE EVERYWHERE:

1. API errors — create lib/handle-error.ts:
   - Import ApiError from "@repo/shared"
   - Export function handleApiError(err: unknown): string
     - If err instanceof ApiError → return err.message
     - If err instanceof Error → return err.message
     - else → return "An unexpected error occurred"

2. React Query global error handler — update components/layout/QueryProvider.tsx:
   - Configure QueryClient with defaultOptions:
     queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false }
     mutations: { onError: (err) => console.error(handleApiError(err)) }

3. Loading pattern — every page using useQuery should:
   - if (isLoading) return <LoadingOverlay /> (component already exists)
   - if (isError) return <div className="p-8 text-center"><p className="text-red-500">{handleApiError(error)}</p><button onClick={refetch}>Retry</button></div>
   - Wrap the above in a reusable component: components/shared/QueryBoundary.tsx
     Props: { isLoading, isError, error, refetch, children }

4. Form error display — create components/shared/FormError.tsx:
   - Props: { error: string | null }
   - Renders a red alert box with the error message or null

5. Empty states — every list page should use EmptyState component (already exists) when data array is empty.

6. 404 page — update app/not-found.tsx:
   - Show a friendly "Page not found" with a "Go Home" button that routes based on role from useAuth()

7. Audit all pages — go through these pages and add the above patterns if missing:
   - app/customer/home/page.tsx
   - app/customer/order/cart/page.tsx
   - app/owner/branches/page.tsx
   - app/owner/menu/items/page.tsx (create if missing — lists all items for owner)
   - app/staff/manager/page.tsx

8. TypeScript — ensure all apiClient.get<T>() calls have a proper type T (not `any`). 
   Create types/api.ts file with:
   - Restaurant, Branch, MenuItem, MenuCategory, Order, OrderItem, Booking, QueueEntry, Staff, InventoryItem, Review, Notification, KitchenTicket, Payment
   These extend / match the Prisma types already defined in the shared package.

Show full code for all new/updated files.
```

---

## Quick Reference — All Backend Routes

| Module | Method | Path | Auth |
|---|---|---|---|
| Auth | POST | /auth/signup | public |
| Auth | POST | /auth/login | public |
| Auth | POST | /auth/verify-otp | public |
| Auth | POST | /auth/refresh | public |
| Auth | POST | /auth/logout | bearer |
| Auth | POST | /auth/forgot-password | public |
| Auth | POST | /auth/reset-password | public |
| Auth | POST | /auth/change-password | bearer |
| Users | GET | /users/me | bearer |
| Users | PATCH | /users/me | bearer |
| Restaurants | GET | /restaurants/nearby | public |
| Restaurants | GET | /restaurants/:id | public |
| Restaurants | PATCH | /restaurants/:id | owner |
| Branches | GET | /branches | owner |
| Branches | POST | /branches | owner |
| Branches | GET | /branches/:id | owner/mgr |
| Branches | PATCH | /branches/:id | owner/mgr |
| Branches | GET | /branches/:id/live-stats | owner/mgr |
| Menu | GET | /menu/branch/:branchId | public |
| Menu | POST | /menu/categories | owner/mgr |
| Menu | POST | /menu/items | owner/mgr |
| Menu | PATCH | /menu/items/:id | owner/mgr |
| Menu | PATCH | /menu/items/:id/status | owner/mgr |
| Orders | POST | /orders | cust/waiter |
| Orders | GET | /orders/user/me | customer |
| Orders | GET | /orders/staff | staff |
| Orders | GET | /orders/:id | bearer |
| Orders | GET | /orders/table/:tableId | staff |
| Orders | GET | /orders/branch/:branchId/active | staff |
| Payments | POST | /payments/initiate | bearer |
| Bookings | POST | /bookings | customer |
| Bookings | GET | /bookings/user/me | customer |
| Bookings | GET | /bookings/branch/:branchId | host/mgr |
| Bookings | PATCH | /bookings/:id/cancel | customer |
| Bookings | PATCH | /bookings/:id/seat | host/mgr |
| Queue | POST | /queue | customer |
| Queue | GET | /queue/branch/:branchId | public |
| Queue | GET | /queue/me | customer |
| Queue | PATCH | /queue/:id/arrive | host/mgr |
| Queue | PATCH | /queue/:id/assign-table | host/mgr |
| Kitchen | GET | /kitchen/branch/:branchId/tickets | chef/mgr |
| Kitchen | PATCH | /kitchen/orders/:id/status | chef/mgr |
| Staff | GET | /staff/branch/:branchId | mgr/owner |
| Staff | POST | /staff/create | mgr/owner |
| Staff | PATCH | /staff/:id | mgr/owner |
| Staff | PATCH | /staff/:id/toggle-access | mgr/owner |
| Inventory | GET | /inventory/branch/:branchId | mgr/owner |
| Inventory | POST | /inventory | mgr/owner |
| Inventory | PATCH | /inventory/:id | mgr/owner |
| Reviews | GET | /reviews/restaurant/:id | public |
| Reviews | POST | /reviews | customer |
| Notifications | GET | /notifications | bearer |
| Analytics | GET | /analytics/restaurant/:id/overview | owner |
| Reports | GET | /reports/revenue | owner |
| Admin | GET | /admin/restaurants | admin |
| Admin | GET | /admin/analytics/platform | admin |
