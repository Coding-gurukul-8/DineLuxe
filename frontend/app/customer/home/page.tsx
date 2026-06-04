"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { FoodCard } from "@/components/customer/FoodCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import type { Order, MenuItem, LoyaltyData } from "@/types/api";

// QUICK REORDER ADDITION — types ─────────────────────────────────────────────
interface LastOrder {
  id: string;
  created_at: string;
  branch_id: string;
  restaurant_id: string;
  restaurant_name: string;
  logo_url: string | null;
  items_preview: { name: string; quantity: number }[];
  total: number | null;
}

interface ReorderResult {
  items: {
    menu_item_id: string;
    quantity: number;
    notes: string | null;
    addons: unknown[] | null;
    name: string;
    price: number;
  }[];
  branch_id: string;
  restaurant_id: string;
  unavailable_items: string[];
  message: string;
}
// END QUICK REORDER ADDITION — types ─────────────────────────────────────────
import {
  Search, QrCode, Calendar, ShoppingBag, Clock, Star,
  ChevronRight, Flame, Bell, Gift, Sparkles, MapPin,
  TrendingUp, ArrowRight, Zap, Check, X,
} from "lucide-react";

// ── Variants ──────────────────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 260, damping: 22 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

// ── Typewriter hook ────────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 50) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return displayed;
}

// ── Quick Actions ─────────────────────────────────────────────────────────────

const quickActions = [
  { label: "Scan QR",    icon: QrCode,       href: "/customer/scan",    gradient: "from-[#1A3C5E] to-[#2A5C8E]" },
  { label: "Book Table", icon: Calendar,     href: "/customer/booking", gradient: "from-[#E8A020] to-[#F0B840]" },
  { label: "My Orders",  icon: ShoppingBag,  href: "/customer/order",   gradient: "from-[#C0392B] to-[#E74C3C]" },
  { label: "Explore",    icon: TrendingUp,   href: "/customer/menu",    gradient: "from-[#27AE60] to-[#2ECC71]" },
];

// ── Mood Tiles ─────────────────────────────────────────────────────────────────
// Each tile carries a `filter` object that gets appended as query params when
// the user taps the tile. The restaurant feed re-fetches with these params.

interface MoodFilter {
  max_prep_time?: number;
  types?: string;
  cuisine?: string;
  dine_in?: boolean;
  open_after?: string;
  dietary?: string;
  rating?: number;
  ambiance?: string;
}

interface MoodTile {
  id: string;
  label: string;
  emoji: string;
  filter: MoodFilter;
  gradient: string;
}

const MOOD_TILES: MoodTile[] = [
  {
    id: "quick_bite",
    label: "Quick Bite",
    emoji: "⚡",
    filter: { max_prep_time: 15, types: "takeaway,delivery" },
    gradient: "from-orange-400 to-red-500",
  },
  {
    id: "fine_dining",
    label: "Fine Dining",
    emoji: "🍷",
    filter: { cuisine: "fine_dining", dine_in: true },
    gradient: "from-purple-600 to-indigo-700",
  },
  {
    id: "late_night",
    label: "Late Night",
    emoji: "🌙",
    filter: { open_after: "22:00" },
    gradient: "from-indigo-900 to-blue-900",
  },
  {
    id: "healthy",
    label: "Healthy",
    emoji: "🥗",
    filter: { dietary: "vegan,vegetarian,high_protein" },
    gradient: "from-green-400 to-emerald-600",
  },
  {
    id: "celebration",
    label: "Celebration",
    emoji: "🎉",
    filter: { cuisine: "celebration", rating: 4.5 },
    gradient: "from-yellow-400 to-amber-500",
  },
  {
    id: "date_night",
    label: "Date Night",
    emoji: "💑",
    filter: { ambiance: "romantic", dine_in: true },
    gradient: "from-rose-400 to-pink-600",
  },
];

/** Converts a MoodFilter to a URL query-string segment */
function buildMoodQueryString(filter: MoodFilter): string {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null) params.set(k, String(v));
  });
  return params.toString();
}

// ── Shimmer Skeleton ──────────────────────────────────────────────────────────

function ShimmerCard() {
  return (
    <div className="shrink-0 w-48 rounded-2xl overflow-hidden bg-white shadow-sm">
      <div className="h-32 bg-linear-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
      </div>
    </div>
  );
}

// ── Pull-to-refresh indicator ─────────────────────────────────────────────────

function PullIndicator({ pulling }: { pulling: boolean }) {
  return (
    <AnimatePresence>
      {pulling && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 48, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="flex items-center justify-center overflow-hidden"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-6 h-6 border-2 border-[#E8A020] border-t-transparent rounded-full"
          />
          <span className="ml-2 text-sm text-[#E8A020] font-medium">Refreshing…</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Greeting helper ───────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// ── MoodTileGrid component ─────────────────────────────────────────────────────

interface MoodTileGridProps {
  activeMoodId: string | null;
  filteredCount: number | null;
  onTilePress: (tile: MoodTile) => void;
  inView: boolean;
}

function MoodTileGrid({ activeMoodId, filteredCount, onTilePress, inView }: MoodTileGridProps) {
  const activeTile = MOOD_TILES.find((t) => t.id === activeMoodId) ?? null;

  return (
    <div>
      {/* Section heading */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          What are you in the mood for?
        </p>
        {activeMoodId && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-xs text-[#E8A020] font-semibold"
          >
            {filteredCount !== null ? `${filteredCount} restaurants` : "Filtering…"}
          </motion.span>
        )}
      </div>

      {/* 2-row × 3-column grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {MOOD_TILES.map((tile, i) => {
          const isActive = activeMoodId === tile.id;
          return (
            <motion.button
              key={tile.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 20 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => onTilePress(tile)}
              className={[
                "relative h-16 rounded-2xl flex flex-col items-center justify-center gap-1",
                `bg-gradient-to-br ${tile.gradient}`,
                "shadow-md overflow-hidden",
                isActive ? "ring-2 ring-white ring-offset-2 scale-95" : "",
              ].join(" ")}
              aria-pressed={isActive}
              aria-label={tile.label}
            >
              {/* Active checkmark overlay */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    key="check"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="absolute inset-0 bg-black/25 flex items-center justify-center rounded-2xl"
                  >
                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <Check size={13} className="text-gray-800 stroke-[3]" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <span className="text-2xl leading-none">{tile.emoji}</span>
              <span className="text-white text-[10px] font-semibold leading-tight px-1 text-center">
                {tile.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Filtered result label */}
      <AnimatePresence>
        {activeMoodId && filteredCount !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 flex items-center justify-between bg-[#1A3C5E]/6 rounded-xl px-3 py-2">
              <span className="text-xs font-medium text-gray-700">
                <span className="font-bold text-[#1A3C5E]">{filteredCount}</span>{" "}
                restaurants for{" "}
                <span className="font-semibold">{activeTile?.label}</span>
              </span>
              <button
                onClick={() => onTilePress(activeTile!)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear mood filter"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CustomerHomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [pulling, setPulling] = useState(false);
  const [activeMoodId, setActiveMoodId] = useState<string | null>(null);
  const [moodFilteredCount, setMoodFilteredCount] = useState<number | null>(null);
  // QUICK REORDER ADDITION — state ─────────────────────────────────────────────
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  // END QUICK REORDER ADDITION — state ─────────────────────────────────────────
  const { user, branchId } = useAuth();
  const router = useRouter();

  const greeting = useTypewriter(`${getGreeting()}, ${user?.name?.split(" ")[0] ?? "there"} 👋`, 45);

  // Intersection observers for staggered reveals
  const { ref: heroRef, inView: heroInView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { ref: actionsRef, inView: actionsInView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { ref: moodRef, inView: moodInView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { ref: aiRef, inView: aiInView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { ref: loyaltyRef, inView: loyaltyInView } = useInView({ triggerOnce: true, threshold: 0.1 });

  // ── Active mood filter → query string ────────────────────────────────────────
  const activeMoodTile = MOOD_TILES.find((t) => t.id === activeMoodId) ?? null;
  const moodQs = activeMoodTile ? buildMoodQueryString(activeMoodTile.filter) : "";

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: activeOrders = [], isLoading: ordersLoading, isError: ordersError } = useQuery({
    queryKey: ["customer", "active-orders"],
    queryFn: () => apiClient.get<Order[]>("/orders/user/me?status=active"),
    refetchInterval: 15_000,
  });

  const {
    data: featuredItems = [],
    isLoading: featuredLoading,
    isError: featuredError,
    error: featuredErr,
    refetch: refetchFeatured,
  } = useQuery({
    queryKey: ["customer", "menu", branchId, "featured"],
    queryFn: () => apiClient.get<MenuItem[]>(`/menu/branch/${branchId}/items?limit=6`),
    enabled: !!branchId,
  });

  // Mood-filtered restaurant feed — re-fetches whenever activeMoodId changes
  const {
    data: moodRestaurants,
    isLoading: moodLoading,
    refetch: refetchMood,
  } = useQuery({
    queryKey: ["customer", "recommendations", "mood", activeMoodId],
    queryFn: () =>
      apiClient.get<{ id: string; name: string }[]>(
        `/recommendations/popular${moodQs ? `?${moodQs}` : ""}`
      ),
    enabled: activeMoodId !== null,
  });

  // Sync filtered count whenever mood results arrive
  useEffect(() => {
    if (activeMoodId === null) {
      setMoodFilteredCount(null);
      return;
    }
    if (!moodLoading && moodRestaurants) {
      setMoodFilteredCount(moodRestaurants.length);
    }
  }, [activeMoodId, moodLoading, moodRestaurants]);

  const { data: loyaltyData } = useQuery({
    queryKey: ["customer", "loyalty"],
    queryFn: () => apiClient.get<LoyaltyData>("/loyalty/me"),
  });

  // QUICK REORDER ADDITION — query ─────────────────────────────────────────────
  // Only fires for logged-in customers; guests see nothing.
  const { data: lastOrders } = useQuery({
    queryKey: ["customer", "last-orders", user?.id],
    queryFn: () => apiClient.get<LastOrder[]>("/orders/customer/last-three"),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  // END QUICK REORDER ADDITION — query ─────────────────────────────────────────

  // ── Mood tile handler ─────────────────────────────────────────────────────────
  const handleMoodPress = useCallback((tile: MoodTile) => {
    setActiveMoodId((prev) => {
      if (prev === tile.id) {
        // Deselect
        setMoodFilteredCount(null);
        return null;
      }
      setMoodFilteredCount(null); // reset while new results load
      return tile.id;
    });
  }, []);

  // QUICK REORDER ADDITION — handler ───────────────────────────────────────────
  const handleReorder = async (orderId: string) => {
    if (reorderingId) return; // prevent double-tap
    setReorderingId(orderId);
    try {
      const result = await apiClient.post<ReorderResult>(`/orders/${orderId}/reorder`, {});
      // Stash items in localStorage for the menu page to pick up
      localStorage.setItem("reorder_items",     JSON.stringify(result.items));
      localStorage.setItem("reorder_branch_id", result.branch_id);
      // Navigate to the restaurant menu with a reorder flag
      router.push(`/customer/restaurant/${result.restaurant_id}?reorder=true`);
      if (result.unavailable_items.length > 0) {
        const names = result.unavailable_items.join(", ");
        const verb  = result.unavailable_items.length === 1 ? "was" : "were";
        // toast is imported via the existing sonner dependency in this file
        // We use a dynamic import to avoid circular-import issues
        import("sonner").then(({ toast }) => {
          toast.info(`${names} ${verb} not available and skipped`);
        });
      }
    } catch {
      import("sonner").then(({ toast }) => {
        toast.error("Could not load your previous order. Try again.");
      });
    } finally {
      setReorderingId(null);
    }
  };
  // END QUICK REORDER ADDITION — handler ───────────────────────────────────────

  // Client-side search filter
  const visibleItems = searchQuery.trim()
    ? featuredItems.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : featuredItems;

  // Simulated pull-to-refresh
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 80 && window.scrollY === 0) {
      setPulling(true);
      refetchFeatured().finally(() => setTimeout(() => setPulling(false), 600));
    }
  };

  return (
    <div
      className="min-h-screen bg-[#FAF7F4] pb-24"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <PullIndicator pulling={pulling} />

      {/* ── Hero Header ───────────────────────────────────────────────────── */}
      <div
        ref={heroRef}
        className="px-4 pt-12 pb-6 bg-linear-to-br from-[#1A3C5E] via-[#1A3C5E] to-[#0D2A45] relative overflow-hidden"
      >
        {/* decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-[#E8A020]/10" />

        <motion.div
          initial={{ opacity: 0 }}
          animate={heroInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[#E8A020] text-sm font-medium mb-1">DineLuxe</p>
              <h1 className="text-2xl font-bold text-white leading-tight min-h-10">
                {greeting}
              </h1>
              <p className="text-white/60 text-sm mt-1 flex items-center gap-1">
                <MapPin size={12} />
                {user?.name ? "Your saved location" : "Set your location"}
              </p>
            </div>
            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center relative"
                aria-label="Notifications"
              >
                <Bell size={18} className="text-white" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#E8A020] rounded-full animate-pulse" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
                aria-label="Rewards"
              >
                <Gift size={18} className="text-white" />
              </motion.button>
            </div>
          </div>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3 }}
            className="mt-5 relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search dishes, restaurants…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-white rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A020]/50 shadow-lg transition-all"
            />
          </motion.div>
        </motion.div>
      </div>

      <div className="px-4 space-y-7 mt-5">

        {/* ── Quick Actions ────────────────────────────────────────────── */}
        <motion.div
          ref={actionsRef}
          variants={stagger}
          initial="hidden"
          animate={actionsInView ? "visible" : "hidden"}
          className="grid grid-cols-4 gap-3"
        >
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <motion.div key={action.label} variants={cardVariants} whileTap={{ scale: 0.92 }}>
                <Link href={action.href} className="flex flex-col items-center gap-2">
                  <div className={`w-14 h-14 rounded-2xl bg-linear-to-br ${action.gradient} flex items-center justify-center shadow-lg`}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-600">{action.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Active Order Banner ──────────────────────────────────────── */}
        <AnimatePresence>
          {!ordersLoading && !ordersError && activeOrders.length > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              onClick={() => router.push(`/customer/order/${activeOrders[0].id}`)}
              className="w-full text-left bg-linear-to-r from-[#1A3C5E] to-[#2A5C8E] rounded-2xl p-4 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={14} className="text-[#E8A020]" />
                    <span className="text-[#E8A020] text-xs font-bold uppercase tracking-wide">Active Order</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={activeOrders[0].status} />
                    <span className="text-white/60 text-sm">
                      {activeOrders[0].order_items?.length ?? 0} item{(activeOrders[0].order_items?.length ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeOrders[0].total != null && (
                    <span className="text-white font-bold text-lg">{formatCurrency(activeOrders[0].total)}</span>
                  )}
                  <ArrowRight size={18} className="text-white/60" />
                </div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── MOOD TILES — 2×3 grid with filter integration ───────────── */}
        <motion.div
          ref={moodRef}
          initial={{ opacity: 0, y: 20 }}
          animate={moodInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <MoodTileGrid
            activeMoodId={activeMoodId}
            filteredCount={moodFilteredCount}
            onTilePress={handleMoodPress}
            inView={moodInView}
          />
        </motion.div>

        {/* QUICK REORDER ADDITION ─────────────────────────────────────────── */}
        {/* Only rendered when the logged-in customer has at least one past order */}
        {lastOrders && lastOrders.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Order Again
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
              {lastOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex-none w-48 bg-white rounded-2xl border border-gray-100 shadow-sm p-3"
                >
                  {/* Restaurant identity row */}
                  <div className="flex items-center gap-2 mb-2">
                    {order.logo_url ? (
                      <img
                        src={order.logo_url}
                        className="w-8 h-8 rounded-lg object-cover flex-none"
                        alt={order.restaurant_name}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-base flex-none">
                        🍽️
                      </div>
                    )}
                    <span className="text-xs font-semibold text-gray-800 truncate">
                      {order.restaurant_name}
                    </span>
                  </div>

                  {/* Items preview */}
                  <p className="text-xs text-gray-500 mb-1 truncate">
                    {order.items_preview.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  </p>

                  {/* Total */}
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    {order.total != null ? `₹${order.total.toFixed(0)}` : "—"}
                  </p>

                  {/* Reorder button */}
                  <button
                    onClick={() => handleReorder(order.id)}
                    disabled={reorderingId === order.id}
                    className="w-full text-xs py-1.5 bg-[#1A3C5E] text-white rounded-lg font-medium
                               disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 transition-all"
                  >
                    {reorderingId === order.id ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                          <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" />
                        </svg>
                        Loading…
                      </span>
                    ) : (
                      "Reorder"
                    )}
                  </button>
                </div>
              ))}
            </div>
          </motion.section>
        )}
        {/* END QUICK REORDER ADDITION ───────────────────────────────────── */}

        {/* ── Mood Results Feed (only shown when a mood is active) ─────── */}
        <AnimatePresence>
          {activeMoodId && (
            <motion.div
              key="mood-results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{activeMoodTile?.emoji}</span>
                <h2 className="text-base font-bold text-gray-900">
                  {activeMoodTile?.label} Spots
                </h2>
              </div>

              {moodLoading ? (
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
                  {[1, 2, 3].map((n) => <ShimmerCard key={n} />)}
                </div>
              ) : (moodRestaurants ?? []).length === 0 ? (
                <EmptyState
                  variant="menu"
                  title="No restaurants found"
                  message={`No results for ${activeMoodTile?.label}. Try another mood!`}
                />
              ) : (
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
                  {(moodRestaurants ?? []).map((r) => (
                    <motion.button
                      key={r.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => router.push(`/customer/restaurant/${r.id}`)}
                      className="shrink-0 w-44 rounded-2xl overflow-hidden bg-white shadow-sm text-left"
                    >
                      <div className={`h-24 bg-gradient-to-br ${activeMoodTile?.gradient} flex items-center justify-center`}>
                        <span className="text-4xl">{activeMoodTile?.emoji}</span>
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── AI Picks ─────────────────────────────────────────────────── */}
        {branchId && (
          <div ref={aiRef}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-linear-to-br from-[#E8A020] to-[#F0B840] flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">AI Picks For You</h2>
              </div>
              <Link href="/customer/menu" className="flex items-center gap-1 text-sm text-[#E8A020] font-semibold">
                See All <ChevronRight size={15} />
              </Link>
            </div>

            <QueryBoundary
              isLoading={featuredLoading}
              isError={featuredError}
              error={featuredErr}
              refetch={refetchFeatured}
            >
              {featuredLoading ? (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={stagger}
                  className="space-y-4"
                >
                  {[1, 2, 3].map((n) => (
                    <motion.div key={n} variants={cardVariants}>
                      <ShimmerCard />
                    </motion.div>
                  ))}
                </motion.div>
              ) : visibleItems.length === 0 ? (
                <EmptyState
                  variant="menu"
                  title={searchQuery ? "No results found" : "No featured items yet"}
                  message={searchQuery ? `Nothing matched "${searchQuery}"` : "Check back soon."}
                />
              ) : (
                <motion.div
                  variants={stagger}
                  initial="hidden"
                  animate={aiInView ? "visible" : "hidden"}
                  className="space-y-4"
                >
                  {visibleItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      variants={cardVariants}
                      custom={index}
                    >
                      <FoodCard item={item} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </QueryBoundary>
          </div>
        )}

        {/* ── Loyalty Card ─────────────────────────────────────────────── */}
        {loyaltyData && (
          <motion.div
            ref={loyaltyRef}
            variants={cardVariants}
            initial="hidden"
            animate={loyaltyInView ? "visible" : "hidden"}
            className="rounded-3xl p-6 text-white overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #0D2A45 50%, #2A1A0A 100%)" }}
          >
            {/* decorative */}
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-[#E8A020]/10" />
            <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/5" />

            <div className="relative flex items-start justify-between mb-5">
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">Loyalty Points</p>
                <motion.p
                  className="text-4xl font-bold tabular-nums"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={loyaltyInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                >
                  {loyaltyData.points?.toLocaleString("en-IN") ?? 0}
                </motion.p>
                <p className="text-white/50 text-xs mt-1">
                  {loyaltyData.pointsToNextReward ?? 0} pts to next reward
                </p>
              </div>
              <motion.div
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="w-14 h-14 bg-[#E8A020]/20 rounded-2xl flex items-center justify-center"
              >
                <Star size={26} className="text-[#E8A020] fill-[#E8A020]" />
              </motion.div>
            </div>

            <div className="relative">
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #E8A020, #F0B840)" }}
                  initial={{ width: 0 }}
                  animate={loyaltyInView ? { width: `${loyaltyData.progressPercent ?? 0}%` } : {}}
                  transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-white/40 text-xs">0</span>
                <span className="text-white/40 text-xs">{loyaltyData.pointsToNextReward ?? 1000}</span>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}