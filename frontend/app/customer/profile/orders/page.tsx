"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueries, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, Clock, Filter, RefreshCcw, ReceiptText, Star, ShoppingBag } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { useCart } from "@/hooks/useCart";
import { cn, formatCurrency, formatDateTime, truncate } from "@/lib/utils";

type OrderType = "dine_in" | "delivery" | "takeaway";

interface OrderReview {
  id: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  name: string;
  notes?: string | null;
  menuItem?: { id: string; name: string; photo_url?: string | null };
}

interface OrderHistoryEntry {
  id: string;
  status: string;
  order_type: OrderType;
  created_at: string;
  branch_id: string;
  branch?: { id?: string; name: string } | null;
  items?: OrderItem[];
  total?: number;
  totalAmount?: number;
}

const FILTERS = ["all", "dine_in", "delivery", "takeaway"] as const;
type FilterKey = (typeof FILTERS)[number];

function formatItemsSummary(items: OrderItem[] | undefined) {
  if (!items || items.length === 0) return "No items";
  const names = items.map((item) => item.name).filter(Boolean);
  const shown = names.slice(0, 3);
  const remaining = names.length - shown.length;
  return `${shown.join(", ")}${remaining > 0 ? ` (+${remaining} more)` : ""}`;
}

export default function CustomerProfileOrdersPage() {
  const router = useRouter();
  const clearCart = useCart((state) => state.clearCart);
  const addItem = useCart((state) => state.addItem);
  const branchId = useCart((state) => state.branchId);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["customer", "profile", "orders"],
    queryFn: () => apiClient.get<OrderHistoryEntry[]>("/orders/user/me?limit=30"),
  });

  const reviewQueries = useQueries({
    queries: orders.map((order) => ({
      queryKey: ["customer", "profile", "order-review-status", order.id],
      queryFn: () => apiClient.get<OrderReview | null>(`/reviews/order/${order.id}`),
      enabled: Boolean(order.id),
    })),
  });

  const reviewMap = useMemo(() => {
    const map = new Map<string, boolean>();
    reviewQueries.forEach((query, index) => {
      const order = orders[index];
      map.set(order.id, Boolean(query.data));
    });
    return map;
  }, [orders, reviewQueries]);

  const filteredOrders = useMemo(() => {
    if (activeFilter === "all") return orders;
    return orders.filter((order) => order.order_type === activeFilter);
  }, [activeFilter, orders]);

  const handleReorder = (order: OrderHistoryEntry) => {
    if (!order.items || order.items.length === 0) {
      toast.error("No items to reorder");
      return;
    }

    clearCart();
    order.items.forEach((item) => {
      addItem(
        {
          id: item.menuItem?.id ?? item.id,
          name: item.menuItem?.name ?? item.name,
          price: item.unitPrice,
          quantity: item.quantity,
        },
        null,
        order.branch_id ?? branchId,
      );
    });

    toast.success("Items added to cart");
    router.push("/customer/order/cart");
  };

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">
      <div
        className="px-4 pt-12 pb-8 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #0D2A45 55%, #2A1A0A 100%)" }}
      >
        <div className="absolute -top-8 -right-8 w-44 h-44 rounded-full bg-[#E8A020]/10" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
          >
            <ChevronLeft size={18} className="text-white" />
          </motion.button>
          <div>
            <p className="text-[#E8A020] text-xs font-semibold uppercase tracking-widest">Profile</p>
            <h1 className="text-white font-bold text-xl">My Orders</h1>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3 text-white/70 text-sm">
          <ShoppingBag size={16} className="text-[#E8A020]" />
          <span>{isLoading ? "Loading orders…" : `${orders.length} order${orders.length === 1 ? "" : "s"} found`}</span>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => {
            const active = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-sm font-semibold border whitespace-nowrap transition-colors",
                  active
                    ? "bg-[#1A3C5E] text-white border-[#1A3C5E]"
                    : "bg-white text-gray-700 border-gray-100",
                )}
              >
                {filter === "all" ? "All" : filter === "dine_in" ? "Dine-In" : filter === "delivery" ? "Delivery" : "Takeaway"}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="bg-white rounded-2xl border border-gray-100 p-4 h-40 animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={<ReceiptText size={32} className="text-gray-300" />}
            title="No orders found"
            message="Your order history will appear here."
            action={{ label: "Browse Restaurants", onClick: () => router.push("/customer/home") }}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filteredOrders.map((order, index) => {
                const total = order.totalAmount ?? order.total ?? 0;
                const hasReview = reviewMap.get(order.id) ?? false;
                const orderTypeLabel = order.order_type === "dine_in" ? "Dine-In" : order.order_type === "delivery" ? "Delivery" : "Takeaway";
                const itemsSummary = formatItemsSummary(order.items);

                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate">{order.branch?.name ?? "Restaurant"}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-[#1A3C5E]/10 text-[#1A3C5E] px-2.5 py-1 text-[11px] font-semibold">
                            {orderTypeLabel}
                          </span>
                          <StatusBadge status={order.status} size="sm" />
                        </div>

                        <div className="mt-3 space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Clock size={13} className="text-gray-400" />
                            <span>{formatDateTime(order.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{truncate(itemsSummary, 90)}</p>
                          <p className="text-lg font-black text-[#1A3C5E]">{formatCurrency(total)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/customer/order/${order.id}/receipt`)}
                        className="flex-1 min-w-35 py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <ReceiptText size={14} /> View Receipt
                      </button>

                      {(order.status === "paid" || order.status === "closed") && !hasReview && (
                        <button
                          type="button"
                          onClick={() => router.push(`/customer/order/${order.id}/receipt`)}
                          className="flex-1 min-w-35 py-2.5 rounded-xl text-sm font-semibold text-[#E8A020] bg-[#E8A020]/10 hover:bg-[#E8A020]/20 transition-colors flex items-center justify-center gap-2"
                        >
                          <Star size={14} /> Rate Order
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleReorder(order)}
                        className="flex-1 min-w-35 py-2.5 rounded-xl text-sm font-semibold text-[#1A3C5E] bg-[#1A3C5E]/10 hover:bg-[#1A3C5E]/20 transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCcw size={14} /> Reorder
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

