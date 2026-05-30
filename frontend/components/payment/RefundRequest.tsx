"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  X,
  RefreshCcw,
  ChevronRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

const REFUND_REASONS = [
  { value: "Food quality issue", label: "Food quality issue", emoji: "🍽️" },
  { value: "Wrong items delivered", label: "Wrong items delivered", emoji: "❌" },
  { value: "Order never arrived", label: "Order never arrived", emoji: "🚫" },
  { value: "Charged incorrectly", label: "Charged incorrectly", emoji: "💳" },
  { value: "Other", label: "Other", emoji: "✏️" },
] as const;

type ReasonValue = (typeof REFUND_REASONS)[number]["value"];

interface RefundRequestProps {
  orderId: string;
  paymentId: string;
  amount: number;
  onSuccess?: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RefundRequest({ orderId, paymentId, amount, onSuccess }: RefundRequestProps) {
  const [open, setOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReasonValue | null>(null);
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const shortId = orderId.slice(-8).toUpperCase();

  const { mutate: submitRefund, isPending } = useMutation({
    mutationFn: () => {
      const reason =
        selectedReason === "Other"
          ? details.trim()
          : selectedReason === null
          ? ""
          : details.trim()
          ? `${selectedReason}: ${details.trim()}`
          : selectedReason;

      return apiClient.post(`/payments/${orderId}/refund-request`, { reason });
    },
    onSuccess: () => {
      setSubmitted(true);
      onSuccess?.();
    },
    onError: (err: any) => {
      const msg = err?.message ?? "Failed to submit refund request. Please try again.";
      toast.error(msg);
    },
  });

  const isValid =
    selectedReason !== null &&
    (selectedReason !== "Other" || details.trim().length >= 10);

  function handleClose() {
    if (isPending) return;
    setOpen(false);
    // Reset after close animation
    setTimeout(() => {
      setSubmitted(false);
      setSelectedReason(null);
      setDetails("");
    }, 300);
  }

  return (
    <>
      {/* Trigger Button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:border-[#1A3C5E]/30 hover:text-[#1A3C5E] transition-colors group"
      >
        <span className="flex items-center gap-2">
          <RefreshCcw size={15} className="text-gray-400 group-hover:text-[#1A3C5E] transition-colors" />
          Request Refund
        </span>
        <ChevronRight size={15} className="text-gray-400 group-hover:text-[#1A3C5E] transition-colors" />
      </motion.button>

      {/* Overlay + Bottom Sheet */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[2px]"
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col"
            >
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-4 pt-1 border-b border-gray-100 shrink-0">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Request Refund</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Order #{shortId}</p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                  {submitted ? (
                    // ─── Success State ────────────────────────────────────
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center justify-center px-6 py-12 text-center"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                        className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4"
                      >
                        <CheckCircle2 size={32} className="text-green-500" />
                      </motion.div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        Request Submitted ✅
                      </h3>
                      <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                        Your refund request has been received. We'll review it and get
                        back to you within{" "}
                        <span className="font-semibold text-gray-700">24 hours</span>.
                      </p>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleClose}
                        className="mt-8 px-8 py-3 bg-[#1A3C5E] text-white text-sm font-semibold rounded-xl"
                      >
                        Done
                      </motion.button>
                    </motion.div>
                  ) : (
                    // ─── Form ─────────────────────────────────────────────
                    <motion.div
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="px-5 py-4 space-y-5"
                    >
                      {/* Order Summary */}
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-amber-700 font-medium">Refund Amount</p>
                          <p className="text-xl font-bold text-amber-800 mt-0.5">
                            {formatCurrency(amount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-amber-600">Order</p>
                          <p className="text-sm font-semibold text-amber-800">#{shortId}</p>
                        </div>
                      </div>

                      {/* Reason Selection */}
                      <div>
                        <p className="text-sm font-semibold text-gray-800 mb-3">
                          What went wrong?
                        </p>
                        <div className="space-y-2">
                          {REFUND_REASONS.map((r) => (
                            <motion.button
                              key={r.value}
                              whileTap={{ scale: 0.985 }}
                              onClick={() => setSelectedReason(r.value)}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                                selectedReason === r.value
                                  ? "border-[#1A3C5E] bg-[#1A3C5E]/5 text-[#1A3C5E]"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                              )}
                            >
                              <span className="text-base w-6 text-center">{r.emoji}</span>
                              <span className="text-sm font-medium flex-1">{r.label}</span>
                              <div
                                className={cn(
                                  "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                  selectedReason === r.value
                                    ? "border-[#1A3C5E] bg-[#1A3C5E]"
                                    : "border-gray-300"
                                )}
                              >
                                {selectedReason === r.value && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                )}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Details Textarea */}
                      <AnimatePresence>
                        {selectedReason !== null && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <label className="block text-sm font-semibold text-gray-800 mb-2">
                              Describe the issue
                              {selectedReason !== "Other" && (
                                <span className="font-normal text-gray-400 ml-1">(optional)</span>
                              )}
                            </label>
                            <textarea
                              value={details}
                              onChange={(e) => setDetails(e.target.value)}
                              placeholder={
                                selectedReason === "Other"
                                  ? "Please describe your issue in detail (min 10 characters)…"
                                  : "Add any additional details…"
                              }
                              rows={3}
                              className="w-full text-sm bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/30 focus:border-[#1A3C5E] resize-none transition-all placeholder:text-gray-400"
                            />
                            {selectedReason === "Other" && details.trim().length < 10 && details.length > 0 && (
                              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                <AlertCircle size={11} />
                                {10 - details.trim().length} more characters needed
                              </p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Notice */}
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2.5">
                        <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 leading-relaxed">
                          Refunds are typically processed within{" "}
                          <span className="font-semibold">5–7 business days</span> after approval.
                          You'll be notified via email once processed.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Submit Button — only shown when not submitted */}
              {!submitted && (
                <div className="shrink-0 px-5 py-4 border-t border-gray-100 bg-white">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    disabled={!isValid || isPending}
                    onClick={() => submitRefund()}
                    className={cn(
                      "w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all",
                      isValid && !isPending
                        ? "bg-[#1A3C5E] text-white shadow-sm hover:bg-[#1A3C5E]/90"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    )}
                  >
                    {isPending ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      "Submit Refund Request"
                    )}
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
