"use client"

import { useEffect, useRef } from "react"
import { motion, useMotionValue, animate } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"
import { AreaChart, Area, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"

interface KPICardProps {
  title: string
  value: string | number
  prefix?: string
  suffix?: string
  trend?: number
  trendLabel?: string
  sparklineData?: { v: number }[]
  icon?: React.ReactNode
  className?: string
  change?: string
  changeType?: "positive" | "negative"
  formatValue?: (n: number) => string
}

function AnimatedNumber({
  target,
  prefix = "",
  suffix = "",
  formatValue,
}: {
  target: number
  prefix?: string
  suffix?: string
  formatValue?: (n: number) => string
}) {
  const mv = useMotionValue(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const controls = animate(mv, target, {
      duration: 1.2,
      ease: "easeOut",
    })
    const unsub = mv.on("change", (latest) => {
      if (ref.current) {
        const display = formatValue
          ? formatValue(latest)
          : Math.round(latest).toLocaleString()
        ref.current.textContent = `${prefix}${display}${suffix}`
      }
    })
    return () => {
      controls.stop()
      unsub()
    }
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}0{suffix}
    </span>
  )
}

export function KPICard({
  title,
  value,
  prefix = "",
  suffix = "",
  trend,
  trendLabel,
  sparklineData,
  icon,
  className,
  change,
  changeType,
  formatValue,
}: KPICardProps) {
  const isUp = trend !== undefined ? trend >= 0 : changeType === "positive"
  const trendValue = trend ?? 0
  const numericValue = typeof value === "number" ? value : Number(value)
  const canAnimate = typeof value === "number" || (typeof value === "string" && Number.isFinite(numericValue) && value.trim() !== "")
  const displayString = typeof value === "number"
    ? undefined
    : (typeof value === "string" ? value : String(value))

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn(
        "relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-[#1A3C5E]/20 via-[#E8A020]/60 to-[#1A3C5E]/20" />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider truncate">
              {title}
            </p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900 font-mono">
              {canAnimate ? (
                <AnimatedNumber
                  target={numericValue}
                  prefix={prefix}
                  suffix={suffix}
                  formatValue={formatValue}
                />
              ) : (
                <>
                  {prefix}{displayString}{suffix}
                </>
              )}
            </p>
          </div>

          {icon && (
            <div className="shrink-0 w-10 h-10 rounded-xl bg-[#1A3C5E]/8 flex items-center justify-center text-[#1A3C5E]">
              {icon}
            </div>
          )}
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="mt-3 h-10 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E8A020" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#E8A020" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#E8A020"
                  strokeWidth={1.5}
                  fill={`url(#spark-${title})`}
                  isAnimationActive={true}
                  animationDuration={1200}
                  animationEasing="ease-out"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {(trend !== undefined || change) && (
          <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-1.5">
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: isUp ? 0 : 180 }}
              transition={{ duration: 0.4 }}
            >
              {isUp ? (
                <TrendingUp size={13} className="text-emerald-500" />
              ) : (
                <TrendingDown size={13} className="text-red-500" />
              )}
            </motion.div>
            <span
              className={cn(
                "text-xs font-semibold",
                isUp ? "text-emerald-600" : "text-red-500"
              )}
            >
              {trend !== undefined
                ? `${isUp ? "+" : ""}${trendValue.toFixed(1)}%`
                : change}
            </span>
            {trendLabel && (
              <span className="text-xs text-gray-400">{trendLabel}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default KPICard