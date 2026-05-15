"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import { ShoppingBag, Clock, ArrowRight, MapPin, Filter } from "lucide-react"
import { apiClient } from "@/lib/api-client"

const statusSteps = [
  { status: "preparing", label: "Preparing" },
  { status: "ready", label: "Ready" },
  { status: "served", label: "Served" },
]

const ACTIVE_STATUSES = ["created", "confirmed", "preparing", "ready"]
const PAST_STATUSES = ["served", "paid", "closed", "cancelled"]

export default function CustomerOrderPage() {
  const [activeTab, setActiveTab] = useState<"ongoing" | "history">("ongoing")
  const [filter, setFilter] = useState("all")

  const { data: allOrders = [], isLoading } = useQuery({
    queryKey: ["customer", "orders"],
    queryFn: () => apiClient.get<any[]>("/orders/user/me"),
    refetchInterval: 15_000,
  })

  const ongoingOrders = allOrders.filter((o: any) => ACTIVE_STATUSES.includes(o.status))
  const pastOrders = allOrders.filter((o: any) => PAST_STATUSES.includes(o.status))

  const displayOrders = activeTab === "ongoing" ? ongoingOrders : pastOrders

  return (
    <PageWrapper title="Your Orders" subtitle="Track and manage your orders">
      {/* Filter Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("ongoing")}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
              activeTab === "ongoing"
                ? "bg-brand-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Ongoing ({ongoingOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
              activeTab === "history"
                ? "bg-brand-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            History ({pastOrders.length})
          </button>
        </div>
        <button className="p-3 bg-white rounded-xl border border-gray-200">
          <Filter size={20} className="text-gray-600" />
        </button>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-500">Loading orders…</div>}

      {/* Orders List */}
      <div className="space-y-4">
        {!isLoading && displayOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {activeTab === "ongoing" ? "No active orders" : "No past orders"}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {activeTab === "ongoing"
                ? "Your current orders will appear here"
                : "Your completed orders will appear here"}
            </p>
            <Button variant="primary">Order Now</Button>
          </motion.div>
        ) : (
          displayOrders.map((order: any) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-md border border-gray-100 p-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">{order.branch?.name ?? "Restaurant"}</h3>
                  <p className="text-sm text-gray-500">#{order.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              {/* Table Info */}
              {order.table?.label && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-brand-primary/5 rounded-xl">
                  <MapPin size={18} className="text-brand-primary" />
                  <span className="font-medium text-gray-900">Table {order.table.label}</span>
                </div>
              )}

              {/* Progress Steps (ongoing only) */}
              {activeTab === "ongoing" && (
                <div className="flex items-center justify-between mb-4">
                  {statusSteps.map((step, index) => {
                    const stepIndex = statusSteps.findIndex((s) => s.status === order.status)
                    const isActive = index <= stepIndex
                    return (
                      <div key={step.status} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isActive ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <span className="text-xs mt-1 text-gray-500">{step.label}</span>
                        </div>
                        {index < statusSteps.length - 1 && (
                          <div className={`flex-1 h-0.5 ${isActive ? "bg-brand-primary" : "bg-gray-200"} mx-2`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Items */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                {(order.items ?? []).map((item: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">
                      {item.quantity}x {item.name ?? item.menuItem?.name}
                    </span>
                    <span className="text-gray-900">Rs {item.price ?? item.unitPrice}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex justify-between font-semibold text-lg border-t border-gray-100 pt-4">
                <span>Total</span>
                <span>Rs {order.total ?? order.totalAmount}</span>
              </div>

              {/* Reorder (history) */}
              {activeTab === "history" && (
                <Button variant="outline" className="w-full mt-4">
                  Reorder
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              )}
            </motion.div>
          ))
        )}
      </div>
    </PageWrapper>
  )
}