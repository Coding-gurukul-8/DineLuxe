"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCart } from "@/hooks/useCart";
import { ShoppingBag, RotateCcw, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface OrderItem { id?: string; name: string; quantity: number; unitPrice: number; menuItemId?: string }
interface Order {
  id: string; status: string; total: number; order_type: string
  created_at: string; items?: OrderItem[]; branch_id?: string
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function CustomerOrderHistoryPage() {
  const router = useRouter()
  const addItem    = useCart((s) => s.addItem)
  const clearCart  = useCart((s) => s.clearCart)
  const branchId   = useCart((s) => s.branchId)

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["orders", "user", "me"],
    queryFn: () => apiClient.get<Order[]>("/orders/user/me"),
  });

  const handleReorder = (order: Order) => {
    if (!order.items || order.items.length === 0) {
      toast.error("No items to reorder")
      return
    }
    clearCart()
    order.items.forEach((item) => {
      addItem(
        {
          menuItemId: item.menuItemId ?? item.id ?? item.name,
          name: item.name,
          price: item.unitPrice,
          quantity: item.quantity,
        },
        null,
        order.branch_id ?? branchId
      )
    })
    toast.success("Items added to cart")
    router.push("/customer/order/cart")
  }

  return (
    <PageWrapper title="Order History" subtitle="All your past orders">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
          <ShoppingBag size={20} />
        </div>
        <p className="text-sm text-gray-500">
          {isLoading ? "Loading…" : `${orders.length} order${orders.length !== 1 ? "s" : ""} found`}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <ShoppingBag size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">No orders yet</p>
          <p className="text-sm mt-1">Your order history will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order, i) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-gray-500">#{order.id.slice(-8).toUpperCase()}</span>
                <StatusBadge status={order.status} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 capitalize">{order.order_type?.replace("_", " ") ?? "—"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <p className="font-semibold text-gray-900">{formatCurrency(order.total ?? 0)}</p>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => router.push(`/customer/order/${order.id}`)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  View <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => handleReorder(order)}
                  className="flex-1 flex items-center justify-center gap-1 py-2 bg-brand-primary/10 text-brand-primary rounded-lg text-sm font-medium hover:bg-brand-primary/20 transition-colors"
                >
                  <RotateCcw size={14} /> Reorder
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </PageWrapper>
  );
}