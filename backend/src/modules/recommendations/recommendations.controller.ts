import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import {
  getPersonalizedRecommendations,
  getPopularNearby,
} from './recommendations.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCoord(val: unknown, name: string): number {
  const n = Number(val);
  if (!Number.isFinite(n)) {
    throw Object.assign(new Error(`Query param '${name}' must be a valid number`), {
      status: 400,
      code: 'INVALID_QUERY_PARAM',
    });
  }
  return n;
}

// ---------------------------------------------------------------------------
// GET /recommendations/personalized?lat=&lon=&radius=
// Requires: authenticate (userId from req.user.id)
// ---------------------------------------------------------------------------
export async function getPersonalized(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req as any).user?.id as string;
    const lat = parseCoord(req.query.lat, 'lat');
    const lon = parseCoord(req.query.lon, 'lon');
    const radiusKm = req.query.radius !== undefined ? parseCoord(req.query.radius, 'radius') : 5;

    const data = await getPersonalizedRecommendations(userId, lat, lon, radiusKm);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /recommendations/popular?lat=&lon=&radius=&cuisine=
// No auth required
// ---------------------------------------------------------------------------
export async function getPopular(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const lat = parseCoord(req.query.lat, 'lat');
    const lon = parseCoord(req.query.lon, 'lon');
    const radiusKm = req.query.radius !== undefined ? parseCoord(req.query.radius, 'radius') : 5;
    const cuisine =
      typeof req.query.cuisine === 'string' && req.query.cuisine.trim()
        ? req.query.cuisine.trim()
        : undefined;

    const data = await getPopularNearby(lat, lon, radiusKm, cuisine);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}