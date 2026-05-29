export declare function getMenuSuggestions(branchId: string): Promise<any>;
export declare function getBundleOpportunities(branchId: string): Promise<any>;
export declare function getDemandForecast(branchId: string): Promise<{
    date: string;
    day: string;
    predicted_orders: number;
    confidence: string;
}[]>;
export declare function getStaffingRecommendation(branchId: string): Promise<{
    date: string;
    day: string;
    predicted_orders: number;
    confidence: string;
    recommended_waiters: number;
    recommended_chefs: number;
    scheduled_waiters: number;
    scheduled_chefs: number;
    waiter_gap: number;
    chef_gap: number;
}[]>;
export declare function getRestaurantOverview(restaurantId: string): Promise<{
    revenue_today: number;
    revenue_week: number;
    orders_today: number;
    avg_order_value: number;
    top_items: {
        name: string;
        count: number;
        revenue: number;
    }[];
    occupancy_rate: number;
}>;
export declare function getBranchHourly(branchId: string): Promise<{
    hours: {
        hour: number;
        orders: number;
        revenue: number;
    }[];
}>;
export declare function getRestaurantAnalytics(restaurantId: string, period?: string): Promise<{
    period: string;
    since: string;
    revenue_by_day: {
        date: string;
        amount: number;
    }[];
    orders_by_day: {
        date: string;
        count: number;
    }[];
    avg_order_value: number;
    top_items: {
        name: string;
        count: number;
    }[];
    summary: {
        total_revenue: number;
        total_orders: number;
    };
}>;
//# sourceMappingURL=analytics.service.d.ts.map