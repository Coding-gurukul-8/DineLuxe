import { Request, Response, NextFunction } from 'express';
/**
 * GET /dynamic-pricing/branch/:branchId
 * Returns all pricing rules for a branch. Manager/owner only.
 */
export declare function handleGetRulesForBranch(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /dynamic-pricing/branch/:branchId/active
 * Returns currently active rules based on IST time. Public — used by menu service.
 */
export declare function handleGetActiveRulesNow(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /dynamic-pricing
 * Create a new pricing rule. Manager/owner only.
 */
export declare function handleCreateRule(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * PATCH /dynamic-pricing/:id
 * Update an existing pricing rule. Manager/owner only.
 */
export declare function handleUpdateRule(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * PATCH /dynamic-pricing/:id/toggle
 * Toggle is_active on a rule and notify customer app via WebSocket. Manager/owner only.
 */
export declare function handleToggleRule(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * DELETE /dynamic-pricing/:id
 * Delete a pricing rule. Manager/owner only.
 */
export declare function handleDeleteRule(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=dynamic-pricing.controller.d.ts.map