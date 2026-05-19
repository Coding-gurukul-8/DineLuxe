"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { FoodCard } from "@/components/shared/FoodCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import type { Order, MenuItem, LoyaltyData } from "@/types/api";
import {
  Search,
  QrCode,
  Calendar,
  ShoppingBag,
  Clock,
  Star,
  ChevronRight,
  Flame,
  TrendingUp,
  Bell,
  Gift,
} from "lucide-react";

const quickActions = [
  { label: "Scan QR",    icon: <QrCode size={24} />,     href: "/customer/scan",    color: "bg-blue-500" },
  { label: "Book Table", icon: <Calendar size={24} />,   href: "/customer/booking", color: "bg-green-500" },
  { label: "My Orders",  icon: <ShoppingBag size={24} />,href: "/customer/order",   color: "bg-purple-500" },
  { label: "Menu",       icon: <TrendingUp size={24} />, href: "/customer/menu",    color: "bg-orange-500" },
];

export default function CustomerHomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { user, branchId } = useAuth();
  const router = useRouter();

  // Active orders — refetch every 15 s; ignore errors silently (non-critical section)
  const {
    data: activeOrders = [],
    isLoading: ordersLoading,
    isError: ordersError,
  } = useQuery({
    queryKey: ["customer", "active-orders"],
    queryFn: () => apiClient.get<Order[]>("/orders/user/me?status=active"),
    refetchInterval: 15_000,
  });

  // Featured items — only fetched when we know the branch
  const {
    data: featuredItems = [],
    isLoading: featuredLoading,
    isError: featuredError,
    error: featuredErr,
    refetch: refetchFeatured,
  } = useQuery({
    queryKey: ["customer", "menu", branchId, "featured"],
    queryFn: () =>
      apiClient.get<MenuItem[]>(`/menu/branch/${branchId}/items?limit=5`),
    enabled: !!branchId,
  });

  // Loyalty — ignore errors (badge is optional)
  const { data: loyaltyData } = useQuery({
    queryKey: ["customer", "loyalty"],
    queryFn: () => apiClient.get<LoyaltyData>("/loyalty/me"),
  });

  // Filter featured items by search query (client-side for snappiness)
  const visibleItems =
    searchQuery.trim().length > 0
      ? featuredItems.filter((i) =>
          i.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : featuredItems;

  return (
    <PageWrapper>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Welcome back</p>
          <h1 className="text-xl font-bold text-gray-900">
            {user?.name ?? "Guest"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 bg-white rounded-full shadow-sm" aria-label="Notifications">
            <Bell size={20} className="text-gray-600" />
          </button>
          <button className="p-2 bg-white rounded-full shadow-sm" aria-label="Rewards">
            <Gift size={20} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* ── Search ─────────────────────────────────────────────────── */}
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

      {/* ── Quick Actions ───────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {quickActions.map((action, index) => (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href={action.href} className="flex flex-col items-center gap-2">
              <div
                className={`w-14 h-14 ${action.color} rounded-2xl flex items-center justify-center text-white shadow-md`}
              >
                {action.icon}
              </div>
              <span className="text-xs font-medium text-gray-700">
                {action.label}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ── Active Order Banner ─────────────────────────────────────── */}
      {!ordersLoading && !ordersError && activeOrders.length > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() =>
            router.push(`/customer/order/${activeOrders[0].id}`)
          }
          className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-[#1A3C5E]/30 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Active Order</h2>
            <StatusBadge status={activeOrders[0].status} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-gray-500">
              <Clock size={14} />
              <span>
                {activeOrders[0].order_items?.length ?? 0} item
                {(activeOrders[0].order_items?.length ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>
            {activeOrders[0].total != null && (
              <span className="font-semibold text-gray-900">
                {formatCurrency(activeOrders[0].total)}
              </span>
            )}
          </div>
        </motion.button>
      )}

      {/* ── Popular Dishes ──────────────────────────────────────────── */}
      {branchId && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame size={20} className="text-orange-500" />
              <h2 className="font-semibold text-gray-900">Popular Dishes</h2>
            </div>
            <Link
              href="/customer/menu"
              className="text-sm text-[#1A3C5E] flex items-center gap-1"
            >
              See All <ChevronRight size={16} />
            </Link>
          </div>

          <QueryBoundary
            isLoading={featuredLoading}
            isError={featuredError}
            error={featuredErr}
            refetch={refetchFeatured}
          >
            {visibleItems.length === 0 ? (
              <EmptyState
                variant="menu"
                title={
                  searchQuery
                    ? "No results found"
                    : "No featured items yet"
                }
                message={
                  searchQuery
                    ? `Nothing matched "${searchQuery}"`
                    : "Check back soon for today's popular dishes."
                }
              />
            ) : (
              <div className="space-y-4">
                {visibleItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.07 }}
                  >
                    <FoodCard item={item} />
                  </motion.div>
                ))}
              </div>
            )}
          </QueryBoundary>
        </div>
      )}

      {/* ── Loyalty Card ────────────────────────────────────────────── */}
      {loyaltyData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-5 text-white overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #1a3c5e 0%, #e8a020 100%)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Loyalty Points</p>
              <p className="text-3xl font-bold">
                {loyaltyData.points?.toLocaleString("en-IN") ?? 0}
              </p>
              <p className="text-xs opacity-70 mt-1">
                {loyaltyData.pointsToNextReward ?? 0} points until next reward
              </p>
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
              animate={{ width: `${loyaltyData.progressPercent ?? 0}%` }}
              transition={{ duration: 1, delay: 0.4 }}
            />
          </div>
        </motion.div>
      )}
    </PageWrapper>
  );
}