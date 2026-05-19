"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  TrendingUp,
  ShoppingBag,
  ReceiptText,
  Users2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { KPICard } from "@/components/shared/KPICard";
import { ReportsDashboard } from "@/components/owner/ReportsDashboard";
import { BranchManagement } from "@/components/owner/BranchManagement";
import { StaffManagement } from "@/components/owner/StaffManagement";
import { MenuManagement } from "@/components/owner/MenuManagement";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function HourlyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">
        {label}:00 – {label}:59
      </p>
      <p className="text-[#1A3C5E]">
        Orders:{" "}
        <span className="font-bold">{payload[0]?.value ?? 0}</span>
      </p>
      <p className="text-[#E8A020]">
        Revenue:{" "}
        <span className="font-bold">
          {formatCurrency(payload[1]?.value ?? 0)}
        </span>
      </p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function KPISkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 bg-gray-200 rounded" />
          <div className="h-7 w-32 bg-gray-200 rounded" />
        </div>
        <div className="h-12 w-12 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Analytics Section ────────────────────────────────────────────────────────

function AnalyticsSection() {
  const { restaurantId, branchId } = useAuth();

  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ["analytics", "overview", restaurantId],
    queryFn: () =>
      apiClient.get<OverviewData>(
        `/analytics/restaurant/${restaurantId}/overview`
      ),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const {
    data: hourly,
    isLoading: hourlyLoading,
  } = useQuery({
    queryKey: ["analytics", "hourly", branchId],
    queryFn: () =>
      apiClient.get<HourlyData>(`/analytics/branch/${branchId}/hourly`),
    enabled: !!branchId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // ── KPI cards config ──────────────────────────────────────────────────────

  const kpis = [
    {
      title: "Revenue Today",
      value: overviewLoading
        ? "—"
        : formatCurrency(overview?.revenue_today ?? 0),
      change: overview?.revenue_week
        ? `${formatCurrency(overview.revenue_week)} this week`
        : undefined,
      changeType: "positive" as const,
      icon: <TrendingUp size={20} />,
    },
    {
      title: "Orders Today",
      value: overviewLoading ? "—" : String(overview?.orders_today ?? 0),
      icon: <ShoppingBag size={20} />,
    },
    {
      title: "Avg Order Value",
      value: overviewLoading
        ? "—"
        : formatCurrency(overview?.avg_order_value ?? 0),
      icon: <ReceiptText size={20} />,
    },
    {
      title: "Occupancy Rate",
      value: overviewLoading
        ? "—"
        : `${Math.round((overview?.occupancy_rate ?? 0) * 100)}%`,
      icon: <Users2 size={20} />,
    },
  ];

  // ── Hourly chart data ─────────────────────────────────────────────────────

  const chartData = (hourly?.hours ?? []).map((h) => ({
    hour: h.hour,
    orders: h.orders,
    revenue: h.revenue,
    label: `${String(h.hour).padStart(2, "0")}:00`,
  }));

  return (
    <section className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Today's Performance
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Live analytics for your restaurant
          </p>
        </div>
        <button
          onClick={() => refetchOverview()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Error state */}
      {overviewError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} />
          Unable to load analytics. Check your connection and try again.
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewLoading
          ? Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)
          : kpis.map((kpi) => (
              <KPICard
                key={kpi.title}
                title={kpi.title}
                value={kpi.value}
                change={kpi.change}
                changeType={kpi.changeType}
                icon={kpi.icon}
              />
            ))}
      </div>

      {/* Hourly Bar Chart */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              Hourly Activity
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Orders and revenue by hour of day
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#1A3C5E]" />
              Orders
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#E8A020]" />
              Revenue
            </span>
          </div>
        </div>

        {hourlyLoading ? (
          <div className="h-56 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-5 bg-gray-200 rounded animate-pulse"
                    style={{
                      height: `${Math.random() * 60 + 20}px`,
                      animationDelay: `${i * 100}ms`,
                    }}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400">Loading hourly data…</p>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-gray-400">
            No hourly data available yet for today
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              barGap={4}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="orders"
                orientation="left"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <YAxis
                yAxisId="revenue"
                orientation="right"
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip content={<HourlyTooltip />} cursor={{ fill: "#f9fafb" }} />
              <Bar
                yAxisId="orders"
                dataKey="orders"
                fill="#1A3C5E"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
              <Bar
                yAxisId="revenue"
                dataKey="revenue"
                fill="#E8A020"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                opacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top Items */}
      {overview?.top_items && overview.top_items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-800">
              Top Selling Items Today
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {overview.top_items.slice(0, 5).map((item, idx) => (
              <div
                key={item.name}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      idx === 0
                        ? "bg-[#E8A020] text-white"
                        : idx === 1
                          ? "bg-gray-300 text-gray-700"
                          : idx === 2
                            ? "bg-amber-700 text-white"
                            : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-800">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-gray-500">{item.count} sold</span>
                  <span className="font-semibold text-[#1A3C5E]">
                    {formatCurrency(item.revenue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerDashboard() {
  return (
    <PageWrapper
      title="Owner Dashboard"
      subtitle="Manage your restaurant operations"
    >
      <div className="space-y-10">
        <AnalyticsSection />
        <BranchManagement />
        <StaffManagement />
        <MenuManagement />
        <ReportsDashboard />
      </div>
    </PageWrapper>
  );
}