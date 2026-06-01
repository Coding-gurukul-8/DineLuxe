import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import {
  getBalance,
  earnPoints,
  redeemPoints,
  getHistory,
  // ── New owner-facing handlers (add these to loyalty.controller.ts) ──
  getStats,
  updateSettings,
  getLeaderboard,
  adminAdjust,
} from './loyalty.controller';

const router: import('express').Router = Router();

router.use(authenticate);

// ── Customer-facing (existing) ─────────────────────────────────────────────────

// GET /loyalty/balance — returns balance for the authenticated user (own data only)
router.get('/balance', getBalance);

// GET /loyalty/me — alias used by customer home page; returns combined balance + summary
router.get('/me', getBalance);

// POST /loyalty/earn
router.post('/earn', earnPoints);

// POST /loyalty/redeem
router.post('/redeem', redeemPoints);

// GET /loyalty/history — returns transaction history for authenticated user only
router.get('/history', getHistory);

// ── Owner / admin endpoints (NEW) ──────────────────────────────────────────────

// GET /loyalty/stats?restaurant_id={id}
// Returns aggregate overview: total members, points issued, redeemed, active this month.
// Role guard: owner or super_admin only.
router.get('/stats', getStats);

// PATCH /loyalty/settings
// Body: { restaurant_id, rupees_per_point, rupees_per_redemption, min_redeem_points }
// Role guard: owner or super_admin only.
router.patch('/settings', updateSettings);

// GET /loyalty/leaderboard?restaurant_id={id}&limit={n}
// Returns top N customers sorted by points_balance desc.
// Role guard: owner or super_admin only.
router.get('/leaderboard', getLeaderboard);

// POST /loyalty/admin/adjust
// Body: { restaurant_id, phone, points, reason }
// Awards (or deducts) points for a customer looked up by phone.
// Role guard: owner or super_admin only.
router.post('/admin/adjust', adminAdjust);

export default router;