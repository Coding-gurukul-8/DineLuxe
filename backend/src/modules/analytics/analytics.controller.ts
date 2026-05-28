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