"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, Plus, Send, ChevronDown, MessageSquare, Loader2, X, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiClient } from "@/lib/api-client";
import { formatDateTime, cn } from "@/lib/utils";

type TicketStatus = "open" | "in_progress" | "resolved";
type TicketCategory = "order_issue" | "billing" | "other";
interface TicketMessage { id: string; sender: "customer" | "support"; message: string; created_at: string; }
interface Ticket { id: string; subject: string; category: TicketCategory; status: TicketStatus; created_at: string; messages?: TicketMessage[]; }

const STATUS_CONFIG: Record<TicketStatus, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  open: { label: "Open", icon: AlertCircle, bg: "bg-blue-50", text: "text-blue-500" },
  in_progress: { label: "In Progress", icon: Clock, bg: "bg-amber-50", text: "text-[#E8A020]" },
  resolved: { label: "Resolved", icon: CheckCircle2, bg: "bg-green-50", text: "text-green-500" },
};
function StatusBadge({ status }: { status: TicketStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full", cfg.bg, cfg.text)}><Icon size={10} />{cfg.label}</span>;
}
const CATEGORY_LABELS: Record<TicketCategory, string> = { order_issue: "Order Issue", billing: "Billing", other: "Other" };

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

export default function SupportPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["customer", "support"],
    queryFn: () => apiClient.get<Ticket[]>("/support/me"),
  });

  const { mutate: createTicket, isPending } = useMutation({
    mutationFn: (data: { subject: string; category: TicketCategory; message: string }) => apiClient.post<Ticket>("/support", data),
    onSuccess: () => { toast.success("Ticket created! We'll get back to you soon."); qc.invalidateQueries({ queryKey: ["customer", "support"] }); setShowNew(false); },
    onError: () => toast.error("Could not create ticket."),
  });

  const open = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;
  const resolved = tickets.filter((t) => t.status === "resolved").length;

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">
      <div className="bg-linear-to-br from-[#1A3C5E] to-[#0D2A45] px-4 pt-12 pb-6 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-[#E8A020]/10" />
        <div className="relative flex items-center gap-3 mb-5">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ChevronLeft size={18} className="text-white" /></motion.button>
          <div>
            <p className="text-[#E8A020] text-xs font-semibold uppercase tracking-widest">Profile</p>
            <h1 className="text-white font-bold text-xl">Support</h1>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowNew(true)} className="ml-auto w-9 h-9 rounded-full bg-[#E8A020] flex items-center justify-center shadow-lg"><Plus size={18} className="text-white" /></motion.button>
        </div>
        <div className="relative grid grid-cols-3 gap-2">
          {[{ label: "Open", value: open, color: "text-blue-300" }, { label: "In Progress", value: inProgress, color: "text-[#E8A020]" }, { label: "Resolved", value: resolved, color: "text-green-400" }].map(({ label, value, color }) => (
            <div key={label} className="bg-white/10 rounded-xl px-3 py-2 text-center">
              <p className={cn("text-xl font-black", color)}>{value}</p>
              <p className="text-white/50 text-[10px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 mt-5 space-y-3">
        {isLoading ? [1,2,3].map((n) => <div key={n} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />) :
          tickets.length === 0 ? <EmptyState icon={<MessageSquare size={32} className="text-gray-300" />} title="No support tickets" message="Having an issue? Open a new ticket and we'll help." action={{ label: "New Ticket", onClick: () => setShowNew(true) }} /> :
          <AnimatePresence>{tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}</AnimatePresence>}
        {tickets.length > 0 && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowNew(true)} className="w-full py-4 rounded-2xl border-2 border-dashed border-[#E8A020]/40 text-[#E8A020] font-semibold text-sm flex items-center justify-center gap-2">
            <Plus size={18} />New Support Ticket
          </motion.button>
        )}
      </div>
      <NewTicketSheet open={showNew} onClose={() => setShowNew(false)} onSubmit={createTicket} loading={isPending} />
    </div>
  );
}