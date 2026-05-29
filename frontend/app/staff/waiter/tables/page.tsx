"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  UtensilsCrossed,
  Users,
  Receipt,
  RefreshCw,
  Wifi,
  WifiOff,
  ArrowRight,
  Clock,
  ShoppingBag,
} from "lucide-react"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { useRealtime } from "@/hooks/useRealtime"
import { formatCurrency, cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

interface TableOrder {
  id: string
  table_number: string | number
  table_id: string
  status: "free" | "occupied" | "cleaning" | "reserved"
  covers?: number
  items_count: number
  total: number
  opened_at?: string
  order_id?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function elapsed(opened_at?: string): string {
  if (!opened_at) return ""
  const mins = Math.floor((Date.now() - new Date(opened_at).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

const STATUS_RING: Record<string, string> = {
  occupied: "border-red-300 shadow-red-100",
  free:     "border-emerald-300 shadow-emerald-100",
  cleaning: "border-amber-300 shadow-amber-100",
  reserved: "border-blue-300 shadow-blue-100",
}

// ── Table Card ─────────────────────────────────────────────────────────────────

function TableCard({ table, onView }: { table: TableOrder; onView: () => void }) {
  const isOccupied = table.status === "occupied"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={cn(
        "bg-white rounded-2xl border-2 shadow-sm p-5 flex flex-col gap-4",
        STATUS_RING[table.status] ?? "border-gray-200"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
            isOccupied ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-700"
          )}>
            {table.table_number}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Table {table.table_number}</p>
            {table.covers && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Users size={11} /> {table.covers} covers
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={table.status} size="sm" />
      </div>

      {/* Order summary */}
      {isOccupied && (
        <div className="grid grid-cols-2 gap-2">
          <div className="px-3 py-2 bg-gray-50 rounded-xl">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Items</p>
            <p className="text-lg font-bold text-gray-900 font-mono">{table.items_count}</p>
          </div>
          <div className="px-3 py-2 bg-gray-50 rounded-xl">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Total</p>
            <p className="text-lg font-bold text-[#1A3C5E] font-mono">
              {formatCurrency(table.total)}
            </p>
          </div>
        </div>
      )}

      {/* Elapsed time */}
      {table.opened_at && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <Clock size={11} /> Opened {elapsed(table.opened_at)} ago
        </p>
      )}

      {/* CTA */}
      {isOccupied ? (
        <button
          onClick={onView}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1A3C5E] text-white rounded-xl text-sm font-semibold hover:bg-[#15304d] transition active:scale-95"
        >
          View Order <ArrowRight size={14} />
        </button>
      ) : (
        <div className="py-2.5 text-center text-xs text-gray-400">
          {table.status === "cleaning" ? "Being cleaned" : "No active order"}
        </div>
      )}
    </motion.div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function WaiterTablesPage() {
  const router = useRouter()
  const { branchId } = useAuth()
  const qc = useQueryClient()

  const { data: tables = [], isLoading, refetch } = useQuery<TableOrder[]>({
    queryKey: ["waiter", "tables", branchId],
    queryFn: () =>
      apiClient.get<TableOrder[]>(`/branch/${branchId}/tables?status=occupied`),
    enabled: !!branchId,
    staleTime: 30_000,
  })

  // ── Real-time table status updates ──────────────────────────────────────────
  const { on, isConnected } = useRealtime({
    room: `branch:${branchId}`,
    // role not needed — raw room string
  } as Parameters<typeof useRealtime>[0])

  useEffect(() => {
    if (!branchId) return
    const unsub = on<{ tableId: string; status: string }>("table:status", () => {
      qc.invalidateQueries({ queryKey: ["waiter", "tables", branchId] })
    })
    return unsub
  }, [branchId, on, qc])

  const occupied = tables.filter((t) => t.status === "occupied")
  const other    = tables.filter((t) => t.status !== "occupied")

  return (
    <PageWrapper
      title="My Tables"
      subtitle={`${occupied.length} occupied · ${tables.length} total`}
      action={
        <div className="flex items-center gap-2">
          <span className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
            isConnected
              ? "bg-emerald-50 text-emerald-600"
              : "bg-gray-100 text-gray-400"
          )}>
            {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
            {isConnected ? "Live" : "Offline"}
          </span>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] transition"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <UtensilsCrossed size={28} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium">No tables assigned</p>
          <p className="text-xs text-gray-400">Occupied tables will appear here</p>
        </div>
      ) : (
        <div className="space-y-6">
          {occupied.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShoppingBag size={14} className="text-red-500" />
                <h2 className="text-sm font-semibold text-gray-700">Active Orders</h2>
                <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                  {occupied.length}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <AnimatePresence>
                  {occupied.map((t) => (
                    <TableCard
                      key={t.id}
                      table={t}
                      onView={() => router.push(`/staff/waiter/order/${t.table_id}`)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {other.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Receipt size={14} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-500">Other Tables</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <AnimatePresence>
                  {other.map((t) => (
                    <TableCard
                      key={t.id}
                      table={t}
                      onView={() => router.push(`/staff/waiter/order/${t.table_id}`)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  )
}