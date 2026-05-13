"use client"

import PageWrapper from "@/components/layout/PageWrapper"
import CartItem from "@/components/customer/CartItem"
import { Button } from "@/components/ui/button"
import { useCart } from "@/hooks/useCart"
import { useRouter } from "next/navigation"
import { ShoppingBag } from "lucide-react"

export default function CartPage() {
  const router = useRouter()
  const items = useCart((state) => state.items)
  const updateQuantity = useCart((state) => state.updateQuantity)
  const removeItem = useCart((state) => state.removeItem)
  const total = useCart((state) => state.total)

  if (items.length === 0) {
    return (
      <PageWrapper title="Your cart" subtitle="Order">
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Your cart is empty</h3>
          <p className="text-sm text-gray-500">Add items from the menu to get started</p>
          <Button className="mt-6" onClick={() => router.push("/customer/menu")}>
            Browse Menu
          </Button>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Your cart" subtitle="Order">
      <div className="space-y-4">
        {items.map((item) => (
          <CartItem
            key={item.menuItemId}
            name={item.name}
            description={item.notes ?? ""}
            price={item.price}
            quantity={item.quantity}
            onIncrease={() => updateQuantity(item.menuItemId, item.quantity + 1)}
            onDecrease={() => updateQuantity(item.menuItemId, Math.max(1, item.quantity - 1))}
            onRemove={() => removeItem(item.menuItemId)}
          />
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between rounded-md border border-ink/10 bg-paper/90 p-6 shadow-soft">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Subtotal</p>
          <p className="mt-2 text-2xl font-semibold text-ink">Rs {total().toFixed(2)}</p>
        </div>
        <Button onClick={() => router.push("/customer/payment/checkout")}>Checkout</Button>
      </div>
    </PageWrapper>
  )
}
