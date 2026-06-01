"use client";

/**
 * components/payment/UPIQRSheet.tsx
 *
 * Generates a UPI QR code via the backend, shows it with a countdown timer,
 * polls every 3 seconds for confirmation, and provides quick-launch links for
 * GPay, PhonePe, and Paytm.
 *
 * Backend contract:
 *   POST /payment-gateway/upi-qr     → { qr_data_url, transaction_ref, upi_link, amount, upi_id }
 *   GET  /payment-gateway/upi-status/:ref → { status: 'pending'|'completed'|'failed'|'expired' }
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UPIQRResponse {
  qr_data_url: string;
  transaction_ref: string;
  upi_link: string;
  amount: number;
  upi_id: string;
}

interface UPIStatusResponse {
  status: "pending" | "completed" | "failed" | "expired";
  transaction_ref: string;
}

type QRStatus = "idle" | "loading" | "showing" | "paid" | "failed" | "expired";

export interface UPIQRSheetProps {
  orderId: string;
  /** Amount in rupees */
  amount: number;
  branchName: string;
  onSuccess: () => void;
}

// ── UPI app deep-link builders ────────────────────────────────────────────────

function buildGPayLink(upiLink: string) {
  // GPay accepts standard upi:// links on Android; iOS uses a different scheme
  return upiLink.replace("upi://pay?", "gpay://upi/pay?");
}

function buildPhonePeLink(upiLink: string) {
  return upiLink.replace("upi://pay?", "phonepe://pay?");
}

function buildPaytmLink(upiLink: string) {
  return upiLink.replace("upi://pay?", "paytmmp://pay?");
}

// ── Countdown timer ───────────────────────────────────────────────────────────

function CountdownTimer({ seconds, total }: { seconds: number; total: number }) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const isWarning = seconds < 60;
  const r = 22;
  const circ = 2 * Math.PI * r;
  const progress = seconds / total;

  return (
    <div className="flex items-center gap-2">
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="#F3F4F6" strokeWidth="3" />
        <motion.circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={isWarning ? "#DC2626" : "#E8A020"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: circ * (1 - progress) }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </svg>
      <div>
        <p
          className={`text-sm font-bold tabular-nums ${
            isWarning ? "text-red-600" : "text-gray-700"
          }`}
        >
          {minutes}:{String(secs).padStart(2, "0")}
        </p>
        <p className="text-[10px] text-gray-400">remaining</p>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const QR_TTL_SECONDS = 15 * 60; // 15 minutes — matches Redis TTL on backend
const POLL_INTERVAL_MS = 3000;

export function UPIQRSheet({
  orderId,
  amount,
  branchName,
  onSuccess,
}: UPIQRSheetProps) {
  const [status, setStatus] = useState<QRStatus>("idle");
  const [qrData, setQrData] = useState<UPIQRResponse | null>(null);
  const [countdown, setCountdown] = useState(QR_TTL_SECONDS);
  const [manualConfirm, setManualConfirm] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── cleanup ──────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── poll for payment status ───────────────────────────────────────────────
  const startPolling = useCallback(
    (transactionRef: string) => {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await apiClient.get<UPIStatusResponse>(
            `/payment-gateway/upi-status/${transactionRef}`,
          );
          if (res.status === "completed") {
            stopPolling();
            setStatus("paid");
            toast.success("Payment received!");
            onSuccess();
          } else if (res.status === "failed") {
            stopPolling();
            setStatus("failed");
            toast.error("Payment failed. Please try again.");
          } else if (res.status === "expired") {
            stopPolling();
            setStatus("expired");
          }
        } catch {
          // Silent — transient network errors are fine; keep polling
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, onSuccess],
  );

  // ── generate QR ───────────────────────────────────────────────────────────
  const generateQR = useCallback(async () => {
    stopPolling();
    setStatus("loading");
    setCountdown(QR_TTL_SECONDS);
    setManualConfirm(false);

    try {
      const data = await apiClient.post<UPIQRResponse>(
        "/payment-gateway/upi-qr",
        { order_id: orderId, amount, branch_name: branchName },
      );
      setQrData(data);
      setStatus("showing");

      // Countdown
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((n) => {
          if (n <= 1) {
            stopPolling();
            setStatus("expired");
            return 0;
          }
          return n - 1;
        });
      }, 1000);

      startPolling(data.transaction_ref);
    } catch (err: any) {
      setStatus("idle");
      toast.error(err?.message ?? "Could not generate QR code");
    }
  }, [orderId, amount, branchName, stopPolling, startPolling]);

  // Auto-generate on mount
  useEffect(() => {
    generateQR();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── render states ─────────────────────────────────────────────────────────

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={32} className="animate-spin text-[#E8A020]" />
        <p className="text-sm text-gray-500">Generating QR code…</p>
      </div>
    );
  }

  if (status === "paid") {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center justify-center py-12 gap-3"
      >
        <CheckCircle2 size={56} className="text-green-500" />
        <p className="text-lg font-bold text-gray-900">Payment received!</p>
        <p className="text-sm text-gray-500">Your order has been confirmed.</p>
      </motion.div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <XCircle size={48} className="text-red-500" />
        <p className="text-base font-semibold text-gray-900">Payment failed</p>
        <button
          onClick={generateQR}
          className="flex items-center gap-2 bg-[#E8A020] text-white text-sm font-semibold px-6 py-3 rounded-xl"
        >
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4">
        <p className="text-sm text-red-500 font-semibold">QR has expired</p>
        <button
          onClick={generateQR}
          className="flex items-center gap-2 bg-[#E8A020] text-white text-sm font-semibold px-6 py-3 rounded-xl"
        >
          <RefreshCw size={15} /> Generate new QR
        </button>
      </div>
    );
  }

  // status === 'showing' || status === 'idle'
  const upiLink = qrData?.upi_link ?? "";

  return (
    <div className="space-y-5">
      {/* QR + timer row */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 font-medium">Scan with any UPI app</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">
              ₹{amount.toFixed(2)}
            </p>
          </div>
          {qrData && (
            <CountdownTimer seconds={countdown} total={QR_TTL_SECONDS} />
          )}
        </div>

        {/* QR image */}
        <AnimatePresence mode="wait">
          {qrData && (
            <motion.div
              key="qr"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center"
            >
              <div className="relative">
                <img
                  src={qrData.qr_data_url}
                  alt="UPI QR Code"
                  className="w-52 h-52 rounded-xl border border-gray-100 shadow"
                />
                {/* Scan line animation */}
                <motion.div
                  className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#E8A020] to-transparent rounded"
                  animate={{ top: ["8px", "200px", "8px"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* UPI ID */}
        {qrData?.upi_id && (
          <p className="text-center text-[11px] text-gray-400 mt-3 font-mono">
            {qrData.upi_id}
          </p>
        )}
      </div>

      {/* Quick-launch UPI app buttons */}
      {qrData && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "GPay", href: buildGPayLink(upiLink), color: "#4285F4" },
            { label: "PhonePe", href: buildPhonePeLink(upiLink), color: "#5F259F" },
            { label: "Paytm", href: buildPaytmLink(upiLink), color: "#00BAF2" },
          ].map(({ label, href, color }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl py-3 px-2 shadow-sm active:scale-95 transition-transform"
            >
              <Smartphone size={18} style={{ color }} />
              <span className="text-xs font-semibold text-gray-700">{label}</span>
            </a>
          ))}
        </div>
      )}

      {/* "I've paid" fallback */}
      {qrData && !manualConfirm && (
        <button
          onClick={() => setManualConfirm(true)}
          className="w-full text-sm text-[#1A3C5E] font-semibold py-3 rounded-2xl border-2 border-[#1A3C5E]/20 hover:border-[#1A3C5E]/40 transition-colors"
        >
          I&apos;ve already paid
        </button>
      )}

      {manualConfirm && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 text-center">
          <p className="font-semibold mb-1">Confirming your payment…</p>
          <p className="text-xs text-amber-600">
            We&apos;ll detect it automatically within 30 seconds. If you continue
            to see this, please show your payment screenshot to the staff.
          </p>
        </div>
      )}

      {/* Regenerate */}
      <button
        onClick={generateQR}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
      >
        <RefreshCw size={12} /> Generate new QR
      </button>
    </div>
  );
}