"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Users,
  ShoppingBag,
  LayoutGrid,
  IndianRupee,
  Pencil,
  RefreshCw,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import PageWrapper from "@/components/layout/PageWrapper";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KPICard } from "@/components/shared/KPICard";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Manager {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  is_active: boolean;
  status: "active" | "closed" | "temporarily_closed";
  seating_capacity: number | null;
  operating_hours: Record<string, unknown> | null;
  manager: Manager | null;
  created_at: string;
  updated_at: string;
}

interface LiveStats {
  /** map of table status → count e.g. { occupied: 4, free: 8 } */
  tables: Record<string, number>;
  total_tables: number;
  active_orders: number;
  staff_on_duty: number;
  revenue_today: number;
}

// ── KPI Grid ──────────────────────────────────────────────────────────────────

function LiveStatsGrid({
  stats,
  isFetching,
}: {
  stats: LiveStats;
  isFetching: boolean;
}) {
  const occupied = stats.tables?.occupied ?? 0;
  const free = stats.tables?.free ?? 0;

  return (
    <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
      <KPICard
        title="Tables Occupied"
        value={`${occupied} / ${stats.total_tables}`}
        icon={<LayoutGrid size={18} />}
        className={cn(isFetching && "opacity-75 transition-opacity")}
      />
      <KPICard
        title="Tables Free"
        value={free}
        icon={<LayoutGrid size={18} />}
        className={cn(isFetching && "opacity-75")}
      />
      <KPICard
        title="Active Orders"
        value={stats.active_orders}
        icon={<ShoppingBag size={18} />}
        className={cn(isFetching && "opacity-75")}
      />
      <KPICard
        title="Staff On Duty"
        value={stats.staff_on_duty}
        icon={<Users size={18} />}
        className={cn(isFetching && "opacity-75")}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BranchDetailPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  // ── Branch data ────────────────────────────────────────────────────────────
  const {
    data: branch,
    isLoading: branchLoading,
    isError: branchError,
    refetch: refetchBranch,
  } = useQuery<Branch>({
    queryKey: ["branch", branchId],
    queryFn: () => apiClient.get<Branch>(`/branches/${branchId}`),
    enabled: !!branchId,
  });

  // ── Live stats (poll every 30 s) ──────────────────────────────────────────
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useQuery<LiveStats>({
    queryKey: ["branch-live-stats", branchId],
    queryFn: () =>
      apiClient.get<LiveStats>(`/branches/${branchId}/live-stats`),
    enabled: !!branchId,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const isLoading = branchLoading || statsLoading;
  const isError = branchError;

  const handleRefresh = () => {
    refetchBranch();
    refetchStats();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageWrapper
      title={branch?.name ?? "Branch Detail"}
      subtitle="Live operations overview — refreshes every 30 seconds"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={statsFetching}
            className="p-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
            aria-label="Refresh stats"
          >
            <RefreshCw
              size={15}
              className={cn(statsFetching && "animate-spin")}
            />
          </button>
          <button
            onClick={() => router.push(`/owner/branches/${branchId}/edit`)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <Pencil size={14} />
            Edit Branch
          </button>
          <button
            onClick={() => router.push("/owner/branches")}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1A3C5E] rounded-lg hover:bg-[#15304d] transition"
          >
            <ArrowLeft size={14} />
            Branches
          </button>
        </div>
      }
    >
      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
            <SkeletonCard variant="stat" count={4} />
          </div>
          <SkeletonCard variant="card" count={1} />
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <p className="text-gray-500 text-sm">Failed to load branch details.</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-[#1A3C5E] text-white text-sm font-semibold rounded-lg hover:bg-[#15304d] transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {!isLoading && !isError && branch && (
        <div className="space-y-6">
          {/* KPI Cards */}
          {stats ? (
            <LiveStatsGrid stats={stats} isFetching={statsFetching} />
          ) : statsError ? (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              Live stats unavailable.{" "}
              <button
                onClick={() => refetchStats()}
                className="underline font-medium"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
              <SkeletonCard variant="stat" count={4} />
            </div>
          )}

          {/* Revenue today — full-width card */}
          {stats && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">Revenue Today</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(stats.revenue_today)}
                </p>
              </div>
              <div className="p-3 bg-green-50 text-green-700 rounded-lg">
                <IndianRupee size={22} />
              </div>
            </div>
          )}

          {/* Branch info card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A3C5E]/10 text-[#1A3C5E]">
                  <Building2 size={18} />
                </span>
                <div>
                  <h2 className="font-semibold text-gray-900">{branch.name}</h2>
                  {branch.manager && (
                    <p className="text-xs text-gray-400">
                      Manager: {branch.manager.name}
                    </p>
                  )}
                </div>
              </div>
              <StatusBadge status={branch.is_active ? "active" : "inactive"} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-sm text-gray-600">
              {branch.address && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" />
                  <span>{branch.address}</span>
                </div>
              )}
              {branch.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="shrink-0 text-gray-400" />
                  <span>{branch.phone}</span>
                </div>
              )}
              {branch.seating_capacity && (
                <div className="flex items-center gap-2">
                  <Users size={14} className="shrink-0 text-gray-400" />
                  <span>{branch.seating_capacity} seats</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock size={14} className="shrink-0 text-gray-400" />
                <span>Updated {formatDateTime(branch.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}