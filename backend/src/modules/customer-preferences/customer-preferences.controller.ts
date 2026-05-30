import { Request, Response, NextFunction } from 'express';
import { success, error } from '../../utils/response';
import {
  getTablePreference,
  saveTablePreference,
  getAllPreferences,
  getDietaryProfile,
  upsertDietaryProfile,
} from './customer-preferences.service';

// ─── Helper ───────────────────────────────────────────────────────────────────

function handleKnownError(err: any, res: Response, next: NextFunction) {
  const code = err.statusCode ?? err.status;
  if (code && code >= 400 && code < 600) {
    return res.status(code).json(error(err.message));
  }
  next(err);
}

// ─── Dietary Profile Handlers ─────────────────────────────────────────────────

/**
 * GET /customer-preferences/dietary
 * Returns the authenticated customer's dietary profile.
 */
export async function handleGetDietaryProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const profile = await getDietaryProfile(userId);
    res.json(success(profile));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}

/**
 * PATCH /customer-preferences/dietary
 * Create or update the authenticated customer's dietary profile.
 */
export async function handleUpsertDietaryProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const profile = await upsertDietaryProfile(userId, req.body);
    res.json(success(profile, 'Dietary profile updated'));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}

// ─── Table Preference Handlers ────────────────────────────────────────────────

/**
 * GET /customer-preferences/tables
 * Returns all table preferences for the customer across all branches.
 */
export async function handleGetAllPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const preferences = await getAllPreferences(userId);
    res.json(success(preferences));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}

/**
 * GET /customer-preferences/tables/:branchId
 * Returns the customer's saved table preference for a specific branch, or null.
 */
export async function handleGetTablePreference(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { branchId } = req.params;
    if (!branchId) return res.status(400).json(error('branchId is required'));
    const preference = await getTablePreference(userId, branchId);
    res.json(success(preference));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}

/**
 * POST /customer-preferences/tables
 * Save or update the customer's preferred table for a branch.
 */
export async function handleSaveTablePreference(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { branch_id, preferred_table_id, preferred_table_label } = req.body;
    const preference = await saveTablePreference(
      userId,
      branch_id,
      preferred_table_id,
      preferred_table_label,
    );
    res.status(201).json(success(preference, 'Table preference saved'));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}