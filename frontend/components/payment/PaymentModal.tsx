"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Split,
  Loader2,
  Tag,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { RazorpayCheckout } from "./RazorpayCheckout"; // P3-7 ENHANCEMENT
import { UPIQRSheet } from "./UPIQRSheet"; // P3-7 ENHANCEMENT
import { SplitBillSheet } from "./SplitBillSheet"; // P3-7 ENHANCEMENT
 
interface PaymentModalProps {
  orderId: string;
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}
 
const METHOD_META = {
  cash: { icon: Banknote, label: "Cash", color: "text-green-600" }, // P3-7 ENHANCEMENT
  card: { icon: CreditCard, label: "Card", color: "text-blue-600" }, // P3-7 ENHANCEMENT
  upi: { icon: Smartphone, label: "UPI", color: "text-purple-600" }, // P3-7 ENHANCEMENT
  online: { icon: Globe, label: "Online", color: "text-indigo-600" }, // P3-7 ENHANCEMENT
  split: { icon: Split, label: "Split", color: "text-orange-600" }, // P3-7 ENHANCEMENT
};
 
export function PaymentModal({ orderId, total, onClose, onSuccess }: PaymentModalProps) {
  const qc = useQueryClient();
  const [method,  setMethod]   = useState("cash");
  const [discount,setDiscount] = useState(0);
  const [coupon,  setCoupon]   = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [split,   setSplit]    = useState({ cash:0, card:0, upi:0 });
 
  // P3-7 ENHANCEMENT: allow server-calculated total after coupon apply.
  const [serverTotalOverride, setServerTotalOverride] = useState<number | null>(null);
  const finalTotal = Math.max(0, serverTotalOverride ?? total - discount);

 
  const { mutate: applyCoupon, isPending: applyingCoupon } = useMutation({
    mutationFn: () =>
      apiClient.post<{ discount: number; coupon_id: string; new_total: number }>(
        `/orders/${orderId}/apply-coupon`,
        { code: coupon }
      ),
    onSuccess: (data) => {
      // P3-7 ENHANCEMENT: backend returns server-calculated totals.
      setDiscount(data.discount);
      setServerTotalOverride(data.new_total ?? null);
      setCouponApplied(true);
      toast.success("Coupon applied!");
    },
    onError: () => toast.error("Invalid or expired coupon"),
  });

 
  const { mutate: pay, isPending } = useMutation({
    mutationFn: () => method === "split"
      ? apiClient.post(`/payments/split`, {
          order_id: orderId,
          splits: Object.entries(split)
            .filter(([, amount]) => amount > 0)
            .map(([paymentMethod, amount]) => ({
              label: paymentMethod.toUpperCase(),
              amount,
              payment_method: paymentMethod,
            })),
        })
      : apiClient.post(`/payments/initiate`, {
          order_id: orderId,
          payment_method: method === "upi" ? "upi" : method === "card" ? "card" : "cash",
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:["orders"] });
      toast.success("Payment successful!");
      onSuccess();
    },
    onError: () => toast.error("Payment failed - please try again"),
  });
 
  const splitTotal = split.cash + split.card + split.upi;
  const splitValid = method !== "split" || Math.abs(splitTotal - finalTotal) < 1;

  // P3-7 ENHANCEMENT: UI-level modes for richer digital flows.
  const [upiSubTab, setUpiSubTab] = useState<"offline" | "qr">("offline"); // for method === 'upi'
  const [showSplitQR, setShowSplitQR] = useState(false); // for method === 'split'

  // P3-7 ENHANCEMENT: Razorpay availability
  const razorpayConfigured =
    typeof window !== "undefined" && Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);

  // P3-7 ENHANCEMENT: shared callback for digital (Razorpay/UPIQR/Split QR) success.
  const handleDigitalSuccess = () => {
    qc.invalidateQueries({ queryKey: ["orders"] });
    toast.success("Payment successful!");
    onSuccess();
  };

  return (

    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-md sm:rounded-md rounded-t-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-base">Process Payment</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <X size={18} className="text-gray-500"/>
          </button>
        </div>
 
        <div className="px-5 py-4 space-y-5">
          {/* Amount */}
          <div className="bg-gray-50 rounded-xl px-5 py-4 text-center">
            <p className="text-sm text-gray-500">Amount Due</p>
            <p className="text-4xl font-extrabold text-[#1A3C5E] mt-1">{formatCurrency(finalTotal)}</p>
            {discount > 0 && <p className="text-xs text-green-600 mt-1">Saved {formatCurrency(discount)}</p>}
          </div>
 
          {/* Coupon */}
          {!couponApplied && (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3">
                <Tag size={14} className="text-gray-400"/>
                <input value={coupon} onChange={e => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Coupon code" className="flex-1 text-sm py-2.5 outline-none"/>
              </div>
              <button onClick={() => applyCoupon()} disabled={!coupon || applyingCoupon}
                className="px-4 py-2.5 bg-[#E8A020] text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-[#d08f1a] transition">
                {applyingCoupon ? <Loader2 size={14} className="animate-spin"/> : "Apply"}
              </button>
            </div>
          )}
 
          {/* Method */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Payment Method</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "cash", label: "Cash" },
                  { key: "card", label: "Card" },
                  { key: "upi", label: "UPI" },
                  // P3-7 ENHANCEMENT: show Online tab only when Razorpay is configured.
                  ...(razorpayConfigured ? [{ key: "online", label: "Online" }] : []),
                  { key: "split", label: "Split" },
                ] as const
              ).map(({ key, label }) => {
                const meta = (METHOD_META as any)[key];
                const Icon = meta?.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setMethod(key)}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium transition",
                      method === key
                        ? "border-[#1A3C5E] bg-[#1A3C5E]/5 text-[#1A3C5E]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    )}
                  >
                    {Icon && <Icon size={16} />}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
 
 
          {/* P3-7 ENHANCEMENT: UPI offline/QR + Split QR + Online Razorpay */}

          {method === "upi" && (
            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <div className="flex gap-2 bg-white border border-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setUpiSubTab("offline")}
                  className={cn(
                    "flex-1 text-xs font-semibold py-2.5 rounded-lg transition",
                    upiSubTab === "offline"
                      ? "bg-white text-[#1A3C5E] shadow"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Offline UPI
                </button>
                <button
                  onClick={() => setUpiSubTab("qr")}
                  className={cn(
                    "flex-1 text-xs font-semibold py-2.5 rounded-lg transition",
                    upiSubTab === "qr"
                      ? "bg-white text-[#1A3C5E] shadow"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  Show QR Code
                </button>
              </div>

              {upiSubTab === "offline" ? (
                <div className="text-xs text-gray-500">
                  Waiter will record payment confirmation from the customer.
                </div>
              ) : (
                <UPIQRSheet
                  orderId={orderId}
                  amount={finalTotal}
                  branchName="Restaurant"
                  onSuccess={() => handleDigitalSuccess()}
                />
              )}
            </div>
          )}

          {method === "online" && razorpayConfigured && (
            <div className="bg-gray-50 rounded-xl p-4">
              <RazorpayCheckout
                orderId={orderId}
                amount={finalTotal}
                onSuccess={() => handleDigitalSuccess()}
              />
            </div>
          )}

          {/* Split Inputs (kept) */}
          {method === "split" && (
            <div className="space-y-3 bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500 font-medium">
                  Enter amounts (total: {formatCurrency(finalTotal)})
                </p>
                <button
                  onClick={() => setShowSplitQR((v) => !v)}
                  className={cn(
                    "text-xs font-semibold px-3 py-2 rounded-xl border transition",
                    showSplitQR
                      ? "border-[#1A3C5E]/30 bg-[#1A3C5E]/5 text-[#1A3C5E]"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  )}
                >
                  Use Split QR
                </button>
              </div>

              {!showSplitQR && (
                <>
                  {(["cash", "card", "upi"] as const).map((k) => (
                    <div key={k} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 capitalize w-10">{k}</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={split[k] || ""}
                        onChange={(e) => setSplit((prev) => ({ ...prev, [k]: Number(e.target.value) }))}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
                      />
                    </div>
                  ))}
                  {!splitValid && splitTotal > 0 && (
                    <p className="text-xs text-red-500">
                      Split total {formatCurrency(splitTotal)} != Bill {formatCurrency(finalTotal)}
                    </p>
                  )}
                </>
              )}

              {showSplitQR && (
                <SplitBillSheet
                  orderId={orderId}
                  totalAmount={finalTotal}
                  branchName="Restaurant"
                  onSplitComplete={() => handleDigitalSuccess()}
                />
              )}
            </div>
          )}

        </div>
 
          {/* Confirm Button */}
          <div className="px-5 pb-6">
            {method === "online" && razorpayConfigured ? (
              <div className="text-xs text-gray-400 text-center py-2">
                Razorpay checkout button above will start payment.
              </div>
            ) : method === "upi" && upiSubTab === "qr" ? (
              <div className="text-xs text-gray-400 text-center py-2">
                Scan the QR code above to complete payment.
              </div>
            ) : method === "split" && showSplitQR ? (
              <div className="text-xs text-gray-400 text-center py-2">
                Split QR flow will collect payments automatically.
              </div>
            ) : (
              <button
                onClick={() => pay()}
                disabled={isPending || !splitValid}
                className="w-full py-4 bg-[#1A3C5E] hover:bg-[#15304d] text-white rounded-md font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isPending && <Loader2 size={16} className="animate-spin"/>}
                Confirm Payment  {formatCurrency(finalTotal)}
              </button>
            )}
          </div>

      </div>
    </div>
  );
}
