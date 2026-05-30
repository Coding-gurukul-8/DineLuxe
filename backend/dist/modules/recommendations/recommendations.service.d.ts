export interface RestaurantRecommendation {
    id: string;
    branch_id: string;
    name: string;
    cuisine_type: string | null;
    logo_url: string | null;
    primary_color: string | null;
    lat: number;
    lon: number;
    avg_rating: number | null;
    orders_last_7d: number;
    distance_meters: number;
    score: number;
    match_reason: string;
}
export declare function getPersonalizedRecommendations(userId: string, lat: number, lon: number, radiusKm?: number): Promise<RestaurantRecommendation[]>;
export declare function getPopularNearby(lat: number, lon: number, radiusKm?: number, cuisine?: string): Promise<RestaurantRecommendation[]>;
//# sourceMappingURL=recommendations.service.d.ts.map