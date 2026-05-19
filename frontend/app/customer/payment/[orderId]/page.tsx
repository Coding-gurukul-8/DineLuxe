"use client"

import { use, useState, useEffect, useRef } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Banknote, CreditCard, Smartphone, ChevronRight, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"

// ── Types ────────────────────────────────────────────────────────────────────
interface Order {
  id: string; status: string; total: number; subtotal: number; tax: number
  items: { name: string; quantity: number; unitPrice: number }[]
}
interface PaymentInitResponse {
  payment_id: string
  razorpay_order_id?: string
  amount: number
  currency: string
  upi_link?: string
  upi_qr_url?: string
}

type PaymentMethod = "cash" | "card" | "upi"

const METHODS: { key: PaymentMethod; label: string; desc: string; icon: React.ElementType }[] = [
  { key: "cash", label: "Cash",      desc: "Pay at counter",                icon: Banknote    },
  { key: "card", label: "Card",      desc: "Debit / Credit card",            icon: CreditCard  },
  { key: "upi",  label: "UPI",       desc: "GPay, PhonePe, Paytm & more",   icon: Smartphone  },
]

interface Props { params: Promise<{ orderId: string }> }

export default function PaymentPage({ params }: Props) {
  const { orderId } = use(params)
  const router = useRouter()
  const [method, setMethod] = useState<PaymentMethod>("upi")
  const [paymentData, setPaymentData] = useState<PaymentInitResponse | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["order", orderId],
    queryFn: () => apiClient.get<Order>(`/orders/${orderId}`),
    enabled: !!orderId,
  })

  // Poll order status after payment initiated
  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = setInterval(async () => {
      try {
        const updated = await apiClient.get<Order>(`/orders/${orderId}`)
        if (updated.status !== "ready" && updated.status !== "confirmed" && updated.status !== "preparing") {
          clearInterval(pollingRef.current!)
          router.push(`/customer/payment/success?orderId=${orderId}`)
        }
      } catch { /* silent */ }
    }, 5_000)
  }

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current) }, [])

  const { mutate: initiatePayment, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post<PaymentInitResponse>("/payments/initiate", {
        order_id: orderId,
        payment_method: method,
      }),
    onSuccess: (data) => {
      setPaymentData(data)
      if (method === "cash") {
        // Cash: show confirmation, poll for status change
        startPolling()
      } else if (method === "upi") {
        startPolling()
      } else if (method === "card") {
        // Razorpay integration could open here; for now poll
        startPolling()
      }
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Payment initiation failed")
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="skeleton w-full max-w-md h-96 mx-4 rounded-xl" />
      </div>
    )
  }

  if (!order) return null

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-(--brand-primary) px-5 pt-12 pb-16 text-white">
        <Link href={`/customer/order/${orderId}`} className="flex items-center gap-2 mb-4 opacity-80 hover:opacity-100">
          <ArrowLeft size={18} /> Back to Order
        </Link>
        <h1 className="text-2xl font-bold">Payment</h1>
        <p className="opacity-80 mt-1">Order #{orderId.slice(-6).toUpperCase()}</p>
      </div>

      <div className="px-4 -mt-8 space-y-4">
        {/* Amount */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Total Amount</p>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(order.total)}</p>
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-sm text-gray-500">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{formatCurrency(order.tax)}</span></div>
          </div>
        </div>

        {/* Payment method selector */}
        {!paymentData && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-3">Payment Method</h2>
            <div className="space-y-2">
              {METHODS.map(({ key, label, desc, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setMethod(key)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-colors text-left",
                    method === key ? "border-brand-primary bg-brand-primary/5" : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", method === key ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-500")}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  {method === key && <div className="ml-auto w-4 h-4 rounded-full border-4 border-brand-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cash confirmation */}
        {paymentData && method === "cash" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <Banknote size={40} className="mx-auto text-green-600 mb-3" />
            <h3 className="font-semibold text-green-800 text-lg">Pay at Counter</h3>
            <p className="text-green-700 text-sm mt-1">Please proceed to the cashier with your order ID</p>
            <p className="font-mono text-green-900 text-lg font-bold mt-3">#{orderId.slice(-6).toUpperCase()}</p>
            <p className="text-xs text-green-600 mt-2">Waiting for cashier to confirm payment…</p>
            <Loader2 size={16} className="mx-auto mt-3 text-green-500 animate-spin" />
          </div>
        )}

        {/* UPI QR / link */}
        {paymentData && method === "upi" && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
            <Smartphone size={40} className="mx-auto text-brand-primary mb-3" />
            <h3 className="font-semibold text-gray-900">Pay via UPI</h3>
            {paymentData.upi_qr_url && (
              <img src={paymentData.upi_qr_url} alt="UPI QR" className="w-48 h-48 mx-auto mt-4 rounded-xl border" />
            )}
            {paymentData.upi_link && (
              <a href={paymentData.upi_link} className="mt-4 inline-block bg-brand-primary text-white px-6 py-2 rounded-full text-sm font-medium">
                Open UPI App
              </a>
            )}
            <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Waiting for payment confirmation…
            </p>
          </div>
        )}

        {/* Card */}
        {paymentData && method === "card" && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 text-center">
            <CreditCard size={40} className="mx-auto text-brand-primary mb-3" />
            <h3 className="font-semibold text-gray-900">Card Payment</h3>
            <p className="text-sm text-gray-500 mt-2">Please complete the payment at the card terminal.</p>
            <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Waiting for confirmation…
            </p>
          </div>
        )}

        {/* CTA */}
        {!paymentData && (
          <Button
            className="w-full py-4 text-base font-semibold"
            disabled={isPending}
            onClick={() => initiatePayment()}
          >
            {isPending ? <><Loader2 size={18} className="animate-spin mr-2" />Processing…</> : <>Pay {formatCurrency(order.total)} <ChevronRight size={18} className="ml-1" /></>}
          </Button>
        )}
      </div>
    </div>
  )
}