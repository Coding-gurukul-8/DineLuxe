import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  getBalance,
  earnPoints,
  redeemPoints,
  getHistory,
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

// P3-2 ADDITION: Stats overview (for owner dashboard)
router.get(
  '/stats',
  injectTenant,
  requireRole('owner', 'manager'),
  getStats,
);

// P3-2 ADDITION: Leaderboard (top members)
router.get(
  '/leaderboard',
  injectTenant,
  requireRole('owner', 'manager'),
  getLeaderboard,
);

// P3-2 ADDITION: Update loyalty program settings
router.patch(
  '/settings',
  injectTenant,
  requireRole('owner'),
  validate({
    body: z.object({
      points_per_rupee: z.number().positive().optional(),
      rupees_per_point: z.number().positive().optional(),
      min_redeem_points: z.number().int().positive().optional(),
    }).refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'At least one setting is required',
    }),
  }),
  updateSettings,
);

// P3-2 ADDITION: Admin manual points adjustment
router.post(
  '/admin/adjust',
  injectTenant,
  requireRole('owner', 'manager'),
  validate({
    body: z.object({
      phone: z.string().min(10).max(15),
      points: z.number().int().refine((n) => n !== 0, 'Points cannot be zero'),
      reason: z.string().min(3).max(200),
    }),
  }),
  adminAdjust,
);

export default router;