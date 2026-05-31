"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { usePaymentConfirmed } from "@/hooks/usePaymentConfirmed"
import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  IndianRupee,
  QrCode,
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActiveOrder {
  id: string
  status: string
  total: number
  tax?: number
  created_at: string
  tables?: { label: string; floor_number: number } | null
  order_items: Array<{
    id: string
    quantity: number
    notes?: string
    menu_items: { name: string; price: number }
  }>
}

interface OrderDetail extends ActiveOrder {
  tax?: number
  subtotal?: number
}

type PaymentMethod = "cash" | "card" | "upi"

const PAYMENT_METHODS: { id: PaymentMethod; label: string; Icon: React.ElementType }[] = [
  { id: "cash", label: "Cash", Icon: IndianRupee },
  { id: "card", label: "Card", Icon: CreditCard },
  { id: "upi", label: "UPI", Icon: QrCode },
]

// ── helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function calcSubtotal(order: ActiveOrder) {
  return order.order_items.reduce(
    (s, i) => s + i.menu_items.price * i.quantity,
    0
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CashierPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null)

  usePaymentConfirmed({
    branchId: branchId ?? undefined,
    onPaymentConfirmed: () => {
      qc.invalidateQueries({ queryKey: ["cashier", "active-orders", branchId] })
      qc.invalidateQueries({ queryKey: ["cashier", "order-detail"] })
    },
  })

  // ── Queries ──────────────────────────────────────────────────────────────────

  const {
    data: orders = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["cashier", "active-orders", branchId],
    queryFn: () =>
      apiClient.get<ActiveOrder[]>(`/orders/branch/${branchId}/active`),
    enabled: !!branchId,
    refetchInterval: 20_000,
  })

  // Fetch full order detail when a row is expanded (for accurate totals/tax)
  const { data: orderDetail } = useQuery({
    queryKey: ["cashier", "order-detail", expandedId],
    queryFn: () => apiClient.get<OrderDetail>(`/orders/${expandedId}`),
    enabled: !!expandedId,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const initiatePayment = useMutation({
    mutationFn: ({
      orderId,
      method,
    }: {
      orderId: string
      method: PaymentMethod
    }) =>
      apiClient.post("/payments/initiate", {
        order_id: orderId,
        payment_method: method,
      }),
    onSuccess: (_, vars) => {
      setConfirmedOrderId(vars.orderId)
      setPayingOrderId(null)
      qc.invalidateQueries({ queryKey: ["cashier", "active-orders", branchId] })
    },
  })

  // ── Derived ───────────────────────────────────────────────────────────────────

  const displayOrder = orderDetail ?? orders.find((o) => o.id === expandedId)
  const subtotal = displayOrder ? calcSubtotal(displayOrder) : 0
  const tax = displayOrder?.tax ?? Math.round(subtotal * 0.05)
  const total = displayOrder?.total ?? subtotal + tax

  function toggleRow(id: string) {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    setPayingOrderId(null)
    setConfirmedOrderId(null)
  }

  // ── Print ─────────────────────────────────────────────────────────────────────

  function printReceipt() {
    window.print()
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <PageWrapper title="Cashier" subtitle="Process payments for active orders">
      {/* Top refresh */}
      <div className="flex justify-end mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="text-gray-500 gap-1"
        >
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {/* ── Orders table ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CheckCircle2 className="mx-auto mb-3 text-gray-200" size={44} />
          <p>No active orders right now.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_100px_100px_80px_40px] gap-3 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Table / Order</span>
            <span>Status</span>
            <span>Time</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          {orders.map((order) => {
            const isExpanded = expandedId === order.id
            const isConfirmed = confirmedOrderId === order.id

            return (
              <div key={order.id} className="border-b border-gray-100 last:border-0">
                {/* Summary row */}
                <button
                  onClick={() => toggleRow(order.id)}
                  className="w-full grid grid-cols-[1fr_100px_100px_80px_40px] gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left items-center"
                >
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {order.tables ? `Table ${order.tables.label}` : "Takeaway"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {order.order_items.length} item
                      {order.order_items.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <StatusBadge status={order.status} size="sm" />

                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={11} />
                    {formatTime(order.created_at)}
                  </span>

                  <span className="text-right font-semibold text-gray-900 text-sm">
                    ₹{order.total}
                  </span>

                  <span className="flex justify-center text-gray-400">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {/* Expanded detail */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 border-t border-gray-100 pt-4">

                        {/* ── Order items ───────────────────────────────── */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            Order Items
                          </h4>
                          <div className="space-y-2">
                            {(displayOrder?.order_items ?? order.order_items).map(
                              (item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start justify-between text-sm py-2 border-b border-gray-50"
                                >
                                  <div>
                                    <p className="font-medium text-gray-800">
                                      {item.quantity}× {item.menu_items.name}
                                    </p>
                                    {item.notes && (
                                      <p className="text-xs text-amber-600 mt-0.5">
                                        {item.notes}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-gray-500 shrink-0 ml-4">
                                    ₹{item.menu_items.price * item.quantity}
                                  </span>
                                </div>
                              )
                            )}
                          </div>

                          {/* Totals */}
                          <div className="mt-4 space-y-1.5 text-sm">
                            <div className="flex justify-between text-gray-500">
                              <span>Subtotal</span>
                              <span>₹{subtotal}</span>
                            </div>
                            <div className="flex justify-between text-gray-500">
                              <span>Tax (5%)</span>
                              <span>₹{tax}</span>
                            </div>
                            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2 mt-2">
                              <span>Total</span>
                              <span>₹{total}</span>
                            </div>
                          </div>
                        </div>

                        {/* ── Payment panel ──────────────────────────────── */}
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          {isConfirmed ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                              <CheckCircle2
                                className="text-green-500"
                                size={40}
                              />
                              <p className="font-semibold text-gray-800">
                                Payment confirmed!
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={printReceipt}
                                className="gap-1.5"
                              >
                                <Printer size={14} />
                                Print Receipt
                              </Button>
                            </div>
                          ) : (
                            <>
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                Payment
                              </h4>

                              {/* Method selector */}
                              <div className="grid grid-cols-3 gap-2 mb-4">
                                {PAYMENT_METHODS.map(({ id, label, Icon }) => (
                                  <button
                                    key={id}
                                    onClick={() => setPaymentMethod(id)}
                                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 py-3 text-xs font-medium transition-all ${
                                      paymentMethod === id
                                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                                    }`}
                                  >
                                    <Icon size={18} />
                                    {label}
                                  </button>
                                ))}
                              </div>

                              {/* Amount summary */}
                              <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4 text-sm space-y-1">
                                <div className="flex justify-between text-gray-500">
                                  <span>Amount due</span>
                                  <span className="font-bold text-gray-900">
                                    ₹{total}
                                  </span>
                                </div>
                                <div className="flex justify-between text-gray-400 text-xs">
                                  <span>Method</span>
                                  <span className="capitalize">{paymentMethod}</span>
                                </div>
                              </div>

                              {/* Error */}
                              {initiatePayment.isError && (
                                <p className="text-xs text-red-500 flex items-center gap-1 mb-3">
                                  <AlertCircle size={12} />
                                  Payment failed. Please try again.
                                </p>
                              )}

                              {/* Action buttons */}
                              <div className="space-y-2">
                                <Button
                                  className="w-full gap-1.5"
                                  disabled={
                                    initiatePayment.isPending &&
                                    payingOrderId === order.id
                                  }
                                  onClick={() => {
                                    setPayingOrderId(order.id)
                                    initiatePayment.mutate({
                                      orderId: order.id,
                                      method: paymentMethod,
                                    })
                                  }}
                                >
                                  <CheckCircle2 size={15} />
                                  {initiatePayment.isPending &&
                                  payingOrderId === order.id
                                    ? "Processing…"
                                    : "Confirm Payment"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full gap-1.5 text-gray-600"
                                  onClick={printReceipt}
                                >
                                  <Printer size={13} />
                                  Print Bill
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </PageWrapper>
  )
}