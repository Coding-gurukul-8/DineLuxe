"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Loader2, Users, CheckCircle2,
  // MERGE FEATURE ADDITION
  Link2, Link2Off, AlertTriangle, Unlink,
  // END MERGE FEATURE ADDITION
} from "lucide-react"
import { toast } from "sonner"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { FloorMap, type FloorTable, type MergedTableInfo } from "@/components/floor/FloorMap"
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

// MERGE FEATURE ADDITION ───────────────────────────────────────────────────────
/** Shape returned by POST /api/v1/tables/merge */
interface MergeApiResponse {
  id: string
  table_id_1: string
  table_id_2: string
  branch_id: string
  merged_by: string
  merged_at: string
  unmerged_at: string | null
}
// END MERGE FEATURE ADDITION ───────────────────────────────────────────────────

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

const LEGEND = [
  { label: "Available",   cls: "bg-emerald-500" },
  { label: "Occupied",    cls: "bg-red-500"     },
  { label: "Cleaning",    cls: "bg-amber-400"   },
  { label: "Reserved",    cls: "bg-blue-500"    },
  { label: "Maintenance", cls: "bg-gray-400"    },
  // MERGE FEATURE ADDITION
  { label: "Merged",      cls: "bg-[#1A3C5E]"  },
  // END MERGE FEATURE ADDITION
]

// MERGE FEATURE ADDITION ───────────────────────────────────────────────────────
/**
 * Rough adjacency check: two tables are considered adjacent when any of their
 * edges are within 30 px of each other on the canvas.
 */
function areAdjacent(a: FloorTable, b: FloorTable): boolean {
  const GAP = 30
  const aRight  = a.x + a.width
  const aBottom = a.y + a.height
  const bRight  = b.x + b.width
  const bBottom = b.y + b.height

  // Horizontal adjacency: vertical ranges overlap and left/right edges close
  const vOverlap = a.y < bBottom + GAP && aBottom + GAP > b.y
  const hClose   = Math.abs(aRight - b.x) <= GAP || Math.abs(bRight - a.x) <= GAP

  // Vertical adjacency: horizontal ranges overlap and top/bottom edges close
  const hOverlap = a.x < bRight + GAP && aRight + GAP > b.x
  const vClose   = Math.abs(aBottom - b.y) <= GAP || Math.abs(bBottom - a.y) <= GAP

  return (vOverlap && hClose) || (hOverlap && vClose)
}
// END MERGE FEATURE ADDITION ───────────────────────────────────────────────────

// ── Table Sidebar ──────────────────────────────────────────────────────────────

function TableSidebar({
  table,
  currentStatus,
  onClose,
  onStatusChange,
  isSaving,
  // MERGE FEATURE ADDITION
  mergeInfo,
  onUnmerge,
  isUnmerging,
  // END MERGE FEATURE ADDITION
}: {
  table: FloorTable
  currentStatus: TableStatus
  onClose: () => void
  onStatusChange: (status: TableStatus) => void
  isSaving: boolean
  // MERGE FEATURE ADDITION
  mergeInfo?: MergedTableInfo
  onUnmerge?: () => void
  isUnmerging?: boolean
  // END MERGE FEATURE ADDITION
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
          {/* MERGE FEATURE ADDITION: show combined label when merged */}
          <h2 className="font-bold text-gray-900">
            {mergeInfo ? `${mergeInfo.label1} + ${mergeInfo.label2}` : `Table ${table.label}`}
          </h2>
          {/* END MERGE FEATURE ADDITION */}
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Users size={11} />
            {/* MERGE FEATURE ADDITION: show combined capacity when merged */}
            {mergeInfo ? mergeInfo.combinedCapacity : table.capacity} capacity
            {/* END MERGE FEATURE ADDITION */}
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

        {/* MERGE FEATURE ADDITION: Unmerge action (shown only for merged tables) */}
        {mergeInfo && (
          <div className="px-4 py-3 bg-[#1A3C5E]/5 border border-[#1A3C5E]/15 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Link2 size={14} className="text-[#1A3C5E]" />
              <p className="text-xs font-semibold text-[#1A3C5E]">
                Merged Table — {mergeInfo.label1} + {mergeInfo.label2}
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Combined capacity: {mergeInfo.combinedCapacity} guests
            </p>
            <button
              onClick={onUnmerge}
              disabled={isUnmerging}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#1A3C5E] text-white text-xs font-semibold hover:bg-[#15304d] disabled:opacity-50 transition"
            >
              {isUnmerging ? (
                <><Loader2 size={12} className="animate-spin" /> Unmerging…</>
              ) : (
                <><Unlink size={12} /> Unmerge Tables</>
              )}
            </button>
          </div>
        )}
        {/* END MERGE FEATURE ADDITION */}

        {/* Current status */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Current Status
          </p>
          <StatusBadge status={currentStatus} />
        </div>

        {/* Change status (hidden for merged tables — status is managed by merge) */}
        {/* MERGE FEATURE ADDITION: skip status change for merged tables */}
        {!mergeInfo && (
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
        )}
        {/* END MERGE FEATURE ADDITION */}

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

      {/* Save button — hidden for merged tables */}
      {/* MERGE FEATURE ADDITION */}
      {!mergeInfo && (
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
      )}
      {/* END MERGE FEATURE ADDITION */}
    </motion.div>
  )
}

// MERGE FEATURE ADDITION ───────────────────────────────────────────────────────
/**
 * Floating action bar that appears at the bottom of the screen once
 * exactly 2 tables have been selected in merge mode.
 */
function MergeActionBar({
  table1,
  table2,
  onConfirm,
  onCancel,
  isMerging,
}: {
  table1: FloorTable
  table2: FloorTable
  onConfirm: () => void
  onCancel: () => void
  isMerging: boolean
}) {
  const adjacent = areAdjacent(table1, table2)
  const combinedCapacity = table1.capacity + table2.capacity

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 w-full max-w-lg px-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 px-5 py-4 space-y-3">
        {/* Summary line */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#1A3C5E]/10 rounded-xl">
            <Link2 size={18} className="text-[#1A3C5E]" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">
              Merge T{table1.label} + T{table2.label} → Combined Table
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Combined capacity: {combinedCapacity} guests
            </p>
          </div>
        </div>

        {/* Adjacency warning */}
        {!adjacent && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              These tables may not be adjacent. Merge anyway?
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2.5">
          <button
            onClick={onCancel}
            disabled={isMerging}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isMerging}
            className="flex-1 py-2.5 rounded-xl bg-[#1A3C5E] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#15304d] disabled:opacity-50 transition"
          >
            {isMerging ? (
              <><Loader2 size={14} className="animate-spin" /> Merging…</>
            ) : (
              <><Link2 size={14} /> Confirm Merge</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
// END MERGE FEATURE ADDITION ───────────────────────────────────────────────────

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HostFloorPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null)

  // MERGE FEATURE ADDITION ───────────────────────────────────────────────────
  const [mergeMode, setMergeMode] = useState(false)
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([])
  const [mergedTables, setMergedTables] = useState<MergedTableInfo[]>([])
  // END MERGE FEATURE ADDITION ───────────────────────────────────────────────

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

  // MERGE FEATURE ADDITION ───────────────────────────────────────────────────

  const { mutate: executeMerge, isPending: isMerging } = useMutation({
    mutationFn: ({ id1, id2 }: { id1: string; id2: string }) =>
      apiClient.post<MergeApiResponse>("/tables/merge", {
        table_id_1: id1,
        table_id_2: id2,
      }),
    onSuccess: (response, { id1, id2 }) => {
      const t1 = floorTables.find((t) => t.id === id1)!
      const t2 = floorTables.find((t) => t.id === id2)!

      // Register this merge locally so FloorMap can render the bracket + label
      const newMerge: MergedTableInfo = {
        mergedId: response.id,
        tableId1: id1,
        tableId2: id2,
        label1: t1.label,
        label2: t2.label,
        combinedCapacity: t1.capacity + t2.capacity,
      }
      setMergedTables((prev) => [...prev, newMerge])

      // Update local status optimistically (backend sets them to "occupied")
      setTableStatus(id1, "occupied")
      setTableStatus(id2, "occupied")

      qc.invalidateQueries({ queryKey: ["floor", "tables", branchId] })
      toast.success(`Tables ${t1.label} and ${t2.label} merged successfully`)

      // Exit merge mode and clear selection
      setSelectedForMerge([])
      setMergeMode(false)
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to merge tables")
    },
  })

  const { mutate: executeUnmerge, isPending: isUnmerging } = useMutation({
    mutationFn: (mergedId: string) =>
      apiClient.post(`/tables/${mergedId}/unmerge`, {}),
    onSuccess: (_, mergedId) => {
      // Remove from local merged list — tables revert to individual status
      const pair = mergedTables.find((m) => m.mergedId === mergedId)
      setMergedTables((prev) => prev.filter((m) => m.mergedId !== mergedId))

      if (pair) {
        setTableStatus(pair.tableId1, "free")
        setTableStatus(pair.tableId2, "free")
      }

      qc.invalidateQueries({ queryKey: ["floor", "tables", branchId] })
      toast.success("Tables unmerged successfully")
      setSelectedTable(null)
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to unmerge tables")
    },
  })

  /** Called when a free table is clicked while merge mode is active */
  function handleTableSelectForMerge(tableId: string) {
    setSelectedForMerge((prev) => {
      if (prev.includes(tableId)) {
        // Deselect
        return prev.filter((id) => id !== tableId)
      }
      if (prev.length >= 2) {
        toast.warning("You can only select 2 tables to merge")
        return prev
      }
      return [...prev, tableId]
    })
  }

  /** Toggle merge mode; reset selection when turning off */
  function toggleMergeMode() {
    setMergeMode((v) => {
      if (v) setSelectedForMerge([])
      return !v
    })
    setSelectedTable(null)
  }

  /** Confirm merge of the 2 selected tables */
  function confirmMerge() {
    if (selectedForMerge.length !== 2) return
    executeMerge({ id1: selectedForMerge[0], id2: selectedForMerge[1] })
  }

  // Look up merge info for the selected table (if it's part of a merged pair)
  const selectedMergeInfo = selectedTable
    ? mergedTables.find(
        (m) => m.tableId1 === selectedTable.id || m.tableId2 === selectedTable.id
      )
    : undefined

  // The two FloorTable objects currently selected for merging
  const mergeTable1 = selectedForMerge[0]
    ? floorTables.find((t) => t.id === selectedForMerge[0])
    : undefined
  const mergeTable2 = selectedForMerge[1]
    ? floorTables.find((t) => t.id === selectedForMerge[1])
    : undefined

  // END MERGE FEATURE ADDITION ───────────────────────────────────────────────

  const currentStatus: TableStatus =
    selectedTable
      ? (tableStatuses[selectedTable.id] ?? (selectedTable.status as TableStatus))
      : TABLE_STATUS.FREE

  return (
    <>
      <PageWrapper
        title="Floor Map"
        subtitle="Live table layout · click a table to manage it"
        // MERGE FEATURE ADDITION: Merge mode toggle in page header action slot
        action={
          <button
            onClick={toggleMergeMode}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition",
              mergeMode
                ? "bg-[#1A3C5E] text-white border-[#1A3C5E] shadow-md"
                : "bg-white text-gray-600 border-gray-200 hover:border-[#1A3C5E]/30"
            )}
          >
            {mergeMode ? (
              <><Link2 size={14} /> Merge Mode: ON</>
            ) : (
              <><Link2Off size={14} /> Merge Tables</>
            )}
          </button>
        }
        // END MERGE FEATURE ADDITION
      >
        {/* MERGE FEATURE ADDITION: Merge mode instruction banner */}
        {mergeMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700"
          >
            <Link2 size={16} className="shrink-0 text-blue-500" />
            <span>
              <strong>Merge Mode active</strong> — click two free tables to select them for merging.
              {selectedForMerge.length > 0 && (
                <span className="ml-1 font-medium">
                  ({selectedForMerge.length}/2 selected)
                </span>
              )}
            </span>
          </motion.div>
        )}
        {/* END MERGE FEATURE ADDITION */}

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
              // MERGE FEATURE ADDITION: pass merge props (all optional — no-ops when mergeMode=false)
              mergeMode={mergeMode}
              selectedForMerge={selectedForMerge}
              onTableSelectForMerge={handleTableSelectForMerge}
              mergedTables={mergedTables}
              // END MERGE FEATURE ADDITION
              onTableClick={(t) => {
                // MERGE FEATURE ADDITION: block sidebar opening while in merge mode
                if (mergeMode) return
                // END MERGE FEATURE ADDITION
                setSelectedTable(t)
              }}
            />
          )}
        </div>
      </PageWrapper>

      {/* MERGE FEATURE ADDITION: Floating merge action bar */}
      <AnimatePresence>
        {mergeMode && mergeTable1 && mergeTable2 && (
          <MergeActionBar
            table1={mergeTable1}
            table2={mergeTable2}
            onConfirm={confirmMerge}
            onCancel={() => setSelectedForMerge([])}
            isMerging={isMerging}
          />
        )}
      </AnimatePresence>
      {/* END MERGE FEATURE ADDITION */}

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
              // MERGE FEATURE ADDITION
              mergeInfo={selectedMergeInfo}
              onUnmerge={() =>
                selectedMergeInfo && executeUnmerge(selectedMergeInfo.mergedId)
              }
              isUnmerging={isUnmerging}
              // END MERGE FEATURE ADDITION
            />
          </>
        )}
      </AnimatePresence>
    </>
  )
}