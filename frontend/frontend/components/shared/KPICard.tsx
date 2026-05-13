"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface KPICardProps {
  title: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative'
  icon: React.ReactNode
  className?: string
}

export function KPICard({ title, value, change, changeType, icon, className }: KPICardProps) {
  return (
    <div className={cn("bg-white rounded-xl p-4 border border-gray-100 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-lg">
          {icon}
        </div>
      </div>
      
      {change && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className={cn(
            "text-sm font-medium",
            changeType === 'positive' ? "text-green-600" : "text-red-600"
          )}>
            {changeType === 'positive' ? '↑' : '↓'} {change}
          </span>
        </div>
      )}
    </div>
  )
}