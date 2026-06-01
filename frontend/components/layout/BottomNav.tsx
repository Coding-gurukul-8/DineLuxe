"use client";

import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, ShoppingCart, Calendar, User, QrCode, LogOut, Sun, Moon, Bell } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

// ── Nav items (customer) ──────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Home",    href: "/customer/home",              icon: Home },
  { label: "Booking", href: "/customer/booking",           icon: Calendar },
  { label: "Scan",    href: "/customer/scan",              icon: QrCode, center: true },
  { label: "Alerts",  href: "/customer/notifications",     icon: Bell, notifications: true },
  { label: "Profile", href: "/customer/profile",           icon: User },
];

// ── Dark mode hook ────────────────────────────────────────────────────────────
function useDarkMode() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const ls = window.localStorage;
      const saved = typeof ls?.getItem === "function" ? ls.getItem("dineluxe-theme") : null;
      const isDark = saved === "dark";
      setDark(isDark);
      document.documentElement.classList.toggle("dark", isDark);
    } catch {}
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      const ls = window.localStorage;
      if (typeof ls?.setItem === "function") ls.setItem("dineluxe-theme", next ? "dark" : "light");
    } catch {}
  };

  return { dark, toggle, mounted };
}

// ── Cart badge ─────────────────────────────────────────────────────────────────
function CartBadge({ count }: { count: number }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="absolute -top-1.5 -right-1.5 min-w-4.5 h-4.5 bg-[#C0392B] rounded-full flex items-center justify-center px-1"
        >
          <motion.span
            animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-[#C0392B]"
          />
          <motion.span
            key={count}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500 }}
            className="relative text-white text-[10px] font-bold leading-none tabular-nums"
          >
            {count > 9 ? "9+" : count}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Notification badge ─────────────────────────────────────────────────────────
function NotifBadge({ count }: { count: number }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-[#C0392B] rounded-full flex items-center justify-center px-1"
        >
          <span className="text-white text-[10px] font-bold leading-none tabular-nums">
            {count > 9 ? "9+" : count}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Unread count hook ──────────────────────────────────────────────────────────
function useUnreadCount() {
  const { data } = useQuery<{ data: { count: number } }>({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => apiClient.get("/notifications?unread=true&count=true"),
    refetchInterval: 60_000, // poll every minute as fallback
    staleTime: 30_000,
  });
  return data?.data?.count ?? 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const cartCount = useCart((s) => s.itemCount)();
  const unreadCount = useUnreadCount();
  const { dark, toggle: toggleDark, mounted: darkMounted } = useDarkMode();
  const [showMenu, setShowMenu] = useState(false);

  const activeIdx = NAV_ITEMS.findIndex(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  const handleLogout = async () => {
    setShowMenu(false);
    await signOut();
    window.location.assign("/auth/login");
  };

  return (
    <>
      {/* ── Profile menu overlay ────────────────────────────────────── */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="fixed bottom-20 right-4 z-50 w-52 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
            >
              {/* Dark mode toggle */}
              <button
                onClick={() => { toggleDark(); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-800"
              >
                {darkMounted && dark
                  ? <Sun size={16} className="text-[#E8A020]" />
                  : <Moon size={16} className="text-gray-500" />
                }
                <span>{darkMounted && dark ? "Light mode" : "Dark mode"}</span>
              </button>
              {/* Sign out */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Bottom bar ──────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-stretch h-16 max-w-lg mx-auto relative">
          {/* Sliding gold underline */}
          {activeIdx >= 0 && (
            <motion.div
              layoutId="navUnderline"
              className="absolute top-0 h-0.5 bg-[#E8A020] rounded-full"
              style={{
                width: `${100 / NAV_ITEMS.length}%`,
                left: `${(activeIdx / NAV_ITEMS.length) * 100}%`,
              }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            />
          )}

          {NAV_ITEMS.map((item, i) => {
            const Icon = item.icon;
            const isActiveItem = i === activeIdx;
            const isCart = item.href.includes("cart");
            const isProfile = item.href.includes("profile");
            const isNotifications = !!(item as any).notifications;

            if (item.center) {
              return (
                <div key={item.label} className="flex-1 flex items-center justify-center">
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => router.push(item.href)}
                    aria-label="Scan QR"
                    className="w-13 h-13 rounded-2xl bg-linear-to-br from-[#1A3C5E] to-[#2A5C8E] flex items-center justify-center shadow-lg -mt-4"
                  >
                    <Icon size={22} className="text-white" />
                  </motion.button>
                </div>
              );
            }

            // Profile button opens overlay menu
            if (isProfile) {
              return (
                <motion.button
                  key={item.label}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => {
                    if (isActiveItem) {
                      setShowMenu((v) => !v);
                    } else {
                      router.push(item.href);
                    }
                  }}
                  className="flex-1 flex flex-col items-center justify-center gap-0.5 relative pt-1"
                >
                  <motion.div
                    animate={isActiveItem ? { y: [0, -3, 0] } : {}}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="relative"
                  >
                    <Icon
                      size={isActiveItem ? 22 : 20}
                      className={cn(
                        "transition-all",
                        isActiveItem ? "text-[#E8A020]" : "text-gray-400 dark:text-gray-500"
                      )}
                      strokeWidth={isActiveItem ? 2.2 : 1.8}
                    />
                  </motion.div>
                  <span className={cn(
                    "text-[10px] font-semibold transition-colors leading-none",
                    isActiveItem ? "text-[#E8A020]" : "text-gray-400 dark:text-gray-500"
                  )}>
                    {item.label}
                  </span>
                </motion.button>
              );
            }

            return (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.88 }}
                onClick={() => router.push(item.href)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative pt-1"
              >
                <motion.div
                  animate={isActiveItem ? { y: [0, -3, 0] } : {}}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="relative"
                >
                  <Icon
                    size={isActiveItem ? 22 : 20}
                    className={cn(
                      "transition-all",
                      isActiveItem ? "text-[#E8A020]" : "text-gray-400 dark:text-gray-500"
                    )}
                    strokeWidth={isActiveItem ? 2.2 : 1.8}
                  />
                  {isCart && <CartBadge count={cartCount} />}
                  {isNotifications && <NotifBadge count={unreadCount} />}
                </motion.div>
                <span className={cn(
                  "text-[10px] font-semibold transition-colors leading-none",
                  isActiveItem ? "text-[#E8A020]" : "text-gray-400 dark:text-gray-500"
                )}>
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default BottomNav;