"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Clock, User, Tag } from "lucide-react"

interface OrderTicketCardProps {
  order: {
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
  className?: string
  onClick?: () => void
}

export function OrderTicketCard({ order, className, onClick }: OrderTicketCardProps) {
  const priorityColors = {
    low: "border-l-green-500",
    medium: "border-l-yellow-500",
    high: "border-l-red-500",
  }
  
  return (
    <motion.div 
      className={cn(
        "bg-white rounded-lg border-l-4 border-gray-200 shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow",
        priorityColors[order.priority || 'medium'],
        className
      )}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-gray-900">#{order.orderNumber}</h3>
            <StatusBadge status={order.status} />
          </div>
          
          <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
            <User size={14} />
            {order.customerName}
          </p>
          
          {order.tableNumber && (
            <p className="text-sm text-gray-600 mb-2">Table {order.tableNumber}</p>
          )}
        </div>
        
        <div className="text-right">
          <p className="font-bold text-gray-900">Rs {order.total}</p>
          {order.estimatedTime && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Clock size={12} />
              {order.estimatedTime} min
            </p>
          )}
        </div>
      </div>
      
      <div className="mt-3">
        <div className="flex flex-wrap gap-1">
          {order.items.slice(0, 3).map((item, index) => (
            <span 
              key={index} 
              className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full"
            >
              <Tag size={10} />
              {item.quantity}x {item.name}
            </span>
          ))}
          {order.items.length > 3 && (
            <span className="inline-flex items-center bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">
              +{order.items.length - 3} more
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}