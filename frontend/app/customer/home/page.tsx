"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { PageWrapper } from "@/components/layout/PageWrapper"
import RestaurantCard from "@/components/customer/RestaurantCard"
import { FoodCard } from "@/components/customer/FoodCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useAuth } from "@/hooks/useAuth"
import { useCart } from "@/hooks/useCart"
import { apiClient } from "@/lib/api-client"
import {
  Search, QrCode, Calendar, ShoppingBag, Clock,
  Star, ChevronRight, Flame, TrendingUp, Bell, Gift, MapPin,
} from "lucide-react"

interface Branch {
  id: string; name: string; address: string; city: string; phone: string
  lat: number; lng: number; opening_time: string; closing_time: string; is_active: boolean
}
interface Restaurant {
  id: string; name: string; description: string; logo_url: string; banner_url: string
  cuisine_type: string; avg_rating: number; total_reviews: number; branches: Branch[]
}

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 }

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)
}

const quickActions = [
  { label: "Scan QR", icon: <QrCode size={24} />, href: "/customer/scan", color: "bg-blue-500" },
  { label: "Book Table", icon: <Calendar size={24} />, href: "/customer/booking", color: "bg-green-500" },
  { label: "My Orders", icon: <ShoppingBag size={24} />, href: "/customer/order", color: "bg-purple-500" },
  { label: "Menu", icon: <TrendingUp size={24} />, href: "/customer/menu", color: "bg-orange-500" },
]

const ORDER_STEPS = ["pending", "confirmed", "preparing", "ready", "served", "completed"]
function progressPercent(status: string) {
  const idx = ORDER_STEPS.indexOf(status)
  return idx < 0 ? 0 : Math.round(((idx + 1) / ORDER_STEPS.length) * 100)
}

export default function CustomerHomePage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const { user, branchId } = useAuth()
  const addItem = useCart((s) => s.addItem)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoReady, setGeoReady] = useState(false)

  useEffect(() => {
    if (!navigator?.geolocation) { setCoords(INDIA_CENTER); setGeoReady(true); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoReady(true) },
      () => { setCoords(INDIA_CENTER); setGeoReady(true) },
      { timeout: 5000 }
    )
  }, [])

  const { data: nearbyRestaurants = [] } = useQuery<Restaurant[]>({
    queryKey: ["restaurants", "nearby", coords],
    queryFn: () => apiClient.get<Restaurant[]>(`/restaurants/nearby?lat=${coords!.lat}&lng=${coords!.lng}&radius=50`),
    enabled: geoReady && !!coords,
  })

  const { data: activeOrders = [] } = useQuery<any[]>({
    queryKey: ["customer", "active-orders"],
    queryFn: () => apiClient.get<any[]>("/orders/user/me?status=active"),
    refetchInterval: 15_000,
  })

  const { data: featuredItems = [] } = useQuery<any[]>({
    queryKey: ["customer", "menu", branchId, "featured"],
    queryFn: () => apiClient.get<any[]>(`/menu/branch/${branchId}/items?limit=5`),
    enabled: !!branchId,
  })

  const { data: loyaltyData } = useQuery<any>({
    queryKey: ["customer", "loyalty"],
    queryFn: () => apiClient.get<any>("/loyalty/me"),
  })

  const filteredRestaurants = nearbyRestaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.cuisine_type?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Welcome back</p>
          <h1 className="text-xl font-bold text-gray-900">{user?.name ?? "Guest"}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 bg-white rounded-full shadow-sm"><Bell size={20} className="text-gray-600" /></button>
          <button className="p-2 bg-white rounded-full shadow-sm"><Gift size={20} className="text-gray-600" /></button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search dishes, restaurants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none transition-all"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        {quickActions.map((action, index) => (
          <motion.div key={action.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} whileTap={{ scale: 0.95 }}>
            <Link href={action.href} className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 ${action.color} rounded-md flex items-center justify-center text-white shadow-lg`}>{action.icon}</div>
              <span className="text-xs font-medium text-gray-700">{action.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900">Active Orders</h2>
          {activeOrders.map((order: any) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              onClick={() => router.push(`/customer/order/${order.id}`)}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-gray-500">#{order.id?.slice(-6).toUpperCase()}</span>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-sm text-gray-700 line-clamp-1 mb-2">
                {order.items?.map((i: any) => i.name).join(", ") ?? "Order items"}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-brand-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${progressPercent(order.status)}%` }} transition={{ duration: 0.8 }} />
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                  <Clock size={12} />
                  <span className="capitalize">{order.status?.replace("_", " ")}</span>
                </div>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-gray-500">{order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? "s" : ""}</span>
                <span className="text-sm font-semibold text-gray-900">₹{order.total ?? 0}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Nearby Restaurants */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={20} className="text-brand-primary" />
          <h2 className="font-semibold text-gray-900">Nearby Restaurants</h2>
        </div>
        {!geoReady ? (
          <div className="space-y-4">{[1, 2].map((i) => <div key={i} className="skeleton h-48 rounded-xl" />)}</div>
        ) : filteredRestaurants.length === 0 ? (
          <p className="text-center py-8 text-sm text-gray-500">No restaurants found nearby</p>
        ) : (
          <div className="space-y-4">
            {filteredRestaurants.map((restaurant, index) => {
              const branch = restaurant.branches?.find((b) => b.is_active) ?? restaurant.branches?.[0]
              const distanceStr = branch && coords ? `${getDistanceKm(coords.lat, coords.lng, branch.lat, branch.lng)} km` : "—"
              return (
                <motion.div key={restaurant.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }} whileTap={{ scale: 0.98 }}>
                  <Link href={`/customer/restaurant/${restaurant.id}`}>
                    <RestaurantCard name={restaurant.name} cuisine={restaurant.cuisine_type ?? "Restaurant"} distance={distanceStr} rating={restaurant.avg_rating ?? 0} imageUrl={restaurant.banner_url ?? restaurant.logo_url} />
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Featured Items */}
      {featuredItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame size={20} className="text-orange-500" />
              <h2 className="font-semibold text-gray-900">Popular Dishes</h2>
            </div>
            <Link href="/customer/menu" className="text-sm text-brand-primary flex items-center gap-1">See All <ChevronRight size={16} /></Link>
          </div>
          <div className="space-y-4">
            {featuredItems.map((item: any, index: number) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                <FoodCard
                  item={{ id: item.id, name: item.name, description: item.description ?? "", price: item.price, discountedPrice: item.discounted_price, photoUrl: item.photo_url ?? item.photoUrl, dietaryTags: item.dietary_tags ?? item.dietaryTags ?? [], allergens: item.allergens ?? [], prepTimeMinutes: item.prep_time_minutes ?? item.prepTimeMinutes, isAvailable: item.is_available ?? true, isSoldOut: item.is_sold_out ?? false }}
                  onAddToCart={(itemId, qty) => addItem({ menuItemId: itemId, name: item.name, price: item.discounted_price ?? item.price, quantity: qty, photoUrl: item.photo_url }, item.restaurant_id ?? null, branchId)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Loyalty Card */}
      {loyaltyData && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-xl p-5 text-white" style={{ background: "linear-gradient(135deg, #1a3c5e 0%, #e8a020 100%)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Loyalty Points</p>
              <p className="text-2xl font-bold">{loyaltyData.points?.toLocaleString() ?? 0}</p>
              <p className="text-xs opacity-70 mt-1">{loyaltyData.pointsToNextReward ?? 0} points until next reward</p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Star size={28} className="text-yellow-300" />
            </div>
          </div>
          <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
            <motion.div className="h-full bg-yellow-300 rounded-full" initial={{ width: 0 }} animate={{ width: `${loyaltyData.progressPercent ?? 0}%` }} transition={{ duration: 1, delay: 0.5 }} />
          </div>
        </motion.div>
      )}
    </PageWrapper>
  )
}