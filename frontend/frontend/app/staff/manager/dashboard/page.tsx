"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { KPICard } from "@/components/shared/KPICard"
import { TableUnit } from "@/components/shared/TableUnit"
import { OrderTicketCard } from "@/components/shared/OrderTicketCard"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { 
  Users, 
  ShoppingCart, 
  IndianRupee,
  Clock,
  Bell,
  Filter,
  RefreshCw
} from "lucide-react"

interface Table {
  id: string
  number: string
  capacity: number
  status: 'free' | 'occupied' | 'reserved' | 'cleaning' | 'maintenance'
  currentOrder?: {
    id: string
    customerName: string
    orderStatus: string
    itemsCount: number
    timeElapsed?: number
  }
}

interface Order {
  id: string
  orderNumber: string
  customerName: string
  tableNumber?: string
  status: string
  items: Array<{
    name: string
    quantity: number
    specialRequests?: string
  }>
  total: number
  createdAt: string
  estimatedTime?: number
  priority?: 'low' | 'medium' | 'high'
}

export default function StaffDashboardPage() {
  const [activeTab, setActiveTab] = useState<"tables" | "orders">("tables")
  const [timeRange, setTimeRange] = useState("today")

  const { data: tables = [] } = useQuery({
    queryKey: ["staff", "tables"],
    queryFn: () => apiClient.get<Table[]>("/tables")
  })

  const { data: orders = [] } = useQuery({
    queryKey: ["staff", "orders"],
    queryFn: () => apiClient.get<Order[]>("/orders/staff")
  })

  const { data: kpiData = {} } = useQuery({
    queryKey: ["staff", "kpi", timeRange],
    queryFn: () => apiClient.get("/analytics/kpi")
  })

  return (
    <PageWrapper 
      title="Staff Dashboard" 
      subtitle="Monitor tables, orders, and performance"
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="Active Tables"
          value={kpiData.activeTables || 0}
          change="+12%"
          changeType="positive"
          icon={<Users size={24} />}
        />
        <KPICard
          title="Active Orders"
          value={kpiData.activeOrders || 0}
          change="+8%"
          changeType="positive"
          icon={<ShoppingCart size={24} />}
        />
        <KPICard
          title="Revenue"
          value={`Rs ${kpiData.revenue?.toLocaleString() || 0}`}
          change="+15%"
          changeType="positive"
          icon={<IndianRupee size={24} />}
        />
        <KPICard
          title="Avg. Wait Time"
          value={`${kpiData.avgWaitTime || 0} min`}
          change="-2 min"
          changeType="positive"
          icon={<Clock size={24} />}
        />
      </div>

      {/* Dashboard Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("tables")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "tables"
                ? "bg-brand-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Tables
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "orders"
                ? "bg-brand-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Orders
          </button>
        </div>
        
        <div className="flex gap-2 ml-auto">
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <Button variant="outline" className="flex items-center gap-2">
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tables View */}
      {activeTab === "tables" && (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {tables.map((table) => (
            <TableUnit 
              key={table.id} 
              table={table} 
              onClick={() => console.log("Table clicked:", table.id)}
            />
          ))}
        </motion.div>
      )}

      {/* Orders View */}
      {activeTab === "orders" && (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {orders.map((order) => (
            <OrderTicketCard 
              key={order.id} 
              order={order} 
              onClick={() => console.log("Order clicked:", order.id)}
            />
          ))}
        </motion.div>
      )}
    </PageWrapper>
  )
}