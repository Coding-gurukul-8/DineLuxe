"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft, Printer, Star, CheckCircle2, Loader2,
  Receipt, CreditCard, Clock, Store,
} from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatDateTime, cn } from "@/lib/utils";
import type { Order } from "@/types/api";

interface OrderWithMeta extends Order {
  restaurant_name?: string;
  branch_name?: string;
  subtotal?: number;
  tax?: number;
  tip?: number;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-2" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button key={star} type="button" whileTap={{ scale: 0.8 }} whileHover={{ scale: 1.15 }}
          onClick={() => onChange(star)} onMouseEnter={() => setHovered(star)} aria-label={`${star} star`}>
          <Star size={32} className={cn("transition-colors", (hovered || value) >= star ? "text-[#E8A020] fill-[#E8A020]" : "text-gray-300")} />
        </motion.button>
      ))}
    </div>
  );
}

function injectPrintStyles() {
  const existing = document.getElementById("print-styles");
  if (existing) return;
  const style = document.createElement("style");
  style.id = "print-styles";
  style.textContent = `@media print { body > *:not(#printable-receipt) { display: none !important; } #printable-receipt { display: block !important; position: fixed; inset: 0; background: white; padding: 24px; font-family: monospace; } }`;
  document.head.appendChild(style);
}

export default function ReceiptPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["customer", "order", orderId],
    queryFn: () => apiClient.get<OrderWithMeta>(`/orders/${orderId}`),
    enabled: !!orderId,
  });

  const { mutate: submitReview, isPending: reviewPending } = useMutation({
    mutationFn: () => apiClient.post("/reviews", { order_id: orderId, rating, comment }),
    onSuccess: () => { toast.success("Thanks for your feedback!"); setReviewed(true); },
    onError: () => toast.error("Could not submit review. Please try again."),
  });

  const handlePrint = () => { injectPrintStyles(); window.print(); };

  if (isLoading) return (
    <div className="min-h-screen bg-[#FAF7F4] flex items-center justify-center">
      <Loader2 size={32} className="text-[#E8A020] animate-spin" />
    </div>
  );

  if (isError || !order) return (
    <div className="min-h-screen bg-[#FAF7F4] flex flex-col items-center justify-center gap-4 px-6">
      <Receipt size={40} className="text-gray-300" />
      <p className="text-gray-500 text-sm text-center">Could not load receipt. Please try again.</p>
      <button onClick={() => router.back()} className="text-[#E8A020] font-semibold text-sm">Go Back</button>
    </div>
  );

  const items = order.order_items ?? [];
  const payment = order.payment;
  const subtotal = order.subtotal ?? order.total ?? 0;
  const tax = order.tax ?? payment?.tax_amount ?? 0;
  const tip = order.tip ?? 0;
  const discount = payment?.discount_amount ?? 0;
  const grandTotal = payment?.amount ?? order.total ?? subtotal + tax + tip - discount;
  const RATINGLABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">
      <div id="printable-receipt" className="hidden">
        <div style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: "bold" }}>{order.restaurant_name ?? "DineLuxe"}</div>
            {order.branch_name && <div style={{ fontSize: 12 }}>{order.branch_name}</div>}
            <div style={{ fontSize: 11, color: "#666" }}>{formatDateTime(order.created_at)}</div>
            <div style={{ fontSize: 11 }}>Order #{order.id.slice(-8).toUpperCase()}</div>
          </div>
          <hr />
          {items.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span>{item.quantity}× {item.menu_item?.name ?? "Item"}</span>
              <span>{formatCurrency(item.unit_price * item.quantity)}</span>
            </div>
          ))}
          <hr />
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          {tax > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>GST</span><span>{formatCurrency(tax)}</span></div>}
          {tip > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tip</span><span>{formatCurrency(tip)}</span></div>}
          {discount > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Discount</span><span>−{formatCurrency(discount)}</span></div>}
          <hr />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: 15 }}>
            <span>Total</span><span>{formatCurrency(grandTotal)}</span>
          </div>
          {payment && <div style={{ marginTop: 8, fontSize: 11, color: "#666" }}>Paid via {payment.method.toUpperCase()}{payment.transaction_ref && ` · Ref: ${payment.transaction_ref}`}</div>}
        </div>
      </div>

      <div className="bg-linear-to-br from-[#1A3C5E] to-[#0D2A45] px-4 pt-12 pb-8 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[#E8A020]/10" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-5">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
              <ChevronLeft size={18} className="text-white" />
            </motion.button>
            <div>
              <p className="text-[#E8A020] text-xs font-semibold uppercase tracking-widest">Receipt</p>
              <h1 className="text-white font-bold text-xl">Order Summary</h1>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store size={14} className="text-[#E8A020]" />
                <span className="text-white font-semibold text-sm">{order.restaurant_name ?? "DineLuxe"}</span>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="flex items-center gap-2 text-white/60 text-xs">
              <Clock size={12} /><span>{formatDateTime(order.created_at)}</span>
            </div>
            <div className="text-white/50 text-xs">Order #{order.id.slice(-8).toUpperCase()}</div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Items Ordered</p>
          </div>
          <div className="divide-y divide-gray-50">
            {items.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex gap-3 flex-1 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-[#E8A020]/10 text-[#E8A020] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{item.quantity}×</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.menu_item?.name ?? "Item"}</p>
                    {item.notes && <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>}
                    {item.addons && item.addons.length > 0 && <p className="text-xs text-gray-400 mt-0.5">+{item.addons.map((a) => a.name).join(", ")}</p>}
                  </div>
                </div>
                <p className="text-sm font-bold text-gray-900 shrink-0">{formatCurrency(item.unit_price * item.quantity)}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bill Details</p>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {tax > 0 && <div className="flex justify-between text-sm text-gray-600"><span>GST & Taxes</span><span>{formatCurrency(tax)}</span></div>}
            {tip > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Tip</span><span>{formatCurrency(tip)}</span></div>}
            {discount > 0 && <div className="flex justify-between text-sm text-green-600 font-medium"><span>Discount</span><span>−{formatCurrency(discount)}</span></div>}
            <div className="pt-2.5 border-t border-gray-100 flex justify-between items-center">
              <span className="font-bold text-gray-900">Grand Total</span>
              <span className="font-bold text-xl text-[#1A3C5E]">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </motion.div>

        {payment && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-[#1A3C5E]/5 rounded-2xl px-4 py-3 flex items-center gap-3">
            <CreditCard size={18} className="text-[#1A3C5E] shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Payment</p>
              <p className="text-sm font-semibold text-gray-900">{payment.method.toUpperCase()}{payment.transaction_ref && <span className="text-gray-400 font-normal ml-2 text-xs">Ref: {payment.transaction_ref}</span>}</p>
            </div>
            <StatusBadge status={payment.status} className="ml-auto" />
          </motion.div>
        )}

        <motion.button whileTap={{ scale: 0.97 }} onClick={handlePrint} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-[#1A3C5E] text-[#1A3C5E] font-semibold text-sm">
          <Printer size={18} />Download / Print Receipt
        </motion.button>

        <AnimatePresence mode="wait">
          {reviewed ? (
            <motion.div key="reviewed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="bg-green-50 border border-green-100 rounded-2xl p-5 flex items-center gap-3">
              <CheckCircle2 size={22} className="text-green-500 shrink-0" />
              <div>
                <p className="font-semibold text-green-700 text-sm">Review submitted!</p>
                <p className="text-xs text-green-500 mt-0.5">Thanks for helping us improve.</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="rate-form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Rate Your Order</p>
                <p className="text-sm text-gray-500">How was your experience?</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <StarRating value={rating} onChange={setRating} />
                {rating > 0 && (
                  <motion.p key={rating} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-semibold text-[#E8A020]">{RATINGLABELS[rating]}</motion.p>
                )}
              </div>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us more (optional)…" rows={3} className="w-full text-sm bg-gray-50 rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E8A020]/40 resize-none" />
              <motion.button whileTap={{ scale: 0.97 }} disabled={rating === 0 || reviewPending} onClick={() => submitReview()} className={cn("w-full py-3.5 rounded-2xl font-bold text-white text-sm transition-all", rating > 0 ? "bg-[#E8A020] shadow-md shadow-[#E8A020]/30" : "bg-gray-200 cursor-not-allowed")}>
                {reviewPending ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />Submitting…</span> : "Submit Review"}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}