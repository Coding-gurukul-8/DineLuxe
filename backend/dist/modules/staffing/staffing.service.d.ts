export interface HourlyPrediction {
    hour: number;
    predicted_orders: number;
    confidence: 'high' | 'medium' | 'low';
}
export interface HourlyStaffing {
    hour: number;
    waiters: number;
    chefs: number;
    cashiers: number;
}
export interface CurrentScheduled {
    waiter: number;
    chef: number;
    cashier: number;
    host: number;
}
export interface StaffingRecommendation {
    date: string;
    peak_hours: number[];
    recommendations: HourlyStaffing[];
    current_scheduled: CurrentScheduled;
    warnings: string[];
}
/**
 * Queries historical orders for the same day-of-week over the last 8 weeks and
 * returns an hourly predicted order count with confidence level for hours 9–23.
 *
 * Cache key: 'staffing_prediction:{branchId}:{dateStr}'  TTL: 2 hours
 */
export declare function predictDemand(branchId: string, restaurantId: string, targetDate: string): Promise<HourlyPrediction[]>;
/**
 * Returns hourly staffing requirements based on demand predictions,
 * compares against currently scheduled staff, and generates warnings.
 */
export declare function getStaffingRecommendation(branchId: string, restaurantId: string, targetDate: string): Promise<StaffingRecommendation>;
/**
 * Returns staffing recommendations for 7 consecutive days starting from weekStart.
 * weekStart must be a YYYY-MM-DD string.
 */
export declare function getWeeklyForecast(branchId: string, restaurantId: string, weekStart: string): Promise<StaffingRecommendation[]>;
//# sourceMappingURL=staffing.service.d.ts.map