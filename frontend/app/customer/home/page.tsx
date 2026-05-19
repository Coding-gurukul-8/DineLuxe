"use client";

/**
 * app/customer/home/page.tsx
 *
 * Fixes vs. old implementation
 * ──────────────────────────────
 * 1. Geolocation → GET /restaurants/nearby?lat&lng&radius
 *    Falls back to India centre (20.5937, 78.9629) on denial.
 * 2. Renders RestaurantCard grid (was missing entirely).
 * 3. Active orders show a status progress bar.
 * 4. Featured items section gated on branchId (was already present but
 *    endpoint now correct: GET /menu/branch/:branchId/items?limit=5).
 * 5. Loyalty points badge properly driven by GET /loyalty/me.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { FoodCard } from "@/components/shared/FoodCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import RestaurantCard from "@/components/customer/RestaurantCard";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import {
  Search,
  QrCode,
  Calendar,
  ShoppingBag,
  Clock,
  MapPin,
  Star,
  ChevronRight,
  Flame,
  TrendingUp,
  Bell,
  Gift,
  Loader2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  is_active: boolean;
}

interface Restaurant {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  cuisine_type?: string;
  avg_rating: number;
  total_reviews: number;
  branches: Branch[];
}

interface ActiveOrder {
  id: string;
  status: string;
  total: number;
  items?: { name: string }[];
}

interface LoyaltyData {
  points: number;
  pointsToNextReward?: number;
  progressPercent?: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const NEARBY_RADIUS = 10; // km

const quickActions = [
  { label: "Scan QR",    icon: <QrCode size={24} />,    href: "/customer/scan",    color: "bg-blue-500" },
  { label: "Book Table", icon: <Calendar size={24} />,  href: "/customer/booking", color: "bg-green-500" },
  { label: "My Orders",  icon: <ShoppingBag size={24} />,href: "/customer/order",  color: "bg-purple-500" },
  { label: "Menu",       icon: <TrendingUp size={24} />, href: "/customer/menu",   color: "bg-orange-500" },
];

// Maps order status to a 0-100 progress value
const ORDER_PROGRESS: Record<string, number> = {
  created:   10,
  confirmed: 30,
  preparing: 55,
  ready:     75,
  served:    90,
  paid:     100,
  closed:   100,
};

// Compute haversine distance in km between two coords
function distanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CustomerHomePage() {
  const { user, branchId } = useAuth();

  // ── Geolocation ─────────────────────────────────────────────────────────────

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoReady, setGeoReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) {
      setCoords(INDIA_CENTER);
      setGeoReady(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoReady(true);
      },
      () => {
        // Permission denied or unavailable — fall back to India centre
        setCoords(INDIA_CENTER);
        setGeoReady(true);
      },
      { timeout: 8_000 }
    );
  }, []);

  // ── Queries ─────────────────────────────────────────────────────────────────

  // GET /restaurants/nearby?lat=&lng=&radius=
  const { data: restaurants = [], isLoading: restaurantsLoading } = useQuery<Restaurant[]>({
    queryKey: ["restaurants", "nearby", coords?.lat, coords?.lng],
    queryFn: () =>
      apiClient.get<Restaurant[]>(
        `/restaurants/nearby?lat=${coords!.lat}&lng=${coords!.lng}&radius=${NEARBY_RADIUS}`
      ),
    enabled: geoReady && !!coords,
    staleTime: 5 * 60_000,
  });

  // GET /orders/user/me?status=active  (poll every 15 s)
  const { data: activeOrders = [] } = useQuery<ActiveOrder[]>({
    queryKey: ["customer", "active-orders"],
    queryFn: () => apiClient.get<ActiveOrder[]>("/orders/user/me?status=active"),
    refetchInterval: 15_000,
  });

  // GET /menu/branch/:branchId/items?limit=5  (only if logged in at a branch)
  const { data: featuredItems = [] } = useQuery({
    queryKey: ["customer", "menu", branchId, "featured"],
    queryFn: () =>
      apiClient.get<any[]>(`/menu/branch/${branchId}/items?limit=5`),
    enabled: !!branchId,
  });

  // GET /loyalty/me
  const { data: loyaltyData } = useQuery<LoyaltyData>({
    queryKey: ["customer", "loyalty"],
    queryFn: () => apiClient.get<LoyaltyData>("/loyalty/me"),
  });

  // ── Client-side search filter ────────────────────────────────────────────────

  const filteredRestaurants = searchQuery.trim()
    ? restaurants.filter(
        (r) =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.cuisine_type?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : restaurants;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Welcome back</p>
          <h1 className="text-xl font-bold text-gray-900">
            {user?.name ?? "Guest"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 bg-white rounded-full shadow-sm">
            <Bell size={20} className="text-gray-600" />
          </button>
          <button className="p-2 bg-white rounded-full shadow-sm">
            <Gift size={20} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          size={20}
        />
        <input
          type="text"
          placeholder="Search dishes, restaurants…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-[#1A3C5E] focus:ring-2 focus:ring-[#1A3C5E]/20 outline-none transition-all"
        />
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-4 gap-3">
        {quickActions.map((action, index) => (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href={action.href} className="flex flex-col items-center gap-2">
              <div
                className={`w-14 h-14 ${action.color} rounded-2xl flex items-center justify-center text-white shadow-md`}
              >
                {action.icon}
              </div>
              <span className="text-xs font-medium text-gray-700 text-center">
                {action.label}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ── Active Orders ── */}
      {activeOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900">Active Orders</h2>
          {activeOrders.map((order) => {
            const progress = ORDER_PROGRESS[order.status] ?? 20;
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    Order #{order.id.slice(-6).toUpperCase()}
                  </h3>
                  <StatusBadge status={order.status} size="sm" />
                </div>

                {order.items && order.items.length > 0 && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-1">
                    {order.items.map((i) => i.name).join(", ")}
                  </p>
                )}

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> In progress
                    </span>
                    <span className="font-semibold text-gray-700">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#1A3C5E] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>

                <Link
                  href={`/customer/order/${order.id}`}
                  className="text-xs text-[#1A3C5E] font-medium flex items-center gap-1 mt-1"
                >
                  Track order <ChevronRight size={13} />
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Nearby Restaurants ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-[#1A3C5E]" />
            <h2 className="font-semibold text-gray-900">Nearby Restaurants</h2>
          </div>
          {!geoReady && (
            <Loader2 size={14} className="text-gray-400 animate-spin" />
          )}
        </div>

        {restaurantsLoading ? (
          <div className="grid grid-cols-1 gap-4">
            <SkeletonCard variant="card" count={3} />
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            {searchQuery ? "No restaurants match your search." : "No restaurants found nearby."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredRestaurants.map((restaurant, index) => {
              // Compute distance from user to closest branch
              const closestBranch = restaurant.branches?.[0];
              const distKm =
                coords && closestBranch?.lat && closestBranch?.lng
                  ? distanceKm(
                      coords.lat,
                      coords.lng,
                      closestBranch.lat,
                      closestBranch.lng
                    )
                  : null;
              const distLabel = distKm !== null
                ? distKm < 1
                  ? `${Math.round(distKm * 1000)} m`
                  : `${distKm.toFixed(1)} km`
                : "—";

              return (
                <motion.div
                  key={restaurant.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link href={`/customer/restaurant/${restaurant.id}`}>
                    <RestaurantCard
                      name={restaurant.name}
                      cuisine={restaurant.cuisine_type ?? "Multi-cuisine"}
                      distance={distLabel}
                      rating={restaurant.avg_rating ?? 0}
                      imageUrl={restaurant.banner_url ?? restaurant.logo_url}
                    />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Featured / Popular Dishes (only when branch is known) ── */}
      {featuredItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-orange-500" />
              <h2 className="font-semibold text-gray-900">Popular Dishes</h2>
            </div>
            <Link
              href="/customer/menu"
              className="text-sm text-[#1A3C5E] flex items-center gap-1"
            >
              See All <ChevronRight size={15} />
            </Link>
          </div>
          <div className="space-y-4">
            {featuredItems.map((item: any, index: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <FoodCard item={item} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Loyalty Card ── */}
      {loyaltyData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-5 text-white"
          style={{ background: "linear-gradient(135deg, #1a3c5e 0%, #e8a020 100%)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Loyalty Points</p>
              <p className="text-3xl font-bold">
                {loyaltyData.points?.toLocaleString("en-IN") ?? 0}
              </p>
              {loyaltyData.pointsToNextReward != null && (
                <p className="text-xs opacity-70 mt-1">
                  {loyaltyData.pointsToNextReward.toLocaleString("en-IN")} pts until next reward
                </p>
              )}
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Star size={28} className="text-yellow-300" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-yellow-300 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(loyaltyData.progressPercent ?? 0, 100)}%` }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          </div>
        </motion.div>
      )}
    </PageWrapper>
  );
}