"use client";

/**
 * app/owner/floor/[branchId]/page.tsx
 *
 * The actual floor layout editor for a specific branch.
 *
 * Data flow:
 *   GET /branches/:branchId         → branch name, status
 *   GET /floor-layout/branch/:id    → existing draft/published layout
 *
 * The FloorLayoutDesigner is lazy-loaded (no SSR) because it uses
 * @dnd-kit/core which requires a browser environment.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback } from "react";
import {
  ArrowLeft,
  MapPin,
  Eye,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiClient } from "@/lib/api-client";
import type { Branch } from "@/types/api";
import type { FloorLayout } from "@/components/floor/FloorLayoutDesigner";

// Lazy-load FloorLayoutDesigner (dnd-kit needs the browser)
const FloorLayoutDesigner = dynamic(
  () => import("@/components/floor/FloorLayoutDesigner"),
  {
    ssr: false,
    loading: () => <DesignerSkeleton />,
  }
);

// Lazy-load FloorMap for the live view modal
const FloorMap = dynamic(
  () =>
    import("@/components/floor/FloorMap").then((m) => ({
      default: m.FloorMap,
    })),
  { ssr: false }
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: { branchId: string };
}

// ── Skeleton while the designer JS bundle loads ───────────────────────────────

function DesignerSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      {/* Simulated 3-col layout */}
      <div className="flex h-[640px]">
        {/* Left sidebar */}
        <div className="w-48 border-r border-gray-100 bg-gray-50 p-4 space-y-4">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
          <div className="skeleton h-3 w-16 rounded mt-4" />
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton w-6 h-6 rounded-full" />
            ))}
          </div>
          <div className="space-y-1.5 mt-4">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-9 rounded-lg" />
            ))}
          </div>
        </div>
        {/* Canvas */}
        <div className="flex-1 bg-gray-50 p-4">
          <div className="skeleton w-full h-full rounded-xl" />
        </div>
        {/* Right panel */}
        <div className="w-64 border-l border-gray-100 bg-gray-50 p-4 space-y-4">
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton h-full rounded-xl" />
        </div>
      </div>
      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
        <div className="flex gap-2">
          <div className="skeleton h-8 w-20 rounded-lg" />
          <div className="skeleton h-8 w-20 rounded-lg" />
        </div>
        <div className="skeleton h-3 w-36 rounded" />
        <div className="flex gap-2">
          <div className="skeleton h-8 w-28 rounded-lg" />
          <div className="skeleton h-8 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ── Layout status chip ────────────────────────────────────────────────────────

function LayoutStatusChip({ layout }: { layout: FloorLayout | null | undefined }) {
  if (!layout) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
        <AlertCircle size={11} />
        No Layout
      </span>
    );
  }
  if (layout.status === "published") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-status-success/10 text-status-success">
        <CheckCircle2 size={11} />
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
      <Clock size={11} />
      Draft
    </span>
  );
}

// ── Live map modal ─────────────────────────────────────────────────────────────

function LiveMapModal({
  branchId,
  open,
  onClose,
}: {
  branchId: string;
  open: boolean;
  onClose: () => void;
}) {
  // Fetch live floor data for the modal
  const { data: liveLayout, isLoading } = useQuery({
    queryKey: ["floor-layout", "live", branchId],
    queryFn: () => apiClient.get<any>(`/floor-layout/branch/${branchId}/live`),
    enabled: open && !!branchId,
    refetchInterval: 30_000,
  });

  // Map DB table rows to FloorMap's FloorTable shape
  const tables = (liveLayout?.floors?.[0]?.tables ?? []).map((t: any) => ({
    id:       t.id ?? t.label,
    label:    t.label,
    capacity: t.capacity ?? 4,
    status:   t.status ?? "free",
    shape:
      t.shape === "booth" ? "rectangle" : t.shape ?? "square",
    x:        (t.x ?? t.x_pos ?? 0) * 48,
    y:        (t.y ?? t.y_pos ?? 0) * 48,
    width:
      t.shape === "rectangle" || t.shape === "booth" ? 92 : 64,
    height:   t.shape === "rectangle" || t.shape === "booth" ? 44 : 64,
  }));

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-4 md:inset-8 lg:inset-16 z-50 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                <h3 className="text-base font-semibold text-gray-900">
                  Live Floor Map
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                aria-label="Close live map"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-auto p-5">
              {isLoading ? (
                <div className="w-full h-full min-h-64 bg-gray-50 rounded-xl animate-pulse" />
              ) : (
                <FloorMap
                  tables={tables}
                  branchId={branchId}
                  readOnly
                  height={480}
                />
              )}
            </div>

            {/* Legend footer */}
            <div className="px-5 py-3 border-t border-gray-100 shrink-0 bg-gray-50/50">
              <p className="text-xs text-gray-400">
                Live view refreshes every 30 seconds. This is read-only —
                use the designer above to make layout changes.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Page header skeleton ───────────────────────────────────────────────────────

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <div className="skeleton h-3 w-40 rounded" />
        <div className="skeleton h-7 w-56 rounded" />
        <div className="skeleton h-3 w-48 rounded" />
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-9 w-28 rounded-xl" />
        <div className="skeleton h-9 w-28 rounded-xl" />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OwnerFloorBranchPage({ params }: PageProps) {
  // In Next.js 14 (App Router), params is a plain object — destructure directly.
  const { branchId } = params;

  const qc = useQueryClient();
  const [showLiveMap, setShowLiveMap] = useState(false);

  // ── Branch details ────────────────────────────────────────────────────────

  const {
    data: branch,
    isLoading: branchLoading,
    isError: branchError,
  } = useQuery<Branch>({
    queryKey: ["branch", branchId],
    queryFn: () => apiClient.get<Branch>(`/branches/${branchId}`),
    enabled: !!branchId,
    staleTime: 5 * 60_000,
  });

  // ── Existing layout ────────────────────────────────────────────────────────

  const {
    data: existingLayout,
    isLoading: layoutLoading,
    isError: layoutError,
  } = useQuery<FloorLayout>({
    queryKey: ["floor-layout", "design", branchId],
    queryFn: () =>
      apiClient.get<FloorLayout>(`/floor-layout/branch/${branchId}`),
    enabled: !!branchId,
    staleTime: 30_000,
    // 404 means no layout yet — treat as null, don't throw
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
  });

  // ── Publish callback ───────────────────────────────────────────────────────

  const handlePublish = useCallback(
    (_layout: FloorLayout) => {
      // Invalidate all floor-layout queries for this branch
      qc.invalidateQueries({ queryKey: ["floor-layout", branchId] });
      qc.invalidateQueries({ queryKey: ["floor-layout", "status", branchId] });
      qc.invalidateQueries({ queryKey: ["floor-layout", "live", branchId] });
      toast.success(
        "Floor layout published! All staff will see the updated floor plan.",
        { duration: 5000 }
      );
    },
    [branchId, qc]
  );

  // ── Error state ────────────────────────────────────────────────────────────

  if (branchError) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle size={24} className="text-red-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-800">
              Branch not found
            </p>
            <p className="text-sm text-gray-500 mt-1">
              This branch may have been deleted or you don't have access.
            </p>
          </div>
          <Link
            href="/owner/floor"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#1A3C5E] hover:text-[#152f4a] transition-colors"
          >
            <ArrowLeft size={14} /> Back to branches
          </Link>
        </div>
      </PageWrapper>
    );
  }

  // A 404 from the layout endpoint means no layout yet — treat as null.
  // layoutError will be truthy if the query threw; in that case we pass null
  // to the designer so it starts fresh.
  const resolvedLayout: FloorLayout | null =
    layoutError ? null : existingLayout ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageWrapper>
      <div className="space-y-5">
        {/* ── Page header ──────────────────────────────────────────────────── */}
        {branchLoading ? (
          <HeaderSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            {/* Left: breadcrumb + title */}
            <div className="min-w-0">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                <Link
                  href="/owner/floor"
                  className="hover:text-[#1A3C5E] transition-colors font-medium"
                >
                  Floor Layout
                </Link>
                <span>/</span>
                <span className="text-gray-600 font-medium truncate max-w-[200px]">
                  {branch?.name ?? "Branch"}
                </span>
              </nav>

              {/* Title row */}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 truncate">
                  {branch?.name ?? "Floor Designer"}
                </h1>
                <LayoutStatusChip layout={resolvedLayout} />
              </div>

              {/* Address */}
              {branch?.address && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <MapPin size={12} className="text-gray-400 shrink-0" />
                  <p className="text-sm text-gray-500 truncate">
                    {branch.address}
                  </p>
                </div>
              )}
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Back link */}
              <Link
                href="/owner/floor"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">Back</span>
              </Link>

              {/* Branch active status */}
              {branch && (
                <StatusBadge
                  status={branch.is_active ? "active" : "inactive"}
                  size="sm"
                />
              )}

              {/* View live map */}
              <button
                onClick={() => setShowLiveMap(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
              >
                <Eye size={14} />
                View Live Map
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Layout / error banner ─────────────────────────────────────── */}
        {layoutError && !layoutLoading && (
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
            <RefreshCw size={13} className="shrink-0" />
            Could not load existing layout. You can start fresh or retry later.
          </div>
        )}

        {/* ── FloorLayoutDesigner ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          // Ensure the designer fills available vertical space
          className="min-h-[680px]"
        >
          <FloorLayoutDesigner
            branchId={branchId}
            initialLayout={resolvedLayout}
            onPublish={handlePublish}
          />
        </motion.div>
      </div>

      {/* ── Live map modal ──────────────────────────────────────────────── */}
      <LiveMapModal
        branchId={branchId}
        open={showLiveMap}
        onClose={() => setShowLiveMap(false)}
      />
    </PageWrapper>
  );
}