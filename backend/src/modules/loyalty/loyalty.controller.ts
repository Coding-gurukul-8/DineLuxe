import { Request, Response, NextFunction } from 'express';
import * as loyaltyService from './loyalty.service';
import { success, error } from '../../utils/response';

// ─── GET /loyalty/balance — own balance only ───────────────────────────────────

export async function getBalance(req: Request, res: Response, next: NextFunction) {
  try {
    // Security: always use the authenticated user's own ID, never a URL param
    const data = await loyaltyService.getBalance(req.user!.id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ─── POST /loyalty/earn ────────────────────────────────────────────────────────

export async function earnPoints(req: Request, res: Response, next: NextFunction) {
  try {
    const { order_id, amount_paid, restaurant_id } = req.body;

    if (!order_id || typeof order_id !== 'string') {
      return res.status(400).json(error('VALIDATION_ERROR', 'order_id is required'));
    }
    const amountNum = Number(amount_paid);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json(error('VALIDATION_ERROR', 'amount_paid must be a positive number'));
    }
    if (!restaurant_id || typeof restaurant_id !== 'string') {
      return res.status(400).json(error('VALIDATION_ERROR', 'restaurant_id is required'));
    }

    const data = await loyaltyService.earn(req.user!.id, order_id, amountNum, restaurant_id);
    res.json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

// ─── POST /loyalty/redeem ──────────────────────────────────────────────────────

export async function redeemPoints(req: Request, res: Response, next: NextFunction) {
  try {
    const { order_id, restaurant_id } = req.body;
    const rawPoints = req.body.points_to_redeem ?? req.body.points;
    const pointsNum = Number(rawPoints);

    if (!order_id || typeof order_id !== 'string') {
      return res.status(400).json(error('VALIDATION_ERROR', 'order_id is required'));
    }
    if (!Number.isFinite(pointsNum)) {
      return res.status(400).json(error('VALIDATION_ERROR', 'points_to_redeem must be a number'));
    }
    if (!restaurant_id || typeof restaurant_id !== 'string') {
      return res.status(400).json(error('VALIDATION_ERROR', 'restaurant_id is required'));
    }

    const data = await loyaltyService.redeem(req.user!.id, order_id, pointsNum, restaurant_id);
    res.json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

// ─── GET /loyalty/history — own history only ──────────────────────────────────

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    // Security: always use authenticated user's own ID
    const result = await loyaltyService.getHistory(req.user!.id, page, limit);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner-facing endpoints
// Routes:
//   GET  /loyalty/stats           → getStats
//   PATCH /loyalty/settings       → updateSettings
//   GET  /loyalty/leaderboard     → getLeaderboard
//   POST /loyalty/admin/adjust    → adminAdjust
// ─────────────────────────────────────────────────────────────────────────────

const OWNER_ROLES = ['owner', 'super_admin'] as const;

function requireOwner(req: Request, res: Response): boolean {
  const role = req.user?.role;
  if (!OWNER_ROLES.includes(role as any)) {
    res.status(403).json(error('FORBIDDEN', 'Only restaurant owners can access this endpoint'));
    return false;
  }
  return true;
}

// ─── GET /loyalty/stats ───────────────────────────────────────────────────────

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireOwner(req, res)) return;

    const restaurant_id = req.query.restaurant_id as string;
    if (!restaurant_id) {
      return res.status(400).json(error('VALIDATION_ERROR', 'restaurant_id query param is required'));
    }

    const data = await loyaltyService.getLoyaltyStats(restaurant_id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /loyalty/settings ──────────────────────────────────────────────────

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireOwner(req, res)) return;

    const { restaurant_id, rupees_per_point, rupees_per_redemption, min_redeem_points } = req.body;

    if (!restaurant_id) {
      return res.status(400).json(error('VALIDATION_ERROR', 'restaurant_id is required'));
    }
    if (typeof rupees_per_point !== 'number') {
      return res.status(400).json(error('VALIDATION_ERROR', 'rupees_per_point must be a number'));
    }
    if (typeof rupees_per_redemption !== 'number') {
      return res.status(400).json(error('VALIDATION_ERROR', 'rupees_per_redemption must be a number'));
    }
    if (typeof min_redeem_points !== 'number') {
      return res.status(400).json(error('VALIDATION_ERROR', 'min_redeem_points must be a number'));
    }

    const data = await loyaltyService.updateLoyaltySettings(
      restaurant_id,
      rupees_per_point,
      rupees_per_redemption,
      min_redeem_points,
    );
    res.json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}

// ─── GET /loyalty/leaderboard ─────────────────────────────────────────────────

export async function getLeaderboard(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireOwner(req, res)) return;

    const restaurant_id = req.query.restaurant_id as string;
    if (!restaurant_id) {
      return res.status(400).json(error('VALIDATION_ERROR', 'restaurant_id query param is required'));
    }

    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const data = await loyaltyService.getLoyaltyLeaderboard(restaurant_id, limit);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ─── POST /loyalty/admin/adjust ───────────────────────────────────────────────

export async function adminAdjust(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireOwner(req, res)) return;

    const { restaurant_id, phone, points, reason } = req.body;

    if (!restaurant_id) {
      return res.status(400).json(error('VALIDATION_ERROR', 'restaurant_id is required'));
    }
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json(error('VALIDATION_ERROR', 'phone is required'));
    }
    const pointsNum = Number(points);
    if (!Number.isFinite(pointsNum) || !Number.isInteger(pointsNum) || pointsNum === 0) {
      return res.status(400).json(error('VALIDATION_ERROR', 'points must be a non-zero integer'));
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json(error('VALIDATION_ERROR', 'reason is required'));
    }

    const data = await loyaltyService.adminAdjustPoints(
      restaurant_id,
      phone,
      pointsNum,
      reason,
    );
    res.json(success(data));
  } catch (err: any) {
    if (err.statusCode) return res.status(err.statusCode).json(error(err.message));
    next(err);
  }
}