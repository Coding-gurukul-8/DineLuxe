"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { KPICard } from "@/components/charts/KPICard"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { useAuth } from "@/hooks/useAuth"
import { apiClient } from "@/lib/api-client"
import { DollarSign, Users, ShoppingBag, Star } from "lucide-react"

export default function OwnerDashboardPage() {
  const { branchId } = useAuth()

  const { data: sales } = useQuery({
    queryKey: ["reports", "sales", branchId],
    queryFn: () => apiClient.get<any>(`/reports/sales?period=today`),
    enabled: !!branchId,
    refetchInterval: 60_000,
  })

  const { data: menuPerf } = useQuery({
    queryKey: ["reports", "menu-performance", branchId],
    queryFn: () => apiClient.get<any>(`/reports/menu-performance`),
    enabled: !!branchId,
  })

  const { data: recentOrders = [] } = useQuery({
    queryKey: ["orders", "active", branchId],
    queryFn: () => apiClient.get<any[]>(`/orders/branch/${branchId}/active`),
    enabled: !!branchId,
    refetchInterval: 15_000,
  })

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff", branchId],
    queryFn: () => apiClient.get<any[]>(`/staff/branch/${branchId}`),
    enabled: !!branchId,
    refetchInterval: 60_000,
  })

  const kpiData = [
    {
      title: "Today's Revenue",
      value: sales?.totalRevenue ?? 0,
      prefix: "Rs ",
      change: sales?.revenueChangePercent ?? 0,
      changeType: (sales?.revenueChangePercent ?? 0) >= 0 ? "increase" : "decrease" as const,
      icon: <DollarSign size={20} />,
      color: "blue",
    },
    {
      title: "Total Orders",
      value: sales?.totalOrders ?? 0,
      change: sales?.ordersChangePercent ?? 0,
      changeType: (sales?.ordersChangePercent ?? 0) >= 0 ? "increase" : "decrease" as const,
      icon: <ShoppingBag size={20} />,
      color: "green",
    },
    {
      title: "Customers",
      value: sales?.uniqueCustomers ?? 0,
      change: sales?.customersChangePercent ?? 0,
      changeType: (sales?.customersChangePercent ?? 0) >= 0 ? "increase" : "decrease" as const,
      icon: <Users size={20} />,
      color: "purple",
    },
    {
      title: "Avg Rating",
      value: sales?.avgRating ?? 0,
      suffix: "/5",
      change: sales?.ratingChangePercent ?? 0,
      changeType: (sales?.ratingChangePercent ?? 0) >= 0 ? "increase" : "decrease" as const,
      icon: <Star size={20} />,
      color: "orange",
    },
  ]

  const topItems: any[] = menuPerf?.topItems ?? []

  return (
    <PageWrapper title="Dashboard" subtitle="Overview of your restaurant performance">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <KPICard {...kpi} />
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-md border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
            <Link href="/owner/bookings" className="text-sm text-brand-primary hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {recentOrders.slice(0, 5).map((order: any) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {order.customer?.name ?? "Customer"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {order.items?.length ?? 0} items
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">
                    Rs {order.total ?? order.totalAmount}
                  </span>
                  <StatusBadge status={order.status} size="sm" />
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No active orders</p>
            )}
          </div>
        </motion.div>

        {/* Top Items */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-md border border-gray-100 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Top Selling Items</h2>
            <Link href="/owner/menu" className="text-sm text-brand-primary hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {topItems.slice(0, 4).map((item: any, index: number) => (
              <div key={item.id ?? item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-primary/10 rounded-lg flex items-center justify-center text-brand-primary font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.totalOrders ?? item.orders} orders</p>
                  </div>
                </div>
                <span className="font-semibold text-gray-900">Rs {item.revenue?.toLocaleString()}</span>
              </div>
            ))}
            {topItems.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No data yet</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Staff Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-md border border-gray-100 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Staff on Duty</h2>
          <Link href="/owner/staff" className="text-sm text-brand-primary hover:underline">View All</Link>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {staffList.slice(0, 3).map((staff: any) => (
            <div key={staff.id} className="p-4 bg-gray-50 rounded-xl text-center">
              <div className="w-12 h-12 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <Users size={20} className="text-brand-primary" />
              </div>
              <p className="font-medium text-gray-900 text-sm">{staff.name ?? staff.user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{staff.role}</p>
            </div>
          ))}
          {staffList.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4 col-span-3">No staff on duty</p>
          )}
        </div>
      </motion.div>
    </PageWrapper>
  )
}
