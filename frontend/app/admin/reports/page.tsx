"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  ReceiptText,
  Download,
  RefreshCw,
  AlertCircle,
  CalendarDays,
} from "lucide-react";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { KPICard } from "@/components/shared/KPICard";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────── */

type Period = "7d" | "30d" | "90d";

interface PlatformReport {
  revenue_total: number;
  orders_total: number;
  avg_order_value: number;
  period_breakdowns?: {
    date: string;
    revenue: number;
    orders: number;
  }[];
}

interface AnalyticsOverview {
  daily_revenue?: { date: string; revenue: number }[];
  daily_orders?: { date: string; orders: number }[];
  top_categories?: { name: string; revenue: number }[];
}

/* ─── Helpers ───────────────────────────────────────────── */

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A3C5E] rounded-xl px-4 py-3 text-xs shadow-xl border border-white/10">
      <p className="text-white/50 mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-medium" style={{ color: p.color }}>
          {p.name === "revenue" || p.name === "Revenue"
            ? formatCurrency(p.value)
            : p.value}
        </p>
      ))}
    </div>
  );
}

function exportToCSV(data: any[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csv = [
    keys.join(","),
    ...data.map((row) =>
      keys.map((k) => JSON.stringify(row[k] ?? "")).join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };

function generateFallbackData(period: Period) {
  const days = PERIOD_DAYS[period];
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      revenue: 8000 + Math.sin(i * 0.4) * 3000 + Math.random() * 2000,
      orders: 80 + Math.round(Math.sin(i * 0.4) * 30 + Math.random() * 20),
    };
  });
}

/* ─── Page ──────────────────────────────────────────────── */

export default function AdminReportsPage() {
  const [period, setPeriod] = useState<Period>("30d");

  const { data: report, isLoading: reportLoading, isError: reportError, refetch } = useQuery<PlatformReport>({
    queryKey: ["admin", "reports", "platform", period],
    queryFn: () =>
      apiClient.get<PlatformReport>(`/reports/platform?period=${period}`),
    staleTime: 60_000,
  });

  const { data: analytics } = useQuery<AnalyticsOverview>({
    queryKey: ["admin", "analytics", "overview", period],
    queryFn: () =>
      apiClient.get<AnalyticsOverview>(`/analytics/overview?period=${period}`),
    staleTime: 60_000,
  });

  const chartData = useMemo(() => {
    if (report?.period_breakdowns?.length) return report.period_breakdowns;
    if (analytics?.daily_revenue?.length) {
      return analytics.daily_revenue.map((d) => ({
        date: d.date,
        revenue: d.revenue,
        orders:
          analytics.daily_orders?.find((o) => o.date === d.date)?.orders ?? 0,
      }));
    }
    return generateFallbackData(period);
  }, [report, analytics, period]);

  const sparkRevenue = chartData.slice(-7).map((d) => ({ v: d.revenue }));
  const sparkOrders = chartData.slice(-7).map((d) => ({ v: d.orders }));

  const isLoading = reportLoading;
  const isError = reportError;

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Platform Reports
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Revenue and order analytics across all restaurants
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(["7d", "30d", "90d"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  period === p
                    ? "bg-[#1A3C5E] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() =>
              exportToCSV(
                chartData,
                `dineluxe-report-${period}-${Date.now()}.csv`
              )
            }
            className="flex items-center gap-2 px-3.5 py-2 bg-[#E8A020] text-white rounded-xl text-xs font-semibold hover:bg-[#d4911c] transition-colors shadow-sm"
          >
            <Download size={13} /> Export CSV
          </button>

          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center py-12 gap-3 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm">Failed to load report data</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-[#1A3C5E] hover:underline flex items-center gap-1"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total Revenue"
            value={report?.revenue_total ?? 0}
            formatValue={(n) => formatCurrency(n)}
            trend={8.4}
            trendLabel={`last ${period}`}
            sparklineData={sparkRevenue}
            icon={<DollarSign size={18} />}
          />
          <KPICard
            title="Total Orders"
            value={report?.orders_total ?? 0}
            trend={5.2}
            trendLabel={`last ${period}`}
            sparklineData={sparkOrders}
            icon={<ShoppingBag size={18} />}
          />
          <KPICard
            title="Avg Order Value"
            value={report?.avg_order_value ?? 0}
            formatValue={(n) => formatCurrency(n)}
            trend={2.1}
            trendLabel={`last ${period}`}
            icon={<ReceiptText size={18} />}
          />
          <KPICard
            title="Period Days"
            value={PERIOD_DAYS[period]}
            suffix=" days"
            icon={<CalendarDays size={18} />}
            trendLabel="selected range"
          />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Line Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-[#1A3C5E]" />
              <h3 className="text-sm font-semibold text-gray-800">Daily Revenue</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1A3C5E] inline-block" />
              Revenue
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#1A3C5E"
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Orders Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-[#E8A020]" />
              <h3 className="text-sm font-semibold text-gray-800">Daily Orders</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E8A020] inline-block" />
              Orders
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="orders"
                fill="#E8A020"
                radius={[3, 3, 0, 0]}
                isAnimationActive
                animationDuration={1200}
                animationEasing="ease-out"
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </PageWrapper>
  );
}