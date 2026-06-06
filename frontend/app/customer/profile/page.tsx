"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Settings, ChevronRight, Star, ShoppingBag, Calendar,
  Gift, LogOut, Edit3, Camera, Bell, Shield, HelpCircle,
  BookOpen, ClipboardList, RotateCcw,
} from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

// ── Count-up hook ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1200, trigger = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    const start = Date.now();
    const id = requestAnimationFrame(function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [target, duration, trigger]);
  return value;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, trigger }: {
  label: string; value: number; icon: React.ComponentType<any>;
  color: string; trigger: boolean;
}) {
  const displayed = useCountUp(value, 1000, trigger);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={trigger ? { opacity: 1, y: 0 } : {}}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-50 text-center"
    >
      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-2", color)}>
        <Icon size={16} className="text-white" />
      </div>
      <p className="text-xl font-bold text-gray-900 tabular-nums">{displayed.toLocaleString("en-IN")}</p>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mt-0.5">{label}</p>
    </motion.div>
  );
}

// ── Menu link ─────────────────────────────────────────────────────────────────
function MenuLink({ label, icon: Icon, onClick, danger = false, badge }: {
  label: string; icon: React.ComponentType<any>; onClick: () => void; danger?: boolean; badge?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3.5 px-4 bg-white rounded-2xl shadow-sm border border-gray-50 text-left"
    >
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
        danger ? "bg-red-50" : "bg-gray-50"
      )}>
        <Icon size={16} className={danger ? "text-[#C0392B]" : "text-gray-500"} />
      </div>
      <span className={cn("text-sm font-semibold flex-1", danger ? "text-[#C0392B]" : "text-gray-800")}>
        {label}
      </span>
      {/* Badge — shown when there are active refund requests */}
      {badge && (
        <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#E8A020]/10 text-[#E8A020]">
          {badge}
        </span>
      )}
      {!danger && <ChevronRight size={15} className="text-gray-300" />}
    </motion.button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, logout } = useAuth();

  const { ref: statsRef, inView: statsInView } = useInView({ triggerOnce: true, threshold: 0.2 });
  const { ref: ordersRef, inView: ordersInView } = useInView({ triggerOnce: true, threshold: 0.1 });

  const { data: profileData } = useQuery({
    queryKey: ["customer", "profile"],
    queryFn: () => apiClient.get<{ orders_count: number; bookings_count: number }>("/users/me/stats"),
  });

  const { data: loyaltyData } = useQuery({
    queryKey: ["customer", "loyalty"],
    queryFn: () =>
      apiClient.get<{ points: number; nextRewardThreshold: number; progressPercent: number }>("/loyalty/me"),
  });

  const { data: orderHistory = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["customer", "order-history"],
    queryFn: () => apiClient.get<any[]>("/orders/user/me?limit=5"),
  });

  // ── Fetch active refund count for badge (Spec §9.7) ───────────────────────
  const { data: refundData } = useQuery({
    queryKey: ["customer", "refunds"],
    queryFn: () => apiClient.get<{ order_id: string; stage: string }[]>("/payments/my-refunds"),
  });

  // Count only non-terminal (pending) refunds for the badge
  const activeRefundCount = (refundData ?? []).filter(
    (r) => r.stage !== "approved" && r.stage !== "rejected",
  ).length;

  const refundBadge = activeRefundCount > 0
    ? `${activeRefundCount} request${activeRefundCount > 1 ? "s" : ""}`
    : undefined;

  function handleLogout() {
    logout();
    router.replace("/auth/login");
  }

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <PageWrapper>
      {/* ── Avatar & name ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center pt-4 pb-6"
      >
        <motion.div
          whileHover={{ scale: 1.04 }}
          className="relative mb-4 cursor-pointer group"
        >
          {user?.profile_pic_url ? (
            <img src={user.profile_pic_url} alt={user.name} className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-linear-to-br from-[#1A3C5E] to-[#2A5C8E] flex items-center justify-center text-white text-2xl font-bold">
              {initials}
            </div>
          )}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            whileHover={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 rounded-full border-2 border-[#E8A020] pointer-events-none"
            style={{ margin: -3 }}
          />
          <div className="absolute bottom-0 right-0 w-7 h-7 bg-[#E8A020] rounded-full flex items-center justify-center shadow-md border-2 border-white">
            <Camera size={12} className="text-white" />
          </div>
        </motion.div>

        <h2 className="text-xl font-bold text-gray-900">{user?.name ?? "Guest"}</h2>
        <p className="text-sm text-gray-400 mt-0.5">{user?.email ?? ""}</p>
        {user?.phone && <p className="text-xs text-gray-400">{user.phone}</p>}
      </motion.div>

      {/* ── Stats row ────────────────────────────────────────────────── */}
      <div ref={statsRef} className="flex gap-3 mb-6">
        <StatCard label="Orders"   value={profileData?.orders_count   ?? 0} icon={ShoppingBag} color="bg-[#1A3C5E]" trigger={statsInView} />
        <StatCard label="Bookings" value={profileData?.bookings_count ?? 0} icon={Calendar}    color="bg-[#E8A020]" trigger={statsInView} />
        <StatCard label="Points"   value={loyaltyData?.points         ?? 0} icon={Gift}         color="bg-[#C0392B]" trigger={statsInView} />
      </div>

      {/* ── Loyalty bar ──────────────────────────────────────────────── */}
      {loyaltyData && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={statsInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="bg-linear-to-r from-[#1A3C5E] to-[#2A5C8E] rounded-2xl p-4 mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Star size={15} className="text-[#E8A020] fill-[#E8A020]" />
              <span className="text-white text-sm font-bold">Loyalty Progress</span>
            </div>
            <span className="text-white/70 text-xs">{loyaltyData.points} / {loyaltyData.nextRewardThreshold} pts</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-linear-to-r from-[#E8A020] to-[#F0B840]"
              initial={{ width: 0 }}
              animate={statsInView ? { width: `${loyaltyData.progressPercent ?? 0}%` } : {}}
              transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
            />
          </div>
          <p className="text-white/50 text-xs mt-2">
            {loyaltyData.nextRewardThreshold - loyaltyData.points} more points to next reward 🎁
          </p>
        </motion.div>
      )}

      {/* ── Recent orders ─────────────────────────────────────────────── */}
      <div ref={ordersRef} className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900">Recent Orders</h3>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/customer/profile/orders")}
            className="text-xs text-[#E8A020] font-semibold flex items-center gap-1"
          >
            See all <ChevronRight size={13} />
          </motion.button>
        </div>

        {ordersLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
        ) : orderHistory.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">No orders yet</div>
        ) : (
          <motion.div
            initial="hidden"
            animate={ordersInView ? "visible" : "hidden"}
            variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
            className="space-y-2"
          >
            {orderHistory.map((order) => (
              <motion.button
                key={order.id}
                variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260 } } }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(`/customer/order/${order.id}`)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex items-center gap-3 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <ShoppingBag size={18} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    Order #{order.id?.slice(-6).toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(order.total)}</p>
                  <StatusBadge status={order.status} size="sm" />
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Menu links ────────────────────────────────────────────────── */}
      {/* ✅ AUDIT FIX — added /customer/profile/bookings and /customer/profile/orders */}
      {/* ✅ SPEC §9.7  — added Refunds entry linking to support page with ?tab=refunds */}
      <div className="space-y-2 mb-6">
        <MenuLink label="Edit Profile"       icon={Edit3}         onClick={() => router.push("/customer/profile/edit")} />
        <MenuLink label="My Orders"          icon={ClipboardList} onClick={() => router.push("/customer/profile/orders")} />
        <MenuLink label="My Bookings"        icon={BookOpen}      onClick={() => router.push("/customer/profile/bookings")} />
        <MenuLink label="Loyalty & Rewards"  icon={Gift}          onClick={() => router.push("/customer/profile/loyalty")} />
        <MenuLink
          label="Refunds"
          icon={RotateCcw}
          onClick={() => router.push("/customer/support?tab=refunds")}
          badge={refundBadge}
        />
        <MenuLink label="Notifications"      icon={Bell}          onClick={() => router.push("/customer/notifications")} />
        <MenuLink label="Privacy & Security" icon={Shield}        onClick={() => router.push("/customer/profile/privacy")} />
        <MenuLink label="Help & Support"     icon={HelpCircle}    onClick={() => router.push("/customer/support")} />
      </div>

      <MenuLink label="Sign Out" icon={LogOut} onClick={handleLogout} danger />
    </PageWrapper>
  );
}