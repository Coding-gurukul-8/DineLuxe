"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Plus, Minus, ShoppingBag, ChevronLeft, Loader2, Tag } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, cn } from "@/lib/utils";

function AnimatedPrice({ value }: { value: number }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span key={value}
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="tabular-nums">
        {formatCurrency(value)}
      </motion.span>
    </AnimatePresence>
  );
}

function CartItem({
  item, onQtyChange, onRemove,
}: {
  item: { id: string; name: string; price: number; quantity: number; image_url?: string | null };
  onQtyChange: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
}) {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-80, -20], [1, 0]);
  const itemOpacity = useTransform(x, [-80, 0], [0.6, 1]);
  const [removing, setRemoving] = useState(false);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -70) { setRemoving(true); setTimeout(() => onRemove(item.id), 320); }
  }

  return (
    <AnimatePresence>
      {!removing && (
        <motion.div layout exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.28, ease: "easeInOut" }}
          className="relative overflow-hidden rounded-2xl">
          <motion.div style={{ opacity: deleteOpacity }}
            className="absolute inset-0 bg-[#C0392B] rounded-2xl flex items-center justify-end pr-5">
            <Trash2 size={22} className="text-white" />
          </motion.div>
          <motion.div drag="x" dragConstraints={{ left: -90, right: 0 }} dragElastic={0.15}
            onDragEnd={handleDragEnd} style={{ x, opacity: itemOpacity }}
            className="relative z-10 bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border border-gray-50 cursor-grab active:cursor-grabbing">
            {item.image_url
              ? <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
              : <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><ShoppingBag size={20} className="text-gray-300" /></div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(item.price)} each</p>
              <div className="flex items-center gap-2 mt-2">
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => onQtyChange(item.id, item.quantity - 1)}
                  className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                  <Minus size={12} className="text-gray-600" />
                </motion.button>
                <AnimatePresence mode="wait">
                  <motion.span key={item.quantity}
                    initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="text-sm font-bold text-gray-900 w-5 text-center tabular-nums">
                    {item.quantity}
                  </motion.span>
                </AnimatePresence>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => onQtyChange(item.id, item.quantity + 1)}
                  className="w-7 h-7 rounded-full bg-[#E8A020] flex items-center justify-center shadow-sm">
                  <Plus size={12} className="text-white" />
                </motion.button>
              </div>
            </div>
            <div className="text-right text-sm font-bold text-gray-900 shrink-0">
              <AnimatedPrice value={item.price * item.quantity} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type OrderState = "idle" | "processing" | "confirmed";

function PlaceOrderButton({ state, onClick }: { state: OrderState; onClick: () => void }) {
  const labels: Record<OrderState, string> = { idle: "Place Order", processing: "Placing Order…", confirmed: "Order Placed!" };
  const colors: Record<OrderState, string> = { idle: "bg-[#E8A020]", processing: "bg-[#E8A020]/80", confirmed: "bg-green-500" };
  return (
    <motion.button layout whileTap={state === "idle" ? { scale: 0.97 } : {}}
      onClick={state === "idle" ? onClick : undefined} disabled={state !== "idle"}
      className={cn("w-full py-4 rounded-2xl font-bold text-white text-base shadow-lg transition-colors flex items-center justify-center gap-2", colors[state])}>
      <AnimatePresence mode="wait">
        <motion.span key={state} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex items-center gap-2">
          {state === "processing" && <Loader2 size={18} className="animate-spin" />}
          {state === "confirmed" && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400 }}>✓</motion.span>}
          {labels[state]}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

export default function CartPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { branchId } = useAuth();
  const items = useCart((s) => s.items);
  const updateItem = useCart((s) => s.updateQuantity);
  const removeItem = useCart((s) => s.removeItem);
  const clearCart = useCart((s) => s.clearCart);
  const cartTotal = useCart((s) => s.total);
  const cartRestaurantId = useCart((s) => s.restaurantId);
  const cartBranchId = useCart((s) => s.branchId);
  const [orderState, setOrderState] = useState<OrderState>("idle");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState(false);

  const tax = cartTotal() * 0.05;
  const discount = promoApplied ? cartTotal() * 0.1 : 0;
  const grandTotal = cartTotal() + tax - discount;

  const { mutate: placeOrder } = useMutation({
    mutationFn: () => apiClient.post("/orders", {
      branch_id: cartBranchId ?? branchId,
      restaurant_id: cartRestaurantId,
      order_type: "dine_in",
      items: items.map((i) => ({ menu_item_id: i.id, quantity: i.quantity, unit_price: i.price })),
    }),
    onMutate: () => setOrderState("processing"),
    onSuccess: (order: any) => {
      setOrderState("confirmed");
      clearCart();
      qc.invalidateQueries({ queryKey: ["customer", "active-orders"] });
      setTimeout(() => router.push(`/customer/payment/${order.id}`), 900);
    },
    onError: () => { setOrderState("idle"); toast.error("Could not place order. Please try again."); },
  });

  if (items.length === 0 && orderState !== "confirmed") {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 280 }}
            className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-5">
            <ShoppingBag size={36} className="text-gray-300" />
          </motion.div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Your cart is empty</h2>
          <p className="text-sm text-gray-500 mb-6">Add items from a restaurant to get started</p>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => router.push("/customer/home")}
            className="bg-[#E8A020] text-white font-bold px-8 py-3 rounded-2xl shadow-lg">
            Explore Menu
          </motion.button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="flex items-center gap-3 mb-6">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ChevronLeft size={18} className="text-gray-700" />
        </motion.button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Your Cart</h1>
          <p className="text-xs text-gray-500">{items.length} item{items.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <CartItem key={item.id} item={item}
              onQtyChange={(id, qty) => { if (qty <= 0) removeItem(id); else updateItem(id, qty); }}
              onRemove={removeItem} />
          ))}
        </AnimatePresence>
      </div>

      <motion.div layout className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-4">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
            <Tag size={15} className="text-gray-400" />
            <input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="Promo code"
              className="text-sm bg-transparent focus:outline-none flex-1 placeholder-gray-400" />
          </div>
          <motion.button whileTap={{ scale: 0.95 }}
            onClick={() => { if (promoCode.trim()) { setPromoApplied(true); toast.success("Promo applied! 10% off"); } }}
            className="bg-[#1A3C5E] text-white text-sm font-bold px-4 rounded-xl">
            Apply
          </motion.button>
        </div>
        {promoApplied && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-green-600 font-semibold mt-2">
            ✓ 10% discount applied
          </motion.p>
        )}
      </motion.div>

      <motion.div layout className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mb-6 space-y-3">
        <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><AnimatedPrice value={cartTotal()} /></div>
        <div className="flex justify-between text-sm text-gray-600"><span>Taxes & fees (5%)</span><AnimatedPrice value={tax} /></div>
        {promoApplied && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-between text-sm text-green-600 font-medium">
            <span>Promo discount</span><span>-{formatCurrency(discount)}</span>
          </motion.div>
        )}
        <div className="border-t border-gray-100 pt-3 flex justify-between text-base font-bold text-gray-900">
          <span>Total</span><AnimatedPrice value={grandTotal} />
        </div>
      </motion.div>

      <PlaceOrderButton state={orderState} onClick={() => placeOrder()} />
    </PageWrapper>
  );
}