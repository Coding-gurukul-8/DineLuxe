"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Trash2, RefreshCw, Users, Clock,
  TrendingUp, AlertTriangle, Loader2,
  UserCheck, TableIcon, X,
} from "lucide-react"
import { toast } from "sonner"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { QueueEntryCard } from "@/components/queue/QueueEntryCard"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

interface QueueEntry {
  id: string
  queueNumber: number
  partySize: number
  customerName?: string
  status: "waiting" | "arrived" | "no-show"
  arrivedAt?: string
  estimatedWaitMinutes: number
  isGeoFenced?: boolean
  createdAt?: string
}

interface BranchTable {
  id: string
  label: string
  capacity: number
  status: string
}

// ── Assign Table Modal ─────────────────────────────────────────────────────────

function AssignTableModal({
  entryId,
  partySize,
  branchId,
  onClose,
}: {
  entryId: string
  partySize: number
  branchId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)

  const { data: tables = [], isLoading } = useQuery<BranchTable[]>({
    queryKey: ["tables", "free", branchId],
    queryFn: () => apiClient.get<BranchTable[]>(`/branch/${branchId}/tables?status=free`),
    staleTime: 15_000,
  })

  const { mutate: assign, isPending } = useMutation({
    mutationFn: () =>
      apiClient.patch(`/queue/${entryId}/assign-table`, { table_id: selected }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] })
      toast.success("Table assigned")
      onClose()
    },
    onError: () => toast.error("Failed to assign table"),
  })

  const suitable = tables.filter((t) => t.capacity >= partySize)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900">Assign Table</h3>
            <p className="text-xs text-gray-400 mt-0.5">Party of {partySize}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2 max-h-56 overflow-y-auto mb-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))
          ) : suitable.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">No suitable tables available</p>
          ) : (
            suitable.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition",
                  selected === t.id
                    ? "border-[#1A3C5E] bg-[#1A3C5E]/5"
                    : "border-gray-100 bg-gray-50 hover:border-[#1A3C5E]/30"
                )}
              >
                <span className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <TableIcon size={14} className="text-gray-400" /> Table {t.label}
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Users size={11} /> {t.capacity}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => assign()}
            disabled={!selected || isPending}
            className="flex-1 py-2.5 rounded-xl bg-[#1A3C5E] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
            Assign
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ManagerQueuePage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()
  const [confirmClear, setConfirmClear] = useState(false)
  const [assignEntry, setAssignEntry] = useState<QueueEntry | null>(null)
  const [statusFilter, setStatusFilter] = useState<"all" | "waiting" | "arrived">("all")

  const { data: queue = [], isLoading, refetch, isFetching } = useQuery<QueueEntry[]>({
    queryKey: ["queue", branchId],
    queryFn: () => apiClient.get<QueueEntry[]>(`/queue/branch/${branchId}`),
    enabled: !!branchId,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })

  const { mutate: markArrived } = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/queue/${id}/arrive`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["queue"] }); toast.success("Marked arrived") },
    onError: () => toast.error("Failed to update"),
  })

  const { mutate: markNoShow } = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/queue/${id}/no-show`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["queue"] }); toast.success("Marked no-show") },
    onError: () => toast.error("Failed to update"),
  })

  const { mutate: clearQueue, isPending: clearing } = useMutation({
    mutationFn: () => apiClient.delete(`/queue/branch/${branchId}/clear`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] })
      toast.success("Queue cleared")
      setConfirmClear(false)
    },
    onError: () => toast.error("Failed to clear queue"),
  })

  // ── Stats ──────────────────────────────────────────────────────────────────

  const waiting = queue.filter((e) => e.status === "waiting")
  const arrived = queue.filter((e) => e.status === "arrived")

  const avgWait = waiting.length
    ? Math.round(waiting.reduce((s, e) => s + e.estimatedWaitMinutes, 0) / waiting.length)
    : 0

  // Rough peak hour — find most common hour of createdAt
  const peakHour = (() => {
    if (!queue.length) return "—"
    const hours = queue
      .map((e) => e.createdAt ? new Date(e.createdAt).getHours() : null)
      .filter(Boolean) as number[]
    if (!hours.length) return "—"
    const counts: Record<number, number> = {}
    hours.forEach((h) => { counts[h] = (counts[h] ?? 0) + 1 })
    const peak = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    const h = Number(peak[0])
    return `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h < 12 ? "am" : "pm"}`
  })()

  const filtered = queue.filter(
    (e) => statusFilter === "all" || e.status === statusFilter
  )

  return (
    <>
      <PageWrapper
        title="Queue Management"
        subtitle="Live guest queue · updates every 15 seconds"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setConfirmClear(true)}
              disabled={queue.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-50 text-red-600 border border-red-100 text-sm font-semibold hover:bg-red-100 transition disabled:opacity-40"
            >
              <Trash2 size={14} /> Clear Queue
            </button>
          </div>
        }
      >
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Waiting",
              value: waiting.length,
              icon: <Users size={16} />,
              cls: "text-gray-700",
              bg: "bg-gray-50",
            },
            {
              label: "Arrived",
              value: arrived.length,
              icon: <UserCheck size={16} />,
              cls: "text-emerald-700",
              bg: "bg-emerald-50",
            },
            {
              label: "Avg Wait",
              value: `${avgWait}m`,
              icon: <Clock size={16} />,
              cls: "text-[#1A3C5E]",
              bg: "bg-[#1A3C5E]/5",
            },
            {
              label: "Peak Hour",
              value: peakHour,
              icon: <TrendingUp size={16} />,
              cls: "text-[#E8A020]",
              bg: "bg-[#E8A020]/8",
            },
          ].map(({ label, value, icon, cls, bg }) => (
            <div
              key={label}
              className={cn("rounded-xl px-4 py-3 flex items-center gap-3", bg)}
            >
              <div className={cn("shrink-0", cls)}>{icon}</div>
              <div>
                <p className="text-2xl font-bold font-mono text-gray-900 leading-none">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Alert if long wait */}
        {avgWait >= 20 && waiting.length > 0 && (
          <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <AlertTriangle size={15} className="shrink-0" />
            Average wait time exceeds 20 minutes — consider opening additional seating.
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {(["all", "waiting", "arrived"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold capitalize transition",
                statusFilter === f
                  ? "bg-[#1A3C5E] text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
              )}
            >
              {f} {f !== "all" && `(${queue.filter((e) => e.status === f).length})`}
            </button>
          ))}
        </div>

        {/* Queue cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Users size={28} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium">Queue is empty</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((entry) => (
                <QueueEntryCard
                  key={entry.id}
                  entry={entry}
                  onMarkArrived={markArrived}
                  onAssignTable={() => setAssignEntry(entry)}
                  onMarkNoShow={markNoShow}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </PageWrapper>

      {/* Assign modal */}
      <AnimatePresence>
        {assignEntry && (
          <AssignTableModal
            entryId={assignEntry.id}
            partySize={assignEntry.partySize}
            branchId={branchId!}
            onClose={() => setAssignEntry(null)}
          />
        )}
      </AnimatePresence>

      {/* Clear confirm */}
      <ConfirmDialog
        isOpen={confirmClear}
        title="Clear Entire Queue"
        message={`This will remove all ${queue.length} entries from the queue. This action cannot be undone.`}
        confirmLabel={clearing ? "Clearing…" : "Yes, Clear Queue"}
        variant="danger"
        onConfirm={() => clearQueue()}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  )
}