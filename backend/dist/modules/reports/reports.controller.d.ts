import { Request, Response, NextFunction } from 'express';
export declare function getSales(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getMenuPerformance(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getKitchenPerformance(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getCustomerInsights(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function getAdminPlatform(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getAdminTrends(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function exportReport(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /reports/revenue?branch_id=&from=&to=
 * → { total, breakdown: [{ date, amount }] }
 */
export declare function getRevenueReport(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /reports/orders?branch_id=&from=&to=
 * → { total_orders, by_type: { dine_in, takeaway, delivery } }
 */
export declare function getOrdersReport(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /reports/menu?branch_id=&from=&to=
 * → { top_items: [{ name, count, revenue }] }
 */
export declare function getMenuReport(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
/**
 * GET /reports/staff?branch_id=&from=&to=
 * → { staff_performance: [{ name, orders, avg_time }] }
 */
export declare function getStaffReport(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=reports.controller.d.ts.map