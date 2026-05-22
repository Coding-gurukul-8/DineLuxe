"use client"

import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Check, X } from "lucide-react"

interface PasswordStrengthMeterProps {
  password: string
  className?: string
}

interface Requirement {
  label: string
  test: (password: string) => boolean
}

const requirements: Requirement[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "Uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "Number", test: (p) => /[0-9]/.test(p) },
  { label: "Special character", test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

const strengthConfig = [
  { label: "Very Weak", color: "#ef4444", textColor: "text-red-500", segments: 1 },
  { label: "Weak",      color: "#f97316", textColor: "text-orange-500", segments: 2 },
  { label: "Fair",      color: "#eab308", textColor: "text-yellow-600", segments: 3 },
  { label: "Good",      color: "#3b82f6", textColor: "text-blue-600", segments: 4 },
  { label: "Strong",    color: "#E8A020", textColor: "text-[#E8A020]", segments: 5 },
]

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  const passedCount = requirements.filter((req) => req.test(password)).length
  const strengthIndex = Math.max(0, passedCount - 1)
  const config = strengthConfig[strengthIndex]

  return (
    <div className={cn("space-y-3", className)}>
      {/* Segmented bar */}
      <div className="space-y-1.5">
        <div className="flex gap-1">
          {requirements.map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-[#1A3C5E]/8">
              <motion.div
                className="h-full rounded-full"
                initial={{ scaleX: 0, originX: 0 }}
                animate={{
                  scaleX: i < passedCount ? 1 : 0,
                  backgroundColor: config.color,
                }}
                transition={{ duration: 0.35, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={config.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className={cn("text-xs font-medium", config.textColor)}
            >
              {config.label}
            </motion.span>
          </AnimatePresence>
          <span className="text-xs text-[#1A3C5E]/30">{passedCount}/{requirements.length}</span>
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="grid grid-cols-2 gap-y-1 gap-x-3">
        {requirements.map((req, index) => {
          const passed = req.test(password)
          return (
            <motion.div
              key={req.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className="flex items-center gap-1.5"
            >
              <motion.div
                animate={{
                  scale: passed ? [1, 1.3, 1] : 1,
                  color: passed ? "#10b981" : "rgba(26,60,94,0.2)",
                }}
                transition={{ duration: 0.3 }}
              >
                {passed
                  ? <Check size={11} className="text-emerald-500" />
                  : <X size={11} className="text-[#1A3C5E]/20" />
                }
              </motion.div>
              <span className={cn("text-[11px] leading-tight transition-colors duration-300",
                passed ? "text-emerald-600" : "text-[#1A3C5E]/35"
              )}>
                {req.label}
              </span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
