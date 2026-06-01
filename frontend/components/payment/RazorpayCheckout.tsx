"use client";

/**
 * components/payment/RazorpayCheckout.tsx
 *
 * Loads the Razorpay checkout.js script dynamically (no npm install needed),
 * creates a Razorpay order via the backend, opens the modal, and on success
 * calls the backend /payment-gateway/verify endpoint before invoking onSuccess.
 *
 * Backend contract:
 *   POST /payment-gateway/create-order → { razorpay_order_id, amount, currency, key_id }
 *   POST /payment-gateway/verify       → { success, payment_id, receipt_url }
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreateOrderResponse {
  razorpay_order_id: string;
  amount: number;   // in paise
  currency: string;
  key_id: string;
}

interface VerifyResponse {
  success: boolean;
  payment_id: string;
  receipt_url: string | null;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutProps {
  orderId: string;
  /** Amount in rupees (the component converts to paise for Razorpay) */
  amount: number;
  onSuccess: (paymentId: string) => void;
  onFailure?: () => void;
  /** Optional label override for the pay button */
  label?: string;
  disabled?: boolean;
}

// ── Script loader (idempotent) ────────────────────────────────────────────────

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);

    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      // Script tag exists but Razorpay may not be ready yet — poll briefly
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        if ((window as any).Razorpay) {
          clearInterval(poll);
          resolve(true);
        } else if (attempts > 20) {
          clearInterval(poll);
          resolve(false);
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RazorpayCheckout({
  orderId,
  amount,
  onSuccess,
  onFailure,
  label,
  disabled = false,
}: RazorpayCheckoutProps) {
  const { user } = useAuth();
  const [scriptReady, setScriptReady] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preload Razorpay script as soon as the component mounts
  useEffect(() => {
    loadRazorpayScript().then((ok) => {
      setScriptReady(ok);
      if (!ok) setError("Failed to load payment gateway. Please refresh.");
    });
  }, []);

  const handlePay = useCallback(async () => {
    setError(null);

    if (!scriptReady) {
      const ok = await loadRazorpayScript();
      if (!ok) {
        setError("Payment gateway unavailable. Please refresh the page.");
        return;
      }
      setScriptReady(true);
    }

    setCreatingOrder(true);

    let orderData: CreateOrderResponse;
    try {
      orderData = await apiClient.post<CreateOrderResponse>(
        "/payment-gateway/create-order",
        { order_id: orderId, amount },
      );
    } catch (err: any) {
      setCreatingOrder(false);
      const msg = err?.message ?? "Could not create payment order";
      setError(msg);
      toast.error(msg);
      return;
    }

    setCreatingOrder(false);

    const rzp = new (window as any).Razorpay({
      key: orderData.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      order_id: orderData.razorpay_order_id,
      amount: orderData.amount,          // already in paise from backend
      currency: orderData.currency,
      name: "DineLuxe",
      description: `Order #${orderId.slice(-8).toUpperCase()}`,
      image: "/logo.png",
      theme: { color: "#E8A020" },
      prefill: {
        name: user?.name ?? "",
        email: user?.email ?? "",
        contact: (user as any)?.phone ?? "",
      },
      handler: async (response: RazorpayResponse) => {
        try {
          const verified = await apiClient.post<VerifyResponse>(
            "/payment-gateway/verify",
            {
              order_id: orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            },
          );
          if (verified.success) {
            toast.success("Payment successful!");
            onSuccess(response.razorpay_payment_id);
          } else {
            throw new Error("Verification returned success=false");
          }
        } catch (verifyErr: any) {
          const msg = verifyErr?.message ?? "Payment verification failed";
          setError(msg);
          toast.error(msg);
          onFailure?.();
        }
      },
      modal: {
        ondismiss: () => {
          // User closed the modal without paying — not an error
          toast.info("Payment cancelled");
        },
      },
    });

    rzp.on("payment.failed", (failResponse: any) => {
      const msg =
        failResponse?.error?.description ?? "Payment failed. Please try again.";
      setError(msg);
      toast.error(msg);
      onFailure?.();
    });

    rzp.open();
  }, [scriptReady, orderId, amount, user, onSuccess, onFailure]);

  const isLoading = creatingOrder;
  const buttonLabel = label ?? `Pay ₹${amount.toFixed(2)}`;

  return (
    <div className="w-full space-y-3">
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={disabled || isLoading || !!error}
        className="
          w-full flex items-center justify-center gap-2
          bg-[#1A3C5E] hover:bg-[#15324f] active:scale-[0.98]
          text-white font-semibold text-sm
          py-4 rounded-2xl shadow-md
          transition-all duration-150
          disabled:opacity-60 disabled:cursor-not-allowed
        "
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Preparing payment…</span>
          </>
        ) : (
          <>
            <CreditCard size={18} />
            <span>{buttonLabel}</span>
          </>
        )}
      </button>

      <p className="text-center text-[11px] text-gray-400">
        Secured by{" "}
        <span className="font-semibold text-gray-500">Razorpay</span> · Card,
        Net Banking, UPI
      </p>
    </div>
  );
}