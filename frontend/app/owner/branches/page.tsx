"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, Pencil, Eye,
  ToggleLeft, ToggleRight, MapPin, Phone,
  Users, ShoppingBag, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { handleApiError } from "@/lib/handle-error";
import PageWrapper from "@/components/layout/PageWrapper";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";

// ── Types (match exact fields from branches.service.ts getAll + getLiveStats) ─

interface BranchManager {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lon: number | null;
  is_active: boolean;
  operating_hours: Record<string, unknown> | null;
  manager: BranchManager | null;
  created_at: string;
  updated_at: string;
}

// Exact shape returned by branches.service.ts → getLiveStats()
interface LiveStats {
  tables: Record<string, number>;   // { free: N, occupied: N, ... }
  total_tables: number;
  active_orders: number;
  staff_on_duty: number;
  revenue_today: number;
}

// toggleStatus body — must match updateBranchStatusSchema
type BranchStatusInput = "active" | "closed" | "temporarily_closed";

// ── Live stats chip ───────────────────────────────────────────────────────────

function LiveStatChip({ branchId }: { branchId: string }) {
  const { data, isLoading, isError } = useQuery<LiveStats>({
    queryKey: ["branch-live-stats", branchId],
    queryFn: () => apiClient.get<LiveStats>(`/branches/${branchId}/live-stats`),
    refetchInterval: 30_000,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-6 w-20 rounded-full" />
        ))}
      </div>
    );
  }

  // Non-critical — just hide if the stats endpoint fails
  if (isError || !data) return null;

  const occupied = data.tables?.occupied ?? 0;

  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">
        <Users size={11} />
        {occupied}/{data.total_tables} tables
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full">
        <ShoppingBag size={11} />
        {data.active_orders} orders
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-green-50 text-green-700 rounded-full">
        <Users size={11} />
        {data.staff_on_duty} staff
      </span>
    </div>
  );
}

// ── Branch card ───────────────────────────────────────────────────────────────

function BranchCard({ branch }: { branch: Branch }) {
  const router = useRouter();
  const qc = useQueryClient();

  const { mutate: toggleStatus, isPending } = useMutation({
    // Body: { status: "active" | "closed" } — matches updateBranchStatusSchema
    mutationFn: (newStatus: BranchStatusInput) =>
      apiClient.patch(`/branches/${branch.id}/status`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-branches"] });
      toast.success(branch.is_active ? "Branch deactivated" : "Branch activated");
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  const badgeStatus = branch.is_active ? "active" : "inactive";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1A3C5E]/10 text-[#1A3C5E]">
            <Building2 size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{branch.name}</h3>
            {branch.manager && (
              <p className="text-xs text-gray-400 mt-0.5">
                Mgr: {branch.manager.name}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={badgeStatus} size="sm" />
      </div>

      {/* Details */}
      {branch.address && (
        <div className="space-y-1.5 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <MapPin size={13} className="mt-0.5 shrink-0 text-gray-400" />
            <span className="line-clamp-2">{branch.address}</span>
          </div>
        </div>
      )}

      {/* Live stats */}
      <LiveStatChip branchId={branch.id} />

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => router.push(`/owner/branches/${branch.id}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1A3C5E] border border-[#1A3C5E]/30 rounded-lg hover:bg-[#1A3C5E]/5 transition-colors"
        >
          <Eye size={13} /> View
        </button>
        <button
          onClick={() => router.push(`/owner/branches/${branch.id}/edit`)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Pencil size={13} /> Edit
        </button>
        <button
          onClick={() =>
            toggleStatus(branch.is_active ? "closed" : "active")
          }
          disabled={isPending}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50",
            branch.is_active
              ? "text-red-600 border border-red-200 hover:bg-red-50"
              : "text-green-700 border border-green-200 hover:bg-green-50"
          )}
        >
          {branch.is_active
            ? <><ToggleLeft size={13} /> Deactivate</>
            : <><ToggleRight size={13} /> Activate</>
          }
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BranchesPage() {
  const router = useRouter();

  const {
    data: branches,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<Branch[]>({
    queryKey: ["owner-branches"],
    queryFn: () => apiClient.get<Branch[]>("/branches"),
    staleTime: 30_000,
  });

  return (
    <PageWrapper
      title="Branches"
      subtitle="Manage your restaurant locations and monitor live operations"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            aria-label="Refresh branches"
          >
            <RefreshCw size={15} className={cn(isFetching && "animate-spin")} />
          </button>
          <button
            onClick={() => router.push("/owner/branches/new")}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1A3C5E] text-white text-sm font-semibold rounded-lg hover:bg-[#15304d] transition-colors"
          >
            <Plus size={15} /> Add Branch
          </button>
        </div>
      }
    >
      {/* Loading */}
      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard variant="card" count={3} />
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <p className="text-sm text-gray-500">Failed to load branches.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-[#1A3C5E] text-white text-sm font-semibold rounded-lg hover:bg-[#15304d] transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && branches?.length === 0 && (
        <EmptyState
          icon={<Building2 size={32} />}
          title="No branches yet"
          message="Add your first branch to start serving customers."
          action={{
            label: "Create your first branch",
            onClick: () => router.push("/owner/branches/new"),
          }}
        />
      )}

      {/* Grid */}
      {!isLoading && !isError && branches && branches.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch) => (
            <BranchCard key={branch.id} branch={branch} />
          ))}
        </div>
      )}
    </PageWrapper>
  );
}