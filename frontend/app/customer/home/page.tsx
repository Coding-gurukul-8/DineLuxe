"use client";

import { useState, useEffect, useRef } from "react";
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
import {
  Search, QrCode, Calendar, ShoppingBag, Clock, Star,
  ChevronRight, Flame, Bell, Gift, Sparkles, MapPin,
  TrendingUp, ArrowRight, Zap,
} from "lucide-react";

// ── Variants ──────────────────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 22 } },
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

// ── Mood Tiles ────────────────────────────────────────────────────────────────

const moodTiles = [
  { label: "🍕 Pizza Night",  color: "from-orange-500 to-red-600",     emoji: "🍕" },
  { label: "🥗 Healthy",      color: "from-green-500 to-emerald-600",  emoji: "🥗" },
  { label: "🍣 Japanese",     color: "from-rose-500 to-pink-600",      emoji: "🍣" },
  { label: "🍔 Burgers",      color: "from-yellow-500 to-orange-500",  emoji: "🍔" },
  { label: "🍜 Noodles",      color: "from-purple-500 to-indigo-600",  emoji: "🍜" },
  { label: "🍦 Desserts",     color: "from-pink-400 to-rose-500",      emoji: "🍦" },
];

// ── Shimmer Skeleton ──────────────────────────────────────────────────────────

function ShimmerCard() {
  return (
    <div className="flex-shrink-0 w-48 rounded-2xl overflow-hidden bg-white shadow-sm">
      <div className="h-32 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />
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

// ── Main component ────────────────────────────────────────────────────────────

export default function CustomerHomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [pulling, setPulling] = useState(false);
  const { user, branchId } = useAuth();
  const router = useRouter();

  const greeting = useTypewriter(`${getGreeting()}, ${user?.name?.split(" ")[0] ?? "there"} 👋`, 45);

  // Intersection observers for staggered reveals
  const { ref: heroRef, inView: heroInView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { ref: actionsRef, inView: actionsInView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { ref: moodRef, inView: moodInView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { ref: aiRef, inView: aiInView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { ref: loyaltyRef, inView: loyaltyInView } = useInView({ triggerOnce: true, threshold: 0.1 });

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

  const { data: loyaltyData } = useQuery({
    queryKey: ["customer", "loyalty"],
    queryFn: () => apiClient.get<LoyaltyData>("/loyalty/me"),
  });

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
        className="px-4 pt-12 pb-6 bg-gradient-to-br from-[#1A3C5E] via-[#1A3C5E] to-[#0D2A45] relative overflow-hidden"
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
              <h1 className="text-2xl font-bold text-white leading-tight min-h-[2.5rem]">
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
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${action.gradient} flex items-center justify-center shadow-lg`}>
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
              className="w-full text-left bg-gradient-to-r from-[#1A3C5E] to-[#2A5C8E] rounded-2xl p-4 shadow-lg"
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

        {/* ── Mood Tiles (horizontal scroll) ──────────────────────────── */}
        <motion.div
          ref={moodRef}
          initial={{ opacity: 0, y: 20 }}
          animate={moodInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">What are you craving?</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
            {moodTiles.map((tile, i) => (
              <motion.button
                key={tile.label}
                initial={{ opacity: 0, x: 20 }}
                animate={moodInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: i * 0.07, type: "spring", stiffness: 280 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                className={`flex-shrink-0 w-28 h-20 rounded-2xl bg-gradient-to-br ${tile.color} flex flex-col items-center justify-center gap-1 shadow-md`}
              >
                <span className="text-2xl">{tile.emoji}</span>
                <span className="text-white text-[11px] font-semibold">{tile.label.split(" ").slice(1).join(" ")}</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── AI Picks ─────────────────────────────────────────────────── */}
        {branchId && (
          <div ref={aiRef}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#E8A020] to-[#F0B840] flex items-center justify-center">
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
                <span className="text-white/40 text-xs">{loyaltyData.nextRewardThreshold ?? 1000}</span>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
