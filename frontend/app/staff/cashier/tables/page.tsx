"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  CreditCard, RefreshCw, ShoppingBag,
  Clock, Receipt, AlertCircle, Loader2,
} from "lucide-react"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { PaymentModal } from "@/components/payment/PaymentModal"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

interface ActiveOrder {
  id: string
  table_number: string | number
  table_label?: string
  items_count: number
  total: number
  subtotal: number
  tax: number
  opened_at: string
  covers?: number
  status: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function elapsed(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ── Order Row ──────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  onPay,
}: {
  order: ActiveOrder
  onPay: () => void
}) {
  const waitMins = Math.floor((Date.now() - new Date(order.opened_at).getTime()) / 60_000)
  const isLong = waitMins >= 30

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={cn(
        "bg-white rounded-2xl border-2 shadow-sm p-5 flex flex-col gap-4",
        isLong ? "border-amber-200" : "border-gray-100"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
            isLong ? "bg-amber-50 text-amber-700" : "bg-[#1A3C5E]/8 text-[#1A3C5E]"
          )}>
            {order.table_label ?? order.table_number}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">
              Table {order.table_label ?? order.table_number}
            </p>
            {order.covers && (
              <p className="text-xs text-gray-400 mt-0.5">{order.covers} covers</p>
            )}
          </div>
        </div>

        <div className={cn(
          "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full",
          isLong
            ? "bg-amber-50 text-amber-700"
            : "bg-gray-50 text-gray-500"
        )}>
          <Clock size={11} />
          {elapsed(order.opened_at)}
          {isLong && " ⚠"}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2">
        <div className="px-3 py-2 bg-gray-50 rounded-xl">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Items</p>
          <p className="text-xl font-bold text-gray-900 font-mono">{order.items_count}</p>
        </div>
        <div className="px-3 py-2 bg-[#1A3C5E]/5 rounded-xl">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Total</p>
          <p className="text-xl font-bold text-[#1A3C5E] font-mono">{formatCurrency(order.total)}</p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="text-xs text-gray-400 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="font-mono">{formatCurrency(order.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <span className="font-mono">{formatCurrency(order.tax)}</span>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={onPay}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#E8A020] text-white rounded-xl text-sm font-bold hover:bg-[#d4911c] transition active:scale-95"
      >
        <CreditCard size={14} /> Process Payment
      </button>
    </motion.div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CashierTablesPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()
  const [payingOrder, setPayingOrder] = useState<ActiveOrder | null>(null)

  const { data: orders = [], isLoading, isError, refetch, isFetching } = useQuery<ActiveOrder[]>({
    queryKey: ["cashier", "orders", "active", branchId],
    queryFn: () =>
      apiClient.get<ActiveOrder[]>(`/branch/${branchId}/orders/active`),
    enabled: !!branchId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const totalPending = orders.reduce((sum, o) => sum + o.total, 0)

  return (
    <>
      <PageWrapper
        title="Billing Queue"
        subtitle={`${orders.length} order${orders.length !== 1 ? "s" : ""} awaiting payment`}
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
        {/* Summary */}
        {!isLoading && orders.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1A3C5E]/8 flex items-center justify-center text-[#1A3C5E]">
                <Receipt size={16} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Pending Orders</p>
                <p className="text-xl font-bold text-gray-900 font-mono">{orders.length}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E8A020]/10 flex items-center justify-center text-[#E8A020]">
                <CreditCard size={16} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">Total Pending</p>
                <p className="text-xl font-bold text-[#1A3C5E] font-mono">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Order grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-16 gap-3 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm">Failed to load orders</p>
            <button onClick={() => refetch()} className="text-sm text-[#1A3C5E] hover:underline">Retry</button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <ShoppingBag size={28} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium">No orders awaiting payment</p>
            <p className="text-xs">New billing requests will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onPay={() => setPayingOrder(order)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </PageWrapper>

      {/* Payment modal */}
      <AnimatePresence>
        {payingOrder && (
          <PaymentModal
            orderId={payingOrder.id}
            total={payingOrder.total}
            onClose={() => setPayingOrder(null)}
            onSuccess={() => {
              qc.invalidateQueries({ queryKey: ["cashier", "orders"] })
              setPayingOrder(null)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}