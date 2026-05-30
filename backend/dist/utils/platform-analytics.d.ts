type Period = '7d' | '30d' | '90d';
type PlatformPeriodBreakdown = {
    date: string;
    revenue: number;
    orders: number;
};
type PlatformPeriodReport = {
    period: Period;
    days: number;
    revenue_total: number;
    orders_total: number;
    avg_order_value: number;
    period_breakdowns: PlatformPeriodBreakdown[];
};
export declare function getPlatformPeriodReport(periodInput?: string): Promise<PlatformPeriodReport>;
export {};
//# sourceMappingURL=platform-analytics.d.ts.map