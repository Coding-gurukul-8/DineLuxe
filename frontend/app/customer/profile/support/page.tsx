"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, Plus, Send, ChevronDown, MessageSquare,
  Loader2, X, CheckCircle2, Clock, AlertCircle,
  RotateCcw, RefreshCw, IndianRupee, Timer, Calendar,
  ExternalLink,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiClient } from "@/lib/api-client";
import { formatDateTime, cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING TICKET TYPES  (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

type TicketStatus = "open" | "in_progress" | "resolved";
type TicketCategory = "order_issue" | "billing" | "other";
interface TicketMessage { id: string; sender: "customer" | "support"; message: string; created_at: string; }
interface Ticket { id: string; subject: string; category: TicketCategory; status: TicketStatus; created_at: string; messages?: TicketMessage[]; }

const STATUS_CONFIG: Record<TicketStatus, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  open:        { label: "Open",        icon: AlertCircle,  bg: "bg-blue-50",   text: "text-blue-500"    },
  in_progress: { label: "In Progress", icon: Clock,        bg: "bg-amber-50",  text: "text-[#E8A020]"   },
  resolved:    { label: "Resolved",    icon: CheckCircle2, bg: "bg-green-50",  text: "text-green-500"   },
};
function StatusBadge({ status }: { status: TicketStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full", cfg.bg, cfg.text)}><Icon size={10} />{cfg.label}</span>;
}
const CATEGORY_LABELS: Record<TicketCategory, string> = { order_issue: "Order Issue", billing: "Billing", other: "Other" };

// ─────────────────────────────────────────────────────────────────────────────
// REFUND TRACKER TYPES  (new)
// ─────────────────────────────────────────────────────────────────────────────

type RefundStage = "submitted" | "under_review" | "approved" | "rejected";

interface RefundStatusItem {
  order_id:         string;
  restaurant_name:  string;
  amount:           number;
  stage:            RefundStage;
  requested_at:     string | null;
  last_updated:     string | null;
  estimated_days:   number | null;
  rejection_reason: string | null;
  ticket_id:        string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE INDICATOR  (4-step horizontal progress)
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_STEPS: { key: string; label: string }[] = [
  { key: "submitted",    label: "Submitted"   },
  { key: "under_review", label: "Under Review" },
  { key: "processed",    label: "Processed"   },
  { key: "credited",     label: "Credited"    },
];

function stageIndex(stage: RefundStage): number {
  switch (stage) {
    case "submitted":    return 0;
    case "under_review": return 1;
    case "approved":     return 3;
    case "rejected":     return 2;   // stops at "Processed" step, shown in red
    default:             return 0;
  }
}

function StageIndicator({ stage }: { stage: RefundStage }) {
  const active   = stageIndex(stage);
  const rejected = stage === "rejected";

  return (
    <div className="flex items-start w-full py-3" role="list" aria-label="Refund progress">
      {STAGE_STEPS.map((step, i) => {
        const isDone     = i < active;
        const isCurrent  = i === active;
        const isRejected = rejected && i === 2;

        // Dot colours
        let dotCls = "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all shrink-0 ";
        if (isRejected) {
          dotCls += "bg-red-500 border-red-500 text-white";
        } else if (isDone) {
          dotCls += "bg-green-500 border-green-500 text-white";
        } else if (isCurrent) {
          dotCls += stage === "submitted"
            ? "bg-amber-400 border-amber-400 text-white"
            : stage === "under_review"
            ? "bg-blue-500 border-blue-500 text-white"
            : "bg-green-500 border-green-500 text-white";
        } else {
          dotCls += "bg-gray-100 border-gray-200 text-gray-400";
        }

        // Label colours
        let labelCls = "text-[9px] font-semibold mt-1 text-center leading-tight w-14 ";
        if (isRejected)     labelCls += "text-red-500";
        else if (isDone)    labelCls += "text-green-600";
        else if (isCurrent) {
          labelCls += stage === "submitted" ? "text-amber-600"
            : stage === "under_review"      ? "text-blue-600"
            : "text-green-600";
        } else {
          labelCls += "text-gray-400";
        }

        // Connector line
        let lineCls = "flex-1 h-0.5 mx-1 mt-3 transition-all ";
        if      (rejected && i === 1) lineCls += "bg-red-200";
        else if (i < active)          lineCls += "bg-green-400";
        else                          lineCls += "bg-gray-200";

        const dotLabel = isRejected ? "✕" : isDone ? "✓" : String(i + 1);
        const stepLabel = isRejected ? "Declined" : step.label;

        return (
          <div key={step.key} className="flex items-start flex-1">
            <div className="flex flex-col items-center" role="listitem">
              <div className={dotCls} aria-current={isCurrent ? "step" : undefined}>{dotLabel}</div>
              <span className={labelCls}>{stepLabel}</span>
            </div>
            {i < STAGE_STEPS.length - 1 && <div className={lineCls} />}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REFUND CARD
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_BADGE: Record<RefundStage, { label: string; bg: string; text: string }> = {
  submitted:    { label: "Submitted",    bg: "bg-amber-50",  text: "text-amber-700"  },
  under_review: { label: "Under Review", bg: "bg-blue-50",   text: "text-blue-700"   },
  approved:     { label: "Approved",     bg: "bg-green-50",  text: "text-green-700"  },
  rejected:     { label: "Declined",     bg: "bg-red-50",    text: "text-red-700"    },
};

function RefundCard({ refund }: { refund: RefundStatusItem }) {
  const badge      = STAGE_BADGE[refund.stage];
  const isApproved = refund.stage === "approved";
  const isRejected = refund.stage === "rejected";
  const isPending  = !isApproved && !isRejected;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{refund.restaurant_name}</p>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Calendar size={10} />
            {formatShortDate(refund.requested_at)}
            <span className="text-gray-300 mx-1">·</span>
            <span className="font-mono text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
              #{refund.order_id.slice(-8).toUpperCase()}
            </span>
          </p>
        </div>
        <span className={cn("shrink-0 text-[10px] font-bold px-2 py-1 rounded-full", badge.bg, badge.text)}>
          {badge.label}
        </span>
      </div>

      {/* Stage progress */}
      <div className="px-4">
        <StageIndicator stage={refund.stage} />
      </div>

      {/* Amount + meta */}
      <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3">
        {/* Amount row */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Refund amount</span>
          <span className={cn("font-bold text-sm flex items-center gap-0.5", isApproved ? "text-green-600" : "text-gray-400")}>
            <IndianRupee size={12} />{refund.amount.toFixed(2)}
          </span>
        </div>

        {/* Estimated days — pending only */}
        {isPending && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Timer size={11} />Estimated
            </span>
            <span className="text-xs text-gray-600 font-medium">3–5 business days</span>
          </div>
        )}

        {/* Rejection reason */}
        {isRejected && refund.rejection_reason && (
          <div className="bg-red-50 rounded-xl px-3 py-2 border border-red-100">
            <p className="text-[10px] text-red-500 font-semibold">Reason</p>
            <p className="text-xs text-red-500 mt-0.5 leading-relaxed">{refund.rejection_reason}</p>
          </div>
        )}

        {/* Footer: updated + contact support */}
        <div className="flex items-center justify-between pt-0.5">
          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <Clock size={10} />Updated {timeAgo(refund.last_updated)}
          </p>
          <button
            onClick={() => {/* deep-link handled by router in parent */}}
            className="text-[10px] text-[#E8A020] font-bold flex items-center gap-0.5 hover:underline"
            aria-label="Contact support about this refund"
          >
            Contact Support <ExternalLink size={10} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REFUND TRACKER SECTION
// ─────────────────────────────────────────────────────────────────────────────

function RefundTracker() {
  const { data: refunds = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["customer", "refunds"],
    queryFn: () => apiClient.get<RefundStatusItem[]>("/payments/my-refunds"),
  });

  // Loading — 3 skeleton cards matching the ticket skeleton style
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 animate-pulse shadow-sm">
            <div className="flex justify-between">
              <div className="space-y-1.5">
                <div className="h-3.5 w-32 bg-gray-200 rounded-full" />
                <div className="h-2.5 w-20 bg-gray-100 rounded-full" />
              </div>
              <div className="h-5 w-16 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center gap-1">
              {[0,1,2,3].map(i => (
                <div key={i} className="flex items-center gap-1 flex-1">
                  <div className="w-6 h-6 rounded-full bg-gray-200 shrink-0" />
                  {i < 3 && <div className="flex-1 h-0.5 bg-gray-100" />}
                </div>
              ))}
            </div>
            <div className="h-2.5 w-40 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <AlertCircle size={36} className="text-red-300" />
        <p className="text-sm text-gray-600 font-medium">Failed to load refund requests</p>
        <button onClick={() => refetch()} className="text-xs text-[#E8A020] font-semibold underline underline-offset-2">
          Try again
        </button>
      </div>
    );
  }

  // Empty state
  if (refunds.length === 0) {
    return (
      <EmptyState
        icon={<div className="text-4xl">🎉</div>}
        title="No refund requests"
        message="No refund requests. All your orders look good!"
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Refresh row */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-400">{refunds.length} request{refunds.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={11} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
      <AnimatePresence>
        {refunds.map((r) => (
          <RefundCard key={r.order_id} refund={r} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING: TicketThread  (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function TicketThread({ ticket }: { ticket: Ticket }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const { data: detail, isLoading } = useQuery({
    queryKey: ["customer", "support", ticket.id],
    queryFn: () => apiClient.get<Ticket>(`/support/${ticket.id}`),
  });
  const { mutate: sendReply, isPending } = useMutation({
    mutationFn: () => apiClient.post(`/support/${ticket.id}/reply`, { message: reply }),
    onSuccess: () => { toast.success("Reply sent!"); setReply(""); qc.invalidateQueries({ queryKey: ["customer", "support", ticket.id] }); },
    onError: () => toast.error("Could not send reply."),
  });
  const messages = detail?.messages ?? ticket.messages ?? [];

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ type: "spring", stiffness: 280, damping: 28 }} className="overflow-hidden">
      <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {isLoading ? [1,2].map((n) => <div key={n} className="flex gap-2"><div className="w-7 h-7 rounded-full bg-gray-100 animate-pulse shrink-0" /><div className="flex-1 h-12 bg-gray-100 rounded-xl animate-pulse" /></div>) :
            messages.length === 0 ? <p className="text-xs text-gray-400 text-center py-3">No messages yet.</p> :
            messages.map((msg) => {
              const isSupport = msg.sender === "support";
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-2", isSupport ? "flex-row" : "flex-row-reverse")}>
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold", isSupport ? "bg-[#1A3C5E] text-white" : "bg-[#E8A020] text-white")}>{isSupport ? "S" : "Y"}</div>
                  <div className={cn("max-w-[80%] px-3 py-2 rounded-2xl text-sm", isSupport ? "bg-gray-100 text-gray-800 rounded-tl-none" : "bg-[#1A3C5E] text-white rounded-tr-none")}>
                    <p>{msg.message}</p>
                    <p className={cn("text-[10px] mt-1", isSupport ? "text-gray-400" : "text-white/50")}>{formatDateTime(msg.created_at)}</p>
                  </div>
                </motion.div>
              );
            })}
        </div>
        {ticket.status !== "resolved" ? (
          <div className="flex gap-2">
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply…" rows={2} className="flex-1 text-sm bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#E8A020]/40 resize-none" />
            <motion.button whileTap={{ scale: 0.9 }} disabled={!reply.trim() || isPending} onClick={() => sendReply()} className={cn("w-10 rounded-xl flex items-center justify-center shrink-0", reply.trim() ? "bg-[#E8A020] text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed")}>
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </motion.button>
          </div>
        ) : <p className="text-xs text-center text-gray-400">This ticket is resolved. Open a new one if you need more help.</p>}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING: TicketCard  (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function TicketCard({ ticket }: { ticket: Ticket }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button onClick={() => setExpanded((v) => !v)} className="w-full text-left px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 text-sm truncate">{ticket.subject}</p>
            <p className="text-xs text-gray-400 mt-0.5">{CATEGORY_LABELS[ticket.category] ?? ticket.category} · {formatDateTime(ticket.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={ticket.status} />
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={16} className="text-gray-400" /></motion.div>
          </div>
        </div>
      </button>
      <AnimatePresence>{expanded && <TicketThread ticket={ticket} />}</AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING: NewTicketSheet  (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES: { value: TicketCategory; label: string }[] = [{ value: "order_issue", label: "Order Issue" }, { value: "billing", label: "Billing" }, { value: "other", label: "Other" }];

function NewTicketSheet({ open, onClose, onSubmit, loading }: { open: boolean; onClose: () => void; onSubmit: (data: { subject: string; category: TicketCategory; message: string }) => void; loading: boolean }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("order_issue");
  const [message, setMessage] = useState("");
  const canSubmit = subject.trim() && message.trim();
  const handleSubmit = () => { if (!canSubmit) return; onSubmit({ subject: subject.trim(), category, message: message.trim() }); setSubject(""); setCategory("order_issue"); setMessage(""); };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/40 z-40" />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="fixed bottom-0 left-0 right-0 z-50 bg-[#FAF7F4] rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-5" />
            <div className="px-5 pb-10 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">New Support Ticket</h2>
                <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X size={16} className="text-gray-600" /></motion.button>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Category</label>
                <div className="flex gap-2">
                  {CATEGORIES.map(({ value, label }) => (
                    <button key={value} type="button" onClick={() => setCategory(value)} className={cn("flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all", category === value ? "border-[#E8A020] bg-[#E8A020] text-white" : "border-gray-200 text-gray-600 bg-white")}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Briefly describe your issue…" className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A020]/40" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1.5">Message</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue in detail…" rows={4} className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A020]/40 resize-none" />
              </div>
              <motion.button whileTap={{ scale: 0.97 }} disabled={!canSubmit || loading} onClick={handleSubmit} className={cn("w-full py-4 rounded-2xl font-bold text-white text-sm shadow-lg", canSubmit ? "bg-[#E8A020] shadow-[#E8A020]/30" : "bg-gray-200 cursor-not-allowed")}>
                {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Submitting…</span> : "Submit Ticket"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE  — tab bar added: Tickets | Refunds
// ─────────────────────────────────────────────────────────────────────────────

type PageTab = "tickets" | "refunds";

export default function SupportPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const qc           = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  // Honour ?tab=refunds deep-link (from profile page "Refunds" card)
  const initialTab = searchParams.get("tab") as PageTab | null;
  const [activeTab, setActiveTab] = useState<PageTab>(
    initialTab === "refunds" ? "refunds" : "tickets",
  );

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["customer", "support"],
    queryFn: () => apiClient.get<Ticket[]>("/support/me"),
  });

  const { mutate: createTicket, isPending } = useMutation({
    mutationFn: (data: { subject: string; category: TicketCategory; message: string }) =>
      apiClient.post<Ticket>("/support", data),
    onSuccess: () => {
      toast.success("Ticket created! We'll get back to you soon.");
      qc.invalidateQueries({ queryKey: ["customer", "support"] });
      setShowNew(false);
    },
    onError: () => toast.error("Could not create ticket."),
  });

  const open       = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;
  const resolved   = tickets.filter((t) => t.status === "resolved").length;

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">

      {/* ── Hero header (existing design unchanged) ── */}
      <div className="bg-linear-to-br from-[#1A3C5E] to-[#0D2A45] px-4 pt-12 pb-6 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-[#E8A020]/10" />

        <div className="relative flex items-center gap-3 mb-5">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
            <ChevronLeft size={18} className="text-white" />
          </motion.button>
          <div>
            <p className="text-[#E8A020] text-xs font-semibold uppercase tracking-widest">Profile</p>
            <h1 className="text-white font-bold text-xl">Support</h1>
          </div>
          {/* Plus button only relevant for tickets tab */}
          {activeTab === "tickets" && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowNew(true)} className="ml-auto w-9 h-9 rounded-full bg-[#E8A020] flex items-center justify-center shadow-lg">
              <Plus size={18} className="text-white" />
            </motion.button>
          )}
        </div>

        {/* Stat pills — tickets tab only */}
        {activeTab === "tickets" && (
          <div className="relative grid grid-cols-3 gap-2">
            {[
              { label: "Open",        value: open,       color: "text-blue-300"    },
              { label: "In Progress", value: inProgress, color: "text-[#E8A020]"  },
              { label: "Resolved",    value: resolved,   color: "text-green-400"  },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/10 rounded-xl px-3 py-2 text-center">
                <p className={cn("text-xl font-black", color)}>{value}</p>
                <p className="text-white/50 text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Refund tab header pill */}
        {activeTab === "refunds" && (
          <div className="relative bg-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
            <RotateCcw size={18} className="text-[#E8A020]" />
            <div>
              <p className="text-white font-bold text-sm">Refund Requests</p>
              <p className="text-white/50 text-[10px]">Track the status of your refunds</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      <div className="bg-white border-b border-gray-100 px-4 flex gap-0">
        {(["tickets", "refunds"] as PageTab[]).map((tab) => (
          <button
            key={tab}
            id={tab === "refunds" ? "refunds" : undefined}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-3.5 text-sm font-bold border-b-2 transition-all duration-150",
              activeTab === tab
                ? "border-[#E8A020] text-[#E8A020]"
                : "border-transparent text-gray-400 hover:text-gray-600",
            )}
          >
            {tab === "tickets"
              ? <><MessageSquare size={14} />Tickets</>
              : <><RotateCcw size={14} />Refunds</>
            }
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="px-4 mt-5 space-y-3">
        <AnimatePresence mode="wait">
          {activeTab === "tickets" && (
            <motion.div key="tickets" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.15 }}>
              {isLoading
                ? [1,2,3].map((n) => <div key={n} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100 mb-3" />)
                : tickets.length === 0
                  ? <EmptyState icon={<MessageSquare size={32} className="text-gray-300" />} title="No support tickets" message="Having an issue? Open a new ticket and we'll help." action={{ label: "New Ticket", onClick: () => setShowNew(true) }} />
                  : (
                    <>
                      <AnimatePresence>
                        {tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}
                      </AnimatePresence>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setShowNew(true)}
                        className="w-full py-4 rounded-2xl border-2 border-dashed border-[#E8A020]/40 text-[#E8A020] font-semibold text-sm flex items-center justify-center gap-2 mt-2"
                      >
                        <Plus size={18} />New Support Ticket
                      </motion.button>
                    </>
                  )
              }
            </motion.div>
          )}

          {activeTab === "refunds" && (
            <motion.div key="refunds" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.15 }}>
              <RefundTracker />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <NewTicketSheet open={showNew} onClose={() => setShowNew(false)} onSubmit={createTicket} loading={isPending} />
    </div>
  );
}