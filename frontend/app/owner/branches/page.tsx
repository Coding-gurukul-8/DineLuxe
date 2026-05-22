"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Plus,
  Pencil,
  Eye,
  MapPin,
  Users,
  ShoppingBag,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { handleApiError } from "@/lib/handle-error";
import PageWrapper from "@/components/layout/PageWrapper";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface BranchManager { id: string; name: string }
interface Branch {
  id: string; name: string; address: string;
  lat: number | null; lon: number | null;
  is_active: boolean;
  operating_hours: Record<string, unknown> | null;
  manager: BranchManager | null;
  created_at: string; updated_at: string;
}
interface LiveStats {
  tables: Record<string, number>;
  total_tables: number; active_orders: number;
  staff_on_duty: number; revenue_today: number;
}
type BranchStatusInput = "active" | "closed" | "temporarily_closed";

function BranchLiveStats({ branchId }: { branchId: string }) {
  const { data, isLoading } = useQuery<LiveStats>({
    queryKey: ["branch-live-stats", branchId],
    queryFn: () => apiClient.get<LiveStats>(`/branches/${branchId}/live-stats`),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
        {[1,2,3].map(i => (
          <div key={i} className="h-6 w-20 rounded-full bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }
  if (!data) return null;

  const occupied = data.tables?.occupied ?? 0;

  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-[#1A3C5E]/8 text-[#1A3C5E] rounded-full">
        <Users size={11} />
        {occupied}/{data.total_tables} tables
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-[#E8A020]/10 text-[#E8A020] rounded-full">
        <ShoppingBag size={11} />
        {data.active_orders} orders
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full">
        {formatCurrency(data.revenue_today)} today
      </span>
    </div>
  );
}

function StatusDot({ isActive }: { isActive: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {isActive && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
      )}
      <span
        className={cn(
          "relative inline-flex rounded-full h-2.5 w-2.5",
          isActive ? "bg-emerald-500" : "bg-gray-300"
        )}
      />
    </span>
  );
}

function BranchCard({
  branch,
  idx,
  onToggle,
  isToggling,
}: {
  branch: Branch;
  idx: number;
  onToggle: (id: string, current: boolean) => void;
  isToggling: boolean;
}) {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.07, duration: 0.4 }}
      whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(26,60,94,0.10)" }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow duration-200"
    >
      <div
        className={cn(
          "h-1",
          branch.is_active
            ? "bg-linear-to-r from-emerald-400 to-emerald-500"
            : "bg-linear-to-r from-gray-200 to-gray-300"
        )}
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <StatusDot isActive={branch.is_active} />
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{branch.name}</h3>
              {branch.address && (
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                  <MapPin size={10} />
                  {branch.address}
                </p>
              )}
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.92 }}
            disabled={isToggling}
            onClick={() => onToggle(branch.id, branch.is_active)}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
            title={branch.is_active ? "Deactivate branch" : "Activate branch"}
          >
            {branch.is_active
              ? <ToggleRight size={22} className="text-emerald-500" />
              : <ToggleLeft size={22} />
            }
          </motion.button>
        </div>

        {branch.manager && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
            <Users size={11} className="text-gray-400" />
            Manager: {branch.manager.name}
          </p>
        )}

        <BranchLiveStats branchId={branch.id} />

        <div className="flex gap-2 mt-4">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => router.push(`/owner/branches/${branch.id}`)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[#1A3C5E]/8 text-[#1A3C5E] hover:bg-[#1A3C5E]/12 transition-colors"
          >
            <Eye size={13} /> View
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => router.push(`/owner/branches/${branch.id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Pencil size={13} /> Edit
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function AddBranchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className="bg-white rounded-2xl border border-[#1A3C5E]/20 shadow-sm p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Add New Branch</h3>
              <button
                onClick={onClose}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Fill in the branch details to set up a new location.
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/owner/branches/new")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1A3C5E] text-white text-sm font-medium hover:bg-[#1A3C5E]/90 transition-colors"
            >
              <ChevronRight size={15} />
              Continue to branch setup
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function BranchesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showAddPanel, setShowAddPanel] = useState(false);

  const { data: branches = [], isLoading, isError, refetch } = useQuery<Branch[]>({
    queryKey: ["owner-branches"],
    queryFn: () => apiClient.get<Branch[]>("/branches"),
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: BranchStatusInput }) =>
      apiClient.patch(`/branches/${id}/status`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["owner-branches"] });
      toast.success("Branch status updated");
    },
    onError: (err) => handleApiError(err, "Failed to update branch status"),
  });

  const handleToggle = (id: string, currentlyActive: boolean) => {
    toggleMutation.mutate({
      id,
      newStatus: currentlyActive ? "closed" : "active",
    });
  };

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Branches
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {branches.length} location{branches.length !== 1 ? "s" : ""}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowAddPanel((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#E8A020] text-white text-sm font-semibold rounded-xl shadow-sm hover:bg-[#E8A020]/90 transition-colors"
        >
          <Plus size={16} />
          Add Branch
        </motion.button>
      </div>

      <AddBranchPanel open={showAddPanel} onClose={() => setShowAddPanel(false)} />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} variant="card" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 gap-3 text-gray-400">
          <p className="text-sm">Failed to load branches</p>
          <button onClick={() => refetch()} className="text-sm text-[#1A3C5E] flex items-center gap-1 hover:underline">
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ) : branches.length === 0 ? (
        <EmptyState
          icon={<Building2 size={32} />}
          title="No branches yet"
          description="Add your first branch to get started."
          action={{
            label: "Create your first branch",
            onClick: () => router.push("/owner/branches/new"),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {branches.map((branch, idx) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              idx={idx}
              onToggle={handleToggle}
              isToggling={toggleMutation.isPending}
            />
          ))}
        </div>
      )}
    </PageWrapper>
  );
}