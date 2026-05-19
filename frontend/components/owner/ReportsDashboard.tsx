"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUp,
  ShoppingBag,
  UtensilsCrossed,
  Users,
  AlertCircle,
  Loader2,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RevenueReport {
  total: number;
  breakdown: { date: string; amount: number }[];
}

interface OrdersReport {
  total_orders: number;
  by_type: { dine_in: number; takeaway: number; delivery: number };
}

interface MenuReport {
  top_items: { name: string; count: number; revenue: number }[];
}

interface StaffReport {
  staff_performance: { name: string; orders: number; avg_time: number }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "revenue", label: "Revenue", icon: TrendingUp },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "menu", label: "Menu", icon: UtensilsCrossed },
  { id: "staff", label: "Staff", icon: Users },
] as const;

type Tab = (typeof TABS)[number]["id"];

const PALETTE = ["#1A3C5E", "#E8A020", "#1E7E34", "#2980B9", "#C0392B"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingOverlay() {
  return (
    <div className="h-64 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-[#1A3C5E]/40" />
    </div>
  );
}

function ErrorBanner({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
      <AlertCircle size={16} />
      {message ?? "Failed to load report data."}
    </div>
  );
}

// ── Revenue tab ───────────────────────────────────────────────────────────────

function RevenueTab({
  branchId,
  from,
  to,
}: {
  branchId: string | null;
  from: string;
  to: string;
}) {
  const { data, isLoading, isError } = useQuery<RevenueReport>({
    queryKey: ["reports", "revenue", branchId, from, to],
    queryFn: () =>
      apiClient.get<RevenueReport>(
        `/reports/revenue?branch_id=${branchId ?? ""}&from=${from}&to=${to}`
      ),
    enabled: !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingOverlay />;
  if (isError) return <ErrorBanner />;

  const chartData = (data?.breakdown ?? []).map((row) => ({
    date: row.date,
    amount: row.amount,
    label: (() => {
      const d = new Date(row.date);
      return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;
    })(),
  }));

  return (
    <div className="space-y-5">
      {/* Summary pill */}
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A3C5E]/5 border border-[#1A3C5E]/10 rounded-full">
        <TrendingUp size={14} className="text-[#1A3C5E]" />
        <span className="text-sm font-semibold text-[#1A3C5E]">
          Total: {formatCurrency(data?.total ?? 0)}
        </span>
      </div>

      {/* Line chart */}
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-400">
          No revenue data for this period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1A3C5E" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1A3C5E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip
              formatter={(v: number) => [formatCurrency(v), "Revenue"]}
              labelStyle={{ fontWeight: 600, color: "#111" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 16px rgba(0,0,0,.08)",
                fontSize: 13,
              }}
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="#1A3C5E"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#1A3C5E" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Orders tab ────────────────────────────────────────────────────────────────

const PIE_LABELS: Record<string, string> = {
  dine_in: "Dine-in",
  takeaway: "Takeaway",
  delivery: "Delivery",
};

function OrdersTab({
  branchId,
  from,
  to,
}: {
  branchId: string | null;
  from: string;
  to: string;
}) {
  const { data, isLoading, isError } = useQuery<OrdersReport>({
    queryKey: ["reports", "orders", branchId, from, to],
    queryFn: () =>
      apiClient.get<OrdersReport>(
        `/reports/orders?branch_id=${branchId ?? ""}&from=${from}&to=${to}`
      ),
    enabled: !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingOverlay />;
  if (isError) return <ErrorBanner />;

  const pieData = data
    ? Object.entries(data.by_type).map(([key, val]) => ({
        name: PIE_LABELS[key] ?? key,
        value: val,
      }))
    : [];

  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#E8A020]/10 border border-[#E8A020]/20 rounded-full">
        <ShoppingBag size={14} className="text-[#E8A020]" />
        <span className="text-sm font-semibold text-[#E8A020]">
          Total orders: {data?.total_orders ?? 0}
        </span>
      </div>

      {pieData.every((d) => d.value === 0) ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-400">
          No order data for this period.
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={108}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((_, idx) => (
                  <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, name: string) => [v, name]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 16px rgba(0,0,0,.08)",
                  fontSize: 13,
                }}
              />
              <Legend
                iconType="circle"
                iconSize={10}
                formatter={(v) => (
                  <span className="text-xs font-medium text-gray-600">{v}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Breakdown table */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(data.by_type).map(([key, val], idx) => (
            <div
              key={key}
              className="rounded-xl px-4 py-3 border text-center"
              style={{
                borderColor: PALETTE[idx % PALETTE.length] + "33",
                background: PALETTE[idx % PALETTE.length] + "0a",
              }}
            >
              <p
                className="text-xs font-medium mb-1"
                style={{ color: PALETTE[idx % PALETTE.length] }}
              >
                {PIE_LABELS[key] ?? key}
              </p>
              <p className="text-2xl font-bold text-gray-900">{val}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Menu tab ──────────────────────────────────────────────────────────────────

function MenuTab({
  branchId,
  from,
  to,
}: {
  branchId: string | null;
  from: string;
  to: string;
}) {
  const { data, isLoading, isError } = useQuery<MenuReport>({
    queryKey: ["reports", "menu", branchId, from, to],
    queryFn: () =>
      apiClient.get<MenuReport>(
        `/reports/menu?branch_id=${branchId ?? ""}&from=${from}&to=${to}`
      ),
    enabled: !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingOverlay />;
  if (isError) return <ErrorBanner />;

  const items = data?.top_items ?? [];

  return (
    <div className="space-y-5">
      {items.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-sm text-gray-400">
          No menu data for this period.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(220, items.length * 42)}>
            <BarChart
              layout="vertical"
              data={items.map((i) => ({ ...i, label: i.name }))}
              margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
              barCategoryGap="25%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#374151" }}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  name === "revenue" ? formatCurrency(v) : v,
                  name === "revenue" ? "Revenue" : "Orders",
                ]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 16px rgba(0,0,0,.08)",
                  fontSize: 13,
                }}
              />
              <Bar dataKey="count" fill="#1A3C5E" radius={[0, 4, 4, 0]} maxBarSize={18} name="Orders" />
            </BarChart>
          </ResponsiveContainer>

          {/* Revenue column alongside */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Item", "Orders", "Revenue"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">
                      {item.name}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{item.count}</td>
                    <td className="px-5 py-3 font-semibold text-[#1A3C5E]">
                      {formatCurrency(item.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Staff tab ─────────────────────────────────────────────────────────────────

function StaffTab({
  branchId,
  from,
  to,
}: {
  branchId: string | null;
  from: string;
  to: string;
}) {
  const { data, isLoading, isError } = useQuery<StaffReport>({
    queryKey: ["reports", "staff", branchId, from, to],
    queryFn: () =>
      apiClient.get<StaffReport>(
        `/reports/staff?branch_id=${branchId ?? ""}&from=${from}&to=${to}`
      ),
    enabled: !!from && !!to,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingOverlay />;
  if (isError) return <ErrorBanner />;

  const staff = data?.staff_performance ?? [];

  return (
    <div className="space-y-4">
      {staff.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-gray-400">
          No staff performance data for this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Staff Member", "Orders Handled", "Avg. Time (min)", "Efficiency"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff
                .slice()
                .sort((a, b) => b.orders - a.orders)
                .map((member, i) => {
                  // Efficiency: inverse of avg_time relative to group avg
                  const avgTime =
                    staff.reduce((s, m) => s + m.avg_time, 0) / (staff.length || 1);
                  const efficiency =
                    avgTime > 0
                      ? Math.min(100, Math.round((avgTime / member.avg_time) * 100))
                      : 100;

                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#1A3C5E]/10 flex items-center justify-center text-xs font-bold text-[#1A3C5E]">
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800">
                            {member.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-semibold text-gray-800">
                        {member.orders}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {member.avg_time.toFixed(1)} min
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full max-w-[80px]">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${efficiency}%`,
                                background:
                                  efficiency >= 80
                                    ? "#1E7E34"
                                    : efficiency >= 50
                                      ? "#E8A020"
                                      : "#C0392B",
                              }}
                            />
                          </div>
                          <span
                            className={cn(
                              "text-xs font-medium",
                              efficiency >= 80
                                ? "text-green-700"
                                : efficiency >= 50
                                  ? "text-yellow-700"
                                  : "text-red-700"
                            )}
                          >
                            {efficiency}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReportsDashboard() {
  const { branchId } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("revenue");

  // Date range — default: last 30 days
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());

  // Quick presets
  const presets = [
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
    { label: "90d", days: 90 },
  ] as const;

  const applyPreset = (days: number) => {
    setFrom(daysAgoISO(days));
    setTo(todayISO());
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Reports &amp; Analytics
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Detailed performance breakdown by date range
          </p>
        </div>

        {/* Date range controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Presets */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition",
                  from === daysAgoISO(p.days) && to === todayISO()
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Manual date pickers */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              max={to}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from}
              max={todayISO()}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-white shadow text-[#1A3C5E]"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        {activeTab === "revenue" && (
          <RevenueTab branchId={branchId} from={from} to={to} />
        )}
        {activeTab === "orders" && (
          <OrdersTab branchId={branchId} from={from} to={to} />
        )}
        {activeTab === "menu" && (
          <MenuTab branchId={branchId} from={from} to={to} />
        )}
        {activeTab === "staff" && (
          <StaffTab branchId={branchId} from={from} to={to} />
        )}
      </div>
    </div>
  );
}