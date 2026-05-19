"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Button } from "@/components/ui/button"
import { useCart } from "@/hooks/useCart"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import {
  Plus, Minus, Trash2, ShoppingCart, ChevronRight, Tag, AlertCircle,
} from "lucide-react"

const TAX_RATE = 0.05

export default function CartPage() {
  const router = useRouter()
  const items      = useCart((s) => s.items)
  const branchId   = useCart((s) => s.branchId)
  const tableId    = useCart((s) => s.tableId)
  const updateQty  = useCart((s) => s.updateQuantity)
  const removeItem = useCart((s) => s.removeItem)
  const clearCart  = useCart((s) => s.clearCart)
  const getTotal   = useCart((s) => s.total)

  const subtotal = getTotal()
  const tax      = subtotal * TAX_RATE
  const total    = subtotal + tax

  const { mutate: placeOrder, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post<{ id: string }>("/orders", {
        branch_id: branchId,
        table_id: tableId ?? undefined,
        items: items.map((i) => ({ menu_item_id: i.menuItemId, quantity: i.quantity, notes: i.notes })),
        order_type: "dine-in",
      }),
    onSuccess: (order) => {
      clearCart()
      router.push(`/customer/order/${order.id}`)
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Could not place order. Please try again.")
    },
  })

  if (items.length === 0) {
    return (
      <PageWrapper title="Your Cart" subtitle="Review and manage your order">
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-4">
            <ShoppingCart className="text-gray-400" size={36} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Your cart is empty</h3>
          <p className="text-gray-500 mb-6 text-sm">Add delicious items from the menu</p>
          <Button onClick={() => router.push("/customer/menu")}>Explore Menu</Button>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Your Cart" subtitle={`${items.reduce((s, i) => s + i.quantity, 0)} items`}>
      {/* Cart Items */}
      <div className="space-y-3">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.menuItemId}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3"
            >
              {/* Thumb */}
              {item.photoUrl ? (
                <img src={item.photoUrl} alt={item.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-2xl">🍽</div>
              )}

              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm line-clamp-1">{item.name}</p>
                {item.notes && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">Note: {item.notes}</p>}
                <p className="font-bold text-gray-900 mt-1">₹{(item.price * item.quantity).toFixed(0)}</p>
                <p className="text-xs text-gray-400">₹{item.price} each</p>
              </div>

              {/* Qty controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => updateQty(item.menuItemId, item.quantity - 1)}
                  className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  {item.quantity === 1 ? <Trash2 size={14} className="text-red-400" /> : <Minus size={14} className="text-gray-600" />}
                </button>
                <motion.span key={item.quantity} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="w-8 text-center font-semibold text-gray-900 text-sm">
                  {item.quantity}
                </motion.span>
                <button
                  onClick={() => updateQty(item.menuItemId, item.quantity + 1)}
                  className="w-8 h-8 rounded-lg bg-brand-primary text-white flex items-center justify-center hover:bg-brand-primary/90 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Clear cart */}
      <button onClick={clearCart} className="text-sm text-red-500 flex items-center gap-1 hover:underline">
        <Trash2 size={14} /> Clear cart
      </button>

      {/* Order Summary */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-3">
        <h2 className="font-semibold text-gray-900">Order Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>GST (5%)</span>
            <span>₹{tax.toFixed(2)}</span>
          </div>
          <div className="border-t border-gray-100 pt-2 flex justify-between text-base font-bold text-gray-900">
            <span>Total</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* No branch warning */}
      {!branchId && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>No branch linked. Scan a QR code to continue.</span>
        </div>
      )}

      {/* Place Order CTA */}
      <Button
        className="w-full py-4 text-base font-semibold"
        disabled={isPending || !branchId}
        onClick={() => placeOrder()}
      >
        {isPending ? "Placing Order…" : `Place Order • ₹${total.toFixed(0)}`}
        {!isPending && <ChevronRight size={18} className="ml-1" />}
      </Button>
    </PageWrapper>
  )
}