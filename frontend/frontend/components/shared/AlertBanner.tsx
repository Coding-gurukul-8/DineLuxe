"use client"

import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { X, AlertTriangle, CheckCircle, Info } from "lucide-react"

interface AlertBannerProps {
  type: 'warning' | 'info' | 'success'
  message: string
  onClose?: () => void
  className?: string
}

export function AlertBanner({ type, message, className }: AlertBannerProps) {
  const typeConfig = {
    warning: {
      container: 'bg-amber-50 border-amber-200',
      icon: <AlertTriangle className="text-amber-600" size={16} />,
      title: 'Warning'
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: <Info className="text-blue-600" size={16} />,
      title: 'Info'
    },
    success: {
      container: 'bg-green-50 border-green-200',
      icon: <CheckCircle className="text-green-600" size={16} />,
      title: 'Success'
    }
  }

  const config = typeConfig[type] || typeConfig.info

  return (
    <motion.div 
      className={cn(
        "flex items-center gap-3 px-4 py-3 bg-white border rounded-md",
        "transition-all duration-300",
        className
      )}
    >
      <div className="flex-shrink-0 text-brand-primary">
        {config.icon}
      </div>
      <div className="flex-1 text-sm text-gray-700">
        {message}
      </div>
      {onClose && (
        <button 
          onClick={onClose}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}