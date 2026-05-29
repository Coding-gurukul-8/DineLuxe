"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Users, Clock, RefreshCw, UserCheck,
  AlertCircle, Search, X, TableIcon,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { QueueEntryCard } from "@/components/queue/QueueEntryCard"
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
}

interface BranchTable {
  id: string
  label: string
  capacity: number
  status: string
}

// ── Table Assign Modal ─────────────────────────────────────────────────────────

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
    queryFn: () =>
      apiClient.get<BranchTable[]>(`/branch/${branchId}/tables?status=free`),
    staleTime: 15_000,
  })

  const suitable = tables.filter((t) => t.capacity >= partySize)

  const { mutate: assign, isPending } = useMutation({
    mutationFn: () =>
      apiClient.patch(`/queue/${entryId}/assign-table`, { table_id: selected }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["queue"] })
      toast.success("Table assigned successfully")
      onClose()
    },
    onError: () => toast.error("Failed to assign table"),
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900">Assign Table</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Party of {partySize} · showing suitable tables
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))
          ) : suitable.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              No suitable free tables available
            </div>
          ) : (
            suitable.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition text-left",
                  selected === t.id
                    ? "border-[#1A3C5E] bg-[#1A3C5E]/5"
                    : "border-gray-100 bg-gray-50 hover:border-[#1A3C5E]/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <TableIcon size={14} className="text-gray-400" />
                  <span className="font-semibold text-gray-800 text-sm">Table {t.label}</span>
                </div>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Users size={11} /> {t.capacity} cap
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => assign()}
            disabled={!selected || isPending}
            className="flex-1 py-2.5 rounded-xl bg-[#1A3C5E] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[#15304d] transition"
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

export default function HostQueuePage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["queue"] }); toast.success("Marked as arrived") },
    onError: () => toast.error("Failed to update"),
  })

  const { mutate: markNoShow } = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/queue/${id}/no-show`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["queue"] }); toast.success("Marked as no-show") },
    onError: () => toast.error("Failed to update"),
  })

  const filtered = queue.filter(
    (e) => statusFilter === "all" || e.status === statusFilter
  )

  const waiting = queue.filter((e) => e.status === "waiting").length
  const arrived = queue.filter((e) => e.status === "arrived").length

  return (
    <>
      <PageWrapper
        title="Guest Queue"
        subtitle="Manage walk-in guests and table assignments"
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">
              Refreshes every 15s
            </span>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        }
      >
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Waiting", count: waiting, cls: "bg-gray-50 text-gray-700", dot: "bg-gray-400" },
            { label: "Arrived", count: arrived, cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
            { label: "Total",   count: queue.length, cls: "bg-[#1A3C5E]/5 text-[#1A3C5E]", dot: "bg-[#1A3C5E]" },
          ].map(({ label, count, cls, dot }) => (
            <div key={label} className={cn("rounded-xl px-4 py-3 flex items-center gap-3", cls)}>
              <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", dot)} />
              <div>
                <p className="text-2xl font-bold font-mono leading-none">{count}</p>
                <p className="text-xs font-medium mt-0.5 opacity-70">{label}</p>
              </div>
            </div>
          ))}
        </div>

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
    </>
  )
}