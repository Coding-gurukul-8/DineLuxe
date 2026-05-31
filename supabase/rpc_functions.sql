-- =============================================================================
-- Restaurant OS — Supabase RPC Functions
-- File: supabase/rpc_functions.sql
--
-- Run this file against your Supabase project via:
--   supabase db push   (if using Supabase CLI)
--   OR paste into SQL editor in the Supabase dashboard
--
-- All functions are idempotent (DROP IF EXISTS + CREATE OR REPLACE).
-- GRANTs are included for service_role and authenticated roles.
--
-- Verified against:
--   • backend/src/modules/admin/admin.service.ts  (exact param names)
--   • backend/src/modules/reports/reports.service.ts (exact param names)
--   • backend/prisma/migrations/*_init_dine_luxe/migration.sql (table/col names)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- HELPER: ensure extensions we rely on are available
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- used by get_db_metrics


-- =============================================================================
-- FUNCTION 1: get_top_restaurants_by_revenue
-- Called by: admin.service.ts → getDashboard()
--   supabaseAdmin.rpc('get_top_restaurants_by_revenue', {
--     p_since: thirtyDaysAgo,
--     p_limit: 5
--   })
-- Purpose: Returns top N restaurants ranked by completed payment revenue
--          since a given timestamp. Used on the super-admin dashboard.
-- =============================================================================
DROP FUNCTION IF EXISTS get_top_restaurants_by_revenue(TIMESTAMPTZ, INTEGER);

CREATE OR REPLACE FUNCTION get_top_restaurants_by_revenue(
  p_since  TIMESTAMPTZ,
  p_limit  INTEGER DEFAULT 5
)
RETURNS TABLE (
  restaurant_id   UUID,
  restaurant_name TEXT,
  logo_url        TEXT,
  cuisine_type    TEXT,
  total_revenue   NUMERIC,
  order_count     BIGINT,
  branch_count    BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id                              AS restaurant_id,
    r.name                            AS restaurant_name,
    rb.logo_url,
    r.cuisine_type,
    COALESCE(SUM(p.amount), 0)        AS total_revenue,
    COUNT(DISTINCT o.id)              AS order_count,
    COUNT(DISTINCT b.id)              AS branch_count
  FROM restaurants r
  JOIN branches b
    ON r.id = b.restaurant_id
  JOIN orders o
    ON b.id = o.branch_id
   AND o.created_at >= p_since
  LEFT JOIN payments p
    ON o.id = p.order_id
   AND p.status = 'completed'
  LEFT JOIN restaurant_branding rb
    ON r.id = rb.restaurant_id
  WHERE r.status = 'active'
  GROUP BY
    r.id,
    r.name,
    rb.logo_url,
    r.cuisine_type
  ORDER BY total_revenue DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_top_restaurants_by_revenue(TIMESTAMPTZ, INTEGER)
  TO service_role, authenticated;

COMMENT ON FUNCTION get_top_restaurants_by_revenue IS
  'Returns top N active restaurants ranked by completed payment revenue since p_since. Used on the super-admin dashboard widget.';


-- =============================================================================
-- FUNCTION 2: get_peak_hours_matrix
-- Called by: admin.service.ts → getPlatformStats()
--   supabaseAdmin.rpc('get_peak_hours_matrix')
-- Purpose: Platform-wide 7×24 order heatmap for the last 90 days.
--          Returns (day_of_week, hour, order_count) for every combination
--          that has at least one non-cancelled order.
-- =============================================================================
DROP FUNCTION IF EXISTS get_peak_hours_matrix();

CREATE OR REPLACE FUNCTION get_peak_hours_matrix()
RETURNS TABLE (
  day_of_week  INTEGER,
  hour         INTEGER,
  order_count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DOW  FROM created_at)::INTEGER AS day_of_week,
    EXTRACT(HOUR FROM created_at)::INTEGER AS hour,
    COUNT(*)                               AS order_count
  FROM orders
  WHERE created_at > NOW() - INTERVAL '90 days'
    AND status NOT IN ('cancelled')
  GROUP BY day_of_week, hour
  ORDER BY day_of_week, hour;
$$;

GRANT EXECUTE ON FUNCTION get_peak_hours_matrix()
  TO service_role, authenticated;

COMMENT ON FUNCTION get_peak_hours_matrix IS
  'Platform-wide 7x24 peak-hours heatmap over the last 90 days. Used on admin analytics page.';


-- =============================================================================
-- FUNCTION 3: get_db_metrics
-- Called by: admin.service.ts → getDetailedHealth()
--   supabaseAdmin.rpc('get_db_metrics')
-- Purpose: Returns a single JSON object with live PostgreSQL metrics from
--          pg_stat_database and pg_stat_activity. Super-admin only.
-- =============================================================================
DROP FUNCTION IF EXISTS get_db_metrics();

CREATE OR REPLACE FUNCTION get_db_metrics()
RETURNS JSON
LANGUAGE sql
VOLATILE               -- reads live pg_stat_* views
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'active_connections',
      (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'),

    'idle_connections',
      (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle'),

    'total_connections',
      (SELECT COUNT(*) FROM pg_stat_activity),

    'database_size_mb',
      (SELECT ROUND(pg_database_size(current_database()) / 1024.0 / 1024.0, 2)),

    'cache_hit_ratio',
      (
        SELECT ROUND(
          100.0 * SUM(blks_hit)
            / NULLIF(SUM(blks_hit + blks_read), 0),
          2
        )
        FROM pg_stat_database
        WHERE datname = current_database()
      ),

    'transactions_per_sec',
      (
        SELECT ROUND(
          xact_commit::NUMERIC
            / GREATEST(EXTRACT(EPOCH FROM (NOW() - stats_reset)), 1),
          2
        )
        FROM pg_stat_database
        WHERE datname = current_database()
      )
  );
$$;

GRANT EXECUTE ON FUNCTION get_db_metrics()
  TO service_role;
-- NOTE: authenticated role intentionally excluded — super_admin only via service_role key.

COMMENT ON FUNCTION get_db_metrics IS
  'Returns live PostgreSQL metrics (connections, cache hit ratio, DB size, TPS). Super-admin health dashboard only.';


-- =============================================================================
-- FUNCTION 4: get_kitchen_performance
-- Called by: reports.service.ts → getKitchenPerformance()
--   supabaseAdmin.rpc('get_kitchen_performance', {
--     p_branch_id: branchId,
--     p_from: from,
--     p_to: to
--   })
-- Purpose: Per-hour breakdown of average prep time and overdue order count
--          for a specific branch in a date range. Overdue = > 20 min.
-- =============================================================================
DROP FUNCTION IF EXISTS get_kitchen_performance(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_kitchen_performance(
  p_branch_id  UUID,
  p_from       TIMESTAMPTZ,
  p_to         TIMESTAMPTZ
)
RETURNS TABLE (
  hour_of_day           INTEGER,
  avg_prep_time_minutes NUMERIC,
  order_count           BIGINT,
  overdue_count         BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(HOUR FROM o.created_at)::INTEGER                                         AS hour_of_day,

    -- Average minutes from order creation to last item marked ready
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (
          MAX(CASE WHEN oi.status = 'ready' THEN oi.prepared_at END) - o.created_at
        )) / 60.0
      ),
      1
    )                                                                                 AS avg_prep_time_minutes,

    COUNT(DISTINCT o.id)                                                             AS order_count,

    -- Orders where last item took > 20 min (or still not ready)
    COUNT(DISTINCT o.id) FILTER (
      WHERE EXTRACT(EPOCH FROM (
        COALESCE(
          MAX(CASE WHEN oi.status = 'ready' THEN oi.prepared_at END),
          NOW()
        ) - o.created_at
      )) / 60.0 > 20
    )                                                                                 AS overdue_count

  FROM orders o
  JOIN order_items oi
    ON o.id = oi.order_id
  WHERE o.branch_id = p_branch_id
    AND o.created_at BETWEEN p_from AND p_to
    AND o.status NOT IN ('cancelled')
  GROUP BY hour_of_day
  ORDER BY hour_of_day;
$$;

GRANT EXECUTE ON FUNCTION get_kitchen_performance(UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO service_role, authenticated;

COMMENT ON FUNCTION get_kitchen_performance IS
  'Per-hour average prep time and overdue count for a branch within a date range. Used on the kitchen performance report page.';


-- =============================================================================
-- FUNCTION 5: get_returning_customers
-- Called by: reports.service.ts → getCustomerInsights()
--   supabaseAdmin.rpc('get_returning_customers', { p_restaurant_id: restaurantId })
-- Purpose: Aggregated customer loyalty metrics for a restaurant —
--          total customers, returning (>1 visit), return rate %, avg visits.
-- =============================================================================
DROP FUNCTION IF EXISTS get_returning_customers(UUID);

CREATE OR REPLACE FUNCTION get_returning_customers(
  p_restaurant_id UUID
)
RETURNS TABLE (
  total_customers          BIGINT,
  returning_customers      BIGINT,
  return_rate_pct          NUMERIC,
  avg_visits_per_customer  NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH customer_visits AS (
    SELECT
      o.customer_id,
      COUNT(*) AS visit_count
    FROM orders o
    JOIN branches b ON o.branch_id = b.id
    WHERE b.restaurant_id = p_restaurant_id
      AND o.status NOT IN ('cancelled')
      AND o.customer_id IS NOT NULL
    GROUP BY o.customer_id
  )
  SELECT
    COUNT(*)                                                          AS total_customers,
    COUNT(*) FILTER (WHERE visit_count > 1)                          AS returning_customers,
    ROUND(
      100.0
        * COUNT(*) FILTER (WHERE visit_count > 1)
        / NULLIF(COUNT(*), 0),
      1
    )                                                                 AS return_rate_pct,
    ROUND(AVG(visit_count), 1)                                        AS avg_visits_per_customer
  FROM customer_visits;
$$;

GRANT EXECUTE ON FUNCTION get_returning_customers(UUID)
  TO service_role, authenticated;

COMMENT ON FUNCTION get_returning_customers IS
  'Aggregated returning-customer metrics for a restaurant: total, returning count, return rate %, avg visit frequency.';


-- =============================================================================
-- FUNCTION 6: get_top_spenders
-- Called by: reports.service.ts → getCustomerInsights()
--   supabaseAdmin.rpc('get_top_spenders', {
--     p_restaurant_id: restaurantId,
--     p_limit: 10
--   })
-- Purpose: Top N customers by total completed payment spend at a restaurant.
--          Phone number masked to last 4 digits for privacy.
-- =============================================================================
DROP FUNCTION IF EXISTS get_top_spenders(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_top_spenders(
  p_restaurant_id  UUID,
  p_limit          INTEGER DEFAULT 10
)
RETURNS TABLE (
  customer_id   UUID,
  display_name  TEXT,
  phone_masked  TEXT,
  total_spent   NUMERIC,
  visit_count   BIGINT,
  last_visit    TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id                                                         AS customer_id,
    u.name                                                       AS display_name,
    '****' || RIGHT(COALESCE(u.phone, '0000'), 4)               AS phone_masked,
    COALESCE(SUM(p.amount), 0)                                   AS total_spent,
    COUNT(DISTINCT o.id)                                         AS visit_count,
    MAX(o.created_at)                                            AS last_visit
  FROM users u
  JOIN orders o
    ON u.id = o.customer_id
  JOIN branches b
    ON o.branch_id = b.id
  LEFT JOIN payments p
    ON o.id = p.order_id
   AND p.status = 'completed'
  WHERE b.restaurant_id = p_restaurant_id
    AND u.role = 'customer'
    AND o.status NOT IN ('cancelled')
  GROUP BY u.id, u.name, u.phone
  ORDER BY total_spent DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_top_spenders(UUID, INTEGER)
  TO service_role, authenticated;

COMMENT ON FUNCTION get_top_spenders IS
  'Returns top N customers by total spend at a restaurant, with masked phone numbers. Used on customer insights report.';


-- =============================================================================
-- FUNCTION 7: get_platform_report
-- Called by: reports.service.ts → getAdminPlatformReport()
--   supabaseAdmin.rpc('get_platform_report')
-- Purpose: Single-row JSON snapshot of platform-wide KPIs for the last 30 days.
--          Used on the super-admin reports page.
-- =============================================================================
DROP FUNCTION IF EXISTS get_platform_report();

CREATE OR REPLACE FUNCTION get_platform_report()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'revenue_total',
      (
        SELECT COALESCE(SUM(amount), 0)
        FROM payments
        WHERE status = 'completed'
          AND created_at > NOW() - INTERVAL '30 days'
      ),

    'orders_total',
      (
        SELECT COUNT(*)
        FROM orders
        WHERE created_at > NOW() - INTERVAL '30 days'
          AND status != 'cancelled'
      ),

    'avg_order_value',
      (
        SELECT ROUND(COALESCE(AVG(amount), 0), 2)
        FROM payments
        WHERE status = 'completed'
          AND created_at > NOW() - INTERVAL '30 days'
      ),

    'active_restaurants',
      (
        SELECT COUNT(*)
        FROM restaurants
        WHERE status = 'active'
      ),

    'new_customers',
      (
        SELECT COUNT(*)
        FROM users
        WHERE role = 'customer'
          AND created_at > NOW() - INTERVAL '30 days'
      ),

    'cancelled_orders',
      (
        SELECT COUNT(*)
        FROM orders
        WHERE status = 'cancelled'
          AND created_at > NOW() - INTERVAL '30 days'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION get_platform_report()
  TO service_role, authenticated;

COMMENT ON FUNCTION get_platform_report IS
  'Single-row JSON snapshot of platform-wide KPIs for the last 30 days. Used on super-admin reports/platform page.';


-- =============================================================================
-- FUNCTION 8: get_platform_trends
-- Called by: reports.service.ts → getAdminTrends()
--   supabaseAdmin.rpc('get_platform_trends', { p_from: from, p_to: to })
-- Purpose: Day-by-day revenue, order count, and new customer count for a
--          date range. Generates a complete date series so there are no gaps
--          in the chart even on days with zero activity.
-- =============================================================================
DROP FUNCTION IF EXISTS get_platform_trends(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_platform_trends(
  p_from  TIMESTAMPTZ,
  p_to    TIMESTAMPTZ
)
RETURNS TABLE (
  date           DATE,
  revenue        NUMERIC,
  orders         BIGINT,
  new_customers  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.day::DATE                                            AS date,
    COALESCE(SUM(p.amount), 0)                            AS revenue,
    COUNT(DISTINCT o.id)                                  AS orders,
    COUNT(DISTINCT u.id)
      FILTER (WHERE u.created_at::DATE = d.day::DATE)     AS new_customers
  FROM
    generate_series(
      p_from::DATE,
      p_to::DATE,
      '1 day'::INTERVAL
    ) AS d(day)
  LEFT JOIN orders o
    ON DATE(o.created_at) = d.day::DATE
   AND o.status != 'cancelled'
  LEFT JOIN payments p
    ON o.id = p.order_id
   AND p.status = 'completed'
  LEFT JOIN users u
    ON u.role = 'customer'
  GROUP BY d.day
  ORDER BY d.day;
$$;

GRANT EXECUTE ON FUNCTION get_platform_trends(TIMESTAMPTZ, TIMESTAMPTZ)
  TO service_role, authenticated;

COMMENT ON FUNCTION get_platform_trends IS
  'Day-by-day revenue, order count, and new customer count for a date range. Fills all days in the series so charts have no gaps.';


-- =============================================================================
-- FUNCTION 9: get_platform_stats
-- Called by: (no direct call found — see NOTE below)
-- NOTE: admin.service.ts calls rpc('get_peak_hours_matrix'), NOT get_platform_stats.
--       However get_platform_stats is listed in the prompt as a distinct function
--       with the same return shape but a 30-day window instead of 90 days.
--       It is included here for completeness and future use.
-- Purpose: Same 7×24 heatmap as get_peak_hours_matrix but scoped to
--          the last 30 days instead of 90 days.
-- =============================================================================
DROP FUNCTION IF EXISTS get_platform_stats();

CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS TABLE (
  day_of_week  INTEGER,
  hour         INTEGER,
  order_count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXTRACT(DOW  FROM created_at)::INTEGER AS day_of_week,
    EXTRACT(HOUR FROM created_at)::INTEGER AS hour,
    COUNT(*)                               AS order_count
  FROM orders
  WHERE created_at > NOW() - INTERVAL '30 days'
    AND status NOT IN ('cancelled')
  GROUP BY day_of_week, hour
  ORDER BY day_of_week, hour;
$$;

GRANT EXECUTE ON FUNCTION get_platform_stats()
  TO service_role, authenticated;

COMMENT ON FUNCTION get_platform_stats IS
  'Same shape as get_peak_hours_matrix but scoped to the last 30 days. Distinct from peak_hours_matrix (90 days).';


-- =============================================================================
-- EXISTING RPCS REFERENCED IN reports.service.ts (must be present)
-- These are called but not defined above — included here so the file is
-- self-contained. If they already exist in your DB, the DROP + CREATE OR
-- REPLACE will safely update them.
-- =============================================================================

-- ── get_sales_report ─────────────────────────────────────────────────────────
-- Called by: reports.service.ts → getSales()
--   rpc('get_sales_report', {
--     p_restaurant_id, p_branch_id, p_from, p_to, p_trunc
--   })
DROP FUNCTION IF EXISTS get_sales_report(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION get_sales_report(
  p_restaurant_id  UUID,
  p_branch_id      UUID,       -- nullable: NULL means all branches
  p_from           TIMESTAMPTZ,
  p_to             TIMESTAMPTZ,
  p_trunc          TEXT        -- 'hour' | 'day' | 'week' | 'month'
)
RETURNS TABLE (
  period         TIMESTAMPTZ,
  order_count    BIGINT,
  revenue        NUMERIC,
  avg_order_value NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard against SQL injection via p_trunc (only allow known values)
  IF p_trunc NOT IN ('hour', 'day', 'week', 'month') THEN
    RAISE EXCEPTION 'Invalid p_trunc value: %', p_trunc;
  END IF;

  RETURN QUERY EXECUTE format(
    $q$
      SELECT
        DATE_TRUNC(%L, o.created_at)           AS period,
        COUNT(DISTINCT o.id)                   AS order_count,
        COALESCE(SUM(p.amount), 0)             AS revenue,
        ROUND(COALESCE(AVG(p.amount), 0), 2)   AS avg_order_value
      FROM orders o
      JOIN branches b ON o.branch_id = b.id
      LEFT JOIN payments p
        ON o.id = p.order_id
       AND p.status = 'completed'
      WHERE b.restaurant_id = $1
        AND ($2 IS NULL OR o.branch_id = $2)
        AND o.created_at BETWEEN $3 AND $4
        AND o.status NOT IN ('cancelled')
      GROUP BY DATE_TRUNC(%L, o.created_at)
      ORDER BY period
    $q$,
    p_trunc, p_trunc
  )
  USING p_restaurant_id, p_branch_id, p_from, p_to;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sales_report(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT)
  TO service_role, authenticated;

COMMENT ON FUNCTION get_sales_report IS
  'Time-series sales report grouped by hour/day/week/month for a restaurant (and optionally one branch).';


-- ── get_menu_performance ─────────────────────────────────────────────────────
-- Called by: reports.service.ts → getMenuPerformance()
--   rpc('get_menu_performance', {
--     p_restaurant_id, p_branch_id, p_since
--   })
DROP FUNCTION IF EXISTS get_menu_performance(UUID, UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_menu_performance(
  p_restaurant_id  UUID,
  p_branch_id      UUID,       -- nullable
  p_since          TIMESTAMPTZ
)
RETURNS TABLE (
  menu_item_id    UUID,
  menu_item_name  TEXT,
  order_count     BIGINT,
  total_quantity  BIGINT,
  total_revenue   NUMERIC,
  avg_rating      NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mi.id                                      AS menu_item_id,
    mi.name                                    AS menu_item_name,
    COUNT(DISTINCT o.id)                       AS order_count,
    COALESCE(SUM(oi.quantity), 0)::BIGINT      AS total_quantity,
    COALESCE(SUM(oi.unit_price * oi.quantity), 0) AS total_revenue,
    ROUND(AVG(r.overall_rating), 1)            AS avg_rating
  FROM menu_items mi
  JOIN order_items oi ON mi.id = oi.menu_item_id
  JOIN orders o       ON oi.order_id = o.id
  LEFT JOIN reviews r ON o.id = r.order_id
  WHERE mi.restaurant_id = p_restaurant_id
    AND (p_branch_id IS NULL OR mi.branch_id = p_branch_id)
    AND o.created_at >= p_since
    AND o.status NOT IN ('cancelled')
  GROUP BY mi.id, mi.name
  ORDER BY order_count DESC;
$$;

GRANT EXECUTE ON FUNCTION get_menu_performance(UUID, UUID, TIMESTAMPTZ)
  TO service_role, authenticated;

COMMENT ON FUNCTION get_menu_performance IS
  'Per-menu-item performance stats (orders, quantity, revenue, rating) since p_since. Slow movers flagged in the service layer.';


-- =============================================================================
-- MATERIALIZED VIEW 1: mv_branch_daily_stats
-- Purpose: Pre-aggregated daily order + revenue stats per branch.
--          Refreshed concurrently so reads are never blocked.
--          Used by analytics endpoints that would otherwise be slow
--          on large order tables.
-- =============================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_branch_daily_stats;

CREATE MATERIALIZED VIEW mv_branch_daily_stats AS
  SELECT
    o.branch_id,
    DATE(o.created_at)                                                      AS stat_date,
    COUNT(*) FILTER (WHERE o.status != 'cancelled')                         AS order_count,
    COALESCE(
      SUM(p.amount) FILTER (WHERE p.status = 'completed'),
      0
    )                                                                       AS revenue,
    COUNT(*) FILTER (WHERE o.status = 'cancelled')                         AS cancellation_count
  FROM orders o
  LEFT JOIN payments p ON o.id = p.order_id
  GROUP BY o.branch_id, DATE(o.created_at)
WITH DATA;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_branch_daily_stats_pk
  ON mv_branch_daily_stats (branch_id, stat_date);

-- Supporting lookup index
CREATE INDEX IF NOT EXISTS idx_mv_branch_daily_stats_date
  ON mv_branch_daily_stats (stat_date DESC);

-- Refresh command (run via pg_cron or Supabase Edge Function on a schedule):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_branch_daily_stats;

COMMENT ON MATERIALIZED VIEW mv_branch_daily_stats IS
  'Pre-aggregated daily order count, revenue, and cancellation count per branch. Refresh CONCURRENTLY daily.';


-- =============================================================================
-- MATERIALIZED VIEW 2: mv_menu_item_performance
-- Purpose: Pre-aggregated per-item sales + rating stats across all non-cancelled
--          orders. Backed by a unique composite index so it can be refreshed
--          CONCURRENTLY without blocking reads.
-- =============================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_menu_item_performance;

CREATE MATERIALIZED VIEW mv_menu_item_performance AS
  SELECT
    oi.menu_item_id,
    o.branch_id,
    COUNT(*)                                         AS total_orders,
    SUM(oi.quantity)                                 AS total_quantity,
    COALESCE(SUM(oi.unit_price * oi.quantity), 0)    AS total_revenue,
    ROUND(AVG(r.overall_rating), 2)                  AS avg_rating
  FROM order_items oi
  JOIN orders  o  ON oi.order_id  = o.id
  LEFT JOIN reviews r ON o.id = r.order_id
  WHERE o.status NOT IN ('cancelled')
  GROUP BY oi.menu_item_id, o.branch_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_menu_item_perf_pk
  ON mv_menu_item_performance (menu_item_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_mv_menu_item_perf_revenue
  ON mv_menu_item_performance (total_revenue DESC);

-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_menu_item_performance;

COMMENT ON MATERIALIZED VIEW mv_menu_item_performance IS
  'Pre-aggregated per-menu-item sales, quantity, revenue, and rating. Refresh CONCURRENTLY daily or on menu changes.';


-- =============================================================================
-- MATERIALIZED VIEW 3: mv_restaurant_monthly_summary
-- Purpose: Monthly revenue, order count, and unique customer count per
--          restaurant. Drives the owner's monthly analytics dashboard.
-- =============================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_restaurant_monthly_summary;

CREATE MATERIALIZED VIEW mv_restaurant_monthly_summary AS
  SELECT
    b.restaurant_id,
    DATE_TRUNC('month', o.created_at)               AS month,
    COUNT(DISTINCT o.id)                            AS order_count,
    COALESCE(
      SUM(p.amount) FILTER (WHERE p.status = 'completed'),
      0
    )                                               AS revenue,
    COUNT(DISTINCT o.customer_id)                   AS unique_customers
  FROM orders o
  JOIN branches b ON o.branch_id = b.id
  LEFT JOIN payments p ON o.id = p.order_id
  WHERE o.status NOT IN ('cancelled')
  GROUP BY b.restaurant_id, DATE_TRUNC('month', o.created_at)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_restaurant_monthly_pk
  ON mv_restaurant_monthly_summary (restaurant_id, month);

CREATE INDEX IF NOT EXISTS idx_mv_restaurant_monthly_month
  ON mv_restaurant_monthly_summary (month DESC);

-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_restaurant_monthly_summary;

COMMENT ON MATERIALIZED VIEW mv_restaurant_monthly_summary IS
  'Monthly order count, revenue, and unique customers per restaurant. Refresh CONCURRENTLY on the 1st of each month.';


-- =============================================================================
-- TABLE: push_subscriptions
-- Purpose: Stores Web Push API subscription objects per user/device.
--          Required for server-side push notifications (Prompt 32).
--          The partial unique index ensures one subscription per
--          (user_id, endpoint) — not per (user_id, full JSONB),
--          which would not de-duplicate correctly.
-- =============================================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_data JSONB         NOT NULL,
  device_type       VARCHAR(20)   NOT NULL DEFAULT 'web',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Partial unique index on (user_id, endpoint) — prevents duplicate subscriptions
-- for the same browser/device without relying on JSONB equality.
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_endpoint
  ON push_subscriptions (user_id, (subscription_data->>'endpoint'));

-- Fast lookup by user for fan-out sends
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions (user_id);

-- RLS: allow service_role full access; authenticated users manage only their own
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_own ON push_subscriptions;
CREATE POLICY push_subscriptions_own
  ON push_subscriptions
  FOR ALL
  USING (
    auth.uid()::TEXT = user_id::TEXT  -- user sees/manages their own subscriptions
    OR current_setting('role', TRUE) = 'service_role'  -- backend has full access
  );

COMMENT ON TABLE push_subscriptions IS
  'Web Push API subscription objects. One row per (user, browser endpoint). Used by the push-notification edge function.';

COMMENT ON COLUMN push_subscriptions.subscription_data IS
  'Full PushSubscription JSON from the browser: { endpoint, keys: { p256dh, auth } }';

COMMENT ON COLUMN push_subscriptions.device_type IS
  'web | android | ios — for analytics/routing. Defaults to web.';


-- =============================================================================
-- CONVENIENCE: refresh all materialized views in one shot
-- Call this from a Supabase Edge Function or pg_cron job:
--   SELECT refresh_all_materialized_views();
-- =============================================================================
DROP FUNCTION IF EXISTS refresh_all_materialized_views();

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_branch_daily_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_menu_item_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_restaurant_monthly_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_all_materialized_views()
  TO service_role;

COMMENT ON FUNCTION refresh_all_materialized_views IS
  'Refreshes all three materialized views concurrently. Call from a scheduled Edge Function or pg_cron.';


-- =============================================================================
-- END OF FILE
-- Total: 9 RPC functions + 2 bonus (get_sales_report, get_menu_performance)
--        + 1 utility function (refresh_all_materialized_views)
--        + 3 materialized views
--        + 1 table (push_subscriptions)
-- =============================================================================