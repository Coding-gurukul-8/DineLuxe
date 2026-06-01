"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Building2,
  Calendar,
  FileText,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

import PageWrapper from "@/components/layout/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiClient } from "@/lib/api-client";
import { formatDate, cn } from "@/lib/utils";
import { RestaurantApproval, type PendingRestaurant } from "@/components/admin/RestaurantApproval";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PendingListResponse {
  data: PendingRestaurant[];
  count?: number;
}

interface ReviewedRestaurant {
  id: string;
  name: string;
  status: "active" | "rejected";
  updated_at?: string;
  approved_at?: string;
  rejected_at?: string;
  approved_by?: string;
  rejected_by?: string;
  rejection_reason?: string;
  owner?: { name?: string; email?: string } | null;
}

type TabType = "pending" | "approved_today" | "rejected";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function maskPhone(phone?: string | null): string {
  if (!phone) return "—";
  return phone.slice(0, 3) + "••••" + phone.slice(-3);
}

// ─── Application Card ──────────────────────────────────────────────────────────

function ApplicationCard({
  restaurant,
  onViewDetails,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  restaurant: PendingRestaurant;
  onViewDetails: (r: PendingRestaurant) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = () => {
    setShowApproveConfirm(false);
    onApprove(restaurant.id);
  };

  const handleReject = () => {
    if (rejectReason.trim().length < 20) return;
    setShowRejectModal(false);
    onReject(restaurant.id, rejectReason.trim());
    setRejectReason("");
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Card Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A3C5E]/10 to-[#E85D04]/10 flex items-center justify-center text-sm font-bold text-[#1A3C5E] shrink-0">
              {restaurant.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-gray-900 truncate">
                  {restaurant.name}
                </h3>
                {restaurant.cuisine_type && (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-[#1A3C5E]/6 text-[#1A3C5E] rounded-full shrink-0">
                    {restaurant.cuisine_type}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                <Clock size={10} />
                Applied {timeAgo(restaurant.created_at)}
              </p>
            </div>
          </div>

          {/* Awaiting badge */}
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-600 border border-amber-200 rounded-full shrink-0">
            Awaiting Review
          </span>
        </div>

        {/* Quick Info Row */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
              <Mail size={11} className="text-gray-400" />
            </div>
            <span className="truncate">{restaurant.owner?.email ?? "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
              <Phone size={11} className="text-gray-400" />
            </div>
            <span>{maskPhone(restaurant.owner?.phone)}</span>
          </div>
          {restaurant.gst_number && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <div className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                <FileText size={11} className="text-gray-400" />
              </div>
              <span className="font-mono truncate">{restaurant.gst_number}</span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4 border-t border-gray-50 bg-gray-50/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                    Owner Name
                  </p>
                  <p className="text-gray-800 font-medium">
                    {restaurant.owner?.name ?? "—"}
                  </p>
                </div>
                {restaurant.city && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                      City
                    </p>
                    <p className="text-gray-800">{restaurant.city}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                    GST Number
                  </p>
                  <p className="font-mono text-gray-800">
                    {restaurant.gst_number ?? "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                    Registration Date
                  </p>
                  <p className="text-gray-800">{formatDate(restaurant.created_at)}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject / Approve Confirm Inlines */}
      <AnimatePresence>
        {showApproveConfirm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4 bg-emerald-50/80 border-t border-emerald-100">
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Approve {restaurant.name}?
              </p>
              <p className="text-xs text-gray-500 mb-3">
                The owner will receive an approval email with onboarding steps.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowApproveConfirm(false)}
                  className="flex-1 px-3 py-2 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="flex-1 px-3 py-2 text-xs font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-40 transition-colors"
                >
                  {isApproving ? "Approving…" : "Yes, Approve"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
        {showRejectModal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 py-4 bg-red-50/50 border-t border-red-100">
              <p className="text-sm font-semibold text-gray-800 mb-2">
                Reason for rejection
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Describe why this application is being rejected (min 20 characters)..."
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 resize-none bg-white placeholder:text-gray-400"
              />
              <div className="flex items-center justify-between mt-2">
                <p
                  className={cn(
                    "text-xs",
                    rejectReason.trim().length < 20 ? "text-red-400" : "text-emerald-500"
                  )}
                >
                  {rejectReason.trim().length}/20 min chars
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRejectModal(false)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={rejectReason.trim().length < 20 || isRejecting}
                    className="px-4 py-1.5 text-xs font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors"
                  >
                    {isRejecting ? "Sending…" : "Send Rejection"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Actions */}
      {!showApproveConfirm && !showRejectModal && (
        <div className="px-5 py-3.5 border-t border-gray-50 bg-gray-50/30 flex items-center justify-between gap-2">
          <button
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp size={12} /> Hide Details
              </>
            ) : (
              <>
                <ChevronDown size={12} /> View Full Details
              </>
            )}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewDetails(restaurant)}
              className="px-3 py-1.5 text-xs text-[#1A3C5E] bg-[#1A3C5E]/6 hover:bg-[#1A3C5E]/10 rounded-lg font-medium transition-colors"
            >
              Full Profile
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={isRejecting || isApproving}
              className="px-3 py-1.5 text-xs text-red-600 border border-red-200 bg-white hover:bg-red-50 rounded-lg font-medium disabled:opacity-40 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => setShowApproveConfirm(true)}
              disabled={isApproving || isRejecting}
              className="px-3 py-1.5 text-xs text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg font-semibold disabled:opacity-40 transition-colors shadow-sm"
            >
              Approve
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Reviewed Table ────────────────────────────────────────────────────────────

function ReviewedRow({ r }: { r: ReviewedRestaurant }) {
  const isApproved = r.status === "active";
  const date = isApproved ? r.approved_at : r.rejected_at;

  return (
    <tr className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-4 py-3.5">
        <p className="text-sm font-medium text-gray-800">{r.name}</p>
        <p className="text-xs text-gray-400">{r.owner?.email ?? "—"}</p>
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge status={isApproved ? "active" : "rejected"} />
      </td>
      <td className="px-4 py-3.5 text-xs text-gray-500">
        {date ? formatDate(date) : "—"}
      </td>
      <td className="px-4 py-3.5 text-xs text-gray-500">
        {isApproved ? r.approved_by ?? "—" : r.rejected_by ?? "—"}
      </td>
      {!isApproved && (
        <td className="px-4 py-3.5 max-w-[200px]">
          <p className="text-xs text-gray-500 truncate" title={r.rejection_reason}>
            {r.rejection_reason ?? "—"}
          </p>
        </td>
      )}
    </tr>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AdminApprovalsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [search, setSearch] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<PendingRestaurant | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // ── Fetch pending ──────────────────────────────────────────────────────────
  const {
    data: pendingRaw,
    isLoading: loadingPending,
    isError: errorPending,
  } = useQuery<PendingListResponse>({
    queryKey: ["admin", "restaurants", "pending"],
    queryFn: () =>
      apiClient.get<PendingListResponse>("/admin/restaurants/pending?limit=100"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const pendingList: PendingRestaurant[] = useMemo(() => {
    if (!pendingRaw) return [];
    if (Array.isArray(pendingRaw)) return pendingRaw as PendingRestaurant[];
    return (pendingRaw as PendingListResponse).data ?? [];
  }, [pendingRaw]);

  // ── Fetch reviewed (approved + rejected) ──────────────────────────────────
  const { data: reviewedRaw, isLoading: loadingReviewed } = useQuery({
    queryKey: ["admin", "restaurants", "reviewed"],
    queryFn: async () => {
      const [approved, rejected] = await Promise.all([
        apiClient.get<{ data: ReviewedRestaurant[] } | ReviewedRestaurant[]>(
          "/admin/restaurants?status=active&limit=50"
        ),
        apiClient.get<{ data: ReviewedRestaurant[] } | ReviewedRestaurant[]>(
          "/admin/restaurants?status=rejected&limit=50"
        ),
      ]);
      const toArr = (v: typeof approved) =>
        Array.isArray(v) ? v : (v as any).data ?? [];
      return [
        ...toArr(approved).map((r: ReviewedRestaurant) => ({ ...r, status: "active" as const })),
        ...toArr(rejected).map((r: ReviewedRestaurant) => ({ ...r, status: "rejected" as const })),
      ] as ReviewedRestaurant[];
    },
    staleTime: 60_000,
    enabled: activeTab !== "pending",
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/admin/restaurants/${id}/approve`, {}),
    onSuccess: (_, id) => {
      toast.success("Restaurant approved! Owner has been notified.");
      qc.invalidateQueries({ queryKey: ["admin", "restaurants"] });
      if (selectedRestaurant?.id === id) setPanelOpen(false);
    },
    onError: () => toast.error("Failed to approve restaurant."),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/admin/restaurants/${id}/reject`, { reason }),
    onSuccess: (_, { id }) => {
      toast.success("Application rejected. Owner has been notified.");
      qc.invalidateQueries({ queryKey: ["admin", "restaurants"] });
      if (selectedRestaurant?.id === id) setPanelOpen(false);
    },
    onError: () => toast.error("Failed to reject application."),
  });

  // ── Filtered list for current tab ─────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredPending = useMemo(() => {
    const needle = search.toLowerCase();
    return pendingList.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.owner?.email?.toLowerCase().includes(needle) ||
        r.owner?.name?.toLowerCase().includes(needle)
    );
  }, [pendingList, search]);

  const approvedToday = useMemo(
    () =>
      (reviewedRaw ?? []).filter(
        (r) =>
          r.status === "active" &&
          r.approved_at &&
          new Date(r.approved_at) >= today
      ),
    [reviewedRaw]
  );

  const rejected = useMemo(
    () => (reviewedRaw ?? []).filter((r) => r.status === "rejected"),
    [reviewedRaw]
  );

  // ── View handler ──────────────────────────────────────────────────────────
  const handleViewDetails = (r: PendingRestaurant) => {
    setSelectedRestaurant(r);
    setPanelOpen(true);
  };

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "pending", label: "All Pending", count: pendingList.length },
    { key: "approved_today", label: "Approved Today", count: approvedToday.length },
    { key: "rejected", label: "Rejected", count: rejected.length },
  ];

  return (
    <PageWrapper>
      {/* Page Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Restaurant Applications
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Review and approve new restaurant registrations
          </p>
        </div>
        {pendingList.length > 0 && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full"
          >
            <Clock size={12} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">
              {pendingList.length} pending
            </span>
          </motion.div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100/80 rounded-xl p-1 mb-6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.key
                ? "bg-white text-[#1A3C5E] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  activeTab === tab.key
                    ? "bg-[#1A3C5E]/10 text-[#1A3C5E]"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pending Tab */}
      {activeTab === "pending" && (
        <>
          {/* Search */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 mb-5 max-w-sm">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by name, owner, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"
            />
          </div>

          {loadingPending ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-36 bg-white rounded-2xl border border-gray-100 animate-pulse"
                />
              ))}
            </div>
          ) : errorPending ? (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">
              <AlertCircle size={16} />
              Failed to load pending applications.
            </div>
          ) : filteredPending.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                <Inbox size={28} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">
                No pending applications 🎉
              </h3>
              <p className="text-sm text-gray-400">
                All restaurant applications have been reviewed.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredPending.map((r) => (
                  <ApplicationCard
                    key={r.id}
                    restaurant={r}
                    onViewDetails={handleViewDetails}
                    onApprove={(id) => approveMutation.mutate(id)}
                    onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
                    isApproving={
                      approveMutation.isPending &&
                      approveMutation.variables === r.id
                    }
                    isRejecting={
                      rejectMutation.isPending &&
                      rejectMutation.variables?.id === r.id
                    }
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* Approved Today Tab */}
      {activeTab === "approved_today" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loadingReviewed ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : approvedToday.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No approvals today yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/80">
                  <tr>
                    {["Name", "Status", "Approved At", "Approved By"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {approvedToday.map((r) => (
                    <ReviewedRow key={r.id} r={r} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rejected Tab */}
      {activeTab === "rejected" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loadingReviewed ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
          ) : rejected.length === 0 ? (
            <div className="py-16 text-center">
              <XCircle size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No rejected applications.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/80">
                  <tr>
                    {["Name", "Status", "Rejected At", "Rejected By", "Reason"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rejected.map((r) => (
                    <ReviewedRow key={r.id} r={r} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Detail Panel Slide-in */}
      <RestaurantApproval
        restaurant={selectedRestaurant}
        isOpen={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelectedRestaurant(null);
        }}
        onApprove={(id) => approveMutation.mutate(id)}
        onReject={(id, reason) => rejectMutation.mutate({ id, reason })}
        isApproving={approveMutation.isPending}
        isRejecting={rejectMutation.isPending}
      />
    </PageWrapper>
  );
}