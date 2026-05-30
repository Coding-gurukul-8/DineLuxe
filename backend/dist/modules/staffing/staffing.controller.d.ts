import { Request, Response, NextFunction } from 'express';
/**
 * Returns hourly demand predictions for a specific date.
 * Query params: branch_id (required), date (YYYY-MM-DD, required)
 */
export declare function handleGetDemandPrediction(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Returns staffing recommendations with warnings for a specific date.
 * Query params: branch_id (required), date (YYYY-MM-DD, required)
 */
export declare function handleGetRecommendation(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Returns a 7-day staffing forecast starting from week_start.
 * Query params: branch_id (required), week_start (YYYY-MM-DD, required)
 */
export declare function handleGetWeeklyForecast(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=staffing.controller.d.ts.map