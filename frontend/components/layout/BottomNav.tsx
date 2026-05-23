"use client";

import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, ShoppingCart, Calendar, User, QrCode } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { cn } from "@/lib/utils";

// ── Nav config ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Home",    href: "/customer/home",    icon: Home },
  { label: "Booking", href: "/customer/booking", icon: Calendar },
  { label: "Scan",    href: "/customer/scan",    icon: QrCode,      center: true },
  { label: "Cart",    href: "/customer/order/cart", icon: ShoppingCart },
  { label: "Profile", href: "/customer/profile", icon: User },
];

// ── Cart badge ────────────────────────────────────────────────────────────────
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
          {/* Pulse ring */}
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

// ── Main ──────────────────────────────────────────────────────────────────────
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const cartCount = useCart((s) => s.itemCount)();

  // Active index for the sliding gold underline
  const activeIdx = NAV_ITEMS.findIndex((item) =>
    pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-2xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch h-16 max-w-lg mx-auto relative">

        {/* Sliding gold underline */}
        {activeIdx >= 0 && (
          <motion.div
            layoutId="navUnderline"
            className="absolute top-0 h-0.5 bg-[#E8A020] rounded-full"
            style={{ width: `${100 / NAV_ITEMS.length}%`, left: `${(activeIdx / NAV_ITEMS.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
          />
        )}

        {NAV_ITEMS.map((item, i) => {
          const Icon = item.icon;
          const isActive = i === activeIdx;
          const isCart = item.href.includes("cart");

          if (item.center) {
            // ── Centre scan button ────────────────────────────────────
            return (
              <div key={item.label} className="flex-1 flex items-center justify-center">
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => router.push(item.href)}
                  className="w-13 h-13 rounded-2xl bg-linear-to-br from-[#1A3C5E] to-[#2A5C8E] flex items-center justify-center shadow-lg -mt-4"
                  style={{ width: 52, height: 52 }}
                >
                  <Icon size={22} className="text-white" />
                </motion.button>
              </div>
            );
          }

          return (
            <motion.button
              key={item.label}
              whileTap={{ scale: 0.88 }}
              onClick={() => router.push(item.href)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative pt-1"
            >
              {/* Icon with bounce on tap */}
              <motion.div
                animate={isActive ? { y: [0, -3, 0] } : {}}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="relative"
              >
                <Icon
                  size={isActive ? 22 : 20}
                  className={cn(
                    "transition-all",
                    isActive ? "text-[#E8A020]" : "text-gray-400"
                  )}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                {isCart && <CartBadge count={cartCount} />}
              </motion.div>

              <span className={cn(
                "text-[10px] font-semibold transition-colors leading-none",
                isActive ? "text-[#E8A020]" : "text-gray-400"
              )}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default BottomNav;