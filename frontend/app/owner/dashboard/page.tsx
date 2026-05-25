"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  ShoppingBag,
  Users2,
  RefreshCw,
  AlertCircle,
  Clock,
  Zap,
} from "lucide-react";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { KPICard } from "@/components/shared/KPICard";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ReportsDashboard } from "@/components/owner/ReportsDashboard";
import { BranchManagement } from "@/components/owner/BranchManagement";
import { StaffManagement } from "@/components/owner/StaffManagement";
import { MenuManagement } from "@/components/owner/MenuManagement";

interface OverviewData {
  revenue_today: number;
  revenue_week: number;
  orders_today: number;
  avg_order_value: number;
  top_items: { name: string; count: number; revenue: number }[];
  occupancy_rate: number;
}

interface HourlyData {
  hours: { hour: number; orders: number; revenue: number }[];
}

interface BranchPerf {
  id: string;
  name: string;
  revenue: number;
  orders: number;
  occupancy_rate: number;
}

interface LiveEvent {
  id: string;
  type: "order" | "booking" | "alert";
  message: string;
  at: string;
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A3C5E] rounded-xl px-4 py-3 text-sm shadow-xl border border-white/10">
      <p className="text-white/60 text-xs mb-1">{label}:00</p>
      <p className="text-[#E8A020] font-bold font-mono">{formatCurrency(payload[0]?.value ?? 0)}</p>
      <p className="text-white/80 text-xs">{payload[1]?.value ?? 0} orders</p>
    </div>
  );
}

function OccupancyHeatmap() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 16 }, (_, i) => i + 7);

  const intensity = (d: number, h: number) => {
    const peak = d >= 4 ? [12, 13, 19, 20, 21] : [12, 13, 19, 20];
    if (peak.includes(h)) return 0.7 + Math.random() * 0.3;
    if (h >= 9 && h <= 22) return 0.2 + Math.random() * 0.4;
    return 0.05;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">Occupancy Heatmap</h3>
      <div className="overflow-x-auto">
        <div className="min-w-130">
          <div className="flex mb-1 pl-10">
            {hours.filter((_, i) => i % 3 === 0).map((h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-gray-400 font-mono">{h}h</div>
            ))}
          </div>
          {days.map((day, d) => (
            <div key={day} className="flex items-center gap-1 mb-1">
              <span className="text-[10px] text-gray-400 w-9 text-right pr-1 font-medium">{day}</span>
              {hours.map((h, hi) => {
                const val = intensity(d, h);
                return (
                  <motion.div
                    key={h}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (d * 16 + hi) * 0.003, duration: 0.3 }}
                    className="flex-1 h-5 rounded-sm"
                    style={{ backgroundColor: `rgba(232, 160, 32, ${val})` }}
                    title={`${day} ${h}:00 — ${Math.round(val * 100)}%`}
                  />
                );
              })}
            </div>
          ))}
          <div className="flex items-center gap-2 mt-3 justify-end">
            <span className="text-[10px] text-gray-400">Low</span>
            <div className="flex gap-0.5">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
                <div key={v} className="w-4 h-2 rounded-sm" style={{ backgroundColor: `rgba(232, 160, 32, ${v})` }} />
              ))}
            </div>
            <span className="text-[10px] text-gray-400">High</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveFeed({ branchId }: { branchId?: string }) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const { on } = useRealtime(branchId ? { branchId, role: "manager" } : { room: "owner" });

  useEffect(() => {
    const unsub1 = on<any>("order:new", (payload) => {
      const nextEvent: LiveEvent = {
        id: payload.id ?? Math.random().toString(),
        type: "order",
        message: `New order #${payload.order_number ?? "—"} received`,
        at: new Date().toLocaleTimeString(),
      };
      setEvents((prev) => [nextEvent, ...prev].slice(0, 12));
    });

    const unsub2 = on<any>("booking:new", (payload) => {
      const nextEvent: LiveEvent = {
        id: payload.id ?? Math.random().toString(),
        type: "booking",
        message: `Booking for ${payload.people_count ?? "?"} guests`,
        at: new Date().toLocaleTimeString(),
      };
      setEvents((prev) => [nextEvent, ...prev].slice(0, 12));
    });

    const unsub3 = on<any>("alert:new", (payload) => {
      const nextEvent: LiveEvent = {
        id: payload.id ?? Math.random().toString(),
        type: "alert",
        message: payload.message ?? "New alert received",
        at: new Date().toLocaleTimeString(),
      };
      setEvents((prev) => [nextEvent, ...prev].slice(0, 12));
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [on]);

  const typeColor: Record<string, string> = {
    order: "bg-[#1A3C5E]/8 text-[#1A3C5E]",
    booking: "bg-[#E8A020]/12 text-[#E8A020]",
    alert: "bg-red-50 text-red-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Today at a Glance</h3>
        <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>
      <div className="space-y-2 min-h-30">
        {events.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">Waiting for live events…</p>
        )}
        <AnimatePresence initial={false}>
          {events.map((ev) => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium",
                typeColor[ev.type] ?? "bg-gray-50 text-gray-600"
              )}
            >
              <span>{ev.message}</span>
              <span className="text-[10px] opacity-60 font-mono">{ev.at}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BranchPerfTable({ restaurantId }: { restaurantId?: string }) {
  const { data, isLoading } = useQuery<BranchPerf[]>({
    queryKey: ["branch-performance", restaurantId],
    queryFn: () => apiClient.get<BranchPerf[]>(`/analytics/branch-performance?restaurant_id=${restaurantId}`),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const rows = data ?? [];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50/80">
            <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3 uppercase tracking-wide">Branch</th>
            <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3 uppercase tracking-wide">Revenue</th>
            <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3 uppercase tracking-wide">Orders</th>
            <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3 uppercase tracking-wide hidden md:table-cell">Occupancy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((branch, idx) => (
            <motion.tr
              key={branch.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.07, duration: 0.35 }}
              className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors"
            >
              <td className="px-4 py-3.5 font-medium text-gray-800">{branch.name}</td>
              <td className="px-4 py-3.5 text-right font-mono text-[#E8A020] font-semibold">{formatCurrency(branch.revenue)}</td>
              <td className="px-4 py-3.5 text-right text-gray-600 font-mono">{branch.orders}</td>
              <td className="px-4 py-3.5 text-right hidden md:table-cell">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${branch.occupancy_rate ?? 0}%` }}
                      transition={{ delay: idx * 0.07 + 0.3, duration: 0.6 }}
                      className="h-full bg-[#1A3C5E] rounded-full"
                    />
                  </div>
                  <span className="text-xs text-gray-500 font-mono w-8 text-right">{branch.occupancy_rate ?? 0}%</span>
                </div>
              </td>
            </motion.tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400">No branch data available</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function OwnerDashboard() {
  const { restaurantId, branchId } = useAuth();

  const {
    data: overview,
    isLoading,
    isError,
    refetch,
  } = useQuery<OverviewData>({
    queryKey: ["analytics", "overview", restaurantId],
    queryFn: () => apiClient.get<OverviewData>(`/analytics/restaurant/${restaurantId}/overview`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: Boolean(restaurantId),
  });

  const { data: hourlyRaw } = useQuery<HourlyData>({
    queryKey: ["analytics", "hourly", branchId],
    queryFn: () => apiClient.get<HourlyData>(`/analytics/branch/${branchId}/hourly`),
    staleTime: 60_000,
    enabled: Boolean(branchId),
  });

  const hourlyData = (hourlyRaw?.hours ?? []).map((h) => ({
    hour: `${h.hour}h`,
    revenue: h.revenue,
    orders: h.orders,
  }));

  const sparkWeek = hourlyData.slice(-7).map((h) => ({ v: h.revenue }));

  if (isError) {
    return (
      <PageWrapper title="Dashboard">
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
          <AlertCircle size={32} className="text-red-400" />
          <p className="text-sm">Failed to load dashboard data</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 text-sm text-[#1A3C5E] hover:underline"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </PageWrapper>
    );
  }

  const revenueToday = overview?.revenue_today ?? 0;
  const revenueWeek = overview?.revenue_week ?? 1;
  const revenueTrend = ((revenueToday / Math.max(revenueWeek / 7, 1)) - 1) * 100;

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>
            Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          ))
        ) : (
          <>
            <KPICard
              title="Revenue Today"
              value={revenueToday}
              prefix="$"
              trend={revenueTrend}
              trendLabel="vs avg"
              sparklineData={sparkWeek}
              icon={<TrendingUp size={18} />}
              formatValue={(n) => (n / 100).toFixed(2)}
            />
            <KPICard
              title="Orders Today"
              value={overview?.orders_today ?? 0}
              trend={5.2}
              trendLabel="vs yesterday"
              sparklineData={sparkWeek.map((d) => ({ v: d.v * 0.01 }))}
              icon={<ShoppingBag size={18} />}
            />
            <KPICard
              title="Avg Order Value"
              value={overview?.avg_order_value ?? 0}
              prefix="$"
              trend={-1.4}
              trendLabel="vs last week"
              icon={<Zap size={18} />}
              formatValue={(n) => (n / 100).toFixed(2)}
            />
            <KPICard
              title="Occupancy Rate"
              value={Math.round((overview?.occupancy_rate ?? 0) * 100)}
              suffix="%"
              trend={3.1}
              trendLabel="vs yesterday"
              icon={<Users2 size={18} />}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Revenue — Today (hourly)</h3>
            <span className="text-[10px] font-mono text-gray-400">{formatCurrency(overview?.revenue_today ?? 0)} total</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={hourlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E8A020" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#E8A020" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#E8A020"
                strokeWidth={2}
                fill="url(#colorRevenue)"
                isAnimationActive={true}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <LiveFeed branchId={branchId ?? undefined} />
      </div>

      <OccupancyHeatmap />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Branch Performance</h3>
        <BranchPerfTable restaurantId={restaurantId ?? undefined} />
      </div>

      <div className="space-y-10">
        <BranchManagement />
        <StaffManagement />
        <MenuManagement />
        <ReportsDashboard />
      </div>
    </PageWrapper>
  );
}