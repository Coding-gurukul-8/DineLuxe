"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, Users, Clock, Loader2, LogOut, Minus, Plus, Wifi, CheckCircle2, Timer, UserCheck, Hourglass, WifiOff } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { QueueEntry } from "@/types/api";

const QUEUE_STORAGE_KEY = "dineluxe_queue_id";
function getStoredQueueId(): string | null { if (typeof window === "undefined") return null; return localStorage.getItem(QUEUE_STORAGE_KEY); }
function setStoredQueueId(id: string) { localStorage.setItem(QUEUE_STORAGE_KEY, id); }
function clearStoredQueueId() { localStorage.removeItem(QUEUE_STORAGE_KEY); }

function WaitRing({ position, estimatedWait }: { position: number; estimatedWait?: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, ((20 - position) / 20) * 100));
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
        <circle cx="72" cy="72" r={r} stroke="#F3F4F6" strokeWidth="12" fill="none" />
        <motion.circle cx="72" cy="72" r={r} stroke="#E8A020" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4, type: "spring", stiffness: 260 }} className="text-4xl font-black text-[#1A3C5E] tabular-nums leading-none">#{position}</motion.p>
        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">in queue</p>
        {estimatedWait != null && <p className="text-xs font-bold text-[#E8A020] mt-1">~{estimatedWait}m wait</p>}
      </div>
    </div>
  );
}

type StepStatus = "done" | "active" | "pending";
function QueueStep({ icon: Icon, label, status }: { icon: React.ElementType; label: string; status: StepStatus }) {
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all", status === "done" ? "bg-green-100" : status === "active" ? "bg-[#E8A020] shadow-md shadow-[#E8A020]/30" : "bg-gray-100")}>
        <Icon size={16} className={cn(status === "done" ? "text-green-500" : status === "active" ? "text-white" : "text-gray-300")} />
      </div>
      <p className={cn("text-xs font-semibold", status === "active" ? "text-gray-900" : "text-gray-400")}>{label}</p>
    </div>
  );
}
function getStepStatus(queueStatus: string, stepKey: "waiting" | "arrived" | "seated"): StepStatus {
  const order = ["waiting", "arrived", "seated"];
  const current = order.indexOf(queueStatus);
  const step = order.indexOf(stepKey);
  if (current > step) return "done";
  if (current === step) return "active";
  return "pending";
}

function PartySizeSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-6">
      <motion.button whileTap={{ scale: 0.85 }} onClick={() => onChange(Math.max(1, value - 1))} className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"><Minus size={18} className="text-gray-700" /></motion.button>
      <AnimatePresence mode="wait">
        <motion.span key={value} initial={{ opacity: 0, y: -10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.8 }} transition={{ type: "spring", stiffness: 400, damping: 22 }} className="text-5xl font-black text-[#1A3C5E] w-16 text-center tabular-nums">{value}</motion.span>
      </AnimatePresence>
      <motion.button whileTap={{ scale: 0.85 }} onClick={() => onChange(Math.min(10, value + 1))} className="w-12 h-12 rounded-full bg-[#E8A020] flex items-center justify-center shadow-md"><Plus size={18} className="text-white" /></motion.button>
    </div>
  );
}

export default function QueuePage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [partySize, setPartySize] = useState(2);
  const [queueId, setQueueId] = useState<string | null>(getStoredQueueId);

  const { data: queueEntry, isLoading: queueLoading, isError: queueError, dataUpdatedAt } = useQuery({
    queryKey: ["customer", "queue", queueId],
    queryFn: () => apiClient.get<QueueEntry>(`/queue/${queueId}`),
    enabled: !!queueId,
    refetchInterval: 10_000,
  });

  if (queueEntry && (queueEntry.status === "no_show" || queueEntry.status === "cancelled")) {
    clearStoredQueueId();
    if (queueId) setQueueId(null);
  }

  const { mutate: joinQueue, isPending: joining } = useMutation({
    mutationFn: () => apiClient.post<QueueEntry>("/queue", { branch_id: restaurantId, people_count: partySize }),
    onSuccess: (entry) => { toast.success("You're in the queue!"); setStoredQueueId(entry.id); setQueueId(entry.id); qc.setQueryData(["customer", "queue", entry.id], entry); },
    onError: () => toast.error("Could not join queue. Please try again."),
  });

  const { mutate: leaveQueue, isPending: leaving } = useMutation({
    mutationFn: () => apiClient.delete(`/queue/${queueId}`),
    onSuccess: () => { toast.success("You've left the queue."); clearStoredQueueId(); setQueueId(null); qc.removeQueries({ queryKey: ["customer", "queue", queueId] }); },
    onError: () => toast.error("Could not leave queue."),
  });

  const isInQueue = !!queueId;
  const isSeated = queueEntry?.status === "seated";
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-24">
      <div className="bg-linear-to-br from-[#1A3C5E] to-[#0D2A45] px-4 pt-12 pb-6 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-[#E8A020]/10" />
        <div className="relative flex items-center gap-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ChevronLeft size={18} className="text-white" /></motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[#E8A020] text-xs font-semibold uppercase tracking-widest">Waitlist</p>
            <h1 className="text-white font-bold text-xl">Join Queue</h1>
          </div>
          {isInQueue && !queueError && (
            <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="w-2 h-2 rounded-full bg-green-400" />
              <Wifi size={12} className="text-white/70" />
              <span className="text-[10px] text-white/70 font-semibold">LIVE</span>
            </div>
          )}
          {isInQueue && queueError && (
            <div className="flex items-center gap-1.5 bg-red-500/20 rounded-full px-3 py-1.5">
              <WifiOff size={12} className="text-red-300" />
              <span className="text-[10px] text-red-300 font-semibold">OFFLINE</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">
        <AnimatePresence mode="wait">
          {!isInQueue ? (
            <motion.div key="join" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-[#1A3C5E]/5 flex items-center justify-center"><Users size={18} className="text-[#1A3C5E]" /></div>
                  <div><p className="font-bold text-gray-900 text-sm">Party Size</p><p className="text-xs text-gray-400">How many people?</p></div>
                </div>
                <PartySizeSelector value={partySize} onChange={setPartySize} />
                <p className="text-center text-xs text-gray-400 mt-4">{partySize === 1 ? "Just you" : `Party of ${partySize}`}</p>
              </div>
              <div className="bg-[#E8A020]/5 border border-[#E8A020]/20 rounded-2xl p-4 space-y-2">
                {[{ icon: Timer, text: "You'll get a live queue position instantly" }, { icon: Wifi, text: "Status auto-updates every 10 seconds" }, { icon: UserCheck, text: "We'll notify you when your table is ready" }].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-xs text-gray-600"><Icon size={14} className="text-[#E8A020] shrink-0" /><span>{text}</span></div>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => joinQueue()} disabled={joining} className="w-full py-4 rounded-2xl font-bold text-white text-base bg-[#E8A020] shadow-lg shadow-[#E8A020]/30">
                {joining ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" />Joining…</span> : <span className="flex items-center justify-center gap-2"><Users size={18} />Join Queue</span>}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="status" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              {queueLoading && !queueEntry ? (
                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="text-[#E8A020] animate-spin" /></div>
              ) : isSeated ? (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-green-50 border border-green-100 rounded-2xl p-8 flex flex-col items-center text-center">
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: 3, duration: 0.5 }}><CheckCircle2 size={56} className="text-green-500 mb-4" /></motion.div>
                  <h2 className="text-xl font-black text-gray-900 mb-1">Your table is ready! 🎉</h2>
                  <p className="text-sm text-gray-500">Please proceed to the host stand.</p>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => { clearStoredQueueId(); setQueueId(null); }} className="mt-6 w-full py-3 rounded-2xl bg-green-500 text-white font-bold text-sm">Done — Remove from Queue</motion.button>
                </motion.div>
              ) : (
                <>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex flex-col items-center gap-4">
                      <WaitRing position={queueEntry?.position ?? 0} estimatedWait={queueEntry?.estimated_wait_minutes} />
                      <div className="w-full flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-600"><Users size={14} className="text-[#E8A020]" /><span>Party of <span className="font-bold text-gray-900">{queueEntry?.people_count ?? partySize}</span></span></div>
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs"><Clock size={12} /><span>Updated {lastUpdated}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Status</p>
                    <div className="flex items-center gap-2">
                      <QueueStep icon={Hourglass} label="Waiting" status={getStepStatus(queueEntry?.status ?? "waiting", "waiting")} />
                      <div className={cn("h-0.5 w-8 rounded-full shrink-0", (queueEntry?.status === "arrived" || queueEntry?.status === "seated") ? "bg-[#E8A020]" : "bg-gray-200")} />
                      <QueueStep icon={UserCheck} label="Arrived" status={getStepStatus(queueEntry?.status ?? "waiting", "arrived")} />
                      <div className={cn("h-0.5 w-8 rounded-full shrink-0", queueEntry?.status === "seated" ? "bg-[#E8A020]" : "bg-gray-200")} />
                      <QueueStep icon={CheckCircle2} label="Seated" status={getStepStatus(queueEntry?.status ?? "waiting", "seated")} />
                    </div>
                  </div>
                  {queueEntry?.status && (
                    <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3">
                      <span className="text-sm text-gray-600 font-medium">Current status</span>
                      <StatusBadge status={queueEntry.status} />
                    </div>
                  )}
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => leaveQueue()} disabled={leaving} className="w-full py-3.5 rounded-2xl border-2 border-red-200 text-red-500 font-semibold text-sm flex items-center justify-center gap-2">
                    {leaving ? <Loader2 size={16} className="animate-spin" /> : <><LogOut size={16} />Leave Queue</>}
                  </motion.button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}