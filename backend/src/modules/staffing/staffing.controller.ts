import { Request, Response, NextFunction } from 'express';
import { success, error } from '../../utils/response';
import {
  predictDemand,
  getStaffingRecommendation,
  getWeeklyForecast,
} from './staffing.service';

// ─── Helper ───────────────────────────────────────────────────────────────────

function handleKnownError(err: any, res: Response, next: NextFunction) {
  const code = err.statusCode ?? err.status;
  if (code && code >= 400 && code < 600) {
    return res.status(code).json(error(err.message));
  }
  next(err);
}

/** Validate a YYYY-MM-DD string. Returns true if valid. */
function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

// ─── GET /staffing/prediction?branch_id=&date= ───────────────────────────────

/**
 * Returns hourly demand predictions for a specific date.
 * Query params: branch_id (required), date (YYYY-MM-DD, required)
 */
export async function handleGetDemandPrediction(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.restaurantId) return res.status(403).json(error('Missing tenant context'));

    const { branch_id, date } = req.query as Record<string, string>;

    if (!branch_id) return res.status(400).json(error('branch_id query param is required'));
    if (!date)      return res.status(400).json(error('date query param is required (YYYY-MM-DD)'));
    if (!isValidDate(date)) {
      return res.status(400).json(error('date must be a valid YYYY-MM-DD string'));
    }

    const predictions = await predictDemand(branch_id, req.restaurantId, date);
    res.json(success(predictions));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}

// ─── GET /staffing/recommendation?branch_id=&date= ───────────────────────────

/**
 * Returns staffing recommendations with warnings for a specific date.
 * Query params: branch_id (required), date (YYYY-MM-DD, required)
 */
export async function handleGetRecommendation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.restaurantId) return res.status(403).json(error('Missing tenant context'));

    const { branch_id, date } = req.query as Record<string, string>;

    if (!branch_id) return res.status(400).json(error('branch_id query param is required'));
    if (!date)      return res.status(400).json(error('date query param is required (YYYY-MM-DD)'));
    if (!isValidDate(date)) {
      return res.status(400).json(error('date must be a valid YYYY-MM-DD string'));
    }

    const recommendation = await getStaffingRecommendation(branch_id, req.restaurantId, date);
    res.json(success(recommendation));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}

// ─── GET /staffing/weekly?branch_id=&week_start= ────────────────────────────

/**
 * Returns a 7-day staffing forecast starting from week_start.
 * Query params: branch_id (required), week_start (YYYY-MM-DD, required)
 */
export async function handleGetWeeklyForecast(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.restaurantId) return res.status(403).json(error('Missing tenant context'));

    const { branch_id, week_start } = req.query as Record<string, string>;

    if (!branch_id)   return res.status(400).json(error('branch_id query param is required'));
    if (!week_start)  return res.status(400).json(error('week_start query param is required (YYYY-MM-DD)'));
    if (!isValidDate(week_start)) {
      return res.status(400).json(error('week_start must be a valid YYYY-MM-DD string'));
    }

    const forecast = await getWeeklyForecast(branch_id, req.restaurantId, week_start);
    res.json(success(forecast));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}