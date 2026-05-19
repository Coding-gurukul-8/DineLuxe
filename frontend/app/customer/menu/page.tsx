"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { FoodCard } from "@/components/customer/FoodCard"
import { Search, SlidersHorizontal, ShoppingCart } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useCart } from "@/hooks/useCart"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

interface MenuCategory { id: string; name: string; items: any[] }

function normalizeItem(item: any) {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    price: item.price,
    discountedPrice: item.discounted_price ?? item.discountedPrice,
    photoUrl: item.photo_url ?? item.photoUrl,
    dietaryTags: item.dietary_tags ?? item.dietaryTags ?? [],
    allergens: item.allergens ?? [],
    prepTimeMinutes: item.prep_time_minutes ?? item.prepTimeMinutes,
    isAvailable: item.is_available ?? item.isAvailable ?? true,
    isSoldOut: item.is_sold_out ?? item.isSoldOut ?? false,
  }
}

export default function CustomerMenuPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const searchParams = useSearchParams()
  const { branchId: authBranchId } = useAuth()
  const cartBranchId = useCart((s) => s.branchId)
  const cartItems = useCart((s) => s.items)
  const addItem = useCart((s) => s.addItem)
  const updateQuantity = useCart((s) => s.updateQuantity)

  // branchId: prefer query param, then cart, then auth
  const branchId = searchParams.get("branchId") ?? cartBranchId ?? authBranchId ?? ""

  const { data: menuData, isLoading } = useQuery<{ categories: MenuCategory[] }>({
    queryKey: ["menu", "full", branchId],
    queryFn: () => apiClient.get<{ categories: MenuCategory[] }>(`/menu/branch/${branchId}`),
    enabled: !!branchId,
  })

  const categories = menuData?.categories ?? []

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((cat) => cat.items.length > 0)
    .filter((cat) => !activeCategory || cat.id === activeCategory)

  const qtyForItem = (id: string) => cartItems.find((i) => i.menuItemId === id)?.quantity ?? 0
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0)

  if (!branchId) {
    return (
      <PageWrapper title="Menu" subtitle="Scan a QR code to view the menu">
        <div className="text-center py-16 text-gray-500">
          <p className="mb-2 font-medium">No branch selected</p>
          <p className="text-sm">Scan a restaurant QR code or visit a restaurant page to see the menu.</p>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Menu" subtitle="Explore our delicious offerings">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all text-sm"
          />
        </div>
        <motion.button whileTap={{ scale: 0.95 }} className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
          <SlidersHorizontal size={20} />
        </motion.button>
      </div>

      {/* Category sticky nav */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-gray-50">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn("px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0", !activeCategory ? "bg-brand-primary text-white" : "bg-white text-gray-600 border border-gray-200")}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
              className={cn("px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0", activeCategory === cat.id ? "bg-brand-primary text-white" : "bg-white text-gray-600 border border-gray-200")}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-36 rounded-xl" />)}</div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>{searchQuery ? "No items match your search" : "Menu not available"}</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={activeCategory + searchQuery} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            {filteredCategories.map((cat) => (
              <div key={cat.id}>
                <h3 className="text-base font-semibold text-gray-800 mb-3">{cat.name}</h3>
                <div className="space-y-4">
                  {cat.items.map((item: any, index: number) => {
                    const qty = qtyForItem(item.id)
                    return (
                      <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                        <FoodCard
                          item={normalizeItem(item)}
                          quantity={qty}
                          onAddToCart={(itemId, newQty) => {
                            if (newQty <= 0) {
                              updateQuantity(itemId, 0)
                            } else if (qty === 0) {
                              addItem({ menuItemId: itemId, name: item.name, price: item.discounted_price ?? item.price, quantity: 1, photoUrl: item.photo_url }, null, branchId)
                            } else {
                              updateQuantity(itemId, newQty)
                            }
                          }}
                        />
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Cart FAB */}
      {cartCount > 0 && (
        <Link href="/customer/order/cart" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
          <motion.div initial={{ y: 80 }} animate={{ y: 0 }} className="flex items-center gap-3 bg-brand-primary text-white px-6 py-3 rounded-full shadow-xl">
            <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">{cartCount}</span>
            <span className="font-semibold">View Cart</span>
            <span>₹{cartTotal.toFixed(0)}</span>
          </motion.div>
        </Link>
      )}
    </PageWrapper>
  )
}