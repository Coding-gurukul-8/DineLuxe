import { Request, Response, NextFunction } from 'express';
import { success, error } from '../../utils/response';
import {
  getRulesForBranch,
  getActiveRulesNow,
  createRule,
  updateRule,
  toggleRule,
  deleteRule,
} from './dynamic-pricing.service';

// ─── Helper ───────────────────────────────────────────────────────────────────

function handleKnownError(err: any, res: Response, next: NextFunction) {
  const code = err.statusCode ?? err.status;
  if (code && code >= 400 && code < 600) {
    return res.status(code).json(error(err.message));
  }
  next(err);
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /dynamic-pricing/branch/:branchId
 * Returns all pricing rules for a branch. Manager/owner only.
 */
export async function handleGetRulesForBranch(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.restaurantId) return res.status(403).json(error('Missing tenant context'));
    const { branchId } = req.params;
    const rules = await getRulesForBranch(branchId, req.restaurantId);
    res.json(success(rules));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}

/**
 * GET /dynamic-pricing/branch/:branchId/active
 * Returns currently active rules based on IST time. Public — used by menu service.
 */
export async function handleGetActiveRulesNow(req: Request, res: Response, next: NextFunction) {
  try {
    const { branchId } = req.params;
    if (!branchId) return res.status(400).json(error('branchId is required'));
    const rules = await getActiveRulesNow(branchId);
    res.json(success(rules));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}

/**
 * POST /dynamic-pricing
 * Create a new pricing rule. Manager/owner only.
 */
export async function handleCreateRule(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.branchId || !req.restaurantId) {
      return res.status(403).json(error('Missing tenant context'));
    }
    const rule = await createRule(req.branchId, req.restaurantId, req.body, req.user!.id);
    res.status(201).json(success(rule, 'Pricing rule created'));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}

/**
 * PATCH /dynamic-pricing/:id
 * Update an existing pricing rule. Manager/owner only.
 */
export async function handleUpdateRule(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.branchId || !req.restaurantId) {
      return res.status(403).json(error('Missing tenant context'));
    }
    const rule = await updateRule(req.params.id, req.branchId, req.restaurantId, req.body);
    res.json(success(rule, 'Pricing rule updated'));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}

/**
 * PATCH /dynamic-pricing/:id/toggle
 * Toggle is_active on a rule and notify customer app via WebSocket. Manager/owner only.
 */
export async function handleToggleRule(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.branchId || !req.restaurantId) {
      return res.status(403).json(error('Missing tenant context'));
    }
    const rule = await toggleRule(req.params.id, req.branchId, req.restaurantId);
    const state = (rule as any).is_active ? 'activated' : 'deactivated';
    res.json(success(rule, `Pricing rule ${state}`));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}

/**
 * DELETE /dynamic-pricing/:id
 * Delete a pricing rule. Manager/owner only.
 */
export async function handleDeleteRule(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.branchId || !req.restaurantId) {
      return res.status(403).json(error('Missing tenant context'));
    }
    const result = await deleteRule(req.params.id, req.branchId, req.restaurantId);
    res.json(success(result, 'Pricing rule deleted'));
  } catch (err: any) {
    handleKnownError(err, res, next);
  }
}