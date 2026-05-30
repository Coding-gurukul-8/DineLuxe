import { Request, Response, NextFunction } from 'express';
/**
 * GET /customer-preferences/dietary
 * Returns the authenticated customer's dietary profile.
 */
export declare function handleGetDietaryProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * PATCH /customer-preferences/dietary
 * Create or update the authenticated customer's dietary profile.
 */
export declare function handleUpsertDietaryProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /customer-preferences/tables
 * Returns all table preferences for the customer across all branches.
 */
export declare function handleGetAllPreferences(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * GET /customer-preferences/tables/:branchId
 * Returns the customer's saved table preference for a specific branch, or null.
 */
export declare function handleGetTablePreference(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * POST /customer-preferences/tables
 * Save or update the customer's preferred table for a branch.
 */
export declare function handleSaveTablePreference(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=customer-preferences.controller.d.ts.map