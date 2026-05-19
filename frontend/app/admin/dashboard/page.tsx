"use client";

import { useQuery } from "@tanstack/react-query";
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
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  }[];
}

// NOTE: The backend exposes GET /admin/dashboard (getDashboard) which returns
// full platform stats including restaurant counts, user counts, today's orders,
// today's revenue, and an optional health score. We also fall back gracefully
// when optional fields are absent.

// ─── Skeleton card ────────────────────────────────────────────────────────────

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

// ─── Health score pill ────────────────────────────────────────────────────────

function HealthScore({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(score)));
  const color =
    pct >= 80 ? "text-green-700 bg-green-50 border-green-200"
    : pct >= 50 ? "text-yellow-700 bg-yellow-50 border-yellow-200"
    : "text-red-700 bg-red-50 border-red-200";

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold",
        color
      )}
    >
      <Activity size={14} />
      Platform health: {pct}%
    </div>
  );
}

// ─── Top restaurants mini-table ───────────────────────────────────────────────

function TopRestaurantsTable({
  rows,
}: {
  rows: PlatformStats["top_restaurants"];
}) {
  if (!rows?.length) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">
          Top Restaurants (last 30 days)
        </h3>
        <a
          href="/admin/restaurants"
          className="flex items-center gap-1 text-xs font-medium text-[#1A3C5E] hover:underline"
        >
          View all <ArrowUpRight size={12} />
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Restaurant", "Revenue", "Orders"].map((h) => (
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
            {rows.map((r, i) => (
              <tr key={r.id ?? i} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#1A3C5E]/10 flex items-center justify-center text-xs font-bold text-[#1A3C5E]">
                      {r.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800">{r.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 font-semibold text-[#1A3C5E]">
                  {formatCurrency(r.revenue ?? 0)}
                </td>
                <td className="px-5 py-3 text-gray-600">{r.orders ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    dataUpdatedAt,
  } = useQuery<PlatformStats>({
    queryKey: ["admin", "dashboard"],
    // GET /admin/dashboard returns the full platform stats object assembled
    // in adminService.getDashboard() — cached in Redis for 5 min server-side.
    queryFn: () => apiClient.get<PlatformStats>("/admin/dashboard"),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const lastRefreshed = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const kpis = [
    {
      title: "Total Restaurants",
      value: isLoading ? "—" : String(data?.total_restaurants ?? 0),
      change: data
        ? `${data.active_restaurants ?? 0} active · ${data.suspended_restaurants ?? 0} suspended`
        : undefined,
      changeType: "positive" as const,
      icon: <Store size={20} />,
    },
    {
      title: "Registered Users",
      value: isLoading ? "—" : (data?.total_users ?? 0).toLocaleString("en-IN"),
      icon: <Users size={20} />,
    },
    {
      title: "Orders Today",
      value: isLoading
        ? "—"
        : String(data?.total_orders_today ?? 0),
      icon: <ShoppingBag size={20} />,
    },
    {
      title: "Revenue Today",
      value: isLoading
        ? "—"
        : formatCurrency(data?.total_revenue_today ?? 0),
      icon: <TrendingUp size={20} />,
    },
  ];

  return (
    <PageWrapper title="Admin Dashboard" subtitle="Platform-wide overview">
      <div className="space-y-6">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {data?.platform_health_score !== undefined && (
              <HealthScore score={data.platform_health_score} />
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <span className="text-xs text-gray-400">
                Updated {lastRefreshed}
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error banner */}
        {isError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            <AlertCircle size={16} />
            Unable to load platform stats. Check your connection or permissions.
          </div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading
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

        {/* Restaurant status breakdown */}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: "Active",
                value: data.active_restaurants ?? 0,
                color: "#1E7E34",
                bg: "bg-green-50 border-green-200",
                text: "text-green-700",
              },
              {
                label: "Suspended",
                value: data.suspended_restaurants ?? 0,
                color: "#C0392B",
                bg: "bg-red-50 border-red-200",
                text: "text-red-700",
              },
              {
                label: "Total",
                value: data.total_restaurants ?? 0,
                color: "#1A3C5E",
                bg: "bg-blue-50 border-blue-200",
                text: "text-[#1A3C5E]",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  "flex items-center justify-between px-5 py-4 rounded-xl border",
                  item.bg
                )}
              >
                <p className={cn("text-sm font-medium", item.text)}>
                  {item.label} Restaurants
                </p>
                <p className={cn("text-2xl font-bold", item.text)}>
                  {item.value.toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Top restaurants table (only if backend returns the data) */}
        {data?.top_restaurants && (
          <TopRestaurantsTable rows={data.top_restaurants} />
        )}

        {/* Quick nav shortcuts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Restaurants", href: "/admin/restaurants", icon: Store },
            { label: "Customers", href: "/admin/customers", icon: Users },
            { label: "Platform Health", href: "/admin/platform-health", icon: Activity },
            { label: "Reports", href: "/admin/reports", icon: TrendingUp },
          ].map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              className="flex items-center gap-2.5 px-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-[#1A3C5E]/20 transition group"
            >
              <div className="p-2 bg-[#1A3C5E]/5 rounded-lg group-hover:bg-[#1A3C5E]/10 transition">
                <Icon size={16} className="text-[#1A3C5E]" />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-[#1A3C5E] transition">
                {label}
              </span>
              <ArrowUpRight
                size={14}
                className="ml-auto text-gray-300 group-hover:text-[#1A3C5E] transition"
              />
            </a>
          ))}
        </div>

      </div>
    </PageWrapper>
  );
}