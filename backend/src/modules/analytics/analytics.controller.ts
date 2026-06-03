import { Request, Response, NextFunction } from 'express';
import * as analyticsService from './analytics.service';
import { success } from '../../utils/response';

// ─── Existing AI/forecast endpoints ──────────────────────────────────────────

export async function getMenuSuggestions(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getMenuSuggestions(req.params.branchId);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getDemandForecast(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getDemandForecast(req.params.branchId);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getBundleOpportunities(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getBundleOpportunities(req.params.branchId);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function getStaffingRecommendation(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getStaffingRecommendation(req.params.branchId);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ─── NEW: Restaurant overview ─────────────────────────────────────────────────
// GET /analytics/restaurant/:restaurantId/overview
// Auth: owner or admin (enforced in router)
export async function getRestaurantOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getRestaurantOverview(req.params.restaurantId);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ─── NEW: Branch hourly activity ──────────────────────────────────────────────
// GET /analytics/branch/:branchId/hourly
// Auth: owner or admin (enforced in router)
export async function getBranchHourly(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getBranchHourly(req.params.branchId);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ─── NEW: Branch performance ───────────────────────────────────────────────────
// GET /analytics/branch-performance?restaurant_id=:restaurantId
// Auth: owner or admin (enforced in router)
export async function getBranchPerformance(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = req.query.restaurant_id as string | undefined;
    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'restaurant_id query parameter is required' },
      });
    }
    const authUser = req.user as { role: string; restaurant_id?: string } | undefined;
    const data = await analyticsService.getBranchPerformance(restaurantId, authUser);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ─── Restaurant period analytics ──────────────────────────────────────────────
// GET /analytics/restaurant/:restaurantId/analytics?period=7d|30d|90d
export async function getRestaurantAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const period = (req.query.period as string) || '30d';
    if (!['7d', '30d', '90d'].includes(period)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'period must be 7d, 30d, or 90d' } });
    }
    const data = await analyticsService.getRestaurantAnalytics(req.params.restaurantId, period);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ─── Platform overview (admin) ───────────────────────────────────────────────
// GET /analytics/overview?period=7d|30d|90d
export async function getPlatformOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const period = (req.query.period as string) || '30d';
    if (!['7d', '30d', '90d'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'period must be 7d, 30d, or 90d' },
      });
    }
    const data = await analyticsService.getPlatformOverview(period);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}