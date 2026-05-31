"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Loader2, Users, MapPin, RefreshCw, Wifi, WifiOff,
  ChevronDown, ExternalLink, UserCheck, AlertCircle,
  // MERGE FEATURE ADDITION
  Link2, Link2Off, AlertTriangle, Unlink,
  // END MERGE FEATURE ADDITION
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { FloorMap, type FloorTable, type MergedTableInfo } from "@/components/floor/FloorMap"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { SkeletonCard } from "@/components/shared/SkeletonCard"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { useTableStatus } from "@/hooks/useTableStatus"
import { useFloorLayoutUpdated } from "@/hooks/useFloorLayoutUpdated"
import { TABLE_STATUS, TABLE_STATUS_COLORS, type TableStatus } from "@/lib/constants"
import { cn, elapsedMinutes } from "@/lib/utils"
import type { Table } from "@/types/api"

// ── Types ──────────────────────────────────────────────────────────────────────

interface TableActiveOrder {
  id: string
  status: string
  created_at: string
  total?: number
  order_items: Array<{
    id: string
    status: string
    quantity: number
    menu_items: { name: string } | null
  }>
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

const TABLE_SHAPE_SIZE: Record<string, { w: number; h: number }> = {
  round:     { w: 72,  h: 72  },
  square:    { w: 68,  h: 68  },
  rectangle: { w: 112, h: 56  },
  booth:     { w: 96,  h: 60  },
}

function toFloorTable(t: Table, index: number): FloorTable {
  const size = TABLE_SHAPE_SIZE[t.shape] ?? { w: 68, h: 68 }
  const col = index % 6
  const row = Math.floor(index / 6)
  return {
    id:       t.id,
    label:    t.label,
    capacity: t.capacity,
    status:   t.status,
    shape:    t.shape === "booth" ? "rectangle" : (t.shape as FloorTable["shape"]),
    x:        t.x_pos ?? 40 + col * 130,
    y:        t.y_pos ?? 40 + row * 110,
    width:    size.w,
    height:   size.h,
  }
}

const OVERRIDE_OPTIONS: { value: TableStatus; label: string; color: string }[] = [
  { value: TABLE_STATUS.FREE,        label: "Free",        color: TABLE_STATUS_COLORS.free        },
  { value: TABLE_STATUS.OCCUPIED,    label: "Occupied",    color: TABLE_STATUS_COLORS.occupied    },
  { value: TABLE_STATUS.RESERVED,    label: "Reserved",    color: TABLE_STATUS_COLORS.reserved    },
  { value: TABLE_STATUS.CLEANING,    label: "Cleaning",    color: TABLE_STATUS_COLORS.cleaning    },
  { value: TABLE_STATUS.MAINTENANCE, label: "Maintenance", color: TABLE_STATUS_COLORS.maintenance },
]

const LEGEND = [
  { label: "Free",        cls: "bg-[#1E7E34]"  },
  { label: "Occupied",    cls: "bg-[#C0392B]"  },
  { label: "Reserved",    cls: "bg-[#2980B9]"  },
  { label: "Cleaning",    cls: "bg-[#F1C40F]"  },
  { label: "Maintenance", cls: "bg-[#7F8C8D]"  },
  // MERGE FEATURE ADDITION
  { label: "Merged",      cls: "bg-[#1A3C5E]"  },
  // END MERGE FEATURE ADDITION
]

// MERGE FEATURE ADDITION ───────────────────────────────────────────────────────
/**
 * Rough adjacency check — identical to host page implementation.
 * Tables are adjacent when any edges are within 30 px.
 */
function areAdjacent(a: FloorTable, b: FloorTable): boolean {
  const GAP = 30
  const aRight  = a.x + a.width
  const aBottom = a.y + a.height
  const bRight  = b.x + b.width
  const bBottom = b.y + b.height

  const vOverlap = a.y < bBottom + GAP && aBottom + GAP > b.y
  const hClose   = Math.abs(aRight - b.x) <= GAP || Math.abs(bRight - a.x) <= GAP

  const hOverlap = a.x < bRight + GAP && aRight + GAP > b.x
  const vClose   = Math.abs(aBottom - b.y) <= GAP || Math.abs(bBottom - a.y) <= GAP

  return (vOverlap && hClose) || (hOverlap && vClose)
}
// END MERGE FEATURE ADDITION ───────────────────────────────────────────────────

// ── Override Status Dropdown ────────────────────────────────────────────────────

function OverrideDropdown({
  tableId,
  currentStatus,
  onChanged,
}: {
  tableId: string
  currentStatus: TableStatus
  onChanged: (status: TableStatus) => void
}) {
  const [open, setOpen] = useState(false)

  const { mutate, isPending } = useMutation({
    mutationFn: (status: TableStatus) =>
      apiClient.patch(`/tables/${tableId}/status`, { status }),
    onSuccess: (_, status) => {
      onChanged(status)
      setOpen(false)
      toast.success("Table status updated")
    },
    onError: () => toast.error("Failed to override table status"),
  })

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="flex items-center gap-1.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
        )}
        Override Status
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden"
          >
            {OVERRIDE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => mutate(opt.value)}
                disabled={opt.value === currentStatus}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition",
                  opt.value === currentStatus
                    ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: opt.color }}
                />
                {opt.label}
                {opt.value === currentStatus && (
                  <span className="ml-auto text-[10px] text-gray-400">current</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Table Details Sheet ─────────────────────────────────────────────────────────

function TableDetailsSheet({
  table,
  rawTable,
  currentStatus,
  onClose,
  onStatusChanged,
  // MERGE FEATURE ADDITION
  mergeInfo,
  onUnmerge,
  isUnmerging,
  // END MERGE FEATURE ADDITION
}: {
  table: FloorTable
  rawTable: Table | undefined
  currentStatus: TableStatus
  onClose: () => void
  onStatusChanged: (status: TableStatus) => void
  // MERGE FEATURE ADDITION
  mergeInfo?: MergedTableInfo
  onUnmerge?: () => void
  isUnmerging?: boolean
  // END MERGE FEATURE ADDITION
}) {
  const router = useRouter()

  const { data: activeOrder, isLoading: orderLoading } = useQuery<TableActiveOrder | null>({
    queryKey: ["manager", "table-order", table.id],
    queryFn: async () => {
      try {
        return await apiClient.get<TableActiveOrder>(`/tables/${table.id}/current-order`)
      } catch {
        return null
      }
    },
    enabled: currentStatus === TABLE_STATUS.OCCUPIED,
    staleTime: 15_000,
  })

  const tableInfoItems = [
    ["ID", table.id.slice(0, 8) + "…"],
    ["Shape", table.shape],
    ["Capacity", `${table.capacity} guests`],
    rawTable?.zone ? ["Zone", rawTable.zone] : null,
    rawTable?.floor_number ? ["Floor", `Floor ${rawTable.floor_number}`] : null,
  ].filter((item): item is [string, string] => Boolean(item))

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 34 }}
      className="fixed right-0 top-0 bottom-0 z-50 bg-white w-84 shadow-2xl border-l border-gray-100 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          {/* MERGE FEATURE ADDITION: show combined label when merged */}
          <h2 className="font-bold text-gray-900 text-base">
            {mergeInfo
              ? `Table ${mergeInfo.label1} + ${mergeInfo.label2}`
              : `Table ${table.label}`}
          </h2>
          {/* END MERGE FEATURE ADDITION */}
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Users size={11} />
              {/* MERGE FEATURE ADDITION: combined capacity */}
              {mergeInfo ? mergeInfo.combinedCapacity : table.capacity} capacity
              {/* END MERGE FEATURE ADDITION */}
            </span>
            {rawTable?.zone && (
              <span className="flex items-center gap-1"><MapPin size={11} /> {rawTable.zone}</span>
            )}
            {rawTable?.floor_number !== undefined && rawTable.floor_number > 0 && (
              <span>Floor {rawTable.floor_number}</span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition"
          aria-label="Close table details"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

        {/* MERGE FEATURE ADDITION: Merge info + unmerge action */}
        {mergeInfo && (
          <div className="px-4 py-3 bg-[#1A3C5E]/5 border border-[#1A3C5E]/15 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Link2 size={14} className="text-[#1A3C5E]" />
              <p className="text-xs font-semibold text-[#1A3C5E]">
                Merged — {mergeInfo.label1} + {mergeInfo.label2}
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
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Current Status
          </p>
          <StatusBadge status={currentStatus} size="md" />
        </div>

        {/* Active order summary */}
        {currentStatus === TABLE_STATUS.OCCUPIED && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Current Order
            </p>
            {orderLoading ? (
              <div className="space-y-2">
                <SkeletonCard variant="list-item" count={2} />
              </div>
            ) : activeOrder ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span className="flex items-center gap-1.5">
                    <StatusBadge status={activeOrder.status} size="sm" />
                  </span>
                  <span className="font-mono text-gray-400">
                    {elapsedMinutes(activeOrder.created_at)}m ago
                  </span>
                </div>

                <div className="bg-gray-50 rounded-xl px-3 py-3 space-y-1.5">
                  {activeOrder.order_items.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            item.status === "ready"    ? "bg-green-500"
                            : item.status === "preparing" ? "bg-amber-500"
                            : "bg-gray-300"
                          )}
                        />
                        <span className="truncate text-gray-700">{item.menu_items?.name ?? "Item"}</span>
                      </div>
                      <span className="text-gray-400 shrink-0 font-mono">×{item.quantity}</span>
                    </div>
                  ))}
                  {activeOrder.order_items.length > 5 && (
                    <p className="text-[10px] text-gray-400 pt-1">
                      +{activeOrder.order_items.length - 5} more items
                    </p>
                  )}
                </div>

                {activeOrder.total !== undefined && (
                  <div className="flex justify-between items-center px-3 py-2 bg-[#1A3C5E]/5 rounded-xl">
                    <span className="text-xs text-gray-500 font-medium">Order Total</span>
                    <span className="text-sm font-bold text-[#1A3C5E]">
                      ₹{activeOrder.total.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-xl text-xs text-gray-400">
                <AlertCircle size={13} />
                No active order found
              </div>
            )}
          </div>
        )}

        {/* Manager actions */}
        {/* MERGE FEATURE ADDITION: hide override/reassign for merged tables */}
        {!mergeInfo && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Manager Actions
            </p>

            <OverrideDropdown
              tableId={table.id}
              currentStatus={currentStatus}
              onChanged={onStatusChanged}
            />

            {currentStatus === TABLE_STATUS.OCCUPIED && activeOrder && (
              <button
                onClick={() => router.push(`/staff/manager/orders?table=${table.id}`)}
                className="flex items-center gap-1.5 w-full px-3 py-2.5 rounded-xl border border-[#1A3C5E]/20 bg-[#1A3C5E]/5 text-sm font-medium text-[#1A3C5E] hover:bg-[#1A3C5E]/10 transition"
              >
                <ExternalLink size={13} />
                View Full Order
              </button>
            )}

            {currentStatus === TABLE_STATUS.OCCUPIED && (
              <button
                onClick={() => router.push(`/staff/manager/staff-duty?table=${table.id}`)}
                className="flex items-center gap-1.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                <UserCheck size={13} />
                Reassign Waiter
              </button>
            )}
          </div>
        )}
        {/* END MERGE FEATURE ADDITION */}

        {/* Table metadata */}
        <div className="px-4 py-3 bg-gray-50 rounded-xl space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Table Info
          </p>
          {tableInfoItems.map(([label, value]) => (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-gray-400">{label}</span>
              <span className="text-gray-600 capitalize">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ── Floor Selector Tabs ─────────────────────────────────────────────────────────

function FloorTabs({
  floors,
  active,
  onChange,
}: {
  floors: number[]
  active: number
  onChange: (f: number) => void
}) {
  if (floors.length <= 1) return null
  return (
    <div className="flex gap-1.5 flex-wrap">
      {floors.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={cn(
            "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition",
            active === f
              ? "bg-[#1A3C5E] text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:border-[#1A3C5E]/30"
          )}
        >
          {f === 0 ? "All Floors" : `Floor ${f}`}
        </button>
      ))}
    </div>
  )
}

// MERGE FEATURE ADDITION ───────────────────────────────────────────────────────
/**
 * Floating action bar shown at the bottom of the screen when exactly 2 tables
 * are selected in merge mode — identical UX to the host floor page.
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

        {!adjacent && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              These tables may not be adjacent. Merge anyway?
            </p>
          </div>
        )}

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

export default function ManagerFloorPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null)
  const [activeFloor, setActiveFloor] = useState(0)

  // MERGE FEATURE ADDITION ───────────────────────────────────────────────────
  const [mergeMode, setMergeMode] = useState(false)
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([])
  const [mergedTables, setMergedTables] = useState<MergedTableInfo[]>([])
  // END MERGE FEATURE ADDITION ───────────────────────────────────────────────

  const { data: rawTables = [], isLoading, refetch } = useQuery<Table[]>({
    queryKey: ["manager", "floor-tables", branchId],
    queryFn: () => apiClient.get<Table[]>(`/branch/${branchId}/tables`),
    enabled: !!branchId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  const { tableStatuses, setTableStatus, isConnected } = useTableStatus({
    branchId: branchId ?? "",
    role: "manager",
  })

  useFloorLayoutUpdated({
    branchId: branchId ?? undefined,
    onFloorLayoutUpdated: () => {
      qc.invalidateQueries({ queryKey: ["manager", "floor-tables", branchId] })
    },
  })

  useEffect(() => {
    if (!branchId) return
    const timer = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["manager", "floor-tables", branchId] })
    }, 30_000)
    return () => clearInterval(timer)
  }, [branchId, qc])

  const floorTables: FloorTable[] = useMemo(
    () =>
      rawTables.map((t, i) => ({
        ...toFloorTable(t, i),
        status: (tableStatuses[t.id] ?? t.status) as FloorTable["status"],
      })),
    [rawTables, tableStatuses]
  )

  const floorNumbers = useMemo(() => {
    const nums = [...new Set(rawTables.map((t) => t.floor_number ?? 1))].sort(
      (a, b) => a - b
    )
    return nums.length > 1 ? [0, ...nums] : nums
  }, [rawTables])

  const visibleTables = useMemo(
    () =>
      activeFloor === 0
        ? floorTables
        : floorTables.filter(
            (_, i) => (rawTables[i]?.floor_number ?? 1) === activeFloor
          ),
    [floorTables, rawTables, activeFloor]
  )

  const selectedRaw = selectedTable
    ? rawTables.find((t) => t.id === selectedTable.id)
    : undefined

  const currentStatus: TableStatus =
    selectedTable
      ? ((tableStatuses[selectedTable.id] ?? selectedTable.status) as TableStatus)
      : TABLE_STATUS.FREE

  const statusCounts = useMemo(
    () =>
      floorTables.reduce<Record<string, number>>((acc, t) => {
        acc[t.status] = (acc[t.status] ?? 0) + 1
        return acc
      }, {}),
    [floorTables]
  )

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

      const newMerge: MergedTableInfo = {
        mergedId: response.id,
        tableId1: id1,
        tableId2: id2,
        label1: t1.label,
        label2: t2.label,
        combinedCapacity: t1.capacity + t2.capacity,
      }
      setMergedTables((prev) => [...prev, newMerge])

      setTableStatus(id1, "occupied")
      setTableStatus(id2, "occupied")

      qc.invalidateQueries({ queryKey: ["manager", "floor-tables", branchId] })
      toast.success(`Tables ${t1.label} and ${t2.label} merged successfully`)

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
      const pair = mergedTables.find((m) => m.mergedId === mergedId)
      setMergedTables((prev) => prev.filter((m) => m.mergedId !== mergedId))

      if (pair) {
        setTableStatus(pair.tableId1, "free")
        setTableStatus(pair.tableId2, "free")
      }

      qc.invalidateQueries({ queryKey: ["manager", "floor-tables", branchId] })
      toast.success("Tables unmerged successfully")
      setSelectedTable(null)
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to unmerge tables")
    },
  })

  function handleTableSelectForMerge(tableId: string) {
    setSelectedForMerge((prev) => {
      if (prev.includes(tableId)) return prev.filter((id) => id !== tableId)
      if (prev.length >= 2) {
        toast.warning("You can only select 2 tables to merge")
        return prev
      }
      return [...prev, tableId]
    })
  }

  function toggleMergeMode() {
    setMergeMode((v) => {
      if (v) setSelectedForMerge([])
      return !v
    })
    setSelectedTable(null)
  }

  function confirmMerge() {
    if (selectedForMerge.length !== 2) return
    executeMerge({ id1: selectedForMerge[0], id2: selectedForMerge[1] })
  }

  const selectedMergeInfo = selectedTable
    ? mergedTables.find(
        (m) => m.tableId1 === selectedTable.id || m.tableId2 === selectedTable.id
      )
    : undefined

  const mergeTable1 = selectedForMerge[0]
    ? visibleTables.find((t) => t.id === selectedForMerge[0])
    : undefined
  const mergeTable2 = selectedForMerge[1]
    ? visibleTables.find((t) => t.id === selectedForMerge[1])
    : undefined

  // END MERGE FEATURE ADDITION ───────────────────────────────────────────────

  return (
    <>
      <PageWrapper
        title="Live Floor Map"
        subtitle="Real-time table status · auto-refreshes every 30 seconds"
        action={
          <div className="flex items-center gap-2">
            {/* Connection indicator */}
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full",
                isConnected
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-gray-100 text-gray-400"
              )}
            >
              {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
              {isConnected ? "Live" : "Polling"}
            </span>

            <button
              onClick={() => refetch()}
              className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30 transition"
              aria-label="Refresh floor map"
            >
              <RefreshCw size={14} />
            </button>

            {/* MERGE FEATURE ADDITION: Merge mode toggle */}
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
            {/* END MERGE FEATURE ADDITION */}
          </div>
        }
      >
        {/* MERGE FEATURE ADDITION: instruction banner */}
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
        <div className="flex flex-wrap items-center gap-4">
          {LEGEND.map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-gray-600 font-medium">
              <span className={cn("w-3 h-3 rounded-sm inline-block", cls)} />
              {label}
            </div>
          ))}
        </div>

        {/* Status count pills */}
        {!isLoading && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-xl text-xs font-medium text-gray-600 shadow-sm"
              >
                <StatusBadge status={status} size="sm" />
                <span className="font-mono font-bold">{count}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-xl text-xs font-medium text-gray-500 shadow-sm ml-auto">
              <span>{floorTables.length} total tables</span>
            </div>
            {/* MERGE FEATURE ADDITION: merged count pill */}
            {mergedTables.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1A3C5E]/5 border border-[#1A3C5E]/20 rounded-xl text-xs font-medium text-[#1A3C5E] shadow-sm">
                <Link2 size={11} />
                <span className="font-mono font-bold">{mergedTables.length}</span>
                <span>merged</span>
              </div>
            )}
            {/* END MERGE FEATURE ADDITION */}
          </div>
        )}

        {/* Floor selector tabs */}
        <FloorTabs floors={floorNumbers} active={activeFloor} onChange={setActiveFloor} />

        {/* Floor map canvas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="h-130 flex items-center justify-center">
              <Loader2 size={28} className="text-gray-300 animate-spin" />
            </div>
          ) : visibleTables.length === 0 ? (
            <div className="h-130 flex flex-col items-center justify-center gap-3 text-gray-400">
              <MapPin size={28} className="text-gray-200" />
              <p className="text-sm">No tables on this floor</p>
            </div>
          ) : (
            <FloorMap
              tables={visibleTables}
              branchId={branchId ?? ""}
              readOnly
              height={520}
              // MERGE FEATURE ADDITION
              mergeMode={mergeMode}
              selectedForMerge={selectedForMerge}
              onTableSelectForMerge={handleTableSelectForMerge}
              mergedTables={mergedTables}
              // END MERGE FEATURE ADDITION
              onTableClick={(t) => {
                // MERGE FEATURE ADDITION: block sidebar while in merge mode
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

      {/* Table Details Sheet */}
      <AnimatePresence>
        {selectedTable && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
              onClick={() => setSelectedTable(null)}
            />
            <TableDetailsSheet
              table={selectedTable}
              rawTable={selectedRaw}
              currentStatus={currentStatus}
              onClose={() => setSelectedTable(null)}
              onStatusChanged={(status) => {
                setTableStatus(selectedTable.id, status)
                qc.invalidateQueries({
                  queryKey: ["manager", "floor-tables", branchId],
                })
                qc.invalidateQueries({
                  queryKey: ["manager", "table-order", selectedTable.id],
                })
              }}
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