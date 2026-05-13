"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { User, Clock } from "lucide-react"

interface TableUnitProps {
  table: {
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
  onClick?: () => void
  className?: string
}

export function TableUnit({ table, onClick, className }: TableUnitProps) {
  const statusConfig = {
    free: { bg: 'bg-green-100', text: 'text-green-800', label: 'Free' },
    occupied: { bg: 'bg-red-100', text: 'text-red-800', label: 'Occupied' },
    reserved: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Reserved' },
    cleaning: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Cleaning' },
    maintenance: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Maintenance' },
  }
  
  const config = statusConfig[table.status]
  
  return (
    <motion.div 
      className={cn(
        "relative bg-white rounded-xl border border-gray-200 p-4 shadow-sm cursor-pointer hover:shadow-md transition-all",
        table.status === 'occupied' && "animate-pulse-red",
        className
      )}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Table {table.number}</h3>
          <p className="text-sm text-gray-500">{table.capacity} seats</p>
        </div>
        
        <div className={cn("px-2 py-1 rounded-full text-xs font-medium", config.bg, config.text)}>
          {config.label}
        </div>
      </div>
      
      {table.currentOrder && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-900 truncate">
            {table.currentOrder.customerName}
          </p>
          
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <User size={12} />
              {table.currentOrder.itemsCount} items
            </div>
            
            {table.currentOrder.timeElapsed && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock size={12} />
                {table.currentOrder.timeElapsed}m
              </div>
            )}
          </div>
          
          <div className="mt-2">
            <StatusBadge status={table.currentOrder.orderStatus} size="sm" />
          </div>
        </div>
      )}
    </motion.div>
  )
}