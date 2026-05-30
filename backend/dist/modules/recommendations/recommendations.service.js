"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPersonalizedRecommendations = getPersonalizedRecommendations;
exports.getPopularNearby = getPopularNearby;
const supabase_1 = require("../../config/supabase");
// ---------------------------------------------------------------------------
// Haversine distance — returns metres
// ---------------------------------------------------------------------------
function haversineMetres(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in metres
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
// ---------------------------------------------------------------------------
// Fetch all active restaurants with branch geo + rating + recent order count
// (shared by both service functions)
// ---------------------------------------------------------------------------
async function fetchActiveRestaurants() {
    const { data, error } = await supabase_1.supabaseAdmin
        .from('branches')
        .select(`
      id,
      lat, lon,
      restaurants!inner (
        id, name, cuisine_type, status,
        restaurant_branding ( logo_url, primary_color ),
        reviews ( overall_rating )
      ),
      orders ( id, created_at )
    `)
        .eq('is_active', true)
        .eq('restaurants.status', 'active')
        .not('lat', 'is', null)
        .not('lon', 'is', null);
    if (error)
        throw error;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return (data ?? []).map((branch) => {
        const restaurant = branch.restaurants;
        const branding = Array.isArray(restaurant.restaurant_branding)
            ? restaurant.restaurant_branding[0]
            : restaurant.restaurant_branding;
        const reviews = restaurant.reviews ?? [];
        const allOrders = branch.orders ?? [];
        const avgRating = reviews.length > 0
            ? reviews.reduce((s, r) => s + r.overall_rating, 0) / reviews.length
            : null;
        const ordersLast7d = allOrders.filter((o) => o.created_at >= sevenDaysAgo).length;
        return {
            id: restaurant.id,
            branch_id: branch.id,
            name: restaurant.name,
            cuisine_type: restaurant.cuisine_type ?? null,
            logo_url: branding?.logo_url ?? null,
            primary_color: branding?.primary_color ?? null,
            lat: Number(branch.lat),
            lon: Number(branch.lon),
            avg_rating: avgRating,
            orders_last_7d: ordersLast7d,
        };
    });
}
// ---------------------------------------------------------------------------
// Time-of-day boost (IST = UTC + 5:30)
// ---------------------------------------------------------------------------
function getTimeBoost(cuisineType) {
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const hour = nowIST.getUTCHours();
    const cuisine = (cuisineType ?? '').toLowerCase();
    // 06:00–11:00 → breakfast boost
    if (hour >= 6 && hour < 11) {
        if (cuisine.includes('breakfast') || cuisine.includes('café') || cuisine.includes('cafe')) {
            return 0.15;
        }
    }
    // 12:00–15:00 → fast casual boost
    if (hour >= 12 && hour < 15) {
        if (cuisine.includes('fast') ||
            cuisine.includes('casual') ||
            cuisine.includes('sandwich') ||
            cuisine.includes('pizza')) {
            return 0.1;
        }
    }
    // 19:00–23:00 → fine dining boost
    if (hour >= 19 && hour < 23) {
        if (cuisine.includes('fine') ||
            cuisine.includes('continental') ||
            cuisine.includes('french') ||
            cuisine.includes('italian')) {
            return 0.1;
        }
    }
    return 0;
}
// ---------------------------------------------------------------------------
// getPersonalizedRecommendations
// GET /recommendations/personalized?lat=&lon=&radius=
// ---------------------------------------------------------------------------
async function getPersonalizedRecommendations(userId, lat, lon, radiusKm = 5) {
    // Step 1 — order history (last 20 grouped by restaurant)
    const { data: historyData } = await supabase_1.supabaseAdmin
        .from('orders')
        .select('restaurant_id:branches!branch_id(restaurant_id), created_at')
        .eq('customer_id', userId)
        .in('status', ['paid', 'served', 'closed'])
        .order('created_at', { ascending: false })
        .limit(100);
    // Count visits per restaurant_id
    const visitMap = new Map();
    for (const row of historyData ?? []) {
        const rid = row.restaurant_id?.restaurant_id;
        if (rid)
            visitMap.set(rid, (visitMap.get(rid) ?? 0) + 1);
    }
    const orderHistory = Array.from(visitMap.entries())
        .map(([restaurant_id, visit_count]) => ({ restaurant_id, cuisine_type: null, visit_count }))
        .sort((a, b) => b.visit_count - a.visit_count)
        .slice(0, 20);
    // Step 2 — dietary profile
    const { data: dietaryData } = await supabase_1.supabaseAdmin
        .from('user_dietary_profiles')
        .select('preferences, allergies')
        .eq('user_id', userId)
        .maybeSingle();
    const userPreferences = dietaryData ?? null;
    // Step 3 — all active restaurants
    const restaurants = await fetchActiveRestaurants();
    // Step 4 — score each restaurant
    const radiusMetres = radiusKm * 1000;
    const scored = [];
    for (const r of restaurants) {
        const dist = haversineMetres(lat, lon, r.lat, r.lon);
        if (dist > radiusMetres)
            continue;
        const distanceScore = 1 - dist / radiusMetres;
        const ratingScore = (r.avg_rating ?? 3) / 5;
        const popularityScore = Math.min((r.orders_last_7d ?? 0) / 100, 1);
        const orderCount = orderHistory.find((o) => o.restaurant_id === r.id)?.visit_count ?? 0;
        const returnBonus = Math.min(orderCount / 10, 0.2);
        const hasDietaryMatch = (userPreferences?.preferences?.length ?? 0) > 0;
        const dietaryBonus = hasDietaryMatch ? 0.1 : 0;
        const timeBoost = getTimeBoost(r.cuisine_type);
        const score = 0.4 * distanceScore +
            0.35 * ratingScore +
            0.25 * popularityScore +
            returnBonus +
            dietaryBonus +
            timeBoost;
        let match_reason;
        if (orderCount > 2)
            match_reason = "You've visited before";
        else if (distanceScore > 0.8)
            match_reason = 'Very close to you';
        else if (ratingScore > 0.8)
            match_reason = 'Highly rated';
        else
            match_reason = 'Popular in your area';
        scored.push({ ...r, distance_meters: Math.round(dist), score, match_reason });
    }
    // Step 5 — sort by score, return top 10
    return scored.sort((a, b) => b.score - a.score).slice(0, 10);
}
// ---------------------------------------------------------------------------
// getPopularNearby
// GET /recommendations/popular?lat=&lon=&radius=&cuisine=
// No auth required
// ---------------------------------------------------------------------------
async function getPopularNearby(lat, lon, radiusKm = 5, cuisine) {
    const restaurants = await fetchActiveRestaurants();
    const radiusMetres = radiusKm * 1000;
    const scored = [];
    for (const r of restaurants) {
        // Optional cuisine filter (case-insensitive substring match)
        if (cuisine) {
            const haystack = (r.cuisine_type ?? '').toLowerCase();
            if (!haystack.includes(cuisine.toLowerCase()))
                continue;
        }
        const dist = haversineMetres(lat, lon, r.lat, r.lon);
        if (dist > radiusMetres)
            continue;
        const ratingNorm = (r.avg_rating ?? 3) / 5;
        const popularityNorm = Math.min((r.orders_last_7d ?? 0) / 100, 1);
        const score = 0.5 * ratingNorm + 0.5 * popularityNorm;
        scored.push({
            ...r,
            distance_meters: Math.round(dist),
            score,
            match_reason: 'Popular in your area',
        });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 20);
}
//# sourceMappingURL=recommendations.service.js.map