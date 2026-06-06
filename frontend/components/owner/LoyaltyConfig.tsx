"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Users,
  Coins,
  TrendingUp,
  Star,
  Crown,
  Award,
  Medal,
  Phone,
  Gift,
  Settings,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoyaltyStats {
  total_members: number;
  total_points_issued: number;
  total_points_redeemed: number;
  active_this_month: number;
}

interface LoyaltySettings {
  rupees_per_point: number;   // ₹X = 1 point
  rupees_per_redemption: number;  // 1 point = ₹X
  min_redeem_points: number;
}

interface LeaderboardEntry {
  user_id: string;
  first_name: string;
  points_balance: number;
  total_earned: number;
  last_visit: string | null;
}

interface AdjustPayload {
  phone: string;
  points: number;
  reason: string;
}

// ── Tier config (Phase 1 — hardcoded) ─────────────────────────────────────────

const TIERS = [
  {
    name: "Bronze",
    range: "0 – 499 pts",
    minPts: 0,
    maxPts: 499,
    icon: Medal,
    color: "#CD7F32",
    bg: "bg-amber-50",
    border: "border-amber-200",
    textColor: "text-amber-800",
    badge: "bg-amber-100 text-amber-700",
    perks: ["Earn 1 point per ₹10 spent", "Access to member-only offers"],
    discount: null,
  },
  {
    name: "Silver",
    range: "500 – 1,999 pts",
    minPts: 500,
    maxPts: 1999,
    icon: Award,
    color: "#A8A9AD",
    bg: "bg-slate-50",
    border: "border-slate-200",
    textColor: "text-slate-700",
    badge: "bg-slate-100 text-slate-600",
    perks: ["5% discount on all orders", "Priority queue seating"],
    discount: "5% off",
  },
  {
    name: "Gold",
    range: "2,000 – 4,999 pts",
    minPts: 2000,
    maxPts: 4999,
    icon: Star,
    color: "#E8A020",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    textColor: "text-yellow-800",
    badge: "bg-yellow-100 text-yellow-700",
    perks: ["10% discount on all orders", "Priority seating", "Early access to new menu"],
    discount: "10% off",
  },
  {
    name: "Platinum",
    range: "5,000+ pts",
    minPts: 5000,
    maxPts: Infinity,
    icon: Crown,
    color: "#5B5BD6",
    bg: "bg-violet-50",
    border: "border-violet-200",
    textColor: "text-violet-800",
    badge: "bg-violet-100 text-violet-700",
    perks: ["15% discount on all orders", "Complimentary welcome drink", "Dedicated concierge"],
    discount: "15% off",
  },
] as const;

function getTier(totalEarned: number) {
  if (totalEarned >= 5000) return "Platinum";
  if (totalEarned >= 2000) return "Gold";
  if (totalEarned >= 500) return "Silver";
  return "Bronze";
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4"
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{label}</p>
        <p
          className="text-2xl font-bold text-gray-900 mt-0.5 font-mono"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        </p>
      </div>
    </motion.div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-gray-100 rounded w-24" />
        <div className="h-6 bg-gray-100 rounded w-16" />
      </div>
    </div>
  );
}

// ── Tier Badge ─────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const found = TIERS.find((t) => t.name.toLowerCase() === tier.toLowerCase());
  if (!found) return <span className="text-xs text-gray-400">{tier}</span>;
  const Icon = found.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
        found.badge
      )}
    >
      <Icon size={10} />
      {found.name}
    </span>
  );
}

// ── Section Wrapper ────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-white rounded-2xl border border-gray-100 shadow-sm", className)}>
      <div className="px-6 py-5 border-b border-gray-50">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-[#1A3C5E]/8 flex items-center justify-center">
              <Icon size={15} className="text-[#1A3C5E]" />
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function LoyaltyConfig({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();

  // ── Settings form state ──────────────────────────────────────────────────────
  const [settings, setSettings] = useState<LoyaltySettings>({
    rupees_per_point: 10,
    rupees_per_redemption: 0.1,
    min_redeem_points: 50,
  });

  // ── Manual adjust form ───────────────────────────────────────────────────────
  const [adjustForm, setAdjustForm] = useState<AdjustPayload>({
    phone: "",
    points: 0,
    reason: "",
  });
  const [adjustErrors, setAdjustErrors] = useState<Partial<AdjustPayload>>({});

  // ── Queries ──────────────────────────────────────────────────────────────────

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery<LoyaltyStats>({
    queryKey: ["loyalty-stats", restaurantId],
    queryFn: () =>
      apiClient.get<LoyaltyStats>(`/loyalty/stats?restaurant_id=${restaurantId}`),
    staleTime: 60_000,
    enabled: Boolean(restaurantId),
  });

  const {
    data: leaderboard,
    isLoading: leaderboardLoading,
    isError: leaderboardError,
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ["loyalty-leaderboard", restaurantId],
    queryFn: () =>
      apiClient.get<LeaderboardEntry[]>(
        `/loyalty/leaderboard?restaurant_id=${restaurantId}&limit=10`
      ),
    staleTime: 60_000,
    enabled: Boolean(restaurantId),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const settingsMutation = useMutation({
    mutationFn: (data: LoyaltySettings) =>
      apiClient.patch("/loyalty/settings", { ...data, restaurant_id: restaurantId }),
    onSuccess: () => {
      toast.success("Loyalty settings saved");
      qc.invalidateQueries({ queryKey: ["loyalty-stats", restaurantId] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to save settings");
    },
  });

  const adjustMutation = useMutation({
    mutationFn: (payload: AdjustPayload & { restaurant_id: string }) =>
      apiClient.post("/loyalty/admin/adjust", payload),
    onSuccess: () => {
      toast.success("Points awarded successfully");
      setAdjustForm({ phone: "", points: 0, reason: "" });
      setAdjustErrors({});
      qc.invalidateQueries({ queryKey: ["loyalty-leaderboard", restaurantId] });
      qc.invalidateQueries({ queryKey: ["loyalty-stats", restaurantId] });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to award points");
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleSaveSettings() {
    if (settings.rupees_per_point < 1 || settings.rupees_per_point > 100) {
      toast.error("Rupees per point must be between 1 and 100");
      return;
    }
    if (settings.min_redeem_points < 1) {
      toast.error("Minimum redemption points must be at least 1");
      return;
    }
    settingsMutation.mutate(settings);
  }

  function handleAwardPoints() {
    const errors: Partial<AdjustPayload> = {};
    if (!adjustForm.phone.trim()) errors.phone = "Phone is required";
    else if (!/^[6-9]\d{9}$/.test(adjustForm.phone.trim()))
      errors.phone = "Enter a valid 10-digit Indian mobile number";
    if (!adjustForm.points || adjustForm.points < 1)
      errors.points = "Points must be at least 1" as any;
    if (!adjustForm.reason.trim()) errors.reason = "Reason is required";

    setAdjustErrors(errors);
    if (Object.keys(errors).length > 0) return;

    adjustMutation.mutate({ ...adjustForm, restaurant_id: restaurantId });
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── SECTION 1: Program Overview ─────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 px-0.5">
          Program Overview
        </h3>
        {statsError ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex items-center gap-3 text-red-600 text-sm">
            <AlertCircle size={16} />
            <span>Failed to load loyalty stats</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              <>
                <StatCard
                  icon={Users}
                  label="Total Members"
                  value={stats?.total_members ?? 0}
                  color="#1A3C5E"
                  delay={0}
                />
                <StatCard
                  icon={Coins}
                  label="Points Issued"
                  value={stats?.total_points_issued ?? 0}
                  color="#E8A020"
                  delay={0.08}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Points Redeemed"
                  value={stats?.total_points_redeemed ?? 0}
                  color="#10B981"
                  delay={0.16}
                />
                <StatCard
                  icon={Trophy}
                  label="Active This Month"
                  value={stats?.active_this_month ?? 0}
                  color="#8B5CF6"
                  delay={0.24}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* ── SECTION 2: Configuration Settings ──────────────────────────────── */}
      <Section
        title="Configuration Settings"
        subtitle="Adjust how customers earn and redeem points"
        icon={Settings}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field
            label="Points Earning Rate"
            hint={`Customer spends ₹${settings.rupees_per_point} → earns 1 point`}
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium pointer-events-none">
                ₹
              </span>
              <Input
                type="number"
                min={1}
                max={100}
                value={settings.rupees_per_point}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    rupees_per_point: Number(e.target.value),
                  }))
                }
                className="pl-7"
                placeholder="10"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5 font-medium">
              ₹{settings.rupees_per_point} spent = 1 point &nbsp;·&nbsp; Range: 1–100
            </p>
          </Field>

          <Field
            label="Redemption Rate"
            hint={`1 point is worth ₹${settings.rupees_per_redemption} when redeemed`}
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium pointer-events-none">
                ₹
              </span>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={settings.rupees_per_redemption}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    rupees_per_redemption: Number(e.target.value),
                  }))
                }
                className="pl-7"
                placeholder="0.10"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5 font-medium">
              1 point = ₹{settings.rupees_per_redemption}
            </p>
          </Field>

          <Field
            label="Minimum Points to Redeem"
            hint="Customers must accumulate at least this many points before redeeming"
          >
            <Input
              type="number"
              min={1}
              step={1}
              value={settings.min_redeem_points}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  min_redeem_points: Math.floor(Number(e.target.value)),
                }))
              }
              placeholder="50"
            />
            <p className="text-[11px] text-gray-400 mt-1.5 font-medium">
              Minimum {settings.min_redeem_points} pts required to unlock redemption
            </p>
          </Field>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button
            onClick={handleSaveSettings}
            disabled={settingsMutation.isPending}
            size="md"
            variant="primary"
            className="gap-2"
          >
            {settingsMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            {settingsMutation.isPending ? "Saving…" : "Save Settings"}
          </Button>
          {settingsMutation.isSuccess && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-emerald-600 font-medium flex items-center gap-1"
            >
              <CheckCircle2 size={12} /> Saved
            </motion.span>
          )}
        </div>
      </Section>

      {/* ── SECTION 3: Tier System ──────────────────────────────────────────── */}
      <Section
        title="Tier System"
        subtitle="Reward structure applied automatically based on cumulative points earned"
        icon={Crown}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map((tier, idx) => {
            const Icon = tier.icon;
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07, duration: 0.35 }}
                className={cn(
                  "rounded-xl border p-4 space-y-3",
                  tier.bg,
                  tier.border
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={16} style={{ color: tier.color }} />
                    <span
                      className={cn("font-bold text-sm", tier.textColor)}
                    >
                      {tier.name}
                    </span>
                  </div>
                  {tier.discount && (
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        tier.badge
                      )}
                    >
                      {tier.discount}
                    </span>
                  )}
                </div>

                <p className="text-[11px] font-mono text-gray-500">{tier.range}</p>

                <ul className="space-y-1">
                  {tier.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <span
                        className="w-1 h-1 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: tier.color }}
                      />
                      {perk}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2">
          <Settings size={12} className="text-gray-400 shrink-0" />
          <p className="text-xs text-gray-400">
            <strong className="text-gray-500">Phase 1:</strong> Tier thresholds and perks are
            fixed. Custom tier configuration is coming in Phase 2.
          </p>
        </div>
      </Section>

      {/* ── SECTION 4: Top Loyalty Members ─────────────────────────────────── */}
      <Section
        title="Top Loyalty Members"
        subtitle="Leaderboard — top 10 customers by points balance"
        icon={Trophy}
      >
        {leaderboardError ? (
          <div className="flex items-center gap-2 text-red-500 text-sm py-4">
            <AlertCircle size={15} />
            Failed to load leaderboard
          </div>
        ) : leaderboardLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !leaderboard?.length ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No loyalty members yet. Start earning!
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="text-left text-[11px] font-semibold text-gray-400 px-4 py-3 uppercase tracking-wide w-12">
                    Rank
                  </th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 px-4 py-3 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="text-right text-[11px] font-semibold text-gray-400 px-4 py-3 uppercase tracking-wide">
                    Points
                  </th>
                  <th className="text-center text-[11px] font-semibold text-gray-400 px-4 py-3 uppercase tracking-wide hidden sm:table-cell">
                    Tier
                  </th>
                  <th className="text-right text-[11px] font-semibold text-gray-400 px-4 py-3 uppercase tracking-wide hidden md:table-cell">
                    Last Visit
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((member, idx) => {
                  const tier = getTier(member.total_earned);
                  const isTop3 = idx < 3;
                  const rankColors = ["text-[#E8A020]", "text-gray-400", "text-amber-600"];
                  return (
                    <motion.tr
                      key={member.user_id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                      className={cn(
                        "border-t border-gray-50 hover:bg-gray-50/50 transition-colors",
                        idx === 0 && "bg-yellow-50/30"
                      )}
                    >
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "font-bold font-mono text-sm",
                            isTop3 ? rankColors[idx] : "text-gray-300"
                          )}
                        >
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-gray-800">
                        {member.first_name}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#1A3C5E]">
                        {member.points_balance.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3.5 text-center hidden sm:table-cell">
                        <TierBadge tier={tier} />
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-400 text-xs hidden md:table-cell">
                        {formatDate(member.last_visit)}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── SECTION 5: Manual Adjustment ───────────────────────────────────── */}
      <Section
        title="Award Points Manually"
        subtitle="Resolve disputes, honour special occasions, or apply goodwill points"
        icon={Gift}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Field label="Customer Phone" hint="10-digit Indian mobile number">
            <div className="relative">
              <Phone
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <Input
                type="tel"
                placeholder="98xxxxxxxx"
                value={adjustForm.phone}
                onChange={(e) => {
                  setAdjustForm((f) => ({ ...f, phone: e.target.value }));
                  setAdjustErrors((err) => ({ ...err, phone: undefined }));
                }}
                className={cn("pl-9", adjustErrors.phone && "border-red-400 focus:border-red-400")}
                maxLength={10}
              />
            </div>
            {adjustErrors.phone && (
              <p className="text-xs text-red-500 mt-1">{adjustErrors.phone}</p>
            )}
          </Field>

          <Field label="Points to Award" hint="Must be a positive whole number">
            <Input
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 100"
              value={adjustForm.points || ""}
              onChange={(e) => {
                setAdjustForm((f) => ({
                  ...f,
                  points: Math.floor(Math.max(1, Number(e.target.value))),
                }));
                setAdjustErrors((err) => ({ ...err, points: undefined }));
              }}
              className={cn(adjustErrors.points && "border-red-400 focus:border-red-400")}
            />
            {adjustErrors.points && (
              <p className="text-xs text-red-500 mt-1">{String(adjustErrors.points)}</p>
            )}
          </Field>

          <Field label="Reason" hint="Required for audit log">
            <Input
              type="text"
              placeholder="e.g. Goodwill for late delivery"
              value={adjustForm.reason}
              onChange={(e) => {
                setAdjustForm((f) => ({ ...f, reason: e.target.value }));
                setAdjustErrors((err) => ({ ...err, reason: undefined }));
              }}
              className={cn(adjustErrors.reason && "border-red-400 focus:border-red-400")}
              maxLength={200}
            />
            {adjustErrors.reason && (
              <p className="text-xs text-red-500 mt-1">{adjustErrors.reason}</p>
            )}
          </Field>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button
            onClick={handleAwardPoints}
            disabled={adjustMutation.isPending}
            variant="secondary"
            size="md"
            className="gap-2"
          >
            {adjustMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Gift size={14} />
            )}
            {adjustMutation.isPending ? "Awarding…" : "Award Points"}
          </Button>
          <AnimatePresence>
            {adjustMutation.isSuccess && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-emerald-600 font-medium flex items-center gap-1"
              >
                <CheckCircle2 size={12} /> Points awarded
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </Section>
    </div>
  );
}