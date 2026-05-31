# 🍽️ Restaurant OS — Prompt Library PART 2
## Deep Gap Analysis — Complete Missing Pieces
**Priyanshu Kumar Gupta & Ronit Gupta | Version 2.0 — 2025**

---

## 🔬 PART 2 — DEEP ANALYSIS FINDINGS

After exhaustive line-by-line comparison between the product document and every source file across all 5 ZIP archives, the following critical gaps were found that **Part 1 did NOT cover**:

---

## 📋 PART 2 GAP ANALYSIS SUMMARY

### 🚨 CRITICAL — Missing SQL RPC Functions (Code calls them but they don't exist)

The backend code calls these Supabase RPCs that have **no SQL definition anywhere**:

| RPC Function | Called By | Status |
|---|---|---|
| `get_top_restaurants_by_revenue` | `admin.service.ts` line 67 | ❌ NO SQL |
| `get_peak_hours_matrix` | `admin.service.ts` line 100 | ❌ NO SQL |
| `get_db_metrics` | `admin.service.ts` line 134 | ❌ NO SQL |
| `get_kitchen_performance` | `reports.service.ts` line 68 | ❌ NO SQL |
| `get_returning_customers` | `reports.service.ts` line 90 | ❌ NO SQL |
| `get_top_spenders` | `reports.service.ts` line 92 | ❌ NO SQL |
| `get_platform_report` | `reports.service.ts` line 107 | ❌ NO SQL |
| `get_platform_trends` | `reports.service.ts` line 117 | ❌ NO SQL |
| `get_platform_stats` | `admin.service.ts` | ❌ NO SQL |

> These RPCs will cause **500 errors at runtime** until created. They are the most urgent fix.

---

### 🚨 CRITICAL — Missing Frontend Pages (Confirmed MISSING from ZIP)

| Page Path | Feature | Status |
|---|---|---|
| `app/owner/loyalty/page.tsx` | Owner loyalty program config | ❌ MISSING |
| `app/delivery/history/page.tsx` | Delivery partner history | ❌ MISSING |
| `app/customer/notifications/page.tsx` | Customer notification centre | ❌ MISSING |
| `app/customer/payment/page.tsx` | Customer payment (root) | ❌ MISSING |

---

### 🚨 CRITICAL — Missing Backend Logic (Business Rules Not Implemented)

| Feature | Current State | Doc Requirement |
|---|---|---|
| Waiter Auto-Assignment | ❌ Zero code exists | Smart workload-based assignment |
| Payment Gateway (Razorpay) | ❌ No gateway code | Full Razorpay + UPI QR integration |
| UPI QR Code Generation | ❌ No QR endpoint | Generate + poll payment status |
| Split Bill (per-person + by-item) | ❌ Referenced but not built | Full split payment logic |
| Delivery Partner Auto-Reassign | ❌ Marked `// TODO` | Auto-reassign on decline/timeout |
| Owner Customer CRM API | ❌ No `/owner/customers` endpoint | Full CRM with history scoped to restaurant |
| Report Export Async (Bull Job) | ❌ Synchronous stream only | Async Bull job + email delivery |
| Admin Restaurant Approval | ❌ Only status PATCH exists | Full approval workflow with emails |
| White-Label Custom Domain | ❌ Not implemented | Sub-domain routing + dynamic theming |
| RLS Policies | ❌ None in codebase | Row-Level Security on all tables |
| Materialized Views | ❌ None in codebase | 3 materialized views needed |
| `push_subscriptions` table | ❌ No SQL exists | Required for Web Push |

---

### ⚠️ INCOMPLETE — Existing Features That Are Partially Broken

| Feature | Issue |
|---|---|
| `app/owner/reports/page.tsx` | Calls `/restaurant/:id/reports` but route is `/reports` (wrong path) |
| `GET /nearby` restaurants | Bug noted in code — RPC doesn't exist, uses JS fallback (OK but slow) |
| White-label branding | Font preference stored but never dynamically loaded |
| `app/owner/staff/page.tsx` | Delegates to `StaffManagement` component but wrong API contract noted in comments |
| Admin peak hours | Calls `get_peak_hours_matrix` RPC that doesn't exist |

---

## 📁 PART 2 — NEW FILES TO CREATE

```
backend/
├── supabase/
│   ├── 🆕 rpc_functions.sql          (ALL missing RPC functions — Prompt P2-1)
│   ├── 🆕 materialized_views.sql     (3 materialized views — Prompt P2-1)
│   └── 🆕 rls_policies.sql           (Row-Level Security — Prompt P2-2)
├── src/
│   ├── modules/
│   │   ├── 🆕 waiter-assignment/     (Smart assignment — Prompt P2-3)
│   │   │   ├── waiter-assignment.service.ts
│   │   │   └── waiter-assignment.routes.ts
│   │   ├── 🆕 payment-gateway/       (Razorpay integration — Prompt P2-4)
│   │   │   ├── payment-gateway.service.ts
│   │   │   ├── payment-gateway.controller.ts
│   │   │   └── payment-gateway.routes.ts
│   │   ├── 🆕 owner-crm/             (Owner customer CRM — Prompt P2-5)
│   │   │   ├── owner-crm.service.ts
│   │   │   ├── owner-crm.controller.ts
│   │   │   └── owner-crm.routes.ts
│   │   ├── ✏️ orders/orders.service.ts  (Add waiter auto-assign — Prompt P2-3)
│   │   ├── ✏️ delivery/delivery.service.ts (Add auto-reassign — Prompt P2-6)
│   │   ├── ✏️ reports/reports.service.ts   (Add async export — Prompt P2-7)
│   │   └── ✏️ admin/admin.service.ts       (Add approval workflow — Prompt P2-8)
│   └── jobs/
│       └── 🆕 report-export.ts       (Bull job for async export — Prompt P2-7)

frontend/
├── app/
│   ├── owner/
│   │   └── 🆕 loyalty/page.tsx       (Prompt P2-9)
│   ├── delivery/
│   │   └── 🆕 history/page.tsx       (Prompt P2-10)
│   ├── customer/
│   │   ├── 🆕 notifications/page.tsx (Prompt P2-11)
│   │   └── 🆕 payment/page.tsx       (Prompt P2-12 — root redirect)
│   └── admin/
│       └── 🆕 approvals/page.tsx     (Prompt P2-8)
└── components/
    ├── 🆕 payment/RazorpayCheckout.tsx     (Prompt P2-4)
    ├── 🆕 payment/UPIQRSheet.tsx           (Prompt P2-4)
    ├── 🆕 payment/SplitBillSheet.tsx       (Prompt P2-4)
    ├── 🆕 owner/LoyaltyConfig.tsx          (Prompt P2-9)
    ├── 🆕 customer/NotificationCenter.tsx  (Prompt P2-11)
    ├── 🆕 admin/RestaurantApproval.tsx     (Prompt P2-8)
    └── 🆕 layout/WhiteLabelProvider.tsx    (Prompt P2-13 — enhanced branding)
```

---

# ═══════════════════════════════════════════════
# GROUP P2-A: CRITICAL DATABASE — ALL MISSING RPCs
# ═══════════════════════════════════════════════

---

## PROMPT P2-1 — All Missing Supabase RPC Functions + Materialized Views

### 📂 Files to Provide to Claude

```
backend/prisma/schema.prisma               (full schema — all 30 models)
backend/src/modules/admin/admin.service.ts (to see EXACT rpc call signatures)
backend/src/modules/reports/reports.service.ts (to see EXACT rpc call signatures)
supabase/functions.sql                      (from Part 1 Prompt 19 — existing RPCs)
```

### 🎯 Task for Claude

```
You are writing the MISSING Supabase PostgreSQL RPC functions for Restaurant OS.
These functions are already called in the backend code but HAVE NO SQL DEFINITION.
Without these, the platform will crash with 500 errors on admin dashboard,
reports pages, and analytics.

I am providing:
1. The Prisma schema (so you know exact table and column names)
2. The admin.service.ts and reports.service.ts (so you can see the EXACT RPC call
   signatures — parameter names and types)
3. The existing supabase/functions.sql from Part 1 (so you can append to it)

=== CRITICAL: Match EXACT parameter names from the service files ===
Each RPC must accept the EXACT parameter names the TypeScript code passes.
Example: if code calls rpc('fn', { p_restaurant_id: id, p_since: date })
         then your function must have parameters NAMED p_restaurant_id and p_since.

=== CREATE THESE 9 MISSING RPC FUNCTIONS ===

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION 1: get_top_restaurants_by_revenue
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parameters: p_since TIMESTAMPTZ, p_limit INTEGER DEFAULT 5
Returns: TABLE(
  restaurant_id UUID,
  restaurant_name TEXT,
  logo_url TEXT,
  cuisine_type TEXT,
  total_revenue NUMERIC,
  order_count BIGINT,
  branch_count BIGINT
)
Logic:
  SELECT 
    r.id as restaurant_id,
    r.name as restaurant_name,
    rb.logo_url,
    r.cuisine_type,
    COALESCE(SUM(p.amount), 0) as total_revenue,
    COUNT(DISTINCT o.id) as order_count,
    COUNT(DISTINCT b.id) as branch_count
  FROM restaurants r
  JOIN branches b ON r.id = b.restaurant_id
  JOIN orders o ON b.id = o.branch_id AND o.created_at >= p_since
  LEFT JOIN payments p ON o.id = p.order_id AND p.status = 'completed'
  LEFT JOIN restaurant_branding rb ON r.id = rb.restaurant_id
  WHERE r.status = 'active'
  GROUP BY r.id, r.name, rb.logo_url, r.cuisine_type
  ORDER BY total_revenue DESC
  LIMIT p_limit;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION 2: get_peak_hours_matrix
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parameters: NONE (platform-wide view for super admin)
Returns: TABLE(day_of_week INTEGER, hour INTEGER, order_count BIGINT)
Logic:
  SELECT 
    EXTRACT(DOW FROM created_at)::INTEGER as day_of_week,
    EXTRACT(HOUR FROM created_at)::INTEGER as hour,
    COUNT(*) as order_count
  FROM orders
  WHERE created_at > NOW() - INTERVAL '90 days'
    AND status NOT IN ('cancelled')
  GROUP BY day_of_week, hour
  ORDER BY day_of_week, hour;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION 3: get_db_metrics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parameters: NONE
Returns: JSON (single row with metrics)
Logic: Uses pg_stat_database and pg_stat_activity
  SELECT json_build_object(
    'active_connections',  (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'),
    'idle_connections',    (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle'),
    'total_connections',   (SELECT COUNT(*) FROM pg_stat_activity),
    'database_size_mb',    (SELECT ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0, 2)),
    'cache_hit_ratio',     (
      SELECT ROUND(100.0 * SUM(blks_hit) / NULLIF(SUM(blks_hit + blks_read), 0), 2)
      FROM pg_stat_database WHERE datname = current_database()
    ),
    'transactions_per_sec', (
      SELECT ROUND(xact_commit / GREATEST(EXTRACT(EPOCH FROM (NOW() - stats_reset)), 1), 2)
      FROM pg_stat_database WHERE datname = current_database()
    )
  );

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION 4: get_kitchen_performance
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parameters: p_branch_id UUID, p_from TIMESTAMPTZ, p_to TIMESTAMPTZ
Returns: TABLE(
  hour_of_day INTEGER,
  avg_prep_time_minutes NUMERIC,
  order_count BIGINT,
  overdue_count BIGINT   -- orders that took > 20 min
)
Logic:
  SELECT 
    EXTRACT(HOUR FROM o.created_at)::INTEGER as hour_of_day,
    ROUND(AVG(
      EXTRACT(EPOCH FROM (
        MAX(CASE WHEN oi.status = 'ready' THEN oi.prepared_at END) - o.created_at
      )) / 60.0
    ), 1) as avg_prep_time_minutes,
    COUNT(DISTINCT o.id) as order_count,
    COUNT(DISTINCT o.id) FILTER (
      WHERE EXTRACT(EPOCH FROM (
        COALESCE(MAX(CASE WHEN oi.status = 'ready' THEN oi.prepared_at END), NOW()) - o.created_at
      )) / 60.0 > 20
    ) as overdue_count
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  WHERE o.branch_id = p_branch_id
    AND o.created_at BETWEEN p_from AND p_to
    AND o.status NOT IN ('cancelled')
  GROUP BY hour_of_day
  ORDER BY hour_of_day;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION 5: get_returning_customers
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parameters: p_restaurant_id UUID
Returns: TABLE(
  total_customers BIGINT,
  returning_customers BIGINT,
  return_rate_pct NUMERIC,
  avg_visits_per_customer NUMERIC
)
Logic:
  WITH customer_visits AS (
    SELECT o.customer_id, COUNT(*) as visit_count
    FROM orders o
    JOIN branches b ON o.branch_id = b.id
    WHERE b.restaurant_id = p_restaurant_id
      AND o.status NOT IN ('cancelled')
    GROUP BY o.customer_id
  )
  SELECT
    COUNT(*) as total_customers,
    COUNT(*) FILTER (WHERE visit_count > 1) as returning_customers,
    ROUND(100.0 * COUNT(*) FILTER (WHERE visit_count > 1) / NULLIF(COUNT(*), 0), 1) as return_rate_pct,
    ROUND(AVG(visit_count), 1) as avg_visits_per_customer
  FROM customer_visits;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION 6: get_top_spenders
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parameters: p_restaurant_id UUID, p_limit INTEGER DEFAULT 10
Returns: TABLE(
  customer_id UUID,
  display_name TEXT,
  phone_masked TEXT,    -- last 4 digits only: ****1234
  total_spent NUMERIC,
  visit_count BIGINT,
  last_visit TIMESTAMPTZ
)
Logic:
  SELECT
    u.id as customer_id,
    u.name as display_name,
    '****' || RIGHT(COALESCE(u.phone, '0000'), 4) as phone_masked,
    COALESCE(SUM(p.amount), 0) as total_spent,
    COUNT(DISTINCT o.id) as visit_count,
    MAX(o.created_at) as last_visit
  FROM users u
  JOIN orders o ON u.id = o.customer_id
  JOIN branches b ON o.branch_id = b.id
  LEFT JOIN payments p ON o.id = p.order_id AND p.status = 'completed'
  WHERE b.restaurant_id = p_restaurant_id
    AND u.role = 'customer'
    AND o.status NOT IN ('cancelled')
  GROUP BY u.id, u.name, u.phone
  ORDER BY total_spent DESC
  LIMIT p_limit;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION 7: get_platform_report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parameters: NONE
Returns: JSON (single object)
Logic:
  SELECT json_build_object(
    'revenue_total',     (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status='completed' AND created_at > NOW() - INTERVAL '30 days'),
    'orders_total',      (SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '30 days' AND status != 'cancelled'),
    'avg_order_value',   (SELECT ROUND(COALESCE(AVG(amount), 0), 2) FROM payments WHERE status='completed' AND created_at > NOW() - INTERVAL '30 days'),
    'active_restaurants',(SELECT COUNT(*) FROM restaurants WHERE status='active'),
    'new_customers',     (SELECT COUNT(*) FROM users WHERE role='customer' AND created_at > NOW() - INTERVAL '30 days'),
    'cancelled_orders',  (SELECT COUNT(*) FROM orders WHERE status='cancelled' AND created_at > NOW() - INTERVAL '30 days')
  );

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION 8: get_platform_trends
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parameters: p_from TIMESTAMPTZ, p_to TIMESTAMPTZ
Returns: TABLE(
  date DATE,
  revenue NUMERIC,
  orders BIGINT,
  new_customers BIGINT
)
Logic:
  SELECT
    DATE(d.day) as date,
    COALESCE(SUM(p.amount), 0) as revenue,
    COUNT(DISTINCT o.id) as orders,
    COUNT(DISTINCT u.id) FILTER (WHERE u.created_at::DATE = d.day::DATE) as new_customers
  FROM generate_series(p_from::DATE, p_to::DATE, '1 day'::interval) as d(day)
  LEFT JOIN orders o ON DATE(o.created_at) = d.day::DATE AND o.status != 'cancelled'
  LEFT JOIN payments p ON o.id = p.order_id AND p.status = 'completed'
  LEFT JOIN users u ON u.role = 'customer'
  GROUP BY d.day
  ORDER BY d.day;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNCTION 9: get_platform_stats
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parameters: NONE
Returns: TABLE(day_of_week INTEGER, hour INTEGER, order_count BIGINT)
  (NOTE: Same shape as get_peak_hours_matrix — check admin.service.ts to confirm
   whether this is a duplicate call or needs different logic)
Logic: Same as get_peak_hours_matrix but last 30 days instead of 90.

=== ALSO: CREATE 3 MATERIALIZED VIEWS ===

VIEW 1: mv_branch_daily_stats
  SELECT branch_id, DATE(created_at) as stat_date,
    COUNT(*) FILTER (WHERE status != 'cancelled') as order_count,
    COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) as revenue,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancellation_count
  FROM orders o
  LEFT JOIN payments p ON o.id = p.order_id
  GROUP BY branch_id, DATE(created_at)
  
  Create UNIQUE INDEX: (branch_id, stat_date)
  Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_branch_daily_stats;

VIEW 2: mv_menu_item_performance
  SELECT menu_item_id, branch_id, 
    COUNT(*) as total_orders,
    SUM(oi.quantity) as total_quantity,
    COALESCE(SUM(oi.unit_price * oi.quantity), 0) as total_revenue,
    AVG(r.overall_rating) as avg_rating
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  LEFT JOIN reviews r ON o.id = r.order_id
  WHERE o.status NOT IN ('cancelled')
  GROUP BY menu_item_id, branch_id

VIEW 3: mv_restaurant_monthly_summary  
  SELECT restaurant_id, DATE_TRUNC('month', o.created_at) as month,
    COUNT(DISTINCT o.id) as order_count,
    COALESCE(SUM(p.amount) FILTER (WHERE p.status='completed'), 0) as revenue,
    COUNT(DISTINCT o.customer_id) as unique_customers
  FROM orders o
  JOIN branches b ON o.branch_id = b.id
  LEFT JOIN payments p ON o.id = p.order_id
  WHERE o.status NOT IN ('cancelled')
  GROUP BY restaurant_id, month

=== ALSO: ADD push_subscriptions TABLE ===
(Required for Web Push from Part 1 Prompt 32)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription_data JSONB NOT NULL,
  device_type VARCHAR(20) DEFAULT 'web',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, (subscription_data->>'endpoint'))
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

=== FORMAT ===
- DROP FUNCTION IF EXISTS before each CREATE OR REPLACE
- Include GRANTs: GRANT EXECUTE ON FUNCTION ... TO service_role, authenticated;
- Add SQL comments explaining each function's purpose
- For materialized views: include the REFRESH MATERIALIZED VIEW command
- Output as a SINGLE complete .sql file: supabase/rpc_functions.sql

Return the complete SQL file.
```

### 📤 Expected Output
- 🆕 `supabase/rpc_functions.sql` — All 9 missing RPCs + 3 materialized views + push_subscriptions table

---

## PROMPT P2-2 — Row-Level Security Policies

### 📂 Files to Provide to Claude

```
backend/prisma/schema.prisma               (full schema — for exact table names)
```

### 🎯 Task for Claude

```
You are implementing PostgreSQL Row-Level Security (RLS) for Restaurant OS.

RLS ensures that even if an application bug bypasses auth checks, the database 
itself PREVENTS cross-restaurant data leaks.

The product document states this is required for M23 security compliance.
Using Supabase's built-in JWT claims for the app user context.

=== IMPLEMENTATION STRATEGY ===

Supabase automatically provides these JWT claims in the PostgreSQL session:
  auth.uid()    → the authenticated user's UUID
  auth.role()   → the user's role ('authenticated', 'anon', 'service_role')

The Supabase service_role key bypasses ALL RLS (used by the backend).
The Supabase anon/authenticated key respects RLS (used by direct client queries if any).

Since Restaurant OS uses the service_role key for all backend queries,
RLS primarily adds a defense-in-depth layer for future direct client access.

=== CREATE supabase/rls_policies.sql ===

STEP 1 — Enable RLS on sensitive tables (don't enable on public ones like restaurants):
  ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
  ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
  ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
  ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
  ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
  ALTER TABLE staff_feedback ENABLE ROW LEVEL SECURITY;
  ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

STEP 2 — Service role bypass (ALWAYS add this first — backend uses service_role):
  For each table above, create:
  CREATE POLICY "{table}_service_role_bypass" ON {table}
    FOR ALL TO service_role USING (true) WITH CHECK (true);

STEP 3 — User can only see their own data (customer-level policies):

  -- Users can read their own profile
  CREATE POLICY "users_own_read" ON users
    FOR SELECT TO authenticated USING (auth.uid() = id);
  
  -- Users can update their own profile
  CREATE POLICY "users_own_update" ON users
    FOR UPDATE TO authenticated USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  
  -- Customers can only see their own orders
  CREATE POLICY "orders_customer_own" ON orders
    FOR SELECT TO authenticated USING (customer_id = auth.uid());
  
  -- Customers can only see their own bookings
  CREATE POLICY "bookings_customer_own" ON bookings
    FOR SELECT TO authenticated USING (user_id = auth.uid());
  
  -- Customers can only see their own payments
  CREATE POLICY "payments_customer_own" ON payments
    FOR SELECT TO authenticated
    USING (order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid()));
  
  -- Customers can see their own loyalty accounts
  CREATE POLICY "loyalty_customer_own" ON loyalty_accounts
    FOR SELECT TO authenticated USING (user_id = auth.uid());
  
  -- Customers can see their own support tickets
  CREATE POLICY "support_tickets_own" ON support_tickets
    FOR SELECT TO authenticated USING (user_id = auth.uid());
  
  -- Customers can insert their own support tickets
  CREATE POLICY "support_tickets_insert_own" ON support_tickets
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  
  -- Customers can see their own notifications
  CREATE POLICY "notifications_own" ON notifications
    FOR SELECT TO authenticated USING (user_id = auth.uid());
  
  -- Customers can update their notifications (mark as read)
  CREATE POLICY "notifications_own_update" ON notifications
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

STEP 4 — Prevent customers from seeing other users' reviews details (public read OK for content):
  CREATE POLICY "reviews_public_read" ON reviews
    FOR SELECT TO authenticated, anon USING (true);
    -- Reviews are public — intentional
  
  CREATE POLICY "reviews_own_insert" ON reviews
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  
  CREATE POLICY "reviews_own_update" ON reviews
    FOR UPDATE TO authenticated USING (user_id = auth.uid());

STEP 5 — Inventory: only accessible by service_role (already covered by bypass policy)
  -- No additional authenticated policies for inventory — staff use service_role key

STEP 6 — Staff feedback: submitter can't re-read their own to preserve anonymity:
  CREATE POLICY "staff_feedback_insert_only" ON staff_feedback
    FOR INSERT TO authenticated 
    WITH CHECK (user_id = auth.uid());
  -- NO SELECT policy for authenticated users — only service_role can read

STEP 7 — Verify policies work correctly:
  -- Add test statements (as comments with expected results):
  -- SET ROLE authenticated; SET request.jwt.claims = '{"sub": "user-uuid"}';
  -- SELECT COUNT(*) FROM orders; -- should return only this user's orders

=== FORMAT ===
Return as a complete supabase/rls_policies.sql file with:
  - Detailed SQL comments explaining each policy
  - DROP POLICY IF EXISTS before each CREATE POLICY (for idempotent re-runs)
  - Section headers for each table
  - A summary comment at the top explaining the overall strategy
```

### 📤 Expected Output
- 🆕 `supabase/rls_policies.sql` — Complete RLS policy definitions

---

# ═══════════════════════════════════════════════
# GROUP P2-B: BACKEND — WAITER AUTO-ASSIGNMENT
# ═══════════════════════════════════════════════

---

## PROMPT P2-3 — Smart Waiter Assignment Module (Backend)

### 📂 Files to Provide to Claude

```
backend/src/modules/orders/orders.service.ts      (full file)
backend/src/modules/tables/tables.service.ts      (full file)
backend/src/modules/staff/staff.service.ts        (full file)
backend/src/modules/staff/staff.routes.ts         (full file)
backend/src/config/supabase.ts
backend/src/config/redis.ts
backend/src/server.ts                             (for WebSocket io import)
backend/src/utils/response.ts
```

### 🎯 Task for Claude

```
You are implementing the Smart Waiter Auto-Assignment system for Restaurant OS.

The product document (M10, M20) specifies that when a table is seated, the system
automatically assigns the waiter with the LOWEST current workload score.

Currently: ZERO waiter auto-assignment code exists anywhere in the codebase.
The orders.service.ts and tables.service.ts have no assignment logic.

=== CREATE FILE: backend/src/modules/waiter-assignment/waiter-assignment.service.ts ===

WORKLOAD SCORE FORMULA (from product doc):
  score = (active_tables × 3) + (active_orders × 1) + (pending_serves × 0.5)

TYPES:
  interface WaiterWorkload {
    waiter_id: string
    waiter_name: string
    active_tables: number
    active_orders: number
    pending_serves: number  // order_items with status='ready' not yet served
    score: number
  }

FUNCTION: getWaiterWorkloads(branchId: string): Promise<WaiterWorkload[]>
  Query to run (single efficient SQL join):
  
  SELECT
    u.id as waiter_id,
    u.name as waiter_name,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'occupied') as active_tables,
    COUNT(DISTINCT o.id) FILTER (WHERE o.status IN ('confirmed','preparing','ready')) as active_orders,
    COUNT(oi.id) FILTER (WHERE oi.status = 'ready') as pending_serves
  FROM users u
  LEFT JOIN tables t ON t.assigned_waiter_id = u.id AND t.branch_id = branchId
  LEFT JOIN orders o ON o.waiter_id = u.id 
    AND o.branch_id = branchId 
    AND o.status IN ('confirmed', 'preparing', 'ready')
  LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.status = 'ready'
  WHERE u.role = 'waiter' 
    AND u.branch_id = branchId 
    AND u.is_active = true
  GROUP BY u.id, u.name

  Calculate score for each: (active_tables * 3) + (active_orders * 1) + (pending_serves * 0.5)
  Return sorted by score ASC.
  
  Also cache in Redis: key='waiter_workloads:{branchId}', TTL=10 seconds
  (Very short TTL — workloads change constantly)

FUNCTION: assignWaiterToTable(tableId: string, branchId: string, restaurantId: string): Promise<{ waiter_id: string, waiter_name: string } | null>
  
  Algorithm:
  1. Get current workloads (or from 10s cache)
  2. Find the waiter with lowest score
  3. If no waiters available (none active): return null (table assigned without waiter)
  4. UPDATE tables SET assigned_waiter_id = waiter_id WHERE id = tableId
  5. Invalidate workload cache for this branch
  6. Emit WebSocket event 'table_assigned' to that specific waiter's socket:
     - Look up waiter's socket ID: Redis key 'socket:{waiterId}'
     - Emit to their room: io.to(waiterSocketId).emit('table_assigned', { table_id, table_label, branch_id })
  7. Also emit 'table_status_changed' to 'branch:{branchId}' room
  8. Return { waiter_id, waiter_name }

FUNCTION: getWorkloadSummary(branchId: string): Promise<WaiterWorkload[]>
  Just returns the workloads array with computed scores (for manager dashboard display).

FUNCTION: manuallyAssignWaiter(tableId: string, waiterId: string, branchId: string, restaurantId: string): Promise<void>
  - Used by manager to manually override auto-assignment
  - Verify waiterId is a waiter in branchId
  - UPDATE tables SET assigned_waiter_id = waiterId
  - Notify waiter via WebSocket
  - Invalidate cache

=== CREATE FILE: backend/src/modules/waiter-assignment/waiter-assignment.routes.ts ===

All routes: authenticate, injectTenant

GET  /waiter-assignment/workloads?branch_id=   → getWorkloadSummary (role: manager, owner)
POST /waiter-assignment/assign                 → manuallyAssignWaiter (role: manager, owner)
  Body: { table_id, waiter_id }

=== UPDATE orders.service.ts ===

Find the createOrder function.
After the order is successfully created (INSERT into orders), add:
  
  // Auto-assign waiter if not already assigned to this table
  try {
    const { data: table } = await supabaseAdmin
      .from('tables')
      .select('assigned_waiter_id')
      .eq('id', orderData.table_id)
      .single()
    
    // If table has no assigned waiter, trigger auto-assignment
    if (table && !table.assigned_waiter_id) {
      const { assignWaiterToTable } = await import('../waiter-assignment/waiter-assignment.service')
      await assignWaiterToTable(orderData.table_id, branchId, restaurantId)
    } else {
      // Table already has an assigned waiter — use them for this order
      await supabaseAdmin
        .from('orders')
        .update({ waiter_id: table?.assigned_waiter_id })
        .eq('id', newOrder.id)
    }
  } catch (assignError) {
    // Auto-assignment failure is non-fatal — log but don't fail the order
    console.error('[waiter-assign] Auto-assignment failed:', assignError)
  }

=== UPDATE tables.service.ts ===

Find where table status is set to 'occupied' (when queue assigns table).
Add after the status update:
  import { assignWaiterToTable } from '../waiter-assignment/waiter-assignment.service'
  await assignWaiterToTable(tableId, branchId, restaurantId).catch(err =>
    console.error('[waiter-assign] Failed:', err)
  )

Return all 4 files (2 new + 2 modified) with full paths.
```

### 📤 Expected Output
- 🆕 `backend/src/modules/waiter-assignment/waiter-assignment.service.ts`
- 🆕 `backend/src/modules/waiter-assignment/waiter-assignment.routes.ts`
- ✏️ `backend/src/modules/orders/orders.service.ts` (with auto-assign added)
- ✏️ `backend/src/modules/tables/tables.service.ts` (with auto-assign trigger)

---

# ═══════════════════════════════════════════════
# GROUP P2-C: PAYMENT GATEWAY INTEGRATION
# ═══════════════════════════════════════════════

---

## PROMPT P2-4 — Razorpay + UPI QR + Split Bill (Backend + Frontend)

### 📂 Files to Provide to Claude

```
backend/src/modules/payments/payments.service.ts   (full file)
backend/src/modules/payments/payments.routes.ts    (full file)
backend/src/modules/payments/payments.schema.ts    (full file)
backend/src/config/env.ts
backend/.env.example
backend/src/utils/response.ts
app/customer/payment/[orderId]/page.tsx            (full existing payment page)
lib/api-client.ts
types/api.ts
hooks/useAuth.ts
```

### 🎯 Task for Claude

```
You are implementing the Razorpay payment gateway integration for Restaurant OS.

The product document (M12, M22) specifies Razorpay as the primary gateway for India.

=== BACKEND: Create payment-gateway module ===

FILE 1: backend/src/modules/payment-gateway/payment-gateway.service.ts

  DEPENDENCIES: npm install razorpay  (add to package.json)
  
  Import: const Razorpay = require('razorpay');
  
  Initialize:
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

  FUNCTION: createRazorpayOrder(orderId: string, amountInPaise: number, currency: string = 'INR'):
    - Create Razorpay order:
      const rzpOrder = await razorpay.orders.create({
        amount: Math.round(amountInPaise),  // amount in paise (₹1 = 100 paise)
        currency,
        receipt: `ros_${orderId.slice(-8)}`,
        notes: { order_id: orderId }
      })
    - Store razorpay_order_id in payments table (UPDATE or INSERT)
    - Return: { razorpay_order_id: rzpOrder.id, amount: rzpOrder.amount, currency, key_id: RAZORPAY_KEY_ID }

  FUNCTION: verifyRazorpayPayment(razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string):
    - Verify HMAC-SHA256 signature:
      const crypto = require('crypto');
      const body = razorpayOrderId + '|' + razorpayPaymentId;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpaySignature)
      );
    - If invalid: throw 400 error 'Payment signature verification failed'
    - If valid: return true

  FUNCTION: confirmPayment(orderId: string, razorpayPaymentId: string, razorpayOrderId: string, razorpaySignature: string):
    - Call verifyRazorpayPayment() first
    - Update payment record: status='completed', transaction_ref=razorpayPaymentId
    - Update order: status='paid'
    - Update table: status='cleaning'
    - Emit 'payment_confirmed' WebSocket to branch room
    - Trigger loyalty points earning (POST to loyalty service internally)
    - Return: { success: true, receipt_url: ... }

  FUNCTION: generateUPIQR(orderId: string, amount: number, branchName: string):
    - DEPENDENCIES: npm install qrcode
    - Merchant UPI ID from env: MERCHANT_UPI_ID
    - Generate UPI deep link:
      const transactionRef = `ROS${Date.now()}`
      const upiLink = `upi://pay?pa=${MERCHANT_UPI_ID}&pn=${encodeURIComponent(branchName)}&am=${amount.toFixed(2)}&tr=${transactionRef}&tn=${encodeURIComponent('Order ' + orderId.slice(-8))}&cu=INR`
    - Convert to QR image: const qrDataUrl = await QRCode.toDataURL(upiLink, { width: 300 })
    - Store transactionRef in Redis: key='upi_pending:{transactionRef}', value=orderId, TTL=15min
    - Return: { qr_data_url: qrDataUrl, transaction_ref: transactionRef, upi_link: upiLink }

  FUNCTION: pollUPIPaymentStatus(transactionRef: string):
    - Check Redis key 'upi_pending:{transactionRef}'
    - If key not found: return { status: 'expired' }
    - Check Redis key 'upi_confirmed:{transactionRef}' — set by webhook
    - Return: { status: 'pending' | 'completed' | 'failed' }
    
    NOTE: UPI payment confirmation comes via Razorpay webhook.
    The webhook handler sets 'upi_confirmed:{transactionRef}' in Redis.

  FUNCTION: handleRazorpayWebhook(body: any, signature: string):
    - Verify webhook signature (different from payment signature):
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(body))
        .digest('hex');
    - Handle events:
      'payment.captured': mark payment complete, set Redis key
      'payment.failed': update payment status='failed', notify customer
      'refund.created': update payment record with refund info

  FUNCTION: calculateSplitBill(orderId: string, splitBy: number):
    - Fetch order total from orders + payments
    - Return: { total, per_person: Math.ceil(total * 100 / splitBy) / 100, split_count: splitBy }

  FUNCTION: processPartialPayment(orderId: string, paymentId: string, portion: number, personIndex: number):
    - Record partial payment in a split_payments table (or as JSONB in payments)
    - When all portions paid: mark main payment complete
    - Return: { portions_paid, total_portions, remaining_amount }

FILE 2: backend/src/modules/payment-gateway/payment-gateway.controller.ts
  Controllers wrapping all service functions.

FILE 3: backend/src/modules/payment-gateway/payment-gateway.routes.ts

  POST /payment-gateway/create-order     → authenticate, createRazorpayOrder
    body: { order_id, amount }
  POST /payment-gateway/verify           → authenticate, confirmPayment
    body: { order_id, razorpay_payment_id, razorpay_order_id, razorpay_signature }
  POST /payment-gateway/upi-qr           → authenticate, generateUPIQR
    body: { order_id, amount, branch_name }
  GET  /payment-gateway/upi-status/:ref  → pollUPIPaymentStatus (no auth — polling)
  POST /payment-gateway/webhook          → handleRazorpayWebhook (no auth — Razorpay calls this)
  GET  /payment-gateway/split/:orderId?split_by=  → calculateSplitBill

=== ADD TO env.ts ===
  RAZORPAY_KEY_ID: z.string().optional()
  RAZORPAY_KEY_SECRET: z.string().optional()
  RAZORPAY_WEBHOOK_SECRET: z.string().optional()
  MERCHANT_UPI_ID: z.string().optional()

=== FRONTEND: Create 3 Payment Components ===

FILE 4: components/payment/RazorpayCheckout.tsx

  Props: { orderId: string; amount: number; onSuccess: (paymentId: string) => void; onFailure: () => void }
  
  - On mount: call POST /payment-gateway/create-order to get razorpay_order_id
  - Load Razorpay checkout script dynamically (not via npm — use script tag):
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    document.head.appendChild(script)
  - Open Razorpay checkout modal:
    const rzp = new (window as any).Razorpay({
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      order_id: razorpayOrderId,
      amount: amount * 100,
      currency: 'INR',
      name: 'DineLuxe',
      description: `Order #${orderId.slice(-8)}`,
      handler: async (response) => {
        // Verify with backend
        await apiClient.post('/payment-gateway/verify', { ... })
        onSuccess(response.razorpay_payment_id)
      },
      prefill: { name: user.name, email: user.email, contact: user.phone },
      theme: { color: '#1A3C5E' }
    })
    rzp.open()
  - Shows "Pay with Card/Net Banking" button that triggers the flow
  - Loading state while creating order

FILE 5: components/payment/UPIQRSheet.tsx

  Props: { orderId: string; amount: number; branchName: string; onSuccess: () => void }
  
  State: { qrDataUrl, transactionRef, status: 'idle'|'loading'|'showing'|'paid'|'expired' }
  
  On mount:
  1. POST /payment-gateway/upi-qr → get qrDataUrl + transactionRef
  2. Show QR code (img tag with qrDataUrl)
  3. Show UPI app quick-launch buttons: GPay | PhonePe | Paytm
     (deep links to each UPI app with the payment pre-filled)
  4. Start polling: every 3 seconds, GET /payment-gateway/upi-status/:transactionRef
     - If 'completed': set status='paid', show success, call onSuccess()
     - If 'expired' (15min): show "QR has expired, generate new one"
  5. Show countdown timer: "Expires in 14:30"
  6. Show "I've paid" confirmation button (as fallback)
  
  Clean up polling on unmount.

FILE 6: components/payment/SplitBillSheet.tsx

  Props: { orderId: string; totalAmount: number; onSplitComplete: () => void }
  
  TWO SPLIT MODES (tabs):
  
  Mode A — Even Split:
    - Number input: "Split between X people" (2-20)
    - Shows: "₹240 per person" (calculated live)
    - "Start Split" button → shows individual payment links
    - Each person pays their portion via UPI QR or Razorpay
  
  Mode B — Item-by-Item:
    - Fetch order items from GET /api/v1/orders/:orderId
    - Show list of items with checkboxes
    - Customer selects their items
    - Shows their subtotal
    - Pays their portion
    - Tracks which items are paid

  Progress tracker: "2 of 4 people have paid — ₹480 remaining"

Return all 6 files with full paths.
Also show the env.ts additions and .env.example additions.
```

### 📤 Expected Output
- 🆕 `backend/src/modules/payment-gateway/` — 3 new files
- 🆕 `components/payment/RazorpayCheckout.tsx`
- 🆕 `components/payment/UPIQRSheet.tsx`
- 🆕 `components/payment/SplitBillSheet.tsx`

---

# ═══════════════════════════════════════════════
# GROUP P2-D: OWNER CUSTOMER CRM
# ═══════════════════════════════════════════════

---

## PROMPT P2-5 — Owner Customer CRM Module (Backend)

### 📂 Files to Provide to Claude

```
backend/src/modules/users/users.service.ts
backend/src/modules/users/users.routes.ts
backend/src/modules/restaurants/restaurants.service.ts
backend/src/config/supabase.ts
backend/src/middleware/auth.middleware.ts
backend/src/middleware/rbac.middleware.ts
backend/src/middleware/tenant.middleware.ts
backend/src/utils/response.ts
backend/src/utils/pagination.ts
```

### 🎯 Task for Claude

```
You are building the Owner Customer CRM module for Restaurant OS.

The product document (M4) specifies owners can:
  - See all customers who visited THEIR restaurant (not other restaurants)
  - Create lightweight customer accounts from the POS (no password needed)
  - View per-customer visit history and spend (scoped to their restaurant only)

The frontend (app/owner/customers/page.tsx, 14.8KB) already exists and calls:
  GET  /api/v1/owner/customers?search=&sort=&page=
  POST /api/v1/owner/customers/create-by-restaurant
  GET  /api/v1/owner/customers/:id/history

Currently NO backend routes exist for these endpoints.

=== CREATE THESE 3 FILES ===

FILE 1: backend/src/modules/owner-crm/owner-crm.service.ts

  FUNCTION: listRestaurantCustomers(restaurantId: string, options: {
    search?: string, sort?: 'visits' | 'spend' | 'last_visit', 
    page: number, limit: number
  }):
  
  - Returns customers who have placed at least 1 order at this restaurant
  - PRIVACY: Phone shown masked (last 4 digits) for Manager role, full for Owner
  - Query:
    SELECT DISTINCT
      u.id,
      u.name as display_name,
      '****' || RIGHT(u.phone, 4) as phone_masked,
      u.phone as phone_full,  -- filtered in controller based on role
      COUNT(DISTINCT o.id) as visit_count,
      MAX(o.created_at) as last_visit,
      COALESCE(SUM(p.amount) FILTER (WHERE p.status='completed'), 0) as total_spent,
      u.created_by_restaurant  -- true = created by restaurant staff
    FROM users u
    JOIN orders o ON u.id = o.customer_id
    JOIN branches b ON o.branch_id = b.id
    LEFT JOIN payments p ON o.id = p.order_id
    WHERE b.restaurant_id = restaurantId
      AND u.role = 'customer'
      AND o.status NOT IN ('cancelled')
    GROUP BY u.id, u.name, u.phone, u.created_by_restaurant
    ORDER BY [sort_column] DESC
    OFFSET ... LIMIT ...
  
  - If search provided: filter by u.name ILIKE '%{search}%'
  - Return: paginated { data, total, page, pages }

  FUNCTION: createCustomerByRestaurant(restaurantId: string, name: string, phone: string, createdBy: string):
  
  - Check if user with this phone already exists:
    SELECT id FROM users WHERE phone = phone LIMIT 1
  - If EXISTS: link existing user (return their id, add to restaurant's customer list — handled by order history naturally)
  - If NOT EXISTS: create user record:
    INSERT INTO users: {
      name, phone, email: null, password_hash: null,
      role: 'customer', created_by_restaurant: true,
      is_active: true, force_password_change: false
    }
    NOTE: No Supabase Auth user is created (no email/password) — they log in only if they self-register later
  - Create AuditLog entry
  - Return: { user_id, is_existing: boolean, message: 'Customer created/linked' }

  FUNCTION: getCustomerHistory(customerId: string, restaurantId: string):
  
  - Verify customer has visited this restaurant (security check)
  - Fetch:
    SELECT o.*, 
      json_agg(json_build_object('name', mi.name, 'quantity', oi.quantity)) as items,
      p.amount as payment_amount, p.method as payment_method
    FROM orders o
    JOIN branches b ON o.branch_id = b.id
    JOIN order_items oi ON o.id = oi.order_id
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    LEFT JOIN payments p ON o.id = p.order_id
    WHERE o.customer_id = customerId
      AND b.restaurant_id = restaurantId
      AND o.status NOT IN ('cancelled')
    GROUP BY o.id, p.amount, p.method
    ORDER BY o.created_at DESC
    LIMIT 50
  - Return: {
      customer: { name, phone_masked, visit_count, total_spent, first_visit, last_visit },
      orders: [...],
      favorite_items: (top 3 by frequency)
    }

FILE 2: backend/src/modules/owner-crm/owner-crm.controller.ts
  Standard controllers for all 3 functions above.
  
  NOTE: In listRestaurantCustomers controller:
    - If req.user.role === 'owner': include phone_full in response
    - If req.user.role === 'manager': include only phone_masked

FILE 3: backend/src/modules/owner-crm/owner-crm.routes.ts
  All routes: authenticate, injectTenant

  GET  /owner/customers           → requireRole('owner','manager'), listRestaurantCustomers
  POST /owner/customers/create-by-restaurant → requireRole('owner','manager'), createCustomerByRestaurant
    body: { name, phone }
  GET  /owner/customers/:id/history → requireRole('owner','manager'), getCustomerHistory

Also add these registrations to app.ts:
  import ownerCrmRoutes from './modules/owner-crm/owner-crm.routes';
  app.use(`${API}`, ownerCrmRoutes);  // Note: routes start with /owner/

Return all 3 files with full paths.
```

### 📤 Expected Output
- 🆕 `backend/src/modules/owner-crm/` — 3 new files

---

# ═══════════════════════════════════════════════
# GROUP P2-E: DELIVERY AUTO-REASSIGNMENT
# ═══════════════════════════════════════════════

---

## PROMPT P2-6 — Delivery Auto-Reassignment + Partner History (Backend)

### 📂 Files to Provide to Claude

```
backend/src/modules/delivery/delivery.service.ts  (full file — ~350 lines)
backend/src/modules/delivery/delivery.routes.ts   (full file)
backend/src/config/supabase.ts
backend/src/config/redis.ts
backend/src/server.ts
backend/src/utils/response.ts
```

### 🎯 Task for Claude

```
You are fixing and enhancing the delivery module in Restaurant OS.

=== FIX 1: Implement the TODO — Auto-Reassign on Decline/Rejection ===

Current code has this comment at line ~164:
  // Clear partner active delivery and re-assign
  // TODO: auto-reassign to next available partner

Find the section where status is updated to 'rejected' or 'failed'.
Replace the TODO with actual auto-reassignment logic:

  // Auto-reassignment algorithm:
  async function autoReassignDelivery(deliveryId: string, failedPartnerId: string, branchId: string) {
    // 1. Get delivery details (order_id, restaurant location)
    const delivery = await supabaseAdmin.from('delivery_assignments')
      .select('order_id, restaurant_lat, restaurant_lon')
      .eq('id', deliveryId).single()
    
    // 2. Find next available partner (nearest, not the failed one)
    const { data: partners } = await supabaseAdmin
      .from('delivery_partners')
      .select('id, lat, lon')
      .eq('branch_id', branchId)
      .eq('is_online', true)
      .is('active_delivery_id', null)
      .neq('id', failedPartnerId)  // exclude the one who failed/rejected
    
    if (!partners || partners.length === 0) {
      // No available partners — send alert to manager
      io.to(`branch:${branchId}:manager`).emit('delivery_no_partner', {
        delivery_id: deliveryId,
        message: 'No available delivery partners for reassignment'
      })
      return
    }
    
    // 3. Sort by distance using haversine
    const sorted = partners
      .map(p => ({ ...p, dist: haversine(delivery.restaurant_lat, delivery.restaurant_lon, p.lat, p.lon) }))
      .sort((a, b) => a.dist - b.dist)
    
    const nextPartner = sorted[0]
    
    // 4. Create new delivery assignment for next partner
    // (reuse existing createDelivery logic with the same order_id)
    // 5. Notify new partner via WebSocket
    io.to(`partner:${nextPartner.id}`).emit('new_delivery_request', {
      delivery_id: deliveryId, order_id: delivery.order_id
    })
  }

  Call this function after rejection with proper error handling.

=== FIX 2: Add Delivery Partner Online/Offline Toggle ===

This is missing from the routes. Add:
  PATCH /delivery/partner/status
    body: { is_online: boolean }
    Updates delivery_partners.is_online
    Emits 'partner_status_changed' to manager room

=== FIX 3: Add Delivery History Endpoint (for delivery/history/page.tsx which doesn't exist yet) ===

ADD to delivery.service.ts:

  FUNCTION: getPartnerHistory(partnerId: string, page: number, limit: number):
    SELECT da.id, da.created_at, da.completed_at, da.status,
      o.id as order_id, o.order_type,
      b.name as branch_name, b.address as pickup_address,
      u.name as customer_name,
      -- Calculate duration in minutes
      EXTRACT(EPOCH FROM (COALESCE(da.completed_at, NOW()) - da.created_at)) / 60 as duration_minutes,
      -- Earnings (stub: ₹30 base + ₹5 per km — customize via env vars)
      (30 + (da.distance_km * 5))::numeric as earnings
    FROM delivery_assignments da
    JOIN orders o ON da.order_id = o.id
    JOIN branches b ON o.branch_id = b.id
    JOIN users u ON o.customer_id = u.id
    WHERE da.partner_id = partnerId
    ORDER BY da.created_at DESC
    OFFSET (page-1)*limit LIMIT limit
  
  Returns: { deliveries, total, stats: { total_deliveries, total_earnings, avg_rating } }

ADD to delivery.routes.ts:
  GET /delivery/partner/history?page=&limit=   → requireRole('delivery_partner'), getPartnerHistory
  GET /delivery/partner/stats                  → requireRole('delivery_partner'), getPartnerStats

=== FIX 4: Add acceptance countdown timer ===

When delivery is assigned to a partner:
  - Set Redis key: 'delivery_acceptance:{deliveryId}:{partnerId}', TTL=30 seconds
  - Create a Bull delayed job: if partner hasn't accepted in 30s, auto-reassign
  
  (The jobs/inventory-alert.ts is an example of how Bull jobs are set up)
  
  ADD file: backend/src/jobs/delivery-acceptance-timeout.ts
    - Checks if delivery is still in 'assigned' status
    - If so: update to 'rejected' and call autoReassignDelivery()

Return:
- Updated delivery.service.ts (with all 4 fixes)
- Updated delivery.routes.ts (with new endpoints)
- New backend/src/jobs/delivery-acceptance-timeout.ts
```

### 📤 Expected Output
- ✏️ `backend/src/modules/delivery/delivery.service.ts`
- ✏️ `backend/src/modules/delivery/delivery.routes.ts`
- 🆕 `backend/src/jobs/delivery-acceptance-timeout.ts`

---

# ═══════════════════════════════════════════════
# GROUP P2-F: ASYNC REPORT EXPORT + ADMIN APPROVAL
# ═══════════════════════════════════════════════

---

## PROMPT P2-7 — Async Report Export with Bull Job (Backend)

### 📂 Files to Provide to Claude

```
backend/src/modules/reports/reports.service.ts     (full file)
backend/src/modules/reports/reports.routes.ts      (full file)
backend/src/jobs/booking-reminder.ts               (existing Bull job as reference)
backend/src/config/env.ts
backend/src/modules/notifications/notifications.service.ts
backend/src/utils/response.ts
```

### 🎯 Task for Claude

```
You are implementing async report export for Restaurant OS.

The product document specifies (M4, M22):
  "Queue job in Bull, generate CSV/XLSX using exceljs library
   Upload to S3, return pre-signed download URL (valid 1 hour)
   Send email notification to admin when ready"

Currently: exportReport() in reports.service.ts streams synchronously (OK for small
datasets but will timeout for large restaurants with 100K+ orders).

=== STEP 1: Create the Bull Job ===

FILE: backend/src/jobs/report-export.ts

  Use the same Bull setup pattern as booking-reminder.ts for reference.
  
  Queue name: 'report-export'
  
  Job data interface:
  interface ReportExportJob {
    report_type: 'sales' | 'menu-performance' | 'kitchen-performance' | 'customer-insights'
    format: 'csv' | 'xlsx' | 'pdf'
    branch_id?: string
    restaurant_id: string
    from: string    // ISO date string
    to: string      // ISO date string
    requested_by_user_id: string
    requested_by_email: string
  }
  
  Job processor:
  
  1. Fetch the report data (call the same query functions from reports.service.ts)
  2. Generate the file:
  
     For CSV (using json2csv — already imported):
       const { Parser } = require('json2csv')
       const parser = new Parser({ fields: getFieldsForReportType(data) })
       const csv = parser.parse(data)
       const buffer = Buffer.from(csv, 'utf8')
  
     For XLSX (using exceljs — npm install exceljs):
       const ExcelJS = require('exceljs')
       const workbook = new ExcelJS.Workbook()
       const sheet = workbook.addWorksheet(report_type)
       sheet.columns = getColumnsForReportType(data)
       data.forEach(row => sheet.addRow(row))
       const buffer = await workbook.xlsx.writeBuffer()
  
     For PDF (using pdfkit — already in package.json):
       Generate a structured PDF with the restaurant name, date range, and data table
  
  3. Upload to S3 (or use Supabase Storage as alternative):
     IF SUPABASE_STORAGE_BUCKET env var is set:
       Use supabaseAdmin.storage.from(bucket).upload(key, buffer)
       Get public URL: supabaseAdmin.storage.from(bucket).getPublicUrl(key)
     ELSE:
       Save to /tmp/{unique-filename}.csv (and return file path — for local dev)
  
  4. Send email notification to the requester:
     Import sendEmail from email module
     Use weeklyReportEmail or a simpler 'Report Ready' email:
       Subject: 'Your report is ready — [Restaurant Name]'
       Body: 'Your [report_type] report for [date range] is ready. 
              Download it here: [download_url] (valid for 24 hours)'
  
  5. Also save the download URL in Redis:
     key: 'report_download:{job_id}', value: download_url, TTL=86400 (24 hours)

=== STEP 2: Update reports.service.ts ===

ADD function: queueReportExport(params: ReportExportJob): Promise<{ job_id: string }>
  - Add job to Bull queue
  - Return { job_id, message: 'Report is being generated. You will receive an email when ready.' }

ADD function: getReportJobStatus(jobId: string): Promise<{ status: 'waiting'|'active'|'completed'|'failed', download_url?: string }>
  - Check Bull job status
  - If completed: return download_url from Redis

=== STEP 3: Update reports.routes.ts ===

Replace the synchronous POST /export route with:
  POST /reports/export → queueReportExport (returns job_id immediately)
  GET  /reports/export/:jobId/status → getReportJobStatus

Keep the synchronous endpoint as /reports/export/sync for small on-demand exports
(< 500 rows, used for the frontend's "Download CSV" button):
  POST /reports/export/sync → keep existing exportReport function

Return all modified/new files.
```

### 📤 Expected Output
- 🆕 `backend/src/jobs/report-export.ts`
- ✏️ `backend/src/modules/reports/reports.service.ts`
- ✏️ `backend/src/modules/reports/reports.routes.ts`

---

## PROMPT P2-8 — Admin Restaurant Approval Workflow (Backend + Frontend)

### 📂 Files to Provide to Claude

```
backend/src/modules/admin/admin.service.ts         (full file)
backend/src/modules/admin/admin.routes.ts          (full file)
backend/src/modules/admin/admin.controller.ts      (full file)
backend/src/email/send.ts
backend/src/email/templates/welcome.ts             (for email pattern reference)
backend/src/modules/notifications/notifications.service.ts
app/admin/restaurants/page.tsx                     (full file — for UI integration)
lib/api-client.ts
types/api.ts
```

### 🎯 Task for Claude

```
You are implementing the Restaurant Approval Workflow for Restaurant OS.

When a new restaurant registers (status='pending'), an admin must:
  1. Review the submission (restaurant details, owner info, GST number)
  2. Approve → restaurant goes live (status='active')
  3. Reject → owner is notified with a reason

Currently: updateRestaurantStatus PATCH endpoint exists but has no approval workflow,
no email notifications, and no dedicated approval UI.

=== BACKEND: Update admin.service.ts ===

ADD FUNCTION: approveRestaurant(restaurantId: string, adminId: string):
  - Find the restaurant (verify status='pending')
  - UPDATE restaurants SET status='active', approved_by=adminId, approved_at=NOW()
  - UPDATE the owner user: SET is_active=true (they may have been pending-inactive)
  - Create Notification for owner: 'Your restaurant has been approved! You can now go live.'
  - Send email (owner's email):
    Subject: '🎉 Your restaurant is approved on DineLuxe!'
    Body: Full approval email:
      - Restaurant name
      - 'You can now set up your menu, floor layout, and staff.'
      - Link to dashboard: process.env.OWNER_DASHBOARD_URL
      - Onboarding checklist: ✅ Step 1: Set up your menu | ✅ Step 2: Design floor layout | ✅ Step 3: Add staff
  - Log to AuditLog: action='RESTAURANT_APPROVED'
  - Emit WebSocket event to admin room (if any): 'restaurant_approved'
  - Return: { success: true, restaurant_id, owner_notified: true }

ADD FUNCTION: rejectRestaurant(restaurantId: string, adminId: string, reason: string):
  - Verify status='pending'
  - UPDATE restaurants SET status='rejected', rejected_by=adminId, rejected_at=NOW(), rejection_reason=reason
  - Create Notification for owner with reason
  - Send email:
    Subject: 'Update on your DineLuxe application'
    Body:
      - 'We reviewed your application for [Restaurant Name]'
      - 'Unfortunately, we are unable to approve it at this time.'
      - Reason: [reason text]
      - 'You may reapply after addressing the above. Contact support@dineluxe.app for help.'
  - Log to AuditLog
  - Return: { success: true }

ADD FUNCTION: getPendingRestaurants(page: number, limit: number):
  - SELECT restaurants WHERE status='pending'
  - JOIN users for owner name, email, phone
  - ORDER BY created_at ASC (oldest first — first come, first serve)
  - Return paginated list with full details for review

UPDATE admin.routes.ts — add:
  GET    /admin/restaurants/pending          → authenticate, requireRole(super_admin, admin), getPendingRestaurants
  POST   /admin/restaurants/:id/approve      → authenticate, requireRole(super_admin, admin), approveRestaurant
  POST   /admin/restaurants/:id/reject       → authenticate, requireRole(super_admin, admin), rejectRestaurant
    body: { reason: string }

=== FRONTEND: Create Admin Approvals Page ===

FILE: app/admin/approvals/page.tsx
"use client"

This page shows pending restaurant applications for admin review.

LAYOUT:
  Page header: "Restaurant Applications" + badge showing pending count
  
  Filter tabs: All Pending | Approved Today | Rejected
  
  Application Cards (each pending restaurant):
    - Restaurant name + cuisine type
    - Owner name + email + phone (masked)
    - Registration date: "Applied 3 days ago"
    - GST number (for verification)
    - Status: "Awaiting Review" (amber badge)
    
    Action buttons on each card:
    [View Full Details] → expands to show all info
    [Approve] (green button) → confirmation: "Approve [Name]? They will receive an email."
    [Reject] (red outline button) → opens a reject modal:
      - Text area: "Reason for rejection (required, min 20 chars)"
      - "Send Rejection" button
    
  Approved section (below pending):
    - Compact table showing recently approved/rejected restaurants
    - Columns: Name | Status | Date | Approved/Rejected By

  Empty state: "No pending applications 🎉"

API calls:
  GET  /api/v1/admin/restaurants/pending   → load pending list
  POST /api/v1/admin/restaurants/:id/approve → approve action
  POST /api/v1/admin/restaurants/:id/reject → reject action with reason

Also create a companion component: components/admin/RestaurantApproval.tsx
This is the expanded detail view that slides in from the right when a card is clicked.
Shows: full restaurant info, owner profile picture, all branch details, documents.

Return all files (backend additions + 2 new frontend files).
```

### 📤 Expected Output
- ✏️ `backend/src/modules/admin/admin.service.ts` (approveRestaurant, rejectRestaurant, getPendingRestaurants)
- ✏️ `backend/src/modules/admin/admin.routes.ts` (new routes)
- 🆕 `app/admin/approvals/page.tsx`
- 🆕 `components/admin/RestaurantApproval.tsx`

---

# ═══════════════════════════════════════════════
# GROUP P2-G: MISSING FRONTEND PAGES
# ═══════════════════════════════════════════════

---

## PROMPT P2-9 — Owner Loyalty Config Page (Frontend)

### 📂 Files to Provide to Claude

```
app/owner/dashboard/page.tsx               (layout reference)
app/owner/branding/page.tsx                (settings page pattern reference — 25KB)
backend/src/modules/loyalty/loyalty.service.ts  (full loyalty service)
backend/src/modules/loyalty/loyalty.routes.ts   (full routes — check endpoints)
lib/api-client.ts
types/api.ts
hooks/useAuth.ts
components/ui/button.tsx
components/ui/input.tsx
```

### 🎯 Task for Claude

```
You are creating the Owner Loyalty Program Configuration page for Restaurant OS.

The loyalty backend (loyalty.service.ts) is fully implemented.
Check the routes file to understand what endpoints exist.

Create TWO files:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 1: components/owner/LoyaltyConfig.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Props: { restaurantId: string }

SECTION 1 — Program Overview (read from the loyalty service):
  API: GET /api/v1/loyalty/stats?restaurant_id={restaurantId}
  Shows:
    📊 Total enrolled members | Total points issued | Total points redeemed | Active this month

SECTION 2 — Configuration Settings:
  
  Points Earning Rate:
    "₹[X] spent = 1 point"
    Default: ₹10 per point (from env: LOYALTY_POINTS_PER_RUPEE)
    Input: number input, 1-100 range
  
  Redemption Rate:
    "1 point = ₹[X]"
    Default: ₹0.10 per point
    Input: number input
  
  Minimum Points to Redeem:
    Default: 50 points
    Input: integer input
  
  Save Settings button → PATCH /api/v1/loyalty/settings

SECTION 3 — Tier System:
  Bronze (0-499 pts): no discount
  Silver (500-1999 pts): 5% discount on all orders
  Gold (2000-4999 pts): 10% discount + priority seating
  Platinum (5000+ pts): 15% discount + complimentary welcome drink
  
  Show these as informational cards (non-editable in Phase 1 — hardcoded tiers).
  Note: "Custom tier configuration coming in Phase 2"

SECTION 4 — Top Loyalty Members:
  API: GET /api/v1/loyalty/leaderboard?restaurant_id={restaurantId}&limit=10
  Shows a table: Rank | Name (first name only) | Points | Tier badge | Last Visit
  
SECTION 5 — Manual Adjustment:
  "Award points to a customer" form:
    - Customer phone input → find customer
    - Points to award (positive integer)
    - Reason (text, required)
    - "Award Points" button → POST /api/v1/loyalty/admin/adjust
  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 2: app/owner/loyalty/page.tsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"use client"
- Page header: "Loyalty Program" + "🏆 Rewards" subtitle
- Import and render: <LoyaltyConfig restaurantId={restaurantId} />
- Handle auth loading state

ALSO: Check loyalty.service.ts for existing endpoints.
If the /loyalty/stats, /loyalty/leaderboard, or /loyalty/admin/adjust endpoints
do NOT exist in loyalty.routes.ts, note them and add them to the service and routes.

Return both files + any loyalty.service.ts additions needed.
```

### 📤 Expected Output
- 🆕 `components/owner/LoyaltyConfig.tsx`
- 🆕 `app/owner/loyalty/page.tsx`
- ✏️ `backend/src/modules/loyalty/loyalty.service.ts` (if additions needed)

---

## PROMPT P2-10 — Delivery Partner History + Stats Page (Frontend)

### 📂 Files to Provide to Claude

```
app/delivery/earnings/page.tsx              (full existing earnings page — 3.4KB)
app/delivery/page.tsx                       (full delivery home page)
lib/api-client.ts
types/api.ts
hooks/useAuth.ts
```

### 🎯 Task for Claude

```
You are creating the Delivery Partner History page for Restaurant OS.

app/delivery/history/page.tsx is MISSING from the codebase.
The backend will expose GET /delivery/partner/history after Prompt P2-6.

Create: app/delivery/history/page.tsx

"use client"

=== PAGE SPECIFICATION ===

API: GET /api/v1/delivery/partner/history?page=&limit=20

PAGE HEADER:
  - Back arrow + "Delivery History"
  - "Showing all your past deliveries"

STATS BAR (4 chips, fetched from GET /delivery/partner/stats):
  📦 Total Deliveries | ₹ Total Earned | ⭐ Average Rating | ⏱️ Avg Duration

FILTER ROW:
  - Date filter: This Week | This Month | All Time
  - Status filter: All | Completed | Failed

DELIVERY HISTORY LIST (paginated, 20 per page):
  Each delivery row card shows:
    - Restaurant name (pickup)
    - Delivery area (drop off — area name, not full address)
    - Date: "May 15, 2025 at 3:45 PM"
    - Duration: "32 minutes"
    - Distance: "4.2 km"
    - Earnings: "₹62.00" (base + distance bonus)
    - Status badge: Completed (green) | Failed (red)
    - Rating: ⭐ 4.8 (if customer rated this delivery)
  
  On card tap: expand to show full delivery details

PAGINATION: "Load More" button at the bottom (infinite scroll style)

EMPTY STATE: "No deliveries yet. Accept your first delivery to see it here."

Return the complete page file.
```

### 📤 Expected Output
- 🆕 `app/delivery/history/page.tsx`

---

## PROMPT P2-11 — Customer Notification Centre (Frontend + Backend)

### 📂 Files to Provide to Claude

```
app/customer/profile/page.tsx                (customer profile for nav pattern)
app/customer/layout.tsx                      (customer layout)
backend/src/modules/notifications/notifications.service.ts  (full service)
backend/src/modules/notifications/notifications.routes.ts   (full routes)
lib/api-client.ts
lib/socket.ts
types/api.ts
hooks/useAuth.ts
```

### 🎯 Task for Claude

```
You are creating the Customer Notification Centre for Restaurant OS.

app/customer/notifications/page.tsx is MISSING from the codebase.

=== CHECK notifications.routes.ts first ===
If these endpoints don't exist, you'll need to add them to the notifications service:
  GET  /notifications → list user's notifications (paginated)
  PATCH /notifications/:id/read → mark as read
  PATCH /notifications/read-all → mark all as read
  DELETE /notifications/:id → delete a notification

=== CREATE FILE: app/customer/notifications/page.tsx ===

"use client"

DESIGN:
  Page header: "Notifications" + "Mark all read" button (text, top right)
  
  Filter tabs (horizontal):
    All | Orders | Bookings | Promotions | System
  
  Notification groups (by date):
    "Today"
      [notification cards]
    "Yesterday"
      [notification cards]
    "Older"
      [notification cards]

  Each notification card:
    - Icon: depends on type:
      order → 🛍️ (amber)  
      booking → 📅 (navy)
      payment → 💳 (green)
      system → 🔔 (gray)
      loyalty → 🏆 (gold)
    - Title (bold)
    - Body text
    - Relative time: "2 hours ago"
    - Unread indicator: left blue border + slightly bolder text
    - Tap → mark as read + navigate to relevant page (from reference_type + reference_id):
        order → /customer/order/{reference_id}
        booking → /customer/booking (or specific booking)
        payment → /customer/payment/success

  WebSocket:
    On mount: socket.on('new_notification', (notif) => {
      // Prepend new notification to list
      // Update unread count in header
    })
    On unmount: socket.off('new_notification')

  Loading: skeleton list (5 skeleton cards)
  
  Empty state:
    Big bell icon with: "You're all caught up! 🎉"
    Subtitle: "New notifications about your orders and bookings will appear here."

=== ALSO: Update components/layout/BottomNav.tsx ===

Check if there's already a notifications icon in the customer bottom nav.
If not, add a bell icon with unread count badge:
  - Fetch unread count: GET /api/v1/notifications?unread=true&count=true
  - Show red badge with count (max display: "9+")
  - Navigate to /customer/notifications on tap

Return: app/customer/notifications/page.tsx + updated BottomNav (if changes needed)
+ any notifications.service.ts additions
```

### 📤 Expected Output
- 🆕 `app/customer/notifications/page.tsx`
- ✏️ `backend/src/modules/notifications/notifications.service.ts` (if additions needed)
- ✏️ `components/layout/BottomNav.tsx` (if notifications icon missing)

---

## PROMPT P2-12 — Fix Owner Reports API Path Mismatch (Frontend)

### 📂 Files to Provide to Claude

```
app/owner/reports/page.tsx             (full file — 6.8KB)
backend/src/modules/reports/reports.routes.ts   (full routes file)
lib/api-client.ts
```

### 🎯 Task for Claude

```
You are fixing a confirmed API path mismatch in Restaurant OS.

PROBLEM FOUND:
The frontend app/owner/reports/page.tsx calls:
  apiClient.get(`/restaurant/${restaurantId}/reports?${queryRange}`)

But the backend reports.routes.ts registers routes at:
  /reports/revenue, /reports/orders, /reports/menu, /reports/staff

These paths DO NOT MATCH. The frontend will get 404 errors.

ALSO FOUND: The frontend only shows ONE combined chart, but the backend has
4 separate tabbed endpoints (revenue, orders, menu, staff).

Please:
1. Read both files carefully
2. Update app/owner/reports/page.tsx to:
   a. Use the CORRECT API paths from reports.routes.ts
   b. Add 4 tabs: Revenue | Orders | Menu | Staff
   c. Each tab fetches from the correct endpoint:
      Revenue tab: GET /api/v1/reports/revenue?branch_id=&from=&to=
      Orders tab:  GET /api/v1/reports/orders?branch_id=&from=&to=
      Menu tab:    GET /api/v1/reports/menu?branch_id=&from=&to=
      Staff tab:   GET /api/v1/reports/staff?branch_id=&from=&to=
   d. Add branch selector if owner has multiple branches
      (fetch from GET /api/v1/branches — inject restaurantId via JWT)
   e. Keep the Export CSV functionality but update path to:
      POST /api/v1/reports/export/sync (synchronous export for small data)
      and POST /api/v1/reports/export (async for large data)

3. Match the response shapes to what the backend actually returns
   (read reports.service.ts if needed to understand response shape)

Return the COMPLETE updated app/owner/reports/page.tsx.
```

### 📤 Expected Output
- ✏️ `app/owner/reports/page.tsx` — Fixed with correct API paths and 4 tabs

---

# ═══════════════════════════════════════════════
# GROUP P2-H: WHITE-LABEL ENHANCED THEMING
# ═══════════════════════════════════════════════

---

## PROMPT P2-13 — Enhanced White-Label Branding System (Frontend)

### 📂 Files to Provide to Claude

```
components/layout/BrandingProvider.tsx         (full existing file — ~200 lines)
app/layout.tsx                                 (root layout)
app/owner/branding/page.tsx                    (full branding configuration page)
lib/constants.ts
tailwind.config.ts
```

### 🎯 Task for Claude

```
You are enhancing the White-Label Branding System for Restaurant OS.

The product document (M2) specifies that each restaurant gets:
  - Custom primary/secondary colors applied platform-wide via CSS variables
  - Custom app name displayed in the browser tab and UI header
  - Custom font loaded from Google Fonts
  - Custom welcome animation on splash screen
  - Branding applied instantly without page reload

Currently: BrandingProvider.tsx exists and handles color variables but:
  1. Font preference is stored in DB but NEVER dynamically loaded
  2. Welcome animation preference is stored but not connected to SplashScreen
  3. The CSS variables are applied but not all Tailwind classes use them
  4. No way to preview branding changes in real-time

=== UPDATE components/layout/BrandingProvider.tsx ===

ADD: Dynamic Font Loading
  After fetching branding data, dynamically load the font:
  
  const FONT_URLS: Record<string, string> = {
    'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    'Geist': 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap',
    'Poppins': 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap',
    'Nunito': 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap',
    'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap',
    'DM Sans': 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap',
  }
  
  function loadFont(fontName: string) {
    if (typeof document === 'undefined') return
    const existing = document.querySelector(`link[data-font="${fontName}"]`)
    if (existing) return  // already loaded
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONT_URLS[fontName] || FONT_URLS['Inter']
    link.dataset.font = fontName
    document.head.appendChild(link)
    // Apply to root element
    document.documentElement.style.setProperty('--font-primary', `'${fontName}', sans-serif`)
    document.documentElement.style.fontFamily = `'${fontName}', sans-serif`
  }

ADD: Welcome Animation Context Value
  Expose the welcome_animation value so SplashScreen can consume it:
  
  Update BrandingContextValue interface:
    welcomeAnimation: string  // 'food_standard' | 'food_premium' | 'minimal' | 'confetti'
  
  SplashScreen checks this value to decide which animation to show.

ADD: Real-Time Preview Hook
  Export a new hook: useBrandingPreview()
  This is used ONLY in app/owner/branding/page.tsx for live preview.
  
  const [previewOverride, setPreviewOverride] = useState<Partial<Branding> | null>(null)
  
  When setPreviewOverride is called with temporary values:
    - Apply them to CSS immediately (without saving to DB)
    - When preview is cleared: restore the saved branding
  
  Return: { previewOverride, setPreviewOverride, clearPreview }

=== UPDATE app/owner/branding/page.tsx ===

Read the existing page carefully.
Add a LIVE PREVIEW panel on the right side (or a preview modal):

  <BrandingPreviewPanel 
    colors={{ primary: selectedPrimary, secondary: selectedSecondary }}
    font={selectedFont}
    appName={selectedAppName}
  />
  
  This component renders a mini version of the DineLuxe app UI (a fake phone frame)
  showing how the branding will look. Update in real-time as inputs change.

ALSO ADD: Font selector in the branding form
  Currently the font_preference field may be missing from the UI.
  Add a font picker with 6 font options:
    - Show each option in its own font style
    - Live preview updates when selected

=== CREATE: components/layout/BrandingPreviewPanel.tsx ===

A mini phone-frame mockup showing:
  - App header with custom primary color and logo
  - A sample restaurant card with custom accent color  
  - Font applied throughout
  - Custom app name in header

Update props whenever parent form values change (no debounce needed — React state).

Return:
- Updated BrandingProvider.tsx
- Updated app/owner/branding/page.tsx (with live preview panel)
- New components/layout/BrandingPreviewPanel.tsx
```

### 📤 Expected Output
- ✏️ `components/layout/BrandingProvider.tsx` — with font loading + preview
- ✏️ `app/owner/branding/page.tsx` — with live preview panel
- 🆕 `components/layout/BrandingPreviewPanel.tsx`

---

# ═══════════════════════════════════════════════
# GROUP P2-I: PRODUCTION HARDENING
# ═══════════════════════════════════════════════

---

## PROMPT P2-14 — Fix All Known API Contract Mismatches

### 📂 Files to Provide to Claude

```
app/owner/staff/page.tsx                   (references StaffManagement component)
components/owner/StaffManagement.tsx       (full component)
backend/src/modules/staff/staff.routes.ts  (full routes)
backend/src/modules/staff/staff.service.ts (full service)
app/staff/manager/dashboard/page.tsx       (full manager dashboard)
backend/src/modules/branches/branches.routes.ts
backend/src/modules/restaurants/restaurants.routes.ts
lib/api-client.ts
```

### 🎯 Task for Claude

```
You are auditing and fixing all known API contract mismatches in Restaurant OS.

=== CONTRACT MISMATCH AUDIT ===

For each file provided, identify all apiClient calls and verify they match the
backend route definitions. Look for:
  1. Wrong HTTP methods (GET vs POST)
  2. Wrong URL paths (e.g., /restaurant/:id/staff vs /staff/branch/:branchId)
  3. Wrong field names in request bodies
  4. Missing required parameters
  5. Routes that don't exist in the backend

=== KNOWN MISMATCH 1: StaffManagement component ===
The comment in app/owner/staff/page.tsx explicitly says:
  "Wrong endpoint  /restaurant/:id/staff  (should be /staff/branch/:branchId)"
  "Wrong field names  name  (should be first_name / last_name)"
  "Toggle hit PATCH /staff/:id with { isActive } instead of PATCH /staff/:id/toggle-access"
  
BUT it says all logic moved to StaffManagement.tsx — read that component
and verify it's using the CORRECT endpoints. If not, fix it.

=== KNOWN MISMATCH 2: Manager Dashboard ===
The manager dashboard may call endpoints that don't exist.
Check all apiClient calls in app/staff/manager/dashboard/page.tsx
and verify they match the routes in branches.routes.ts and staff.routes.ts.

=== COMPREHENSIVE FIX ===

1. Read all provided files carefully
2. List every mismatch you find (be thorough)
3. Fix them — prioritize:
   a. Fix frontend files to call correct backend endpoints
   b. If a backend endpoint is genuinely missing, note it
      (don't create new backend files in this prompt — just note the gap)
4. Return all fixed frontend files

Format your response as:
  MISMATCH AUDIT REPORT
  ---------------------
  1. [File] calls [wrong path] → should be [correct path]  → [fixed/noted]
  
  FIXED FILES:
  [full updated file contents]
```

### 📤 Expected Output
- Audit report + ✏️ Fixed frontend/component files

---

## PROMPT P2-15 — Global Error Boundary + Loading States (Frontend)

### 📂 Files to Provide to Claude

```
app/layout.tsx                             (root layout)
app/customer/layout.tsx                    (customer layout)
app/owner/layout.tsx                       (owner layout)
app/staff/layout.tsx                       (staff layout)
components/shared/EmptyState.tsx           (existing empty state)
components/shared/KPICard.tsx              (for skeleton reference)
lib/api-client.ts
```

### 🎯 Task for Claude

```
You are implementing global error handling and loading states for Restaurant OS.

=== CREATE: components/error/GlobalErrorBoundary.tsx ===

A React class error boundary component that catches runtime errors.

Props: { children, fallback?: ReactNode }

State: { hasError: boolean, error: Error | null, errorInfo: any }

Catches: componentDidCatch → log to a monitoring service (or console in dev)

Display when error caught:
  - Full-screen centered layout
  - DineLuxe logo
  - "Something went wrong" heading
  - Error message (show in dev, hide in production)
  - "Try refreshing the page" subtitle
  - Two buttons: [Reload Page] and [Go Home]

=== CREATE: components/error/NetworkErrorBanner.tsx ===

A banner shown when the app detects it's offline.

Uses: window.addEventListener('online'/'offline')
Shows: Fixed bottom bar (z-50) when offline:
  "⚠️ You appear to be offline. Some features may not work."
  Dismissible with X button.
  Auto-hides when back online with "✅ Back online!" flash.

=== UPDATE: lib/api-client.ts ===

Add global error interceptor:
  - On 401: clear stored JWT, redirect to /auth/login with ?redirect=currentPath
  - On 403: show toast "You don't have permission to do this"
  - On 429: show toast "Too many requests. Please wait a moment."
  - On 500: show toast "Server error. Please try again." (don't expose details)
  - On network error (fetch throws): show toast "Connection error. Check your internet."

=== CREATE: components/shared/PageLoader.tsx ===

Full-page loading spinner for route transitions.

Props: { message?: string }

Design:
  - Centered vertically and horizontally
  - Animated: rotating ring (using Tailwind animate-spin)
  - DineLuxe navy color (#1A3C5E)
  - Optional message below spinner
  - Subtle fade-in animation

=== UPDATE: app/layout.tsx ===

Wrap children in GlobalErrorBoundary.
Add NetworkErrorBanner inside the layout.

=== CREATE: hooks/useErrorHandler.ts ===

Custom hook for consistent error handling in components:
  
  const { handleError, clearError, error } = useErrorHandler()
  
  handleError(err: unknown):
    - Extracts error message from various shapes (Error, ApiError, string)
    - Shows appropriate toast (using sonner)
    - Returns the normalized error message
  
  Usage pattern:
    const { handleError } = useErrorHandler()
    try {
      await apiClient.post('/something', data)
    } catch (err) {
      handleError(err)  // single line instead of try/catch boilerplate
    }

Return all new/modified files.
```

### 📤 Expected Output
- 🆕 `components/error/GlobalErrorBoundary.tsx`
- 🆕 `components/error/NetworkErrorBanner.tsx`
- 🆕 `components/shared/PageLoader.tsx`
- 🆕 `hooks/useErrorHandler.ts`
- ✏️ `lib/api-client.ts` (with error interceptors)
- ✏️ `app/layout.tsx` (with error boundary)

---

## PROMPT P2-16 — Backend Rate Limiting + Request Validation Hardening

### 📂 Files to Provide to Claude

```
backend/src/app.ts
backend/src/middleware/auth.middleware.ts
backend/src/middleware/rbac.middleware.ts
backend/src/middleware/validate.middleware.ts
backend/src/config/env.ts
backend/.env.example
```

### 🎯 Task for Claude

```
You are hardening the Restaurant OS backend against abuse and invalid inputs.

=== TASK 1: Enhance Rate Limiting ===

Read the current app.ts rate limiting setup.
Upgrade it with TIERED rate limits based on endpoint sensitivity:

  // Tier 1 — Auth (strictest — prevent brute force)
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 10,
    message: { success: false, error: { code: 'RATE_LIMIT_AUTH', message: 'Too many auth attempts. Try again in 15 minutes.' }},
    standardHeaders: true,
    legacyHeaders: false,
  })
  Apply to: /auth/login, /auth/forgot-password, /auth/verify-otp

  // Tier 2 — Write operations (moderate)
  const writeRateLimit = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 30,
    skipSuccessfulRequests: false,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests.' }},
  })
  Apply to: POST/PATCH/DELETE on all resource routes

  // Tier 3 — Read operations (lenient)
  const readRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
  })
  Apply to: GET requests globally

  // Tier 4 — Upload (strictest per hour)
  const uploadRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 20,
    message: { success: false, error: { code: 'RATE_LIMIT_UPLOAD', message: 'Upload limit reached. Try again in an hour.' }},
  })
  Apply to: /branding/upload-url route

=== TASK 2: Add Request Size Guards ===

For image/file upload endpoints (POST /branding/upload-url):
  - Validate file_size in body doesn't exceed allowed limit
  - If file_size > 5MB for banners: return 400 immediately (before generating S3 URL)

For bulk operations (POST /inventory/deduct, POST /menu/items/bulk-price-update):
  - Limit array lengths to prevent timeout attacks
  - Already handled by Zod schemas — verify they have max() constraints

=== TASK 3: Add IP-based suspicious activity logging ===

If the same IP hits 401 more than 5 times in 5 minutes:
  - Log to AuditLog table: { action: 'SUSPICIOUS_AUTH_ATTEMPT', ip_address }
  - Not blocking — just logging for monitoring

Add to auth middleware:
  - Track failed auth attempts in Redis: key='failed_auth:{ip}' TTL=5min
  - Increment on 401, log audit if > 5

=== TASK 4: Verify all required env vars exist at startup ===

Add to server.ts startup:
  const REQUIRED_VARS = [
    'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_JWT_SECRET', 'REDIS_URL', 'JWT_ACCESS_SECRET'
  ]
  
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      console.error(`FATAL: Missing required environment variable: ${varName}`)
      process.exit(1)
    }
  }

Return updated files:
- backend/src/app.ts (with tiered rate limiting)
- backend/src/middleware/auth.middleware.ts (with suspicious activity logging)
- backend/src/server.ts (with startup env var check)
```

### 📤 Expected Output
- ✏️ `backend/src/app.ts` (tiered rate limiting)
- ✏️ `backend/src/middleware/auth.middleware.ts` (suspicious IP logging)
- ✏️ `backend/src/server.ts` (env var startup check)

---

# ═══════════════════════════════════════════════
# GROUP P2-J: ADVANCED AI FEATURES
# ═══════════════════════════════════════════════

---

## PROMPT P2-17 — Customer Item-Level Rating System (Frontend + Backend)

### 📂 Files to Provide to Claude

```
app/customer/payment/success/page.tsx     (full existing success page — 9.2KB)
app/customer/payment/[orderId]/page.tsx   (full payment flow page)
backend/src/modules/reviews/reviews.service.ts
backend/src/modules/reviews/reviews.routes.ts
lib/api-client.ts
types/api.ts
```

### 🎯 Task for Claude

```
You are implementing item-level ratings for Restaurant OS customer app.

The product document (M13-17) specifies:
  "Rating Modal (post-payment):
   → Overall restaurant rating (1-5 stars)
   → Item-level section: each ordered dish with its own 1-5 star selector
   → Text review box (optional)
   → Photo upload (up to 3 photos)
   → Skip and Submit buttons"

Currently: payment/success/page.tsx exists but the rating prompt likely 
only captures overall rating.

=== STEP 1: Create Rating Component ===

CREATE: components/customer/PostOrderRating.tsx

Props: {
  orderId: string
  restaurantId: string
  orderItems: Array<{ menu_item_id: string, name: string, photo_url?: string, quantity: number }>
  onSubmit: () => void
  onSkip: () => void
}

DESIGN (slides up from bottom as a sheet):
  
  Header: "How was your experience?" + restaurant name
  
  SECTION 1 — Overall Rating:
    5 interactive stars (tap to select, half-stars not supported)
    Labels: 1=Terrible, 2=Bad, 3=OK, 4=Good, 5=Excellent
    Animate selected stars: scale + color fill
  
  SECTION 2 — Item Ratings (only if overall > 0):
    "Rate each dish" subtitle
    For each order_item:
      - Small thumbnail (if photo_url) or food emoji placeholder
      - Item name
      - 5 micro-stars (smaller than overall)
      - No labels needed — just tap a star
    Items scroll horizontally (max 3 visible, swipe for more)
  
  SECTION 3 — Text Review (optional):
    Placeholder: "What did you love? What could be better?"
    Character count: 0/500
    Only shown if overall rating > 0
  
  SECTION 4 — Photo Upload (optional):
    3 photo slots (+ icon in each empty slot)
    On tap: open camera or gallery
    Show thumbnails of selected photos
    Limit: 3 photos, max 5MB each
  
  BOTTOM BUTTONS:
    [Skip Rating] (text button, subtle) | [Submit Review] (filled button, navy)
  
  Submit calls:
    POST /api/v1/reviews with:
      { order_id, restaurant_id, overall_rating, text_review, item_ratings: [{menu_item_id, rating}], photo_urls }
  
  On success: close sheet, show brief "Thanks for your review! 🙏" toast

=== STEP 2: Check reviews.service.ts ===

Read reviews.service.ts and verify that:
  a. item_ratings JSONB field is stored correctly
  b. Multiple photos can be attached
  c. The review is linked to the order_id for deduplication (prevent double review)

If any of these are missing, add the logic and return updated reviews.service.ts.

=== STEP 3: Update payment/success/page.tsx ===

Read the current file. Find where the rating prompt is (or add it):
  - After the success animation settles (1.5 second delay)
  - Show: <PostOrderRating /> component as a slide-up sheet
  - Pass the order items (fetch from GET /api/v1/orders/:orderId)
  - On skip or submit: navigate to /customer/home

Return the PostOrderRating component + updated payment/success/page.tsx
+ any reviews.service.ts updates needed.
```

### 📤 Expected Output
- 🆕 `components/customer/PostOrderRating.tsx`
- ✏️ `app/customer/payment/success/page.tsx` (with rating integration)
- ✏️ `backend/src/modules/reviews/reviews.service.ts` (if updates needed)

---

## PROMPT P2-18 — Sentiment Analysis Integration for Reviews (Backend)

### 📂 Files to Provide to Claude

```
backend/src/modules/reviews/reviews.service.ts
backend/src/modules/reviews/reviews.routes.ts
backend/src/jobs/booking-reminder.ts          (Bull job pattern reference)
backend/src/config/env.ts
backend/src/config/redis.ts
```

### 🎯 Task for Claude

```
You are implementing sentiment analysis for customer reviews in Restaurant OS.

The product document (M20) specifies two approaches:
  Option A — Keyword scoring (free, fast) — implement this as default
  Option B — Hugging Face API (higher accuracy) — implement as optional upgrade

=== IMPLEMENT SENTIMENT ANALYSIS ===

ADD to reviews.service.ts:

FUNCTION: analyzeSentiment(text: string): { label: 'positive' | 'neutral' | 'negative', score: number }

  // Option A — Keyword scoring (always runs)
  const POSITIVE_WORDS = [
    'amazing', 'great', 'excellent', 'loved', 'perfect', 'fantastic', 'wonderful',
    'delicious', 'outstanding', 'superb', 'awesome', 'brilliant', 'best', 'fresh',
    'tasty', 'crispy', 'friendly', 'quick', 'clean', 'recommended', 'impressed',
    'enjoyed', 'definitely', 'return', 'again', 'again', 'hot', 'flavorful'
  ]
  
  const NEGATIVE_WORDS = [
    'terrible', 'awful', 'worst', 'disgusting', 'cold', 'rude', 'slow', 'late',
    'overpriced', 'stale', 'dirty', 'disappointing', 'bad', 'never', 'horrible',
    'bland', 'undercooked', 'overcooked', 'wrong', 'missing', 'dry', 'burnt',
    'tough', 'soggy', 'inedible', 'waste', 'refund', 'complaint', 'avoid'
  ]
  
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
  const posCount = words.filter(w => POSITIVE_WORDS.includes(w)).length
  const negCount = words.filter(w => NEGATIVE_WORDS.includes(w)).length
  
  const rawScore = posCount - negCount
  const normalizedScore = rawScore / Math.max(words.length, 1)
  
  const label = posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral'
  const score = Math.abs(normalizedScore)  // always positive 0-1
  
  // Option B — Hugging Face API (if HUGGINGFACE_API_KEY is set in env)
  if (process.env.HUGGINGFACE_API_KEY && text.length > 20) {
    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: text.slice(0, 512) })  // API limit
        }
      )
      const data = await response.json()
      if (data?.[0]) {
        const hfLabel = data[0].label.toLowerCase() as 'positive' | 'negative'
        const hfScore = data[0].score
        return { label: hfScore > 0.6 ? hfLabel : 'neutral', score: hfScore }
      }
    } catch {
      // Fallback to keyword scoring silently
    }
  }
  
  return { label, score }

UPDATE createReview function in reviews.service.ts:
  After saving the review, call analyzeSentiment(text_review)
  UPDATE reviews SET sentiment_label = label, sentiment_score = score WHERE id = review.id
  
  This should be done ASYNCHRONOUSLY (don't make the customer wait):
  setImmediate(async () => {
    const sentiment = await analyzeSentiment(review.text_review)
    await supabaseAdmin.from('reviews').update(sentiment).eq('id', review.id)
  })

ADD: Aggregate sentiment for restaurant analytics
FUNCTION: getRestaurantSentimentSummary(restaurantId: string, periodDays: number = 30):
  Returns: { 
    positive_pct, neutral_pct, negative_pct,
    total_reviews,
    most_common_positives: string[],  // top 5 positive keywords
    most_common_negatives: string[],  // top 5 negative keywords
    trend: 'improving' | 'declining' | 'stable'  // compare last 30d vs previous 30d
  }
  
  Cache in Redis: 'sentiment:{restaurantId}:{days}', TTL=1 hour

ADD to reviews.routes.ts:
  GET /reviews/sentiment-summary/:restaurantId → authenticate, getRestaurantSentimentSummary

Return updated reviews.service.ts and reviews.routes.ts.
```

### 📤 Expected Output
- ✏️ `backend/src/modules/reviews/reviews.service.ts`
- ✏️ `backend/src/modules/reviews/reviews.routes.ts`

---

# ═══════════════════════════════════════════════
# GROUP P2-K: FINAL INTEGRATIONS
# ═══════════════════════════════════════════════

---

## PROMPT P2-19 — Wire All New Modules from Part 2 into app.ts

### 📂 Files to Provide to Claude

```
backend/src/app.ts                              (updated from Part 1 Prompt 7)
```

### 🎯 Task for Claude

```
You are adding all new Part 2 backend module routes to app.ts.

Read the current app.ts carefully and add these new imports and registrations.
Keep ALL existing code exactly as-is. Only ADD new lines.

=== NEW IMPORTS ===

import waiterAssignmentRoutes from './modules/waiter-assignment/waiter-assignment.routes';
import paymentGatewayRoutes from './modules/payment-gateway/payment-gateway.routes';
import ownerCrmRoutes from './modules/owner-crm/owner-crm.routes';

=== NEW ROUTE REGISTRATIONS ===

// Part 2 — Phase 3 Modules
app.use(`${API}`, ownerCrmRoutes);           // mounts /owner/customers routes
app.use(`${API}/waiter-assignment`, waiterAssignmentRoutes);
app.use(`${API}/payment-gateway`, paymentGatewayRoutes);

=== ALSO: Start the background jobs ===

Add to server startup section (or wherever other jobs are started):

// Start delivery acceptance timeout job processor
import './jobs/delivery-acceptance-timeout';

// Start report export job processor
import './jobs/report-export';

// Start materialized view refresh cron (every hour at :00)
import cron from 'node-cron';
cron.schedule('0 * * * *', async () => {
  try {
    await supabaseAdmin.rpc('refresh_materialized_views');
    // Create this RPC in supabase — it runs REFRESH MATERIALIZED VIEW CONCURRENTLY for all 3 views
    console.log('[cron] Materialized views refreshed');
  } catch (err) {
    console.error('[cron] Materialized view refresh failed:', err);
  }
});

Also add a Supabase RPC for the cron:
  CREATE OR REPLACE FUNCTION refresh_materialized_views()
  RETURNS void LANGUAGE plpgsql AS $$
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_branch_daily_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_menu_item_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_restaurant_monthly_summary;
  END; $$;

Return the complete updated app.ts.
```

### 📤 Expected Output
- ✏️ `backend/src/app.ts` — Updated with all Part 2 routes

---

## PROMPT P2-20 — Final Navigation + Sidebar Updates

### 📂 Files to Provide to Claude

```
components/layout/Sidebar.tsx              (updated from Part 1 Prompt 21)
components/layout/BottomNav.tsx            (updated from Part 1 Prompt 21)
```

### 🎯 Task for Claude

```
You are adding all new Part 2 pages to the navigation.

Read both files carefully and add the following new nav items:

=== OWNER SIDEBAR additions (after existing items) ===
If these don't already exist, add:
  { label: 'Loyalty Program', href: '/owner/loyalty', icon: Award, roles: ['owner'] }
  { label: 'Customers', href: '/owner/customers', icon: Users, roles: ['owner', 'manager'] }

=== ADMIN SIDEBAR additions ===
  { label: 'Approvals', href: '/admin/approvals', icon: CheckSquare, roles: ['super_admin', 'admin'],
    badge: 'pending_count'  }  // show count of pending restaurants
  { label: 'Refunds', href: '/admin/refunds', icon: RotateCcw, roles: ['super_admin'] }

=== DELIVERY BOTTOM NAV additions ===
If the delivery partner app has a bottom nav, add:
  { label: 'History', href: '/delivery/history', icon: History }

=== CUSTOMER BOTTOM NAV additions ===
If notifications bell is not already there, add to BottomNav.
(Already partially addressed in P2-11 — check if it was added)

For the Approvals nav item:
  - Add a badge showing count of pending restaurant applications
  - Fetch from GET /api/v1/admin/restaurants/pending (only count, use ?count=true)
  - Show red badge if count > 0
  - Update every 5 minutes via polling

Return the complete updated Sidebar.tsx and BottomNav.tsx.
```

### 📤 Expected Output
- ✏️ `components/layout/Sidebar.tsx` (with new nav items)
- ✏️ `components/layout/BottomNav.tsx` (with new items)

---

# ═══════════════════════════════════════════════
# PART 2 — COMPLETE FILE CHECKLIST
# ═══════════════════════════════════════════════

## 📂 ALL NEW FILES FROM PART 2 (32 New + 18 Modified)

### New Database Files (3)
```
supabase/rpc_functions.sql              ← P2-1 (9 RPCs + 3 materialized views)
supabase/rls_policies.sql               ← P2-2
supabase/materialized_views.sql         ← P2-1 (included in rpc_functions.sql)
```

### New Backend Module Files (10)
```
backend/src/modules/waiter-assignment/waiter-assignment.service.ts  ← P2-3
backend/src/modules/waiter-assignment/waiter-assignment.routes.ts   ← P2-3
backend/src/modules/payment-gateway/payment-gateway.service.ts      ← P2-4
backend/src/modules/payment-gateway/payment-gateway.controller.ts   ← P2-4
backend/src/modules/payment-gateway/payment-gateway.routes.ts       ← P2-4
backend/src/modules/owner-crm/owner-crm.service.ts                  ← P2-5
backend/src/modules/owner-crm/owner-crm.controller.ts               ← P2-5
backend/src/modules/owner-crm/owner-crm.routes.ts                   ← P2-5
backend/src/jobs/delivery-acceptance-timeout.ts                      ← P2-6
backend/src/jobs/report-export.ts                                    ← P2-7
```

### New Frontend Pages (4)
```
app/owner/loyalty/page.tsx              ← P2-9
app/delivery/history/page.tsx           ← P2-10
app/customer/notifications/page.tsx     ← P2-11
app/admin/approvals/page.tsx            ← P2-8
```

### New Frontend Components (10)
```
components/payment/RazorpayCheckout.tsx       ← P2-4
components/payment/UPIQRSheet.tsx             ← P2-4
components/payment/SplitBillSheet.tsx         ← P2-4
components/owner/LoyaltyConfig.tsx            ← P2-9
components/admin/RestaurantApproval.tsx       ← P2-8
components/customer/PostOrderRating.tsx       ← P2-17
components/error/GlobalErrorBoundary.tsx      ← P2-15
components/error/NetworkErrorBanner.tsx       ← P2-15
components/shared/PageLoader.tsx              ← P2-15
components/layout/BrandingPreviewPanel.tsx    ← P2-13
```

### New Utility Files (1)
```
hooks/useErrorHandler.ts                ← P2-15
```

### Modified Backend Files (9)
```
backend/src/app.ts                                          ← P2-19
backend/src/server.ts                                       ← P2-16
backend/src/middleware/auth.middleware.ts                    ← P2-16
backend/src/modules/orders/orders.service.ts                ← P2-3
backend/src/modules/tables/tables.service.ts                ← P2-3
backend/src/modules/delivery/delivery.service.ts            ← P2-6
backend/src/modules/delivery/delivery.routes.ts             ← P2-6
backend/src/modules/reports/reports.service.ts              ← P2-7
backend/src/modules/reports/reports.routes.ts               ← P2-7
backend/src/modules/admin/admin.service.ts                  ← P2-8
backend/src/modules/admin/admin.routes.ts                   ← P2-8
backend/src/modules/reviews/reviews.service.ts              ← P2-17, P2-18
backend/src/modules/reviews/reviews.routes.ts               ← P2-18
backend/src/modules/loyalty/loyalty.service.ts              ← P2-9 (if needed)
```

### Modified Frontend Files (8)
```
app/owner/reports/page.tsx                              ← P2-12 (critical fix)
app/owner/branding/page.tsx                             ← P2-13
app/customer/payment/success/page.tsx                   ← P2-17
components/layout/BrandingProvider.tsx                  ← P2-13
components/layout/Sidebar.tsx                           ← P2-20
components/layout/BottomNav.tsx                         ← P2-20, P2-11
app/layout.tsx                                          ← P2-15
lib/api-client.ts                                       ← P2-15
```

---

## 📊 COMPLETE IMPLEMENTATION SEQUENCE (Parts 1 + 2 Combined)

```
🔴 CRITICAL (Must do FIRST — things are broken without these)
   → P2-1:  Missing RPC functions (crashes admin + reports)
   → P2-12: Owner reports page path mismatch (404 errors)
   → P2-2:  RLS policies (security gap)

🟠 HIGH PRIORITY (Core features that document promises)
   → P2-3:  Waiter auto-assignment (key operational feature)
   → P2-4:  Razorpay + UPI QR payment integration (no payments work without this)
   → P2-8:  Admin restaurant approval workflow
   → P2-5:  Owner Customer CRM backend

🟡 MEDIUM PRIORITY (Complete the product)
   → P2-6:  Delivery auto-reassignment
   → P2-7:  Async report export
   → P2-9:  Owner Loyalty config page
   → P2-10: Delivery history page
   → P2-11: Customer notifications
   → P2-13: Enhanced white-label branding

🟢 POLISH (Production readiness)
   → P2-14: API contract mismatch audit + fixes
   → P2-15: Error boundaries + global error handling
   → P2-16: Rate limiting hardening
   → P2-17: Item-level ratings
   → P2-18: Sentiment analysis
   → P2-19: Wire all modules in app.ts
   → P2-20: Final navigation updates
```

---

## 📊 COMBINED TOTALS (Parts 1 + 2 Together)

| Category | Part 1 | Part 2 | **Total** |
|---|---|---|---|
| Detailed Prompts | 38 | 20 | **58** |
| New Files | ~90 | 32 | **~122** |
| Modified Files | ~30 | 18 | **~48** |
| SQL Functions | 4 | 9 + 3 views | **16** |
| New Backend Modules | 10 | 3 | **13** |
| New Frontend Pages | 8 | 4 | **12** |
| New Components | 12 | 10 | **22** |

---

*Restaurant OS — Complete Implementation Prompt Library PART 2*
*Priyanshu Kumar Gupta & Ronit Gupta | Deep Analysis Version | 2025*
*Every prompt is production-grade — run them in sequence for best results*
