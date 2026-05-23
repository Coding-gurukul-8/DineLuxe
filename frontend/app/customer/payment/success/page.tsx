"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Clock, ChevronRight, Star } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, cn } from "@/lib/utils";

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
  const particles = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    color: ["#E8A020","#1A3C5E","#C0392B","#27AE60","#F0B840","#2A5C8E","#fff","#F39C12"][i % 8],
    x: Math.random() * 100,
    delay: Math.random() * 1.2,
    size: 5 + Math.random() * 9,
    duration: 1.5 + Math.random() * 1.2,
    spin: Math.random() > 0.5 ? 720 : -720,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ y: "110vh", opacity: 0, rotate: p.spin, scale: 0.4 }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          className="absolute top-0 rounded-sm"
          style={{ width: p.size, height: p.size, backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

// ── SVG Checkmark ─────────────────────────────────────────────────────────────
function AnimatedCheck() {
  return (
    <div className="relative">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-28 h-28 rounded-full bg-green-50 flex items-center justify-center"
      >
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          <motion.circle
            cx="36" cy="36" r="32"
            stroke="#27AE60" strokeWidth="3.5" fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
          <motion.path
            d="M20 36 L31 47 L52 25"
            stroke="#27AE60" strokeWidth="3.5"
            strokeLinecap="round" strokeLinejoin="round" fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.6, ease: "easeOut" }}
          />
        </svg>
      </motion.div>
      {/* Rings */}
      {[1, 2].map((n) => (
        <motion.div
          key={n}
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 2 + n * 0.4, opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.3 + n * 0.15, ease: "easeOut" }}
          className="absolute inset-0 rounded-full border-2 border-green-400"
        />
      ))}
    </div>
  );
}

// ── Countdown clock ────────────────────────────────────────────────────────────
function EstimatedCountdown({ minutes }: { minutes: number }) {
  const [remaining, setRemaining] = useState(minutes * 60);
  useEffect(() => {
    const id = setInterval(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return (
    <div className="flex items-center gap-1 text-[#E8A020]">
      <Clock size={14} />
      <span className="text-sm font-bold tabular-nums">
        {m}:{String(s).padStart(2, "0")} remaining
      </span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PaymentSuccessPage() {
  const router = useRouter();
  const [showConfetti, setShowConfetti] = useState(true);

  // Fetch the most recent active order
  const { data: orders = [] } = useQuery({
    queryKey: ["customer", "recent-order"],
    queryFn: () => apiClient.get<any[]>("/orders/user/me?limit=1&status=confirmed"),
  });
  const order = orders[0];

  useEffect(() => {
    const id = setTimeout(() => setShowConfetti(false), 3500);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF7F4] flex flex-col pb-10">
      {showConfetti && <Confetti />}

      {/* Full-screen hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        <AnimatedCheck />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="text-center mt-6"
        >
          <h1 className="text-2xl font-bold text-gray-900">Order Confirmed!</h1>
          <p className="text-gray-500 text-sm mt-2">
            Your food is being prepared with love 🍽️
          </p>
        </motion.div>

        {/* Order details card */}
        {order && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, type: "spring", stiffness: 220 }}
            className="w-full mt-6 bg-white rounded-3xl p-5 shadow-lg border border-gray-50"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Order ID</p>
                <p className="text-sm font-bold text-gray-900 font-mono">
                  #{order.id?.slice(-8).toUpperCase()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Total Paid</p>
                <p className="text-lg font-bold text-[#1A3C5E]">{formatCurrency(order.total)}</p>
              </div>
            </div>

            {/* Estimated time */}
            <div className="bg-[#FFF8EC] rounded-2xl p-4 mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Estimated ready in</p>
                <p className="text-2xl font-bold text-[#E8A020]">25–30 min</p>
              </div>
              <EstimatedCountdown minutes={28} />
            </div>

            {/* Items preview */}
            {order.order_items?.slice(0, 3).map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center py-2 border-t border-gray-50 first:border-t-0">
                <span className="text-sm text-gray-700">
                  {item.quantity}× {item.menu_item?.name ?? item.name ?? "Item"}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency((item.unit_price ?? 0) * (item.quantity ?? 1))}
                </span>
              </div>
            ))}
            {(order.order_items?.length ?? 0) > 3 && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                +{order.order_items.length - 3} more item{order.order_items.length - 3 !== 1 ? "s" : ""}
              </p>
            )}
          </motion.div>
        )}
      </div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4 }}
        className="px-6 space-y-3"
      >
        {order && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(`/customer/order/${order.id}`)}
            className="w-full bg-[#1A3C5E] text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2 relative overflow-hidden"
          >
            {/* Pulse ring */}
            <motion.span
              animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-0 rounded-2xl border-2 border-white/30"
            />
            <MapPin size={17} />
            Track Order
            <ChevronRight size={17} />
          </motion.button>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => router.push("/customer/home")}
          className="w-full bg-white text-[#1A3C5E] font-bold py-4 rounded-2xl border-2 border-gray-100 shadow-sm flex items-center justify-center gap-2"
        >
          Back to Home
        </motion.button>

        <div className="flex items-center justify-center gap-2 pt-2">
          <Star size={13} className="text-[#E8A020] fill-[#E8A020]" />
          <p className="text-xs text-gray-400">Enjoying DineLuxe? Leave a review after your meal</p>
        </div>
      </motion.div>
    </div>
  );
}
