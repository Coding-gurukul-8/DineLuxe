"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { RefreshCw, Filter, AlertCircle, ClipboardList } from "lucide-react"
import { toast } from "sonner"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { OrderTicket } from "@/components/orders/OrderTicket"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

type OrderStatus = "pending" | "preparing" | "ready" | "served"

interface OrderItem {
  name: string
  quantity: number
  notes?: string
}

interface BranchOrder {
  id: string
  tableLabel: string
  items: OrderItem[]
  specialNotes?: string
  createdAt: string
  status: OrderStatus
}

// ── Filter tabs ────────────────────────────────────────────────────────────────

const FILTERS: { value: "all" | OrderStatus; label: string; cls: string }[] = [
  { value: "all",       label: "All",       cls: "bg-gray-800 text-white" },
  { value: "pending",   label: "Pending",   cls: "bg-blue-500 text-white" },
  { value: "preparing", label: "Preparing", cls: "bg-amber-500 text-white" },
  { value: "ready",     label: "Ready",     cls: "bg-emerald-500 text-white" },
  { value: "served",    label: "Served",    cls: "bg-gray-500 text-white" },
]

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ManagerOrdersPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<"all" | OrderStatus>("all")

  const { data: orders = [], isLoading, isError, refetch, isFetching } = useQuery<BranchOrder[]>({
    queryKey: ["manager", "orders", branchId],
    queryFn: () =>
      apiClient.get<BranchOrder[]>(`/orders/branch/${branchId}?status=active`),
    enabled: !!branchId,
    staleTime: 20_000,
    refetchInterval: 30_000,
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      apiClient.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ["manager", "orders", branchId] })
      toast.success(`Order marked as ${status}`)
    },
    onError: () => toast.error("Failed to update order status"),
  })

  const filtered = filter === "all"
    ? orders
    : orders.filter((o) => o.status === filter)

  // Count per status for badges
  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <PageWrapper
      title="Live Orders"
      subtitle={`${orders.length} active order${orders.length !== 1 ? "s" : ""} · auto-refreshes every 30s`}
      action={
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
        </button>
      }
    >
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ value, label, cls }) => {
          const count = value === "all" ? orders.length : (counts[value] ?? 0)
          const isActive = filter === value
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2",
                isActive ? cls : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn(
                  "text-xs font-bold px-1.5 py-0.5 rounded-full",
                  isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 gap-3 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm">Failed to load orders</p>
          <button onClick={() => refetch()} className="text-sm text-[#1A3C5E] hover:underline">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <ClipboardList size={28} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium">
            {filter === "all" ? "No active orders" : `No ${filter} orders`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filtered.map((order) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
              >
                <OrderTicket
                  order={order}
                  onStatusChange={(orderId, newStatus) =>
                    updateStatus({ orderId, status: newStatus })
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </PageWrapper>
  )
}