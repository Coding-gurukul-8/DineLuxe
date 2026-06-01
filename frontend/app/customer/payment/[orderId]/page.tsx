"use client";

/**
 * app/customer/payment/[orderId]/page.tsx
 *
 * Customer-facing payment page. Wires up all three new payment components:
 *   - UPIQRSheet      (real QR from backend + 3s polling)
 *   - RazorpayCheckout (card / net banking via Razorpay modal)
 *   - SplitBillSheet  (even-split or item-by-item)
 *
 * The "cash" and "wallet" tabs keep their existing UI (staff handles those).
 *
 * API used:
 *   GET /orders/:orderId → Order (order_items joined, status)
 *   GET /branches/:branchId → Branch (for branch name in UPI QR)
 */

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  Smartphone,
  CreditCard,
  Wallet,
  Users,
  Banknote,
  Loader2,
} from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, cn } from "@/lib/utils";
import { UPIQRSheet } from "@/components/payment/UPIQRSheet";
import { RazorpayCheckout } from "@/components/payment/RazorpayCheckout";
import { SplitBillSheet } from "@/components/payment/SplitBillSheet";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  name?: string;
  quantity: number;
  unit_price: number;
  menu_items?: { name: string; price: number };
}

interface Order {
  id: string;
  status: string;
  branch_id: string;
  order_items?: OrderItem[];
  branches?: { name: string; address: string };
}

interface PaymentMethod {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "upi",   label: "UPI / QR",   icon: Smartphone, description: "Scan & pay instantly" },
  { id: "card",  label: "Card",        icon: CreditCard, description: "Credit / Debit via Razorpay" },
  { id: "split", label: "Split Bill",  icon: Users,      description: "Divide among friends" },
  { id: "cash",  label: "Cash",        icon: Banknote,   description: "Pay at counter" },
  { id: "wallet",label: "Wallet",      icon: Wallet,     description: "Digital wallet" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeTotal(order: Order): number {
  if (!order.order_items?.length) return 0;
  return order.order_items.reduce(
    (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
    0,
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface Props { params: Promise<{ orderId: string }> }

export default function PaymentPage({ params }: Props) {
  const { orderId } = use(params);
  const router = useRouter();
  const [activeMethod, setActiveMethod] = useState("upi");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => apiClient.get<Order>(`/orders/${orderId}`),
  });

  // Guard: if already paid, redirect to success
  useEffect(() => {
    if (order?.status === "paid") {
      router.replace("/customer/payment/success");
    }
  }, [order?.status, router]);

  const total = order ? computeTotal(order) : 0;
  const branchName = order?.branches?.name ?? "DineLuxe";

  function handleSuccess(label = "Payment confirmed!") {
    toast.success(label);
    router.push("/customer/payment/success");
  }

  if (isLoading || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#E8A020]" size={32} />
      </div>
    );
  }

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <ChevronLeft size={18} className="text-gray-700" />
        </motion.button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payment</h1>
          <p className="text-xs text-gray-500">
            Order #{orderId.slice(-6).toUpperCase()}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-lg font-bold text-gray-900">
            {formatCurrency(total)}
          </p>
        </div>
      </div>

      {/* Method tab strip */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6 pb-1">
        {PAYMENT_METHODS.map((m) => {
          const Icon = m.icon;
          const isActive = activeMethod === m.id;
          return (
            <motion.button
              key={m.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveMethod(m.id)}
              className={cn(
                "shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-2xl border-2 transition-all text-xs font-semibold",
                isActive
                  ? "border-[#E8A020] bg-[#E8A020]/8 text-[#E8A020]"
                  : "border-gray-100 bg-white text-gray-500",
              )}
            >
              <Icon size={18} />
              {m.label}
              {isActive && (
                <motion.div
                  layoutId="methodUnderline"
                  className="h-0.5 w-6 bg-[#E8A020] rounded-full"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Panel */}
      <AnimatePresence mode="wait">

        {/* ── UPI QR ── */}
        {activeMethod === "upi" && (
          <motion.div
            key="upi"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <UPIQRSheet
              orderId={orderId}
              amount={total}
              branchName={branchName}
              onSuccess={() => handleSuccess("UPI payment confirmed!")}
            />
          </motion.div>
        )}

        {/* ── Card via Razorpay ── */}
        {activeMethod === "card" && (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4"
          >
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Pay with Card or Net Banking
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Razorpay checkout opens in a popup. Supports all major cards,
                UPI, and net banking.
              </p>
            </div>
            <RazorpayCheckout
              orderId={orderId}
              amount={total}
              onSuccess={() => handleSuccess("Card payment confirmed!")}
              onFailure={() => toast.error("Payment failed. Please try again.")}
            />
          </motion.div>
        )}

        {/* ── Split Bill ── */}
        {activeMethod === "split" && (
          <motion.div
            key="split"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <SplitBillSheet
              orderId={orderId}
              totalAmount={total}
              branchName={branchName}
              onSplitComplete={() => handleSuccess("All portions paid!")}
            />
          </motion.div>
        )}

        {/* ── Cash ── */}
        {activeMethod === "cash" && (
          <motion.div
            key="cash"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center space-y-4"
          >
            <Banknote size={40} className="mx-auto text-[#E8A020]" />
            <div>
              <p className="text-base font-semibold text-gray-800">
                Pay at the counter
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Hand{" "}
                <span className="font-bold text-gray-700">
                  {formatCurrency(total)}
                </span>{" "}
                cash to the cashier. They will mark your order as paid.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              Please keep your order number ready:{" "}
              <span className="font-bold">#{orderId.slice(-6).toUpperCase()}</span>
            </div>
          </motion.div>
        )}

        {/* ── Wallet ── */}
        {activeMethod === "wallet" && (
          <motion.div
            key="wallet"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-3"
          >
            {["Paytm Wallet", "Amazon Pay", "Mobikwik"].map((w) => (
              <motion.button
                key={w}
                whileTap={{ scale: 0.98 }}
                className="w-full text-left bg-white rounded-2xl p-4 border-2 border-gray-100 shadow-sm flex items-center justify-between hover:border-[#E8A020]/50 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-800">{w}</span>
                <ChevronLeft size={16} className="text-gray-400 rotate-180" />
              </motion.button>
            ))}
          </motion.div>
        )}

      </AnimatePresence>
    </PageWrapper>
  );
}