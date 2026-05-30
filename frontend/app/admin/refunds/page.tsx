"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCcw,
  AlertCircle,
  X,
  Loader2,
  ChevronDown,
  BadgeIndianRupee,
  User,
  Calendar,
  MessageSquare,
} from "lucide-react";

import PageWrapper from "@/components/layout/PageWrapper";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import { toast as sonner } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type RefundStatus = "pending" | "approved" | "rejected";

interface RefundTicket {
  id: string;               // support_ticket id
  payment_id: string;
  order_id: string;
  customer_name?: string;
  customer_email?: string;
  amount: number;
  reason: string;
  status: RefundStatus;     // derived from payment status
  ticket_status: string;    // support_ticket status
  created_at: string;
  resolved_at?: string;
}

// API returns support_tickets with refund meta embedded — we normalise here
interface RawTicket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  created_at: string;
  resolved_at?: string;
  conversation: Array<{
    sender_id: string;
    sender_role: string;
    message: string;
    created_at: string;
    meta?: {
      reference_type?: string;
      order_id?: string;
      payment_id?: string;
    };
  }>;
  user?: { name?: string; email?: string };
  payment?: { id: string; amount: number; status: string };
}

function normaliseTickets(raw: RawTicket[]): RefundTicket[] {
  return raw
    .filter((t) => {
      const meta = t.conversation?.[0]?.meta;
      return meta?.reference_type === "refund";
    })
    .map((t) => {
      const meta = t.conversation?.[0]?.meta ?? {};
      const firstMsg = t.conversation?.[0];
      const paymentStatus = t.payment?.status ?? "";

      let status: RefundStatus = "pending";
      if (paymentStatus === "refunded") status = "approved";
      else if (paymentStatus === "refund_rejected") status = "rejected";

      return {
        id: t.id,
        payment_id: meta.payment_id ?? t.payment?.id ?? "",
        order_id: meta.order_id ?? "",
        customer_name: t.user?.name,
        customer_email: t.user?.email,
        amount: t.payment?.amount ?? 0,
        reason: firstMsg?.message ?? "",
        status,
        ticket_status: t.status,
        created_at: t.created_at,
        resolved_at: t.resolved_at,
      };
    });
}

// ─── Filter Tabs ─────────────────────────────────────────────────────────────

const FILTER_TABS: { key: RefundStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────

function RefundStatusBadge({ status }: { status: RefundStatus }) {
  const cfg = {
    pending:  { label: "Pending",  icon: Clock,        cls: "bg-amber-50 text-amber-700 border-amber-200" },
    approved: { label: "Approved", icon: CheckCircle2, cls: "bg-green-50 text-green-700 border-green-200" },
    rejected: { label: "Rejected", icon: XCircle,      cls: "bg-red-50 text-red-700 border-red-200" },
  }[status];

  const Icon = cfg.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border", cfg.cls)}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ─── Process Modal ────────────────────────────────────────────────────────────

interface ProcessModalProps {
  ticket: RefundTicket;
  action: "approve" | "reject";
  onClose: () => void;
}

function ProcessModal({ ticket, action, onClose }: ProcessModalProps) {
  const [notes, setNotes] = useState("");
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      apiClient.patch(`/payments/${ticket.payment_id}/process-refund`, {
        action,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(
        action === "approve"
          ? "Refund approved and customer notified."
          : "Refund rejected and customer notified."
      );
      qc.invalidateQueries({ queryKey: ["admin", "refunds"] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to process refund.");
    },
  });

  const isApprove = action === "approve";

  return (
    <motion.div
      key="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        {/* Header */}
        <div className={cn("px-6 py-5 flex items-center justify-between", isApprove ? "bg-green-50 border-b border-green-100" : "bg-red-50 border-b border-red-100")}>
          <div className="flex items-center gap-3">
            {isApprove
              ? <CheckCircle2 size={22} className="text-green-600" />
              : <XCircle size={22} className="text-red-500" />}
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {isApprove ? "Approve Refund" : "Reject Refund"}
              </h3>
              <p className="text-xs text-gray-500">Order #{ticket.order_id.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center text-gray-500 hover:bg-white transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Customer</span>
              <span className="font-medium text-gray-800">{ticket.customer_name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Refund Amount</span>
              <span className="font-bold text-gray-900">{formatCurrency(ticket.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Reason</span>
              <span className="font-medium text-gray-700 text-right max-w-[60%]">{ticket.reason.slice(0, 60)}{ticket.reason.length > 60 ? "…" : ""}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes to customer
              <span className="font-normal text-gray-400 ml-1">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isApprove
                  ? "e.g. Your refund has been approved and will appear in 5–7 days."
                  : "e.g. After review, we were unable to approve this refund request."
              }
              rows={3}
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/25 focus:border-[#1A3C5E] resize-none placeholder:text-gray-400"
            />
          </div>

          {isApprove && (
            <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-3">
              <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Approving will update the payment status to <strong>refunded</strong> and
                send an email notification to the customer.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-colors",
              isApprove
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-500 hover:bg-red-600",
              isPending && "opacity-70 cursor-not-allowed"
            )}
          >
            {isPending
              ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
              : isApprove
              ? <><CheckCircle2 size={15} /> Approve & Notify</>
              : <><XCircle size={15} /> Reject & Notify</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Refund Row ───────────────────────────────────────────────────────────────

function RefundRow({ ticket }: { ticket: RefundTicket }) {
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState<"approve" | "reject" | null>(null);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
      >
        {/* Main Row */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left px-5 py-4 hover:bg-gray-50/60 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            {/* Left: customer + order info */}
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#1A3C5E]/10 flex items-center justify-center text-xs font-bold text-[#1A3C5E] shrink-0">
                {(ticket.customer_name ?? ticket.customer_email ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {ticket.customer_name ?? ticket.customer_email ?? "Unknown customer"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Order #{ticket.order_id.slice(-8).toUpperCase()}
                  {" · "}
                  {formatDateTime(ticket.created_at)}
                </p>
              </div>
            </div>

            {/* Right: amount + status */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{formatCurrency(ticket.amount)}</p>
              </div>
              <RefundStatusBadge status={ticket.status} />
              <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={16} className="text-gray-400" />
              </motion.div>
            </div>
          </div>
        </button>

        {/* Expanded Detail */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 pt-1 border-t border-gray-100 space-y-4">
                {/* Detail Cards */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><User size={10} /> Customer</p>
                    <p className="font-semibold text-gray-800 truncate">{ticket.customer_name ?? "—"}</p>
                    <p className="text-xs text-gray-500 truncate">{ticket.customer_email ?? "—"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><BadgeIndianRupee size={10} /> Amount</p>
                    <p className="font-bold text-gray-800">{formatCurrency(ticket.amount)}</p>
                    <p className="text-xs text-gray-500">Payment #{ticket.payment_id.slice(-8)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><MessageSquare size={10} /> Reason</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{ticket.reason || "—"}</p>
                  </div>
                </div>

                {/* Action Buttons — only for pending */}
                {ticket.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setModal("approve")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle2 size={15} />
                      Approve Refund
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setModal("reject")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-semibold hover:bg-red-100 transition-colors"
                    >
                      <XCircle size={15} />
                      Reject
                    </motion.button>
                  </div>
                )}

                {ticket.status !== "pending" && ticket.resolved_at && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar size={11} />
                    Resolved {formatDateTime(ticket.resolved_at)}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Process Modal */}
      <AnimatePresence>
        {modal && (
          <ProcessModal
            ticket={ticket}
            action={modal}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminRefundsPage() {
  const [activeFilter, setActiveFilter] = useState<RefundStatus | "all">("all");
  const [search, setSearch] = useState("");

  const { data: raw, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "refunds"],
    queryFn: () =>
      apiClient.get<RawTicket[] | { data: RawTicket[] }>(
        "/support?status=all&reference_type=refund&limit=100"
      ),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const tickets: RefundTicket[] = useMemo(() => {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : (raw as any).data ?? [];
    return normaliseTickets(list);
  }, [raw]);

  const filtered = useMemo(() => {
    let result = tickets;

    if (activeFilter !== "all") {
      result = result.filter((t) => t.status === activeFilter);
    }

    if (search.trim()) {
      const needle = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.customer_name?.toLowerCase().includes(needle) ||
          t.customer_email?.toLowerCase().includes(needle) ||
          t.order_id.toLowerCase().includes(needle) ||
          t.reason.toLowerCase().includes(needle)
      );
    }

    return result;
  }, [tickets, activeFilter, search]);

  // Stats
  const stats = useMemo(() => ({
    total:    tickets.length,
    pending:  tickets.filter((t) => t.status === "pending").length,
    approved: tickets.filter((t) => t.status === "approved").length,
    rejected: tickets.filter((t) => t.status === "rejected").length,
    totalAmount: tickets
      .filter((t) => t.status === "pending")
      .reduce((s, t) => s + t.amount, 0),
  }), [tickets]);

  return (
    <PageWrapper title="Refund Management" description="Review and process customer refund requests">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Requests",    value: stats.total,    color: "text-gray-800",   bg: "bg-gray-50" },
          { label: "Pending Review",    value: stats.pending,  color: "text-amber-700",  bg: "bg-amber-50",  bold: true },
          { label: "Approved",          value: stats.approved, color: "text-green-700",  bg: "bg-green-50" },
          { label: "Rejected",          value: stats.rejected, color: "text-red-700",    bg: "bg-red-50" },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-xl p-4 border border-gray-100", s.bg)}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={cn("text-2xl font-bold", s.color, s.bold && "text-3xl")}>{s.value}</p>
          </div>
        ))}
      </div>

      {stats.pending > 0 && (
        <div className="mb-5 flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-bold">{stats.pending} refund request{stats.pending !== 1 ? "s" : ""}</span>{" "}
            pending review · potential {formatCurrency(stats.totalAmount)} in refunds
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by customer, order ID, or reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/25 focus:border-[#1A3C5E]"
          />
        </div>

        {/* Refresh */}
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCcw size={14} className={cn(isLoading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? tickets.length
              : tickets.filter((t) => t.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border",
                activeFilter === tab.key
                  ? "bg-[#1A3C5E] text-white border-[#1A3C5E]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  activeFilter === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="bg-white rounded-xl border border-red-100 p-8 text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Failed to load refund requests</p>
          <button
            onClick={() => refetch()}
            className="mt-3 text-sm text-[#1A3C5E] font-medium hover:underline"
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-600">
            {search ? "No refund requests match your search" : "No refund requests found"}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-2 text-xs text-[#1A3C5E] hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((ticket) => (
              <RefundRow key={ticket.id} ticket={ticket} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </PageWrapper>
  );
}
