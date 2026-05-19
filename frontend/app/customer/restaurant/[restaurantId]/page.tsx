"use client"

import { use, useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { apiClient } from "@/lib/api-client"
import { useCart } from "@/hooks/useCart"
import { FoodCard } from "@/components/customer/FoodCard"
import {
  ArrowLeft, Star, Clock, Users, MapPin,
  Phone, Info, ChefHat, MessageSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────
interface Branch {
  id: string; name: string; address: string; city: string; phone: string
  lat: number; lng: number; opening_time: string; closing_time: string; is_active: boolean
}
interface Restaurant {
  id: string; name: string; description: string; logo_url: string; banner_url: string
  cuisine_type: string; avg_rating: number; total_reviews: number; branches: Branch[]
}
interface LiveStatus { is_open: boolean; queue_length: number; wait_minutes: number }
interface MenuCategory { id: string; name: string; items: any[] }

// ── Helpers ──────────────────────────────────────────────────────────────────
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

type Tab = "menu" | "reviews" | "info"

interface Props { params: Promise<{ restaurantId: string }> }

export default function RestaurantPage({ params }: Props) {
  const { restaurantId } = use(params)
  const [activeTab, setActiveTab] = useState<Tab>("menu")
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const addItem = useCart((s) => s.addItem)
  const cartItems = useCart((s) => s.items)

  // ── Restaurant ────────────────────────────────────────────────────────────
  const { data: restaurant, isLoading } = useQuery<Restaurant>({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => apiClient.get<Restaurant>(`/restaurants/${restaurantId}`),
    enabled: !!restaurantId,
  })

  // ── Live status (refetch every 30s) ───────────────────────────────────────
  const { data: liveStatus } = useQuery<LiveStatus>({
    queryKey: ["restaurant", restaurantId, "live-status"],
    queryFn: () => apiClient.get<LiveStatus>(`/restaurants/${restaurantId}/live-status`),
    enabled: !!restaurantId,
    refetchInterval: 30_000,
  })

  // ── Branch — first active branch ──────────────────────────────────────────
  const branch = restaurant?.branches?.find((b) => b.is_active) ?? restaurant?.branches?.[0]

  // ── Menu ──────────────────────────────────────────────────────────────────
  const { data: menuData, isLoading: menuLoading } = useQuery<{ categories: MenuCategory[] }>({
    queryKey: ["menu", "branch", branch?.id],
    queryFn: () => apiClient.get<{ categories: MenuCategory[] }>(`/menu/branch/${branch!.id}`),
    enabled: !!branch?.id && activeTab === "menu",
  })

  const categories = menuData?.categories ?? []

  useEffect(() => {
    if (categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0].id)
    }
  }, [categories, activeCategoryId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="skeleton h-56 w-full" />
        <div className="px-4 py-6 space-y-4">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!restaurant) return null

  const qtyForItem = (id: string) => cartItems.find((i) => i.menuItemId === id)?.quantity ?? 0

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Banner */}
      <div className="relative h-56 bg-gradient-to-br from-brand-primary to-brand-secondary overflow-hidden">
        {restaurant.banner_url ? (
          <img src={restaurant.banner_url} alt={restaurant.name} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <ChefHat size={80} className="text-white" />
          </div>
        )}
        {/* Back button */}
        <Link href="/customer/home" className="absolute top-4 left-4 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-md">
          <ArrowLeft size={20} className="text-gray-700" />
        </Link>
        {/* Open/closed badge */}
        {liveStatus && (
          <div className={cn("absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold", liveStatus.is_open ? "bg-green-500 text-white" : "bg-red-500 text-white")}>
            {liveStatus.is_open ? "Open" : "Closed"}
          </div>
        )}
        {/* Logo */}
        {restaurant.logo_url && (
          <div className="absolute -bottom-8 left-4 w-16 h-16 rounded-xl border-4 border-white shadow-md overflow-hidden bg-white">
            <img src={restaurant.logo_url} alt="logo" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 pt-12 pb-4 bg-white">
        <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{restaurant.cuisine_type}</p>
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-1 text-sm text-amber-500">
            <Star size={14} className="fill-amber-400" />
            <span className="font-semibold text-gray-800">{restaurant.avg_rating?.toFixed(1) ?? "—"}</span>
            <span className="text-gray-400">({restaurant.total_reviews ?? 0})</span>
          </div>
          {liveStatus?.is_open && liveStatus.wait_minutes > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Clock size={14} />
              <span>~{liveStatus.wait_minutes} min wait</span>
            </div>
          )}
          {liveStatus?.is_open && liveStatus.queue_length > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Users size={14} />
              <span>{liveStatus.queue_length} in queue</span>
            </div>
          )}
          {branch?.address && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <MapPin size={14} />
              <span className="line-clamp-1">{branch.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 flex">
        {(["menu", "reviews", "info"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn("flex-1 py-3 text-sm font-medium capitalize transition-colors", activeTab === tab ? "text-brand-primary border-b-2 border-brand-primary" : "text-gray-500")}
          >
            {tab === "menu" && <ChefHat size={14} className="inline mr-1" />}
            {tab === "reviews" && <MessageSquare size={14} className="inline mr-1" />}
            {tab === "info" && <Info size={14} className="inline mr-1" />}
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Menu Tab */}
        {activeTab === "menu" && (
          <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4">
            {menuLoading ? (
              <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
            ) : categories.length === 0 ? (
              <p className="text-center py-12 text-gray-500">Menu not available</p>
            ) : (
              <>
                {/* Category nav — horizontal scroll */}
                <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide mb-4">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryId(cat.id)}
                      className={cn("px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0", activeCategoryId === cat.id ? "bg-brand-primary text-white" : "bg-white text-gray-600 border border-gray-200")}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Items — vertical list per active category */}
                {categories
                  .filter((cat) => !activeCategoryId || cat.id === activeCategoryId)
                  .map((cat) => (
                    <div key={cat.id} className="mb-8">
                      <h3 className="text-base font-semibold text-gray-800 mb-3">{cat.name}</h3>
                      <div className="space-y-4">
                        {cat.items?.map((item: any) => (
                          <FoodCard
                            key={item.id}
                            item={normalizeItem(item)}
                            quantity={qtyForItem(item.id)}
                            onAddToCart={(itemId, qty) =>
                              addItem(
                                { menuItemId: itemId, name: item.name, price: item.discounted_price ?? item.price, quantity: qty, photoUrl: item.photo_url },
                                restaurant.id,
                                branch?.id ?? null
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
              </>
            )}
          </motion.div>
        )}

        {/* Reviews Tab */}
        {activeTab === "reviews" && (
          <motion.div key="reviews" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-8 text-center">
            <MessageSquare size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Reviews coming soon</p>
          </motion.div>
        )}

        {/* Info Tab */}
        {activeTab === "info" && branch && (
          <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 py-4 space-y-4">
            <div className="bg-white rounded-xl p-4 space-y-3 border border-gray-100 shadow-sm">
              <h3 className="font-semibold text-gray-900">Branch Details</h3>
              <div className="flex items-start gap-3 text-sm text-gray-600">
                <MapPin size={16} className="shrink-0 mt-0.5 text-brand-primary" />
                <span>{branch.address}, {branch.city}</span>
              </div>
              {branch.phone && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Phone size={16} className="text-brand-primary" />
                  <a href={`tel:${branch.phone}`} className="text-brand-primary">{branch.phone}</a>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Clock size={16} className="text-brand-primary" />
                <span>{branch.opening_time} – {branch.closing_time}</span>
              </div>
            </div>
            {restaurant.description && (
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-2">About</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{restaurant.description}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart FAB */}
      {cartItems.length > 0 && (
        <Link href="/customer/order/cart" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
          <motion.div initial={{ y: 80 }} animate={{ y: 0 }} className="flex items-center gap-3 bg-brand-primary text-white px-6 py-3 rounded-full shadow-xl">
            <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
              {cartItems.reduce((s, i) => s + i.quantity, 0)}
            </span>
            <span className="font-semibold">View Cart</span>
            <span>₹{cartItems.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(0)}</span>
          </motion.div>
        </Link>
      )}
    </div>
  )
}