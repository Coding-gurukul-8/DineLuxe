"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft, Plus, Minus, Search, CreditCard,
  Loader2, AlertCircle, X, ShoppingBag, CheckCircle2,
  Clock, ChefHat, Utensils,
} from "lucide-react"
import { toast } from "sonner"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { useDebounce } from "@/hooks/useDebounce"
import { formatCurrency, cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

type ItemStatus = "pending" | "preparing" | "ready" | "served"

interface OrderItem {
  id: string
  menu_item_id: string
  name: string
  quantity: number
  unit_price: number
  status: ItemStatus
  notes?: string
}

interface CurrentOrder {
  id: string
  table_number: string | number
  status: string
  items: OrderItem[]
  subtotal: number
  tax: number
  total: number
  covers?: number
}

interface MenuItem {
  id: string
  name: string
  category: string
  price: number
  is_available: boolean
  description?: string
}

// ── Status config ──────────────────────────────────────────────────────────────

const ITEM_STATUS: Record<ItemStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:   { label: "Pending",   cls: "bg-gray-100 text-gray-600",       icon: <Clock size={11} /> },
  preparing: { label: "Preparing", cls: "bg-amber-100 text-amber-700",     icon: <ChefHat size={11} /> },
  ready:     { label: "Ready",     cls: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 size={11} /> },
  served:    { label: "Served",    cls: "bg-blue-100 text-blue-700",       icon: <Utensils size={11} /> },
}

// ── Add Items Drawer ───────────────────────────────────────────────────────────

function AddItemsDrawer({
  orderId,
  branchId,
  onClose,
}: {
  orderId: string
  branchId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<Record<string, number>>({})
  const debouncedSearch = useDebounce(search, 300)

  const { data: menuItems = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["menu", "items", branchId, debouncedSearch],
    queryFn: () =>
      apiClient.get<MenuItem[]>(
        `/menu/items?branch_id=${branchId}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`
      ),
    staleTime: 60_000,
  })

  const available = menuItems.filter((i) => i.is_available)

  const { mutate: addItems, isPending } = useMutation({
    mutationFn: () =>
      Promise.all(
        Object.entries(cart)
          .filter(([, qty]) => qty > 0)
          .map(([menu_item_id, quantity]) =>
            apiClient.post(`/orders/${orderId}/items`, { menu_item_id, quantity })
          )
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", "table"] })
      toast.success("Items added to order")
      onClose()
    },
    onError: () => toast.error("Failed to add items"),
  })

  const totalAdding = Object.values(cart).reduce((a, b) => a + b, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 350, damping: 35 }}
        className="bg-white w-full max-w-sm flex flex-col h-full shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-900">Add Items</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-50 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
            <Search size={14} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search menu…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Menu items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))
          ) : available.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No items found</div>
          ) : (
            available.map((item) => {
              const qty = cart[item.id] ?? 0
              return (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.category} · {formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {qty > 0 ? (
                      <>
                        <button
                          onClick={() => setCart((c) => ({ ...c, [item.id]: Math.max(0, qty - 1) }))}
                          className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300 transition"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-sm font-bold text-gray-900 w-5 text-center">{qty}</span>
                      </>
                    ) : null}
                    <button
                      onClick={() => setCart((c) => ({ ...c, [item.id]: qty + 1 }))}
                      className="w-7 h-7 rounded-lg bg-[#1A3C5E] flex items-center justify-center text-white hover:bg-[#15304d] transition"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => addItems()}
            disabled={totalAdding === 0 || isPending}
            className="w-full py-3 rounded-xl bg-[#1A3C5E] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[#15304d] transition"
          >
            {isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Adding…</>
            ) : (
              <>{totalAdding > 0 ? `Add ${totalAdding} item${totalAdding > 1 ? "s" : ""}` : "Select items"}</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function WaiterOrderPage() {
  const { tableId } = useParams<{ tableId: string }>()
  const router = useRouter()
  const qc = useQueryClient()
  const { branchId } = useAuth()
  const [showAddItems, setShowAddItems] = useState(false)

  const { data: order, isLoading, isError } = useQuery<CurrentOrder>({
    queryKey: ["order", "table", tableId],
    queryFn: () => apiClient.get<CurrentOrder>(`/tables/${tableId}/current-order`),
    enabled: !!tableId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const { mutate: updateQty } = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      apiClient.patch(`/orders/${order!.id}/items/${itemId}`, { quantity }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["order", "table", tableId] }),
    onError: () => toast.error("Failed to update quantity"),
  })

  const { mutate: requestPayment, isPending: paying } = useMutation({
    mutationFn: () =>
      apiClient.post(`/orders/${order!.id}/payment`, { method: "cash" }),
    onSuccess: () => {
      toast.success("Payment requested — cashier notified")
      router.push("/staff/waiter/tables")
    },
    onError: () => toast.error("Failed to request payment"),
  })

  if (isLoading) {
    return (
      <PageWrapper title="Loading order…">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </PageWrapper>
    )
  }

  if (isError || !order) {
    return (
      <PageWrapper title="Order not found">
        <div className="flex flex-col items-center py-16 gap-3 text-gray-400">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm">Could not load order for this table</p>
          <button onClick={() => router.back()} className="text-sm text-[#1A3C5E] hover:underline flex items-center gap-1">
            <ArrowLeft size={13} /> Go back
          </button>
        </div>
      </PageWrapper>
    )
  }

  const allServed = order.items.every((i) => i.status === "served")

  return (
    <>
      <PageWrapper
        title={`Table ${order.table_number}`}
        subtitle={`${order.items.length} item${order.items.length !== 1 ? "s" : ""} · ${order.covers ? `${order.covers} covers` : ""}`}
        action={
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30 transition"
          >
            <ArrowLeft size={16} />
          </button>
        }
      >
        {/* Order items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
          {order.items.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2 text-gray-400">
              <ShoppingBag size={24} className="text-gray-300" />
              <p className="text-sm">No items yet</p>
            </div>
          ) : (
            order.items.map((item) => {
              const statusMeta = ITEM_STATUS[item.status] ?? ITEM_STATUS.pending
              return (
                <motion.div
                  key={item.id}
                  layout
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  {/* Qty controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateQty({ itemId: item.id, quantity: Math.max(1, item.quantity - 1) })}
                      disabled={item.status !== "pending"}
                      className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                    <button
                      onClick={() => updateQty({ itemId: item.id, quantity: item.quantity + 1 })}
                      disabled={item.status !== "pending"}
                      className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-30 transition"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                    {item.notes && <p className="text-xs text-amber-600 mt-0.5">{item.notes}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(item.unit_price)} each</p>
                  </div>

                  {/* Status + subtotal */}
                  <div className="shrink-0 text-right space-y-1">
                    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full", statusMeta.cls)}>
                      {statusMeta.icon}
                      {statusMeta.label}
                    </span>
                    <p className="text-sm font-bold text-gray-900 font-mono">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </p>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-500">
            <span>Tax</span>
            <span className="font-mono">{formatCurrency(order.tax)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
            <span>Total</span>
            <span className="font-mono text-[#1A3C5E]">{formatCurrency(order.total)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddItems(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-[#1A3C5E]/20 text-[#1A3C5E] rounded-xl text-sm font-semibold hover:bg-[#1A3C5E]/5 transition"
          >
            <Plus size={16} /> Add Items
          </button>
          <button
            onClick={() => requestPayment()}
            disabled={paying || order.items.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#E8A020] text-white rounded-xl text-sm font-semibold hover:bg-[#d4911c] disabled:opacity-50 transition"
          >
            {paying ? (
              <><Loader2 size={14} className="animate-spin" /> Requesting…</>
            ) : (
              <><CreditCard size={14} /> Request Payment</>
            )}
          </button>
        </div>
      </PageWrapper>

      <AnimatePresence>
        {showAddItems && (
          <AddItemsDrawer
            orderId={order.id}
            branchId={branchId!}
            onClose={() => setShowAddItems(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}