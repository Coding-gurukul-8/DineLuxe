"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Store,
  Users,
  ShoppingBag,
  TrendingUp,
  Activity,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { KPICard } from "@/components/shared/KPICard";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, cn } from "@/lib/utils";

interface PlatformStats {
  total_restaurants: number;
  active_restaurants: number;
  suspended_restaurants: number;
  total_users: number;
  total_orders_today: number;
  total_revenue_today: number;
  platform_health_score?: number;
  top_restaurants?: {
    id: string;
    name: string;
    revenue: number;
    orders: number;
    status?: string;
  }[];
}

interface GrowthPoint {
  date: string;
  restaurants: number;
  orders: number;
  revenue: number;
}

interface RecentActivity {
  id: string;
  type: "restaurant_joined" | "restaurant_suspended" | "large_order" | "user_signup";
  message: string;
  at: string;
}

function GrowthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-[#1A3C5E] rounded-xl px-4 py-3 text-xs shadow-xl border border-white/10">
      <p className="text-white/50 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-medium" style={{ color: p.color }}>
          {p.name}: {p.name === "revenue" ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

const actTypeStyles: Record<string, string> = {
  restaurant_joined: "bg-emerald-50 text-emerald-700",
  restaurant_suspended: "bg-red-50 text-red-600",
  large_order: "bg-[#E8A020]/10 text-[#E8A020]",
  user_signup: "bg-[#1A3C5E]/8 text-[#1A3C5E]",
};

function ActivityLog({ activities }: { activities: RecentActivity[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">Recent Activity</h3>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {activities.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6">No recent activity</p>
          )}
          {activities.map((a, idx) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.25 }}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium",
                actTypeStyles[a.type] ?? "bg-gray-50 text-gray-600"
              )}
            >
              <span>{a.message}</span>
              <span className="font-mono opacity-60 text-[10px] ml-2 shrink-0">{a.at}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RestaurantStatusGrid({ restaurants }: { restaurants: PlatformStats["top_restaurants"] }) {
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");

  const items = (restaurants ?? []).filter((r) => {
    if (filter === "active") return r.status !== "suspended";
    if (filter === "suspended") return r.status === "suspended";
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Top Restaurants</h3>
        <div className="flex gap-1.5">
          {(["all", "active", "suspended"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-colors",
                filter === f ? "bg-[#1A3C5E] text-white" : "text-gray-400 hover:text-gray-600"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AnimatePresence>
          {items.map((r, idx) => (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-800 truncate max-w-32.5">{r.name}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{formatCurrency(r.revenue)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-[#E8A020]">{r.orders}</p>
                <p className="text-[10px] text-gray-400">orders</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <p className="col-span-2 text-xs text-gray-400 text-center py-4">No data</p>
        )}
      </div>
    </div>
  );
}

function HealthScore({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(score)));
  const color =
    pct >= 80
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : pct >= 50
        ? "text-yellow-600 bg-yellow-50 border-yellow-200"
        : "text-red-600 bg-red-50 border-red-200";

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold", color)}>
      <Activity size={12} />
      Platform health: {pct}%
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading, isError, refetch } = useQuery<PlatformStats>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => apiClient.get<PlatformStats>("/admin/dashboard"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const growthData: GrowthPoint[] = Array.from({ length: 14 }, (_, i) => ({
    date: `Day ${i + 1}`,
    restaurants: 40 + i * 2 + (i % 3),
    orders: 300 + i * 15 + (i % 5) * 4,
    revenue: 50000 + i * 3000 + (i % 4) * 750,
  }));

  const activities: RecentActivity[] = [
    { id: "1", type: "restaurant_joined", message: "New restaurant joined: Spice House", at: "2m ago" },
    { id: "2", type: "large_order", message: "Large order ($1,240) at La Maison", at: "7m ago" },
    { id: "3", type: "user_signup", message: "15 new customers signed up", at: "12m ago" },
    { id: "4", type: "restaurant_suspended", message: "Restaurant suspended: Burger Hub", at: "1h ago" },
  ];

  const sparkOrders: { v: number }[] = growthData.slice(-7).map((d) => ({ v: d.orders }));
  const sparkRevenue: { v: number }[] = growthData.slice(-7).map((d) => ({ v: d.revenue }));

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>
            Platform Overview
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats?.platform_health_score !== undefined && <HealthScore score={stats.platform_health_score} />}
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
            ))
          : isError
            ? (
                <div className="col-span-4 flex flex-col items-center py-12 gap-3 text-gray-400">
                  <AlertCircle size={28} className="text-red-400" />
                  <p className="text-sm">Failed to load platform stats</p>
                  <button
                    onClick={() => refetch()}
                    className="text-sm text-[#1A3C5E] hover:underline flex items-center gap-1"
                  >
                    <RefreshCw size={13} /> Retry
                  </button>
                </div>
              )
            : (
                <>
                  <KPICard
                    title="Total Restaurants"
                    value={stats?.total_restaurants ?? 0}
                    trend={4.8}
                    trendLabel="this month"
                    sparklineData={sparkOrders}
                    icon={<Store size={18} />}
                  />
                  <KPICard
                    title="Orders Today"
                    value={stats?.total_orders_today ?? 0}
                    trend={12.3}
                    trendLabel="vs yesterday"
                    sparklineData={sparkOrders}
                    icon={<ShoppingBag size={18} />}
                  />
                  <KPICard
                    title="Revenue Today"
                    value={stats?.total_revenue_today ?? 0}
                    prefix="$"
                    formatValue={(n) => formatCurrency(n)}
                    trend={7.1}
                    trendLabel="vs yesterday"
                    sparklineData={sparkRevenue}
                    icon={<TrendingUp size={18} />}
                  />
                  <KPICard
                    title="Active Users"
                    value={stats?.total_users ?? 0}
                    trend={2.5}
                    trendLabel="this week"
                    icon={<Users size={18} />}
                  />
                </>
              )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Platform Growth (14 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={growthData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip content={<GrowthTooltip />} />
              <Line
                type="monotone"
                dataKey="orders"
                stroke="#1A3C5E"
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={1200}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="restaurants"
                stroke="#E8A020"
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ActivityLog activities={activities} />
      </div>

      <div className="mt-4">
        <RestaurantStatusGrid restaurants={stats?.top_restaurants} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {[
          { label: "Restaurants", href: "/admin/restaurants" },
          { label: "Customers", href: "/admin/customers" },
          { label: "Platform Health", href: "/admin/platform-health" },
          { label: "Reports", href: "/admin/reports" },
        ].map(({ label, href }) => (
          <a
            key={label}
            href={href}
            className="flex items-center gap-2.5 px-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-[#1A3C5E]/20 transition group"
          >
            <div className="p-2 bg-[#1A3C5E]/5 rounded-lg group-hover:bg-[#1A3C5E]/10 transition">
              <ArrowUpRight size={16} className="text-[#1A3C5E]" />
            </div>
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#1A3C5E] transition">{label}</span>
            <ArrowUpRight size={14} className="ml-auto text-gray-300 group-hover:text-[#1A3C5E] transition" />
          </a>
        ))}
      </div>
    </PageWrapper>
  );
}