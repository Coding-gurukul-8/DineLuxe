import { Request, Response, NextFunction } from 'express';
export declare function getMenuSuggestions(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getDemandForecast(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getBundleOpportunities(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getStaffingRecommendation(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getRestaurantOverview(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getBranchHourly(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getRestaurantAnalytics(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getPlatformOverview(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=analytics.controller.d.ts.map