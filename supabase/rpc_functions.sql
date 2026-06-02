-- =============================================================================
-- Restaurant OS — Supabase RPC Functions
-- File: supabase/rpc_functions.sql
-- =============================================================================
-- Run this file once in the Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- All functions use CREATE OR REPLACE so re-running is safe.
--
-- Execution order:
--   1.  Schema prerequisite columns  (restaurants columns added via ALTER TABLE)
--   2.  Materialized views            (mv_*)
--   3.  Utility / helper views        (waiter_workload)
--   4.  Core RPCs                     (analytics, reports, admin)
--   5.  Audit log shortcut            (log_audit_event)
--   6.  Storage bucket instructions   (manual – cannot be done in SQL)
-- =============================================================================


-- =============================================================================
-- SECTION 0 — PREREQUISITE COLUMN ADDITIONS
-- These columns are referenced by admin.service.ts but are not present in the
-- base Prisma migration (they are Supabase-only additions to the restaurants
-- table).  Running ALTER TABLE … ADD COLUMN IF NOT EXISTS is idempotent.
-- =============================================================================

-- restaurants: owner link
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- restaurants: approval / rejection metadata
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS approved_by   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS approved_at   TIMESTAMPTZ;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS rejected_by   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS rejected_at   TIMESTAMPTZ;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Index for fast owner look-ups (used by admin.service.ts join)
CREATE INDEX IF NOT EXISTS restaurants_owner_id_idx ON restaurants(owner_id);

-- Named FK so Supabase's PostgREST can resolve  owner:users!restaurants_owner_id_fkey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'restaurants_owner_id_fkey'
       AND conrelid = 'restaurants'::regclass
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END;
$$;


-- =============================================================================
-- SECTION 1 — MATERIALIZED VIEWS
-- Used by the hourly refresh loop in app.ts and by analytics queries.
-- CONCURRENTLY refresh requires a unique index on each view.
-- =============================================================================

-- ─── mv_branch_daily_stats ───────────────────────────────────────────────────
-- Aggregates per-branch daily revenue & order counts.  Used by analytics and
-- the materialized-view refresh cron.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_branch_daily_stats AS
SELECT
  o.branch_id,
  DATE_TRUNC('day', o.created_at)::DATE          AS stat_date,
  COUNT(DISTINCT o.id)                            AS order_count,
  COALESCE(SUM(p.amount), 0)                      AS revenue,
  COUNT(DISTINCT o.customer_id)                   AS unique_customers,
  ROUND(
    COALESCE(SUM(p.amount), 0)
    / NULLIF(COUNT(DISTINCT o.id), 0), 2
  )                                               AS avg_order_value
FROM   orders  o
LEFT  JOIN payments p ON p.order_id = o.id AND p.status = 'completed'
WHERE  o.status NOT IN ('created')
GROUP BY o.branch_id, DATE_TRUNC('day', o.created_at)::DATE;

CREATE UNIQUE INDEX IF NOT EXISTS mv_branch_daily_stats_uq
  ON mv_branch_daily_stats (branch_id, stat_date);


-- ─── mv_menu_item_performance ────────────────────────────────────────────────
-- Per-item 30-day order counts and revenue.  Used by analytics & slow-mover
-- detection in getMenuPerformance().
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_menu_item_performance AS
SELECT
  oi.menu_item_id,
  mi.name                                         AS item_name,
  mi.branch_id,
  mi.restaurant_id,
  mi.price,
  COUNT(DISTINCT oi.order_id)                     AS order_count,
  COALESCE(SUM(oi.quantity), 0)                   AS units_sold,
  COALESCE(SUM(oi.unit_price * oi.quantity), 0)   AS revenue
FROM   order_items  oi
JOIN   menu_items   mi ON mi.id = oi.menu_item_id
JOIN   orders       o  ON o.id  = oi.order_id
WHERE  o.created_at >= NOW() - INTERVAL '30 days'
  AND  o.status NOT IN ('created')
GROUP BY oi.menu_item_id, mi.name, mi.branch_id, mi.restaurant_id, mi.price;

CREATE UNIQUE INDEX IF NOT EXISTS mv_menu_item_performance_uq
  ON mv_menu_item_performance (menu_item_id);


-- ─── mv_restaurant_monthly_summary ──────────────────────────────────────────
-- Per-restaurant monthly totals.  Used by the top-restaurants and platform
-- report queries.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_restaurant_monthly_summary AS
SELECT
  b.restaurant_id,
  DATE_TRUNC('month', o.created_at)::DATE          AS month,
  COUNT(DISTINCT o.id)                              AS order_count,
  COALESCE(SUM(p.amount), 0)                        AS revenue,
  COUNT(DISTINCT o.customer_id)                     AS unique_customers
FROM   orders  o
JOIN   branches b ON b.id = o.branch_id
LEFT  JOIN payments p ON p.order_id = o.id AND p.status = 'completed'
WHERE  o.status NOT IN ('created')
GROUP BY b.restaurant_id, DATE_TRUNC('month', o.created_at)::DATE;

CREATE UNIQUE INDEX IF NOT EXISTS mv_restaurant_monthly_summary_uq
  ON mv_restaurant_monthly_summary (restaurant_id, month);


-- =============================================================================
-- SECTION 2 — HELPER VIEWS (non-materialized)
-- =============================================================================

-- ─── waiter_workload view ─────────────────────────────────────────────────────
-- Used as a fallback inside waiter-assign.ts when the get_least_busy_waiter
-- RPC is unavailable.
CREATE OR REPLACE VIEW waiter_workload AS
SELECT
  u.id                                                             AS staff_id,
  u.branch_id,
  u.is_active,
  COUNT(DISTINCT o.id)  FILTER (WHERE o.status = 'occupied')      AS active_tables,
  COUNT(DISTINCT o.id)  FILTER (
    WHERE o.status IN ('confirmed','preparing','ready')
  )                                                                AS active_orders,
  COUNT(DISTINCT o.id)  FILTER (WHERE o.status = 'ready')         AS pending_serves
FROM   users   u
LEFT  JOIN orders o ON o.waiter_id = u.id
  AND o.status NOT IN ('paid','closed','cancelled')
WHERE  u.role = 'waiter'
GROUP BY u.id, u.branch_id, u.is_active;


-- =============================================================================
-- SECTION 3 — MISSING 1: get_top_restaurants_by_revenue
-- Verified against admin.service.ts call:
--   supabaseAdmin.rpc('get_top_restaurants_by_revenue', {
--     p_since: thirtyDaysAgo,   ← TIMESTAMPTZ string
--     p_limit: 5                ← INTEGER
--   })
-- Parameter names MUST be p_since and p_limit (exact match).
-- =============================================================================

CREATE OR REPLACE FUNCTION get_top_restaurants_by_revenue(
  p_since TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  restaurant_id   UUID,
  restaurant_name TEXT,
  total_revenue   NUMERIC,
  order_count     BIGINT,
  avg_order_value NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    b.restaurant_id,
    r.name                                              AS restaurant_name,
    COALESCE(SUM(p.amount), 0)                         AS total_revenue,
    COUNT(DISTINCT o.id)                               AS order_count,
    ROUND(
      COALESCE(SUM(p.amount), 0)
      / NULLIF(COUNT(DISTINCT o.id), 0), 2
    )                                                  AS avg_order_value
  FROM   orders    o
  JOIN   branches  b ON b.id = o.branch_id
  JOIN   restaurants r ON r.id = b.restaurant_id
  LEFT  JOIN payments p
         ON p.order_id = o.id
        AND p.status   = 'completed'
  WHERE  o.created_at >= p_since
    AND  o.status NOT IN ('created')
  GROUP BY b.restaurant_id, r.name
  ORDER BY total_revenue DESC
  LIMIT  p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_top_restaurants_by_revenue(TIMESTAMPTZ, INTEGER) TO service_role;


-- =============================================================================
-- SECTION 4 — MISSING 2: refresh_materialized_views
-- Called every hour by app.ts:
--   supabaseAdmin.rpc('refresh_materialized_views')
-- Uses graceful degradation: only refreshes views that actually exist,
-- so the function is safe to deploy before the views are created.
-- =============================================================================

CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only refresh if the view exists (graceful degradation)
  IF EXISTS (
    SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_branch_daily_stats'
  ) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_branch_daily_stats;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_menu_item_performance'
  ) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_menu_item_performance;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_restaurant_monthly_summary'
  ) THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_restaurant_monthly_summary;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_materialized_views() TO service_role;


-- =============================================================================
-- SECTION 5 — MISSING 3: get_db_metrics (safe version for managed Supabase)
-- Replaces the previous version that used pg_stat_activity, which is
-- restricted on Supabase's managed PostgreSQL.
-- This version uses only pg_database_size, information_schema, and
-- pg_statio_user_tables — all accessible to service_role.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_db_metrics()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'database_size_mb', ROUND(pg_database_size(current_database()) / 1048576.0, 2),
    'total_tables', (
      SELECT COUNT(*)
        FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type   = 'BASE TABLE'
    ),
    'cache_hit_ratio', (
      SELECT ROUND(
        100.0 * SUM(blks_hit)
        / NULLIF(SUM(blks_hit + blks_read), 0),
        2
      )
      FROM pg_statio_user_tables
    ),
    'generated_at', NOW()
  );
$$;

GRANT EXECUTE ON FUNCTION get_db_metrics() TO service_role;


-- =============================================================================
-- SECTION 6 — MISSING 4: Supabase Storage — 'reports' bucket
-- Storage buckets CANNOT be created via SQL.
-- Follow the manual steps below or use the Management API.
--
-- Instructions:
--   1. Supabase Dashboard → Storage → New bucket
--   2. Name:             reports
--   3. Public:           NO  (private — access via signed URLs only)
--   4. File size limit:  50 MB  (52428800 bytes)
--   5. Allowed MIME types:
--        text/csv
--        application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
--        application/pdf
--
-- Storage RLS policies (paste into Dashboard → Storage → Policies):
-- =============================================================================

-- Policy: service_role has full access (this is the Supabase default for
-- service_role; listed here for documentation purposes only).
--
--   Bucket: reports
--   Role:   service_role
--   Action: ALL
--   Policy: TRUE
--
-- No public read policy is needed — signed URLs handle authenticated downloads.
--
-- NOTE: The existing reports.service.ts uses an 'exports' bucket (not
-- 'reports').  If you rename to 'reports', update the bucket name in
-- reports.service.ts → exportReport() and ensureExportsBucket() accordingly.
-- For async jobs in jobs/report-export.ts, update the bucket reference there
-- as well.


-- =============================================================================
-- SECTION 7 — MISSING 5: log_audit_event
-- Convenience shortcut for inserting audit log records directly from the DB
-- (e.g. from triggers or other stored procedures).
-- NOTE: audit_logs columns from the Prisma schema:
--   actor_id, action, target_type, target_id, old_value, new_value,
--   ip_address, created_at
-- The prompt specified p_resource_type / p_resource_id.  We map these to
-- target_type / target_id to match the actual table columns exactly.
-- p_meta is stored in new_value (there is no separate 'meta' column).
-- =============================================================================

CREATE OR REPLACE FUNCTION log_audit_event(
  p_actor_id      UUID,
  p_action        TEXT,
  p_resource_type TEXT,
  p_resource_id   UUID,
  p_ip_address    TEXT    DEFAULT NULL,
  p_meta          JSONB   DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    ip_address,
    new_value,       -- p_meta stored here; there is no separate 'meta' column
    created_at
  )
  VALUES (
    p_actor_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_ip_address,
    p_meta,
    NOW()
  );
EXCEPTION WHEN OTHERS THEN
  -- Audit log failures must NEVER block the main operation
  RAISE WARNING 'log_audit_event failed: % (action=%, resource=% id=%)',
    SQLERRM, p_action, p_resource_type, p_resource_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_audit_event(UUID, TEXT, TEXT, UUID, TEXT, JSONB) TO service_role;


-- =============================================================================
-- SECTION 8 — EXISTING RPCs (from P2-1 and later phases)
-- All preserved exactly.  Re-running with CREATE OR REPLACE is safe.
-- =============================================================================

-- ─── get_peak_hours_matrix ───────────────────────────────────────────────────
-- Called by admin.service.ts → getPlatformStats()
-- Returns a 7×24 matrix of average orders per (day_of_week, hour).
CREATE OR REPLACE FUNCTION get_peak_hours_matrix()
RETURNS TABLE (
  day_of_week  INTEGER,   -- 0 = Sunday … 6 = Saturday
  hour         INTEGER,   -- 0 – 23
  avg_orders   NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    EXTRACT(DOW  FROM created_at)::INTEGER   AS day_of_week,
    EXTRACT(HOUR FROM created_at)::INTEGER   AS hour,
    ROUND(COUNT(*)::NUMERIC / NULLIF(
      COUNT(DISTINCT created_at::DATE), 0
    ), 2)                                    AS avg_orders
  FROM  orders
  WHERE status NOT IN ('created')
    AND created_at >= NOW() - INTERVAL '90 days'
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION get_peak_hours_matrix() TO service_role;


-- ─── get_sales_report ────────────────────────────────────────────────────────
-- Called by reports.service.ts → getSales()
-- Parameters verified:
--   p_restaurant_id, p_branch_id (nullable), p_from, p_to, p_trunc
CREATE OR REPLACE FUNCTION get_sales_report(
  p_restaurant_id UUID,
  p_branch_id     UUID,
  p_from          TIMESTAMPTZ,
  p_to            TIMESTAMPTZ,
  p_trunc         TEXT DEFAULT 'day'    -- 'hour' | 'day' | 'week' | 'month'
)
RETURNS TABLE (
  period          TIMESTAMPTZ,
  order_count     BIGINT,
  total_revenue   NUMERIC,
  avg_order_value NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    DATE_TRUNC(p_trunc, o.created_at)         AS period,
    COUNT(DISTINCT o.id)                      AS order_count,
    COALESCE(SUM(p.amount), 0)                AS total_revenue,
    ROUND(
      COALESCE(SUM(p.amount), 0)
      / NULLIF(COUNT(DISTINCT o.id), 0), 2
    )                                         AS avg_order_value
  FROM   orders    o
  JOIN   branches  b ON b.id = o.branch_id
  LEFT  JOIN payments p
         ON p.order_id = o.id
        AND p.status   = 'completed'
  WHERE  b.restaurant_id   = p_restaurant_id
    AND  o.created_at      BETWEEN p_from AND p_to
    AND  o.status NOT IN ('created')
    AND  (p_branch_id IS NULL OR o.branch_id = p_branch_id)
  GROUP BY DATE_TRUNC(p_trunc, o.created_at)
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION get_sales_report(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO service_role;


-- ─── get_menu_performance ─────────────────────────────────────────────────────
-- Called by reports.service.ts → getMenuPerformance()
-- Parameters: p_restaurant_id, p_branch_id (nullable), p_since
CREATE OR REPLACE FUNCTION get_menu_performance(
  p_restaurant_id UUID,
  p_branch_id     UUID,
  p_since         TIMESTAMPTZ
)
RETURNS TABLE (
  menu_item_id UUID,
  item_name    TEXT,
  category     TEXT,
  price        NUMERIC,
  order_count  BIGINT,
  units_sold   BIGINT,
  revenue      NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    mi.id                                         AS menu_item_id,
    mi.name                                       AS item_name,
    mc.name                                       AS category,
    mi.price::NUMERIC,
    COUNT(DISTINCT oi.order_id)                   AS order_count,
    COALESCE(SUM(oi.quantity), 0)                 AS units_sold,
    COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS revenue
  FROM   menu_items       mi
  JOIN   menu_categories  mc  ON mc.id  = mi.category_id
  JOIN   order_items      oi  ON oi.menu_item_id = mi.id
  JOIN   orders           o   ON o.id   = oi.order_id
  WHERE  mi.restaurant_id = p_restaurant_id
    AND  o.created_at    >= p_since
    AND  o.status NOT IN ('created')
    AND  (p_branch_id IS NULL OR mi.branch_id = p_branch_id)
  GROUP BY mi.id, mi.name, mc.name, mi.price
  ORDER BY order_count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_menu_performance(UUID, UUID, TIMESTAMPTZ) TO service_role;


-- ─── get_kitchen_performance ─────────────────────────────────────────────────
-- Called by reports.service.ts → getKitchenPerformance()
-- Parameters: p_branch_id, p_from, p_to
CREATE OR REPLACE FUNCTION get_kitchen_performance(
  p_branch_id UUID,
  p_from      TIMESTAMPTZ,
  p_to        TIMESTAMPTZ
)
RETURNS TABLE (
  date                   DATE,
  avg_prep_minutes       NUMERIC,
  orders_completed       BIGINT,
  orders_overdue         BIGINT,
  avg_items_per_order    NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    o.created_at::DATE                                                    AS date,
    ROUND(AVG(
      EXTRACT(EPOCH FROM (o.paid_at - o.confirmed_at)) / 60.0
    )::NUMERIC, 2)                                                        AS avg_prep_minutes,
    COUNT(o.id)                                                           AS orders_completed,
    COUNT(o.id) FILTER (
      WHERE o.paid_at - o.confirmed_at > INTERVAL '45 minutes'
    )                                                                     AS orders_overdue,
    ROUND(AVG(item_counts.cnt)::NUMERIC, 2)                               AS avg_items_per_order
  FROM orders o
  JOIN (
    SELECT order_id, COUNT(*) AS cnt
    FROM   order_items
    GROUP BY order_id
  ) item_counts ON item_counts.order_id = o.id
  WHERE o.branch_id    = p_branch_id
    AND o.created_at  BETWEEN p_from AND p_to
    AND o.status IN ('paid','closed')
    AND o.confirmed_at IS NOT NULL
    AND o.paid_at      IS NOT NULL
  GROUP BY o.created_at::DATE
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION get_kitchen_performance(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;


-- ─── get_returning_customers ─────────────────────────────────────────────────
-- Called by reports.service.ts → getCustomerInsights()
-- Parameter: p_restaurant_id
CREATE OR REPLACE FUNCTION get_returning_customers(
  p_restaurant_id UUID
)
RETURNS TABLE (
  customer_id    UUID,
  name           TEXT,
  email          TEXT,
  order_count    BIGINT,
  total_spent    NUMERIC,
  last_order_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    u.id                          AS customer_id,
    u.name,
    u.email,
    COUNT(DISTINCT o.id)          AS order_count,
    COALESCE(SUM(p.amount), 0)    AS total_spent,
    MAX(o.created_at)             AS last_order_at
  FROM   orders    o
  JOIN   branches  b  ON b.id  = o.branch_id
  JOIN   users     u  ON u.id  = o.customer_id
  LEFT  JOIN payments p
         ON p.order_id = o.id
        AND p.status   = 'completed'
  WHERE  b.restaurant_id = p_restaurant_id
    AND  o.created_at   >= NOW() - INTERVAL '90 days'
    AND  o.status NOT IN ('created')
  GROUP BY u.id, u.name, u.email
  HAVING COUNT(DISTINCT o.id) > 1   -- "returning" = more than one visit
  ORDER BY order_count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_returning_customers(UUID) TO service_role;


-- ─── get_top_spenders ────────────────────────────────────────────────────────
-- Called by reports.service.ts → getCustomerInsights()
-- Parameters: p_restaurant_id, p_limit
CREATE OR REPLACE FUNCTION get_top_spenders(
  p_restaurant_id UUID,
  p_limit         INTEGER DEFAULT 10
)
RETURNS TABLE (
  customer_id    UUID,
  name           TEXT,
  email          TEXT,
  total_spent    NUMERIC,
  order_count    BIGINT,
  last_order_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    u.id                          AS customer_id,
    u.name,
    u.email,
    COALESCE(SUM(p.amount), 0)    AS total_spent,
    COUNT(DISTINCT o.id)          AS order_count,
    MAX(o.created_at)             AS last_order_at
  FROM   orders    o
  JOIN   branches  b  ON b.id  = o.branch_id
  JOIN   users     u  ON u.id  = o.customer_id
  LEFT  JOIN payments p
         ON p.order_id = o.id
        AND p.status   = 'completed'
  WHERE  b.restaurant_id = p_restaurant_id
    AND  o.status NOT IN ('created')
  GROUP BY u.id, u.name, u.email
  ORDER BY total_spent DESC
  LIMIT  p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_top_spenders(UUID, INTEGER) TO service_role;


-- ─── get_platform_report ─────────────────────────────────────────────────────
-- Called by reports.service.ts → getAdminPlatformReport()
-- No parameters.
CREATE OR REPLACE FUNCTION get_platform_report()
RETURNS TABLE (
  restaurant_id   UUID,
  restaurant_name TEXT,
  branch_count    BIGINT,
  order_count     BIGINT,
  total_revenue   NUMERIC,
  avg_order_value NUMERIC,
  period_start    DATE,
  period_end      DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    r.id                                          AS restaurant_id,
    r.name                                        AS restaurant_name,
    COUNT(DISTINCT b.id)                          AS branch_count,
    COUNT(DISTINCT o.id)                          AS order_count,
    COALESCE(SUM(p.amount), 0)                    AS total_revenue,
    ROUND(
      COALESCE(SUM(p.amount), 0)
      / NULLIF(COUNT(DISTINCT o.id), 0), 2
    )                                             AS avg_order_value,
    (NOW() - INTERVAL '30 days')::DATE            AS period_start,
    NOW()::DATE                                   AS period_end
  FROM   restaurants r
  JOIN   branches    b  ON b.restaurant_id = r.id
  LEFT  JOIN orders  o  ON o.branch_id     = b.id
    AND o.created_at >= NOW() - INTERVAL '30 days'
    AND o.status NOT IN ('created')
  LEFT  JOIN payments p
         ON p.order_id = o.id
        AND p.status   = 'completed'
  GROUP BY r.id, r.name
  ORDER BY total_revenue DESC;
$$;

GRANT EXECUTE ON FUNCTION get_platform_report() TO service_role;


-- ─── get_platform_trends ─────────────────────────────────────────────────────
-- Called by reports.service.ts → getAdminTrends()
-- Parameters: p_from, p_to
CREATE OR REPLACE FUNCTION get_platform_trends(
  p_from TIMESTAMPTZ,
  p_to   TIMESTAMPTZ
)
RETURNS TABLE (
  date            DATE,
  order_count     BIGINT,
  total_revenue   NUMERIC,
  active_restaurants BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    o.created_at::DATE                            AS date,
    COUNT(DISTINCT o.id)                          AS order_count,
    COALESCE(SUM(p.amount), 0)                    AS total_revenue,
    COUNT(DISTINCT b.restaurant_id)               AS active_restaurants
  FROM   orders    o
  JOIN   branches  b  ON b.id = o.branch_id
  LEFT  JOIN payments p
         ON p.order_id = o.id
        AND p.status   = 'completed'
  WHERE  o.created_at BETWEEN p_from AND p_to
    AND  o.status NOT IN ('created')
  GROUP BY o.created_at::DATE
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION get_platform_trends(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;


-- ─── get_item_order_counts ────────────────────────────────────────────────────
-- Called by analytics.service.ts → getMenuSuggestions()
-- Parameters: p_branch_id, p_since
CREATE OR REPLACE FUNCTION get_item_order_counts(
  p_branch_id UUID,
  p_since     TIMESTAMPTZ
)
RETURNS TABLE (
  menu_item_id UUID,
  item_name    TEXT,
  price        NUMERIC,
  order_count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    mi.id          AS menu_item_id,
    mi.name        AS item_name,
    mi.price::NUMERIC,
    COUNT(DISTINCT oi.order_id) AS order_count
  FROM   menu_items   mi
  LEFT  JOIN order_items oi  ON oi.menu_item_id = mi.id
  LEFT  JOIN orders      o   ON o.id = oi.order_id
    AND o.created_at >= p_since
    AND o.status NOT IN ('created')
  WHERE  mi.branch_id = p_branch_id
    AND  mi.status    = 'available'
  GROUP BY mi.id, mi.name, mi.price
  ORDER BY order_count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_item_order_counts(UUID, TIMESTAMPTZ) TO service_role;


-- ─── get_co_order_pairs ───────────────────────────────────────────────────────
-- Called by analytics.service.ts → getBundleOpportunities()
-- Parameters: p_branch_id, p_min_count, p_limit
-- Finds pairs of menu items frequently ordered together.
CREATE OR REPLACE FUNCTION get_co_order_pairs(
  p_branch_id UUID,
  p_min_count INTEGER DEFAULT 10,
  p_limit     INTEGER DEFAULT 5
)
RETURNS TABLE (
  item_a_id    UUID,
  item_a_name  TEXT,
  item_a_price NUMERIC,
  item_b_id    UUID,
  item_b_name  TEXT,
  item_b_price NUMERIC,
  co_orders    BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    a.menu_item_id                          AS item_a_id,
    mia.name                               AS item_a_name,
    mia.price::NUMERIC                     AS item_a_price,
    b.menu_item_id                         AS item_b_id,
    mib.name                               AS item_b_name,
    mib.price::NUMERIC                     AS item_b_price,
    COUNT(*)                               AS co_orders
  FROM   order_items a
  JOIN   order_items b   ON b.order_id    = a.order_id
                        AND b.menu_item_id > a.menu_item_id   -- avoid duplicates
  JOIN   menu_items  mia ON mia.id        = a.menu_item_id
  JOIN   menu_items  mib ON mib.id        = b.menu_item_id
  JOIN   orders      o   ON o.id          = a.order_id
  WHERE  o.branch_id = p_branch_id
    AND  o.status NOT IN ('created')
    AND  o.created_at >= NOW() - INTERVAL '30 days'
  GROUP BY a.menu_item_id, mia.name, mia.price,
           b.menu_item_id, mib.name, mib.price
  HAVING COUNT(*) >= p_min_count
  ORDER BY co_orders DESC
  LIMIT  p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_co_order_pairs(UUID, INTEGER, INTEGER) TO service_role;


-- ─── get_order_hourly_distribution ───────────────────────────────────────────
-- Called by analytics.service.ts → getDemandForecast()
-- Parameters: p_branch_id, p_since
CREATE OR REPLACE FUNCTION get_order_hourly_distribution(
  p_branch_id UUID,
  p_since     TIMESTAMPTZ
)
RETURNS TABLE (
  day_of_week INTEGER,   -- 0 = Sunday … 6 = Saturday
  hour        INTEGER,   -- 0 – 23
  avg_orders  NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    EXTRACT(DOW  FROM created_at)::INTEGER   AS day_of_week,
    EXTRACT(HOUR FROM created_at)::INTEGER   AS hour,
    ROUND(COUNT(*)::NUMERIC / NULLIF(
      COUNT(DISTINCT created_at::DATE), 0
    ), 2)                                    AS avg_orders
  FROM   orders
  WHERE  branch_id   = p_branch_id
    AND  created_at >= p_since
    AND  status NOT IN ('created')
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION get_order_hourly_distribution(UUID, TIMESTAMPTZ) TO service_role;


-- ─── get_scheduled_staff ─────────────────────────────────────────────────────
-- Called by analytics.service.ts → getStaffingRecommendation()
-- Parameter: p_branch_id
-- Returns scheduled waiter & chef counts per day for the next 7 days.
CREATE OR REPLACE FUNCTION get_scheduled_staff(
  p_branch_id UUID
)
RETURNS TABLE (
  date         DATE,
  waiter_count BIGINT,
  chef_count   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    s.date,
    COUNT(s.id) FILTER (WHERE s.role_for_shift = 'waiter'
                           OR (s.role_for_shift IS NULL AND u.role = 'waiter')) AS waiter_count,
    COUNT(s.id) FILTER (WHERE s.role_for_shift = 'chef'
                           OR (s.role_for_shift IS NULL AND u.role = 'chef'))   AS chef_count
  FROM   shifts s
  JOIN   users  u ON u.id = s.staff_id
  WHERE  s.branch_id = p_branch_id
    AND  s.date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
  GROUP BY s.date
  ORDER BY s.date;
$$;

GRANT EXECUTE ON FUNCTION get_scheduled_staff(UUID) TO service_role;


-- ─── get_least_busy_waiter ────────────────────────────────────────────────────
-- Called by waiter-assign.ts → findLeastBusyWaiter()
-- Parameter: p_branch_id
-- Workload score: active_tables×3 + active_orders×1 + pending_serves×0.5
CREATE OR REPLACE FUNCTION get_least_busy_waiter(
  p_branch_id UUID
)
RETURNS TABLE (
  staff_id UUID,
  score    NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    u.id  AS staff_id,
    (
      COUNT(o.id) FILTER (WHERE o.status = 'occupied')        * 3.0  +
      COUNT(o.id) FILTER (
        WHERE o.status IN ('confirmed','preparing','ready')
      )                                                        * 1.0  +
      COUNT(o.id) FILTER (WHERE o.status = 'ready')           * 0.5
    )     AS score
  FROM   users  u
  LEFT  JOIN orders o
         ON o.waiter_id = u.id
        AND o.branch_id = p_branch_id
        AND o.status NOT IN ('paid','closed','cancelled')
  WHERE  u.branch_id = p_branch_id
    AND  u.role      = 'waiter'
    AND  u.is_active = TRUE
  GROUP BY u.id
  ORDER BY score ASC
  LIMIT  1;
$$;

GRANT EXECUTE ON FUNCTION get_least_busy_waiter(UUID) TO service_role;


-- ─── deduct_inventory_for_item ───────────────────────────────────────────────
-- Called by orders.service.ts when an order item is placed.
-- Parameters: p_branch_id, p_menu_item_id, p_quantity
-- Deducts recipe ingredient quantities from inventory for a menu item.
-- Updates inventory_items.status based on new quantity vs thresholds.
CREATE OR REPLACE FUNCTION deduct_inventory_for_item(
  p_branch_id    UUID,
  p_menu_item_id UUID,
  p_quantity     INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Loop through all recipe ingredients for this menu item
  FOR rec IN
    SELECT
      ri.inventory_item_id,
      ri.quantity_used * p_quantity AS total_deduct,
      ii.quantity                   AS current_qty,
      ii.low_stock_threshold,
      ii.critical_stock_threshold
    FROM recipe_ingredients ri
    JOIN inventory_items     ii
      ON ii.id        = ri.inventory_item_id
     AND ii.branch_id = p_branch_id
    WHERE ri.menu_item_id = p_menu_item_id
  LOOP
    -- Deduct and clamp to 0 (never go negative)
    UPDATE inventory_items
    SET
      quantity   = GREATEST(0, quantity - rec.total_deduct),
      status     = CASE
                     WHEN GREATEST(0, rec.current_qty - rec.total_deduct)
                            <= rec.critical_stock_threshold THEN 'critical'::\"InventoryStatus\"
                     WHEN GREATEST(0, rec.current_qty - rec.total_deduct)
                            <= rec.low_stock_threshold      THEN 'low'::\"InventoryStatus\"
                     ELSE 'normal'::\"InventoryStatus\"
                   END,
      updated_at = NOW()
    WHERE id = rec.inventory_item_id;
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- Inventory deduction failures should not block order creation
  RAISE WARNING 'deduct_inventory_for_item failed: % (menu_item=%, branch=%, qty=%)',
    SQLERRM, p_menu_item_id, p_branch_id, p_quantity;
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_inventory_for_item(UUID, UUID, INTEGER) TO service_role;


-- =============================================================================
-- SECTION 9 — ROW-LEVEL SECURITY (RLS) REMINDERS
-- The functions above use SECURITY DEFINER, so they run as the function owner
-- (typically postgres / supabase_admin) and bypass RLS automatically.
-- If you need RLS on the underlying tables, keep it enabled — SECURITY DEFINER
-- functions will still work correctly.
-- =============================================================================

-- =============================================================================
-- END OF FILE
-- =============================================================================
-- Quick verification — run this after deploying to confirm all functions exist:
--
--   SELECT routine_name, routine_type
--   FROM   information_schema.routines
--   WHERE  routine_schema = 'public'
--     AND  routine_name IN (
--       'get_top_restaurants_by_revenue',
--       'refresh_materialized_views',
--       'get_db_metrics',
--       'log_audit_event',
--       'get_peak_hours_matrix',
--       'get_sales_report',
--       'get_menu_performance',
--       'get_kitchen_performance',
--       'get_returning_customers',
--       'get_top_spenders',
--       'get_platform_report',
--       'get_platform_trends',
--       'get_item_order_counts',
--       'get_co_order_pairs',
--       'get_order_hourly_distribution',
--       'get_scheduled_staff',
--       'get_least_busy_waiter',
--       'deduct_inventory_for_item'
--     )
--   ORDER BY routine_name;
-- =============================================================================