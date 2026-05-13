"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { FoodCard } from "@/components/customer/FoodCard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useAuth } from "@/hooks/useAuth"
import { apiClient } from "@/lib/api-client"
import {
  Search,
  QrCode,
  Calendar,
  ShoppingBag,
  Clock,
  MapPin,
  Star,
  ChevronRight,
  Flame,
  TrendingUp,
} from "lucide-react"

const quickActions = [
  { label: "Scan QR", icon: <QrCode size={24} />, href: "/customer/scan", color: "bg-blue-500" },
  { label: "Book Table", icon: <Calendar size={24} />, href: "/customer/booking", color: "bg-green-500" },
  { label: "My Orders", icon: <ShoppingBag size={24} />, href: "/customer/order", color: "bg-purple-500" },
  { label: "Menu", icon: <TrendingUp size={24} />, href: "/customer/menu", color: "bg-orange-500" },
]

export default function CustomerHomePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const { user, branchId } = useAuth()

  const { data: activeOrders = [] } = useQuery({
    queryKey: ["customer", "active-orders"],
    queryFn: () => apiClient.get<any[]>("/orders/user/me?status=active"),
    refetchInterval: 15_000,
  })

  const { data: featuredItems = [] } = useQuery({
    queryKey: ["customer", "menu", branchId, "featured"],
    queryFn: () => apiClient.get<any[]>(`/menu/branch/${branchId}/items?limit=5`),
    enabled: !!branchId,
  })

  const { data: loyaltyData } = useQuery({
    queryKey: ["customer", "loyalty"],
    queryFn: () => apiClient.get<any>("/loyalty/me"),
  })

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Welcome back</p>
          <h1 className="text-xl font-bold text-gray-900">{user?.name ?? "Guest"}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <MapPin size={16} />
          <span>Nearby</span>
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
          <motion.div
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link href={action.href} className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 ${action.color} rounded-md flex items-center justify-center text-white shadow-lg`}>
                {action.icon}
              </div>
              <span className="text-xs font-medium text-gray-700">{action.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-md p-4 shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Active Order</h2>
            <StatusBadge status={activeOrders[0].status} />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              {activeOrders[0].items?.map((i: any) => i.name).join(", ")}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Clock size={14} />
                <span>In progress</span>
              </div>
              <span className="font-semibold text-gray-900">Rs {activeOrders[0].total}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Featured Items */}
      {featuredItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame size={20} className="text-orange-500" />
              <h2 className="font-semibold text-gray-900">Popular Dishes</h2>
            </div>
            <Link href="/customer/menu" className="text-sm text-brand-primary flex items-center gap-1">
              See All
              <ChevronRight size={16} />
            </Link>
          </div>
          <div className="space-y-4">
            {featuredItems.map((item: any, index: number) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <FoodCard item={item} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Loyalty Card */}
      {loyaltyData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-linear-to-r from-brand-primary to-brand-secondary rounded-md p-5 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Loyalty Points</p>
              <p className="text-2xl font-bold">{loyaltyData.points?.toLocaleString() ?? 0}</p>
              <p className="text-xs opacity-70 mt-1">
                {loyaltyData.pointsToNextReward ?? 0} points until next reward
              </p>
            </div>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Star size={28} className="text-yellow-300" />
            </div>
          </div>
          <div className="mt-4 bg-white/20 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-yellow-300 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${loyaltyData.progressPercent ?? 0}%` }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          </div>
        </motion.div>
      )}
    </PageWrapper>
  )
}
