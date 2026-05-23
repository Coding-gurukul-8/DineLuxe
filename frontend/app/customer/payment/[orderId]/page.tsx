"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Copy, CheckCircle2, Smartphone, CreditCard, Wallet, Users, Loader2 } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, cn } from "@/lib/utils";

interface Order {
  id: string; total: number; status: string;
  order_items?: { name?: string; quantity: number; unit_price: number }[];
}
interface PaymentMethod { id: string; label: string; icon: React.ComponentType<any>; description: string }

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "upi",    label: "UPI / QR",    icon: Smartphone,  description: "Scan & pay instantly" },
  { id: "card",   label: "Card",        icon: CreditCard,  description: "Credit / Debit card" },
  { id: "wallet", label: "Wallet",      icon: Wallet,      description: "Pay via digital wallet" },
  { id: "split",  label: "Split Bill",  icon: Users,       description: "Divide among friends" },
];

// ── Countdown ring ────────────────────────────────────────────────────────────
function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const progress = seconds / total;
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="absolute" width="80" height="80" viewBox="0 0 80 80" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="#F3F4F6" strokeWidth="4" />
        <motion.circle
          cx="40" cy="40" r={r} fill="none"
          stroke={seconds < 60 ? "#C0392B" : "#E8A020"} strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          animate={{ strokeDashoffset: circ * (1 - progress) }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </svg>
      <div className="text-center">
        <p className="text-lg font-bold text-gray-900 tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p>
        <p className="text-[9px] text-gray-400">left</p>
      </div>
    </div>
  );
}

// ── Scan-line animation over QR ───────────────────────────────────────────────
function QRCode({ orderId }: { orderId: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260 }}
      className="relative w-48 h-48 mx-auto bg-white rounded-2xl p-3 shadow-lg border border-gray-100 overflow-hidden">
      {/* QR placeholder grid */}
      <div className="w-full h-full bg-gray-900 rounded-xl flex items-center justify-center">
        <div className="grid grid-cols-8 gap-0.5 w-36 h-36 opacity-90">
          {Array.from({ length: 64 }, (_, i) => (
            <div key={i} className={cn("rounded-sm", Math.random() > 0.45 ? "bg-white" : "bg-gray-900")} />
          ))}
        </div>
      </div>
      {/* Scan line */}
      <motion.div
        className="absolute left-3 right-3 h-0.5 bg-linear-to-r from-transparent via-[#E8A020] to-transparent"
        animate={{ top: ["12px", "180px", "12px"] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <p className="text-center text-[9px] text-gray-400 mt-1 font-mono tracking-wider truncate">{orderId}</p>
    </motion.div>
  );
}

// ── Split bill pie ────────────────────────────────────────────────────────────
function SplitBill({ total }: { total: number }) {
  const [count, setCount] = useState(2);
  const perPerson = total / count;
  const COLORS = ["#E8A020","#1A3C5E","#C0392B","#27AE60","#2A5C8E","#F0B840"];
  const r = 54; const cx = 70; const cy = 70;
  let angle = -90;
  const sliceAngle = 360 / count;

  function polarToXY(deg: number, radius = r) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const slices = Array.from({ length: count }, (_, i) => {
    const start = angle;
    angle += sliceAngle;
    const end = angle;
    const s = polarToXY(start);
    const e = polarToXY(end);
    const large = sliceAngle > 180 ? 1 : 0;
    return `M${cx},${cy} L${s.x},${s.y} A${r},${r},0,${large},1,${e.x},${e.y} Z`;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4">
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => setCount((n) => Math.max(2, n - 1))}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-700">−</motion.button>
        <AnimatePresence mode="wait">
          <motion.span key={count} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400 }}
            className="text-2xl font-bold text-[#1A3C5E] w-8 text-center">{count}</motion.span>
        </AnimatePresence>
        <motion.button whileTap={{ scale: 0.85 }} onClick={() => setCount((n) => Math.min(8, n + 1))}
          className="w-9 h-9 rounded-full bg-[#E8A020] flex items-center justify-center text-lg font-bold text-white">+</motion.button>
        <span className="text-sm text-gray-500">people</span>
      </div>

      <svg viewBox="0 0 140 140" className="w-40 h-40 mx-auto">
        {slices.map((d, i) => (
          <motion.path key={i} d={d} fill={COLORS[i % COLORS.length]}
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 260 }} />
        ))}
        <circle cx={cx} cy={cy} r={28} fill="white" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1A3C5E">{formatCurrency(perPerson)}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7" fill="#9CA3AF">each</text>
      </svg>

      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-xs text-gray-600 font-medium">Person {i + 1}</span>
            <span className="text-xs font-bold text-gray-900 ml-auto">{formatCurrency(perPerson)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface Props { params: Promise<{ orderId: string }> }

export default function PaymentPage({ params }: Props) {
  const { orderId } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [activeMethod, setActiveMethod] = useState("upi");
  const [countdown, setCountdown] = useState(300);
  const [copied, setCopied] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => apiClient.get<Order>(`/orders/${orderId}`),
  });

  // QR countdown
  useEffect(() => {
    if (activeMethod !== "upi") return;
    const id = setInterval(() => setCountdown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [activeMethod]);

  const { mutate: markPaid, isPending } = useMutation({
    mutationFn: () => apiClient.post(`/orders/${orderId}/payment`, { method: activeMethod, status: "paid" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      router.push("/customer/payment/success");
    },
    onError: () => toast.error("Payment failed. Please try again."),
  });

  function copyUpiId() {
    navigator.clipboard.writeText(`dineluxe@upi`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  if (isLoading || !order) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#E8A020]" size={32} /></div>;
  }

  return (
    <PageWrapper>
      <div className="flex items-center gap-3 mb-6">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ChevronLeft size={18} className="text-gray-700" />
        </motion.button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payment</h1>
          <p className="text-xs text-gray-500">Order #{orderId.slice(-6).toUpperCase()}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(order.total)}</p>
        </div>
      </div>

      {/* Method tab slider */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6 pb-1">
        {PAYMENT_METHODS.map((m) => {
          const Icon = m.icon;
          return (
            <motion.button key={m.id} whileTap={{ scale: 0.95 }} onClick={() => setActiveMethod(m.id)}
              className={cn(
                "shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-2xl border-2 transition-all text-xs font-semibold",
                activeMethod === m.id ? "border-[#E8A020] bg-[#E8A020]/8 text-[#E8A020]" : "border-gray-100 bg-white text-gray-500"
              )}>
              <Icon size={18} />
              {m.label}
              {activeMethod === m.id && (
                <motion.div layoutId="methodUnderline" className="h-0.5 w-6 bg-[#E8A020] rounded-full" />
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">

        {/* UPI */}
        {activeMethod === "upi" && (
          <motion.div key="upi" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="space-y-5">
            <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div>
                <p className="text-xs text-gray-500 mb-1">QR valid for</p>
                <CountdownRing seconds={countdown} total={300} />
              </div>
              <div className="flex-1 flex flex-col items-center">
                <QRCode orderId={orderId} />
                <motion.button whileTap={{ scale: 0.95 }} onClick={copyUpiId}
                  className="flex items-center gap-1.5 mt-3 text-xs text-[#1A3C5E] font-semibold bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                  {copied ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
                  {copied ? "Copied!" : "dineluxe@upi"}
                </motion.button>
              </div>
            </div>
            <p className="text-center text-xs text-gray-400">Scan with any UPI app — GPay, PhonePe, Paytm</p>
          </motion.div>
        )}

        {/* Card */}
        {activeMethod === "card" && (
          <motion.div key="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="space-y-3">
            {[
              { label: "Card Number", placeholder: "1234 5678 9012 3456", type: "text" },
              { label: "Name on Card", placeholder: "As printed on card", type: "text" },
            ].map((f) => (
              <div key={f.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <label className="text-xs text-gray-500 font-semibold block mb-1.5">{f.label}</label>
                <input type={f.type} placeholder={f.placeholder}
                  className="w-full text-sm text-gray-900 bg-transparent focus:outline-none placeholder-gray-300" />
              </div>
            ))}
            <div className="flex gap-3">
              {[{ label: "Expiry", placeholder: "MM / YY" }, { label: "CVV", placeholder: "•••" }].map((f) => (
                <div key={f.label} className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <label className="text-xs text-gray-500 font-semibold block mb-1.5">{f.label}</label>
                  <input placeholder={f.placeholder}
                    className="w-full text-sm text-gray-900 bg-transparent focus:outline-none placeholder-gray-300" />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Wallet */}
        {activeMethod === "wallet" && (
          <motion.div key="wallet" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="space-y-3">
            {["Paytm Wallet", "Amazon Pay", "Mobikwik"].map((w) => (
              <motion.button key={w} whileTap={{ scale: 0.98 }}
                className="w-full text-left bg-white rounded-2xl p-4 border-2 border-gray-100 shadow-sm flex items-center justify-between hover:border-[#E8A020]/50 transition-colors">
                <span className="text-sm font-semibold text-gray-800">{w}</span>
                <ChevronLeft size={16} className="text-gray-400 rotate-180" />
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* Split */}
        {activeMethod === "split" && (
          <motion.div key="split" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <SplitBill total={order.total} />
          </motion.div>
        )}

      </AnimatePresence>

      <motion.button whileTap={{ scale: 0.97 }} onClick={() => markPaid()} disabled={isPending}
        className="w-full mt-8 bg-[#E8A020] text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2">
        {isPending ? <><Loader2 size={18} className="animate-spin" />Processing…</> : `Pay ${formatCurrency(order.total)}`}
      </motion.button>
    </PageWrapper>
  );
}