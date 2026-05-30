"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Loader2, Users, MapPin, RefreshCw, Wifi, WifiOff,
  ChevronDown, ExternalLink, UserCheck, AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { FloorMap, type FloorTable } from "@/components/floor/FloorMap"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { SkeletonCard } from "@/components/shared/SkeletonCard"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { useTableStatus } from "@/hooks/useTableStatus"
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

// All 5 statuses the manager can override a table to
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
]

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
}: {
  table: FloorTable
  rawTable: Table | undefined
  currentStatus: TableStatus
  onClose: () => void
  onStatusChanged: (status: TableStatus) => void
}) {
  const router = useRouter()

  // Fetch the active order for this table (if occupied)
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
          <h2 className="font-bold text-gray-900 text-base">Table {table.label}</h2>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
            <span className="flex items-center gap-1"><Users size={11} /> {table.capacity} capacity</span>
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

        {/* Current status */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Current Status
          </p>
          <StatusBadge status={currentStatus} size="md" />
        </div>

        {/* Active order summary (occupied only) */}
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
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Manager Actions
          </p>

          {/* Override status dropdown */}
          <OverrideDropdown
            tableId={table.id}
            currentStatus={currentStatus}
            onChanged={onStatusChanged}
          />

          {/* View order — only when occupied and order exists */}
          {currentStatus === TABLE_STATUS.OCCUPIED && activeOrder && (
            <button
              onClick={() => router.push(`/staff/manager/orders?table=${table.id}`)}
              className="flex items-center gap-1.5 w-full px-3 py-2.5 rounded-xl border border-[#1A3C5E]/20 bg-[#1A3C5E]/5 text-sm font-medium text-[#1A3C5E] hover:bg-[#1A3C5E]/10 transition"
            >
              <ExternalLink size={13} />
              View Full Order
            </button>
          )}

          {/* Reassign waiter */}
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ManagerFloorPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null)
  const [activeFloor, setActiveFloor] = useState(0) // 0 = all

  // ── Fetch all tables for this branch ──────────────────────────────────────
  const { data: rawTables = [], isLoading, refetch } = useQuery<Table[]>({
    queryKey: ["manager", "floor-tables", branchId],
    queryFn: () => apiClient.get<Table[]>(`/branch/${branchId}/tables`),
    enabled: !!branchId,
    staleTime: 30_000,
    refetchInterval: 30_000,  // fallback auto-refresh every 30 s
  })

  // ── Real-time table status overlay ────────────────────────────────────────
  const { tableStatuses, setTableStatus, isConnected } = useTableStatus({
    branchId: branchId ?? "",
    role: "manager",
  })

  // When a status event arrives, also invalidate the query cache
  useEffect(() => {
    if (!branchId) return
    // Force query refetch on table:status changes — tableStatuses already
    // holds the optimistic value, but we want the full table list fresh too.
    const timer = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["manager", "floor-tables", branchId] })
    }, 30_000)
    return () => clearInterval(timer)
  }, [branchId, qc])

  // ── Merge real-time statuses with DB data ─────────────────────────────────
  const floorTables: FloorTable[] = useMemo(
    () =>
      rawTables.map((t, i) => ({
        ...toFloorTable(t, i),
        status: (tableStatuses[t.id] ?? t.status) as FloorTable["status"],
      })),
    [rawTables, tableStatuses]
  )

  // ── Floor numbers for tabs ────────────────────────────────────────────────
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

  // ── Selected table raw data (for zone / floor_number in sidebar) ──────────
  const selectedRaw = selectedTable
    ? rawTables.find((t) => t.id === selectedTable.id)
    : undefined

  const currentStatus: TableStatus =
    selectedTable
      ? ((tableStatuses[selectedTable.id] ?? selectedTable.status) as TableStatus)
      : TABLE_STATUS.FREE

  // ── Stats ──────────────────────────────────────────────────────────────────
  const statusCounts = useMemo(
    () =>
      floorTables.reduce<Record<string, number>>((acc, t) => {
        acc[t.status] = (acc[t.status] ?? 0) + 1
        return acc
      }, {}),
    [floorTables]
  )

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
          </div>
        }
      >
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
          </div>
        )}

        {/* Floor selector tabs */}
        <FloorTabs floors={floorNumbers} active={activeFloor} onChange={setActiveFloor} />

        {/* Floor map canvas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="h-[520px] flex items-center justify-center">
              <Loader2 size={28} className="text-gray-300 animate-spin" />
            </div>
          ) : visibleTables.length === 0 ? (
            <div className="h-[520px] flex flex-col items-center justify-center gap-3 text-gray-400">
              <MapPin size={28} className="text-gray-200" />
              <p className="text-sm">No tables on this floor</p>
            </div>
          ) : (
            <FloorMap
              tables={visibleTables}
              branchId={branchId ?? ""}
              readOnly
              height={520}
              onTableClick={(t) => setSelectedTable(t)}
            />
          )}
        </div>
      </PageWrapper>

      {/* Table Details Sheet */}
      <AnimatePresence>
        {selectedTable && (
          <>
            {/* Backdrop */}
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
            />
          </>
        )}
      </AnimatePresence>
    </>
  )
}