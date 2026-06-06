-- ============================================================
-- Sponsored Placements — Section 9.2 / 19.1
-- Run in Supabase SQL Editor (not via Prisma)
-- ============================================================

CREATE TABLE IF NOT EXISTS sponsored_placements (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID        REFERENCES restaurants(id) ON DELETE CASCADE,
  placement_type   VARCHAR(20) NOT NULL,    -- 'home_banner' | 'search_top' | 'featured_card'
  banner_url       TEXT,                    -- Full image URL for home banner
  headline         TEXT,                    -- e.g. "New Opening — 20% Off Today!"
  cta_text         VARCHAR(50),             -- e.g. "Order Now"
  is_active        BOOLEAN     DEFAULT true,
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  impression_count INTEGER     DEFAULT 0,
  click_count      INTEGER     DEFAULT 0,
  created_by       UUID        REFERENCES users(id),  -- super_admin who created it
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Composite index for the hot query path:
-- "give me all active home_banner placements live right now"
CREATE INDEX IF NOT EXISTS sponsored_placements_lookup_idx
  ON sponsored_placements(placement_type, is_active, starts_at, ends_at);

-- ── Atomic increment RPCs (avoid row-level locking on busy counters) ──────────

-- Called by the batch flush job every 60 s for impressions
CREATE OR REPLACE FUNCTION increment_impression_count(p_id UUID, p_delta INTEGER)
RETURNS void LANGUAGE sql AS $$
  UPDATE sponsored_placements
  SET impression_count = impression_count + p_delta
  WHERE id = p_id;
$$;

-- Called directly on each click (lower volume)
CREATE OR REPLACE FUNCTION increment_click_count(p_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE sponsored_placements
  SET click_count = click_count + 1
  WHERE id = p_id;
$$;