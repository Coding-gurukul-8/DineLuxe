"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { 
  Clock, 
  User, 
  Tag, 
  Check, 
  AlertTriangle,
  Filter,
  RefreshCw
} from "lucide-react"

interface KitchenOrder {
  id: string
  orderNumber: string
  tableNumber: string
  customerName: string
  items: Array<{
    id: string
    name: string
    quantity: number
    specialRequests?: string
    prepTime: number
    status: 'pending' | 'preparing' | 'ready'
    station: string
  }>
  priority: 'low' | 'medium' | 'high'
  createdAt: string
  estimatedCompletion: string
}

export default function KitchenDisplayPage() {
  const [activeStation, setActiveStation] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [darkMode, setDarkMode] = useState(true)

  const { data: orders = [], refetch } = useQuery({
    queryKey: ["kitchen", "orders"],
    queryFn: () => apiClient.get<KitchenOrder[]>("/kitchen/orders")
  })

  const filteredOrders = orders.filter(order => {
    // Apply priority filter if not "all"
    if (priorityFilter !== "all") {
      return order.priority === priorityFilter
    }
    return true
  })

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [refetch])

  const updateItemStatus = (orderId: string, itemId: string, newStatus: 'preparing' | 'ready') => {
    // In a real implementation, this would call an API
    console.log(`Updating item ${itemId} in order ${orderId} to ${newStatus}`)
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'kitchen-dark' : 'bg-gray-100'}`}>
      <PageWrapper 
        title="Kitchen Display System" 
        subtitle="Monitor and manage kitchen orders"
        className="max-w-full"
      >
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveStation("all")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeStation === "all"
                  ? "bg-brand-primary text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              All Stations
            </button>
            <button
              onClick={() => setActiveStation("main")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeStation === "main"
                  ? "bg-brand-primary text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Main Kitchen
            </button>
            <button
              onClick={() => setActiveStation("grill")}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeStation === "grill"
                  ? "bg-brand-primary text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Grill Station
            </button>
          </div>
          
          <div className="flex gap-2 ml-auto">
            <select 
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              className="flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center gap-2"
            >
              {darkMode ? "Light Mode" : "Dark Mode"}
            </Button>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredOrders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-xl p-6 shadow-lg ${
                  darkMode ? 'bg-gray-800' : 'bg-white'
                } border ${
                  darkMode ? 'border-gray-700' : 'border-gray-200'
                }`}
              >
                {/* Order Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      Order #{order.orderNumber}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Table {order.tableNumber}
                      </span>
                      <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        •
                      </span>
                      <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        {order.customerName}
                      </span>
                    </div>
                  </div>
                  
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    order.priority === 'high' ? 'bg-red-100 text-red-800' :
                    order.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {order.priority} priority
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-3 mb-4">
                  {order.items.map((item) => (
                    <div 
                      key={item.id}
                      className={`p-3 rounded-lg ${
                        item.status === 'ready' ? 
                          (darkMode ? 'bg-green-900/20' : 'bg-green-100') : 
                          (darkMode ? 'bg-gray-700/50' : 'bg-gray-50')
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            {item.quantity}x {item.name}
                          </h4>
                          {item.specialRequests && (
                            <p className={`text-sm mt-1 ${darkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                              <AlertTriangle className="inline mr-1" size={14} />
                              {item.specialRequests}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          {item.status === 'pending' && (
                            <Button 
                              size="sm"
                              onClick={() => updateItemStatus(order.id, item.id, 'preparing')}
                              className="bg-blue-500 hover:bg-blue-600"
                            >
                              Start
                            </Button>
                          )}
                          {item.status === 'preparing' && (
                            <Button 
                              size="sm"
                              onClick={() => updateItemStatus(order.id, item.id, 'ready')}
                              className="bg-green-500 hover:bg-green-600"
                            >
                              <Check size={16} />
                            </Button>
                          )}
                          {item.status === 'ready' && (
                            <Button 
                              size="sm"
                              disabled
                              className="bg-green-500"
                            >
                              Ready
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2 text-sm">
                        <Clock size={14} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                        <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                          {item.prepTime} min
                        </span>
                        <Tag size={14} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
                        <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                          {item.station}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Footer */}
                <div className={`pt-3 border-t ${
                  darkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </span>
                    <span className={`text-sm font-medium ${
                      new Date() > new Date(order.estimatedCompletion) ? 
                        (darkMode ? 'text-red-400' : 'text-red-500') : 
                        (darkMode ? 'text-green-400' : 'text-green-500')
                    }`}>
                      Est: {new Date(order.estimatedCompletion).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${
              darkMode ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <Clock className={darkMode ? 'text-gray-400' : 'text-gray-500'} size={32} />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${
              darkMode ? 'text-gray-300' : 'text-gray-900'
            }`}>
              No Active Orders
            </h3>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
              New orders will appear here automatically
            </p>
          </div>
        )}
      </PageWrapper>
    </div>
  )
}