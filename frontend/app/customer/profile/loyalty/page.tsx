"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChevronLeft, Star, Trophy, TrendingUp, TrendingDown, Zap, Gift, Crown, Shield } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatDate, cn } from "@/lib/utils";

interface LoyaltyHistoryEntry { id: string; description: string; points_earned?: number | null; points_redeemed?: number | null; balance: number; created_at: string; }
interface LoyaltyMe { points_balance: number; tier: string; next_tier?: string | null; points_to_next?: number | null; history: LoyaltyHistoryEntry[]; }

const TIER_CONFIG: Record<string, { icon: React.ElementType; gradient: string; label: string; ring: string }> = {
  bronze: { icon: Shield, gradient: "from-amber-700 to-amber-500", label: "Bronze", ring: "ring-amber-400" },
  silver: { icon: Star, gradient: "from-slate-500 to-slate-300", label: "Silver", ring: "ring-slate-400" },
  gold: { icon: Crown, gradient: "from-yellow-500 to-amber-400", label: "Gold", ring: "ring-yellow-400" },
  platinum: { icon: Trophy, gradient: "from-cyan-600 to-sky-400", label: "Platinum", ring: "ring-sky-400" },
};
function getTierConfig(tier: string) {
  return TIER_CONFIG[tier?.toLowerCase()] ?? { icon: Star, gradient: "from-[#E8A020] to-[#F0B840]", label: tier ?? "Member", ring: "ring-[#E8A020]" };
}

const TIER_ORDER = ["bronze", "silver", "gold", "platinum"];

export default function LoyaltyPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["customer", "loyalty-full"],
    queryFn: () => apiClient.get<LoyaltyMe>("/loyalty/me"),
  });

  const tier = getTierConfig(data?.tier ?? "bronze");
  const TierIcon = tier.icon;
  const balance = data?.points_balance ?? 0;
  const pointsToNext = data?.points_to_next ?? 0;
  const progressMax = balance + pointsToNext;
  const progressPct = progressMax > 0 ? Math.round((balance / progressMax) * 100) : 0;
  const history = data?.history ?? [];
  const currentIdx = TIER_ORDER.indexOf(data?.tier?.toLowerCase() ?? "bronze");

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">
      <div className="px-4 pt-12 pb-10 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #0D2A45 55%, #2A1A0A 100%)" }}>
        <div className="absolute -top-8 -right-8 w-44 h-44 rounded-full bg-[#E8A020]/10" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-8">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"><ChevronLeft size={18} className="text-white" /></motion.button>
            <div>
              <p className="text-[#E8A020] text-xs font-semibold uppercase tracking-widest">Profile</p>
              <h1 className="text-white font-bold text-xl">Loyalty</h1>
            </div>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Your Points</p>
              {isLoading ? <div className="h-12 w-36 bg-white/10 rounded-lg animate-pulse" /> :
                <motion.p initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300 }} className="text-5xl font-black text-white tabular-nums">{balance.toLocaleString("en-IN")}</motion.p>}
              <p className="text-white/40 text-xs mt-1">{pointsToNext > 0 ? `${pointsToNext.toLocaleString("en-IN")} pts to ${data?.next_tier ?? "next tier"}` : "You're at the top tier! 🎉"}</p>
            </div>
            <motion.div initial={{ opacity: 0, rotate: -12, scale: 0.7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.2 }} className={cn("w-20 h-20 rounded-3xl flex flex-col items-center justify-center gap-1 ring-2", `bg-linear-to-br ${tier.gradient}`, tier.ring)}>
              <TierIcon size={28} className="text-white" />
              <span className="text-white text-[10px] font-black uppercase tracking-wide">{tier.label}</span>
            </motion.div>
          </div>
          <div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div className={cn("h-full rounded-full bg-linear-to-r", tier.gradient)} initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-white/40 text-[10px]">0</span>
              <span className="text-white/40 text-[10px] font-semibold">{progressPct}%</span>
              <span className="text-white/40 text-[10px]">{progressMax.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Tier Journey</p>
          <div className="flex items-center">
            {TIER_ORDER.map((t, idx) => {
              const cfg = getTierConfig(t);
              const TIcon = cfg.icon;
              const isActive = idx === currentIdx;
              const isPast = idx < currentIdx;
              return (
                <div key={t} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <motion.div animate={{ scale: isActive ? 1.2 : 1 }} transition={{ type: "spring", stiffness: 300 }} className={cn("w-9 h-9 rounded-xl flex items-center justify-center ring-2", isActive ? `bg-linear-to-br ${cfg.gradient} ${cfg.ring}` : isPast ? "bg-gray-200 ring-gray-300" : "bg-gray-100 ring-gray-200")}>
                      <TIcon size={16} className={isActive || isPast ? "text-white" : "text-gray-400"} />
                    </motion.div>
                    <span className={cn("text-[9px] mt-1 font-bold capitalize", isActive ? "text-[#E8A020]" : "text-gray-400")}>{cfg.label}</span>
                  </div>
                  {idx < TIER_ORDER.length - 1 && <div className={cn("h-0.5 flex-1 mx-1 mb-4 rounded-full", isPast ? "bg-[#E8A020]" : "bg-gray-200")} />}
                </div>
              );
            })}
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Earned", value: history.reduce((s, h) => s + (h.points_earned ?? 0), 0).toLocaleString("en-IN"), icon: TrendingUp, color: "text-green-500", bg: "bg-green-50" },
            { label: "Total Redeemed", value: history.reduce((s, h) => s + (h.points_redeemed ?? 0), 0).toLocaleString("en-IN"), icon: Gift, color: "text-purple-500", bg: "bg-purple-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", bg)}><Icon size={18} className={color} /></div>
              <p className="text-xl font-black text-gray-900 tabular-nums">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Points History</p>
          </div>
          {isLoading ? (
            <div className="divide-y divide-gray-50">{[1,2,3,4].map((n) => <div key={n} className="px-4 py-3 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-gray-100 animate-pulse shrink-0" /><div className="flex-1 space-y-1.5"><div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" /><div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/3" /></div><div className="h-4 w-16 bg-gray-100 rounded animate-pulse" /></div>)}</div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center"><Zap size={28} className="text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">No transactions yet.</p></div>
          ) : (
            <div className="divide-y divide-gray-50">
              {history.map((entry, i) => {
                const isEarn = (entry.points_earned ?? 0) > 0;
                const pts = isEarn ? entry.points_earned ?? 0 : entry.points_redeemed ?? 0;
                return (
                  <motion.div key={entry.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="px-4 py-3 flex items-center gap-3">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", isEarn ? "bg-green-50" : "bg-purple-50")}>
                      {isEarn ? <TrendingUp size={16} className="text-green-500" /> : <TrendingDown size={16} className="text-purple-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{entry.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(entry.created_at)} · Balance: {entry.balance.toLocaleString("en-IN")}</p>
                    </div>
                    <span className={cn("text-sm font-black shrink-0", isEarn ? "text-green-500" : "text-purple-500")}>{isEarn ? "+" : "−"}{pts.toLocaleString("en-IN")}</span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}