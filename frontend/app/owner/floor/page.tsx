"use client";

/**
 * app/owner/floor/page.tsx
 *
 * Branch selector — owner picks which branch to design the floor plan for.
 *
 * Data flow:
 *   1. useAuth()  → restaurantId used to scope the branches fetch
 *   2. GET /branches?restaurant_id=:id  → list of owner's branches
 *   3. Per branch: GET /floor-layout/branch/:branchId/status  → { has_active_layout: boolean }
 *      (fetched in parallel via individual useQuery calls inside BranchCard)
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  MapPin,
  ArrowRight,
  CheckCircle2,
  LayoutGrid,
  Plus,
} from "lucide-react";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import type { Branch } from "@/types/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LayoutStatus {
  has_active_layout: boolean;
}

// ── BranchCard ────────────────────────────────────────────────────────────────
// Isolated component so each card manages its own layout-status query without
// blocking the branch list from rendering.

function BranchCard({
  branch,
  index,
}: {
  branch: Branch;
  index: number;
}) {
  const router = useRouter();

  const { data: layoutStatus, isLoading: statusLoading } =
    useQuery<LayoutStatus>({
      queryKey: ["floor-layout", "status", branch.id],
      queryFn: () =>
        apiClient.get<LayoutStatus>(
          `/floor-layout/branch/${branch.id}/status`
        ),
      staleTime: 60_000,
      // If the endpoint doesn't exist yet, fail silently — card still renders
      retry: false,
    });

  const hasLayout = layoutStatus?.has_active_layout ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: "easeOut" }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 flex flex-col"
    >
      {/* Card header */}
      <div className="p-5 flex-1">
        {/* Top row: name + status badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-[#1A3C5E]/8 flex items-center justify-center">
              <LayoutGrid size={16} className="text-[#1A3C5E]" />
            </div>
            <h3 className="text-base font-bold text-gray-900 truncate">
              {branch.name}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge
              status={branch.is_active ? "active" : "inactive"}
              size="sm"
            />
          </div>
        </div>

        {/* Address */}
        {branch.address && (
          <div className="flex items-start gap-1.5 mb-4">
            <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-500 leading-snug line-clamp-2">
              {branch.address}
            </p>
          </div>
        )}

        {/* Layout status chip */}
        <div className="flex items-center gap-2">
          {statusLoading ? (
            <div className="h-5 w-24 bg-gray-100 rounded-full animate-pulse" />
          ) : hasLayout ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-status-success bg-status-success/10 px-2.5 py-1 rounded-full">
              <CheckCircle2 size={11} />
              Layout published
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              No layout yet
            </span>
          )}
        </div>
      </div>

      {/* Card footer — CTA */}
      <div className="px-5 pb-5">
        <button
          onClick={() => router.push(`/owner/floor/${branch.id}`)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1A3C5E] text-white text-sm font-semibold hover:bg-[#152f4a] active:scale-[0.98] transition-all duration-150"
        >
          {hasLayout ? "Edit Floor Plan" : "Design Floor"}
          <ArrowRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Skeleton grid ─────────────────────────────────────────────────────────────

function BranchCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="skeleton w-9 h-9 rounded-xl" />
        <div className="skeleton h-5 w-32 rounded" />
        <div className="ml-auto skeleton h-5 w-16 rounded-full" />
      </div>
      {/* Address */}
      <div className="space-y-1.5">
        <div className="skeleton h-3.5 w-3/4 rounded" />
        <div className="skeleton h-3.5 w-1/2 rounded" />
      </div>
      {/* Layout chip */}
      <div className="skeleton h-5 w-28 rounded-full" />
      {/* CTA */}
      <div className="skeleton h-10 w-full rounded-xl" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OwnerFloorIndexPage() {
  const { restaurantId } = useAuth();

  const {
    data: branches,
    isLoading,
    isError,
  } = useQuery<Branch[]>({
    queryKey: ["branches", restaurantId],
    queryFn: () =>
      apiClient.get<Branch[]>(
        restaurantId
          ? `/branches?restaurant_id=${restaurantId}`
          : "/branches"
      ),
    enabled: true, // fetch even if restaurantId not yet resolved
    staleTime: 60_000,
  });

  return (
    <PageWrapper
      title="Floor Layout Designer"
      subtitle="Set up your restaurant floor plan for each branch"
      action={
        <Link
          href="/owner/branches/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
        >
          <Plus size={14} />
          Add Branch
        </Link>
      }
    >
      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <BranchCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4 text-sm text-red-600 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          Failed to load branches. Please refresh the page.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && (!branches || branches.length === 0) && (
        <EmptyState
          icon={<LayoutGrid size={32} className="text-gray-300" />}
          title="No branches yet"
          message="Add a branch first, then design its floor plan."
          action={{
            label: "Add a Branch",
            onClick: () =>
              (window.location.href = "/owner/branches"),
          }}
          className="py-20"
        />
      )}

      {/* Branch grid */}
      {!isLoading && !isError && branches && branches.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch, i) => (
            <BranchCard key={branch.id} branch={branch} index={i} />
          ))}
        </div>
      )}
    </PageWrapper>
  );
}