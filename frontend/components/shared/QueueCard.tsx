"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { User, Clock, Calendar, Phone } from "lucide-react"

interface QueueCardProps {
  customer: {
    id: string
    name: string
    partySize: number
    phone?: string
    status: 'waiting' | 'seated' | 'cancelled' | 'no-show'
    joinedAt: string
    special?: string
    estimatedWaitTime?: number
    priority?: 'low' | 'medium' | 'high'
  }
  className?: string
  onClick?: () => void
}

export function QueueCard({ customer, className, onClick }: QueueCardProps) {
  const statusConfig = {
    waiting: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Waiting' },
    seated: { bg: 'bg-green-100', text: 'text-green-800', label: 'Seated' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' },
    'no-show': { bg: 'bg-red-100', text: 'text-red-800', label: 'No-show' },
  }
  
  const config = statusConfig[customer.status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: customer.status }
  
  return (
    <motion.div 
      className={cn(
        "bg-white rounded-lg border border-gray-200 p-4 shadow-sm",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">{customer.name}</h3>
          <p className="text-sm text-gray-500 mt-1">
            Party of {customer.partySize}
          </p>
          {customer.phone && (
            <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
              <Phone size={14} />
              {customer.phone}
            </div>
          )}
        </div>
        
        <div className={cn("px-3 py-1 rounded-full text-xs font-medium", config.bg, config.text)}>
          {config.label}
        </div>
      </div>
      
      {customer.joinedAt && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
          <Clock size={12} />
          {customer.joinedAt}
        </div>
      )}
      
      {customer.estimatedWaitTime && (
        <p className="text-xs text-gray-500 mt-1">
          Est. wait: {customer.estimatedWaitTime} mins
        </p>
      )}
    </motion.div>
  )
}