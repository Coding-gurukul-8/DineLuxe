"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { X, Loader2, Users, Tag, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { FloorMap, type FloorTable } from "@/components/floor/FloorMap"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { useTableStatus } from "@/hooks/useTableStatus"
import { TABLE_STATUS, type TableStatus } from "@/lib/constants"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

interface DbTable {
  id: string
  label: string
  capacity: number
  x_pos: number
  y_pos: number
  shape?: string
  status: TableStatus
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toFloorTable(t: DbTable): FloorTable {
  return {
    id:       t.id,
    label:    t.label,
    capacity: t.capacity,
    x:        t.x_pos ?? 40,
    y:        t.y_pos ?? 40,
    width:    t.shape === "circle" ? 80 : 96,
    height:   t.shape === "circle" ? 80 : 64,
    shape:    (t.shape === "booth" ? "rectangle" : t.shape ?? "rectangle") as FloorTable["shape"],
    status:   t.status,
  }
}

const STATUS_OPTIONS: { value: TableStatus; label: string }[] = [
  { value: TABLE_STATUS.FREE,        label: "Available"    },
  { value: TABLE_STATUS.OCCUPIED,    label: "Occupied"     },
  { value: TABLE_STATUS.CLEANING,    label: "Cleaning"     },
  { value: TABLE_STATUS.RESERVED,    label: "Reserved"     },
  { value: TABLE_STATUS.MAINTENANCE, label: "Maintenance"  },
]

// ── Legend ─────────────────────────────────────────────────────────────────────

const LEGEND = [
  { label: "Available",   cls: "bg-emerald-500" },
  { label: "Occupied",    cls: "bg-red-500"     },
  { label: "Cleaning",    cls: "bg-amber-400"   },
  { label: "Reserved",    cls: "bg-blue-500"    },
  { label: "Maintenance", cls: "bg-gray-400"    },
]

// ── Table Sidebar ──────────────────────────────────────────────────────────────

function TableSidebar({
  table,
  currentStatus,
  onClose,
  onStatusChange,
  isSaving,
}: {
  table: FloorTable
  currentStatus: TableStatus
  onClose: () => void
  onStatusChange: (status: TableStatus) => void
  isSaving: boolean
}) {
  const [draft, setDraft] = useState<TableStatus>(currentStatus)

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 350, damping: 35 }}
      className="fixed right-0 top-0 bottom-0 z-50 bg-white w-80 shadow-2xl border-l border-gray-100 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="font-bold text-gray-900">Table {table.label}</h2>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Users size={11} /> {table.capacity} capacity
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Current status */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Current Status
          </p>
          <StatusBadge status={currentStatus} />
        </div>

        {/* Change status */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Change Status
          </p>
          <div className="space-y-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDraft(opt.value)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 transition text-left",
                  draft === opt.value
                    ? "border-[#1A3C5E] bg-[#1A3C5E]/5"
                    : "border-gray-100 bg-gray-50 hover:border-gray-200"
                )}
              >
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                {draft === opt.value && (
                  <CheckCircle2 size={14} className="text-[#1A3C5E]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table info */}
        <div className="px-4 py-3 bg-gray-50 rounded-xl space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">ID</span>
            <span className="font-mono text-gray-600">{table.id.slice(0, 8)}…</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Shape</span>
            <span className="capitalize text-gray-600">{table.shape}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Capacity</span>
            <span className="text-gray-600">{table.capacity} guests</span>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="px-5 py-4 border-t border-gray-100">
        <button
          onClick={() => onStatusChange(draft)}
          disabled={draft === currentStatus || isSaving}
          className="w-full py-2.5 rounded-xl bg-[#1A3C5E] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[#15304d] transition"
        >
          {isSaving ? (
            <><Loader2 size={14} className="animate-spin" /> Saving…</>
          ) : (
            "Update Status"
          )}
        </button>
      </div>
    </motion.div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HostFloorPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null)

  const { data: rawTables = [], isLoading } = useQuery<DbTable[]>({
    queryKey: ["floor", "tables", branchId],
    queryFn: () => apiClient.get<DbTable[]>(`/branch/${branchId}/tables`),
    enabled: !!branchId,
    staleTime: 30_000,
  })

  const { tableStatuses, setTableStatus } = useTableStatus({
    branchId: branchId!,
    role: "host",
  })

  // Merge real-time statuses into floor tables
  const floorTables: FloorTable[] = rawTables.map((t) => ({
    ...toFloorTable(t),
    status: tableStatuses[t.id] ?? t.status,
  }))

  const { mutate: changeStatus, isPending: isSaving } = useMutation({
    mutationFn: ({ tableId, status }: { tableId: string; status: TableStatus }) =>
      apiClient.patch(`/tables/${tableId}/status`, { status }),
    onSuccess: (_, { tableId, status }) => {
      setTableStatus(tableId, status)
      qc.invalidateQueries({ queryKey: ["floor", "tables", branchId] })
      toast.success("Table status updated")
      setSelectedTable(null)
    },
    onError: () => toast.error("Failed to update table status"),
  })

  const currentStatus: TableStatus =
    selectedTable
      ? (tableStatuses[selectedTable.id] ?? (selectedTable.status as TableStatus))
      : TABLE_STATUS.FREE

  return (
    <>
      <PageWrapper
        title="Floor Map"
        subtitle="Live table layout · click a table to manage it"
      >
        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {LEGEND.map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-gray-600 font-medium">
              <span className={cn("w-3 h-3 rounded-sm inline-block", cls)} />
              {label}
            </div>
          ))}
        </div>

        {/* Stats row */}
        {!isLoading && (
          <div className="flex flex-wrap gap-3">
            {Object.entries(
              floorTables.reduce<Record<string, number>>((acc, t) => {
                acc[t.status] = (acc[t.status] ?? 0) + 1
                return acc
              }, {})
            ).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-100 rounded-xl text-xs font-medium text-gray-600 shadow-sm"
              >
                <StatusBadge status={status} size="sm" />
                <span className="font-mono font-bold">{count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Floor map */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="h-130 flex items-center justify-center">
              <Loader2 size={28} className="text-gray-300 animate-spin" />
            </div>
          ) : (
            <FloorMap
              tables={floorTables}
              branchId={branchId!}
              readOnly
              height={520}
              onTableClick={(t) => setSelectedTable(t)}
            />
          )}
        </div>
      </PageWrapper>

      {/* Table sidebar */}
      <AnimatePresence>
        {selectedTable && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
              onClick={() => setSelectedTable(null)}
            />
            <TableSidebar
              table={selectedTable}
              currentStatus={currentStatus}
              onClose={() => setSelectedTable(null)}
              onStatusChange={(status) =>
                changeStatus({ tableId: selectedTable.id, status })
              }
              isSaving={isSaving}
            />
          </>
        )}
      </AnimatePresence>
    </>
  )
}