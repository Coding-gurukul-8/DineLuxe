"use client"

import { useState, useEffect, useRef, type CSSProperties } from "react"
import { BarChart3, AlertTriangle, CheckCircle2, ChevronRight, Clock, Users, TrendingUp, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"

// ─── Types ────────────────────────────────────────────────────────────────────

interface HourlyPrediction {
  hour: number           // 10–23 (10 AM – 11 PM)
  predicted_orders: number
  label?: string         // "10 AM", "11 AM" etc.
}

interface StaffingRole {
  role: string
  recommended: number
  scheduled: number
}

interface StaffingWarning {
  message: string
  time_slot?: string
  severity?: "high" | "medium" | "low"
}

interface StaffingRecommendation {
  date: string
  peak_hours: HourlyPrediction[]
  staffing: StaffingRole[]
  warnings: StaffingWarning[]
  confidence_weeks: number
  confidence_label?: string
}

interface DemandPredictionProps {
  branchId: string
  className?: string
}

type TabKey = "today" | "tomorrow"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(offset: 0 | 1): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().split("T")[0]
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12 AM"
  if (h === 12) return "12 PM"
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

function barColor(orders: number): { bar: string; bg: string; text: string } {
  if (orders > 35) return { bar: "bg-red-500",    bg: "bg-red-50",    text: "text-red-700" }
  if (orders > 20) return { bar: "bg-orange-400", bg: "bg-orange-50", text: "text-orange-700" }
  return              { bar: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" }
}

function statusLabel(rec: number, sched: number) {
  if (sched >= rec) return { icon: <CheckCircle2 size={14} className="text-emerald-500" />, text: "OK",    cls: "text-emerald-600 bg-emerald-50" }
  const delta = rec - sched
  return { icon: <AlertTriangle size={14} className="text-amber-500" />, text: `−${delta}`, cls: "text-amber-700 bg-amber-50" }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn(
        "rounded-lg bg-gray-200 animate-shimmer",
        "bg-size-[200%_100%]",
        "bg-linear-to-r from-gray-200 via-gray-100 to-gray-200",
        className
      )}
      style={style}
    />
  )
}

function CardSkeleton() {
  return (
    <div className="space-y-5 p-1">
      <div className="flex items-end gap-1 h-24">
        {Array.from({ length: 14 }).map((_, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${20 + Math.random() * 60}%` } as React.CSSProperties} />
        ))}
      </div>
      <div className="space-y-2">
        {[80, 65, 70].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-lg" style={{ width: `${w}%` } as React.CSSProperties} />
        ))}
      </div>
    </div>
  )
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

function PeakHoursChart({ data }: { data: HourlyPrediction[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const maxOrders = Math.max(...data.map((d) => d.predicted_orders), 1)

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Predicted Orders by Hour
      </p>
      <div className="relative">
        {/* Bars */}
        <div className="flex items-end gap-0.75 h-28">
          {data.map((point, i) => {
            const heightPct = Math.max((point.predicted_orders / maxOrders) * 100, 4)
            const colors = barColor(point.predicted_orders)
            const isHovered = hoveredIdx === i

            return (
              <div
                key={point.hour}
                className="relative flex-1 flex flex-col items-center cursor-pointer group"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div
                    className={cn(
                      "absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap z-10 shadow-sm",
                      colors.bg, colors.text
                    )}
                  >
                    {point.predicted_orders} orders
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-current opacity-30" />
                  </div>
                )}

                {/* Bar */}
                <div
                  className={cn(
                    "w-full rounded-t-sm transition-all duration-200",
                    colors.bar,
                    isHovered ? "opacity-100 scale-y-105 origin-bottom" : "opacity-80"
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            )
          })}
        </div>

        {/* X-axis labels — show every other */}
        <div className="flex items-center gap-0.75 mt-1.5">
          {data.map((point, i) => (
            <div key={point.hour} className="flex-1 text-center">
              {i % 2 === 0 && (
                <span className="text-[9px] text-gray-400 leading-none">{formatHour(point.hour)}</span>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {[
            { color: "bg-emerald-500", label: "Normal (≤20)" },
            { color: "bg-orange-400",  label: "Busy (21–35)" },
            { color: "bg-red-500",     label: "Peak (35+)" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", color)} />
              <span className="text-[11px] text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Staffing Table ───────────────────────────────────────────────────────────

function StaffingTable({ staffing }: { staffing: StaffingRole[] }) {
  const roleIcon: Record<string, string> = {
    Waiters:  "🍽️",
    Chefs:    "👨‍🍳",
    Cashiers: "💳",
    Hosts:    "🤝",
    default:  "👤",
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Staffing Recommendation
      </p>
      <div className="rounded-xl border border-gray-100 overflow-hidden">
        {/* Table head */}
        <div className="grid grid-cols-4 bg-gray-50 px-3 py-2 border-b border-gray-100">
          {["Role", "Recommended", "Scheduled", "Status"].map((h) => (
            <span key={h} className="text-xs font-semibold text-gray-400">{h}</span>
          ))}
        </div>
        {/* Rows */}
        {staffing.map((row, i) => {
          const status = statusLabel(row.recommended, row.scheduled)
          const icon = roleIcon[row.role] ?? roleIcon.default
          return (
            <div
              key={row.role}
              className={cn(
                "grid grid-cols-4 px-3 py-2.5 items-center",
                i < staffing.length - 1 ? "border-b border-gray-50" : ""
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{icon}</span>
                <span className="text-sm text-gray-700 font-medium">{row.role}</span>
              </div>
              <span className="text-sm font-bold text-[#1A3C5E]">{row.recommended}</span>
              <span className="text-sm text-gray-600">{row.scheduled}</span>
              <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 w-fit text-xs font-semibold", status.cls)}>
                {status.icon}
                <span>{status.text}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Warning Banner ───────────────────────────────────────────────────────────

function WarningBanner({ warning }: { warning: StaffingWarning }) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
      <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-amber-800">{warning.message}</p>
      </div>
      <a
        href="/owner/shifts"
        className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors whitespace-nowrap shrink-0 mt-0.5"
      >
        Update Schedule
        <ChevronRight size={12} />
      </a>
    </div>
  )
}

// ─── Confidence Footer ────────────────────────────────────────────────────────

function ConfidenceIndicator({ weeks }: { weeks: number }) {
  const isLow = weeks < 3
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-xl px-3 py-2",
      isLow ? "bg-gray-50 border border-gray-100" : "bg-[#1A3C5E]/5 border border-[#1A3C5E]/10"
    )}>
      <TrendingUp size={13} className={isLow ? "text-gray-400" : "text-[#1A3C5E]"} />
      <p className="text-xs text-gray-500">
        {isLow
          ? `Limited data (${weeks} week${weeks !== 1 ? "s" : ""}) — prediction may vary`
          : `Based on ${weeks} weeks of historical data`}
      </p>
    </div>
  )
}

// ─── Day Panel ────────────────────────────────────────────────────────────────

function DayPanel({ data, error }: { data: StaffingRecommendation | null; error: boolean }) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <BarChart3 size={18} className="text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">Could not load prediction</p>
          <p className="text-xs text-gray-400 mt-0.5">Not enough historical data yet</p>
        </div>
      </div>
    )
  }

  if (!data) return <CardSkeleton />

  return (
    <div className="space-y-5">
      <PeakHoursChart data={data.peak_hours} />
      <StaffingTable staffing={data.staffing} />
      {data.warnings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alerts</p>
          {data.warnings.map((w, i) => <WarningBanner key={i} warning={w} />)}
        </div>
      )}
      <ConfidenceIndicator weeks={data.confidence_weeks} />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DemandPrediction({ branchId, className }: DemandPredictionProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("today")
  const [todayData, setTodayData] = useState<StaffingRecommendation | null>(null)
  const [tomorrowData, setTomorrowData] = useState<StaffingRecommendation | null>(null)
  const [todayError, setTodayError] = useState(false)
  const [tomorrowError, setTomorrowError] = useState(false)
  const hasFetchedTomorrow = useRef(false)

  // Fetch today on mount
  useEffect(() => {
    if (!branchId) return
    const date = formatDate(0)
    apiClient
      .get<StaffingRecommendation>(`/staffing/recommendation?branch_id=${branchId}&date=${date}`)
      .then(setTodayData)
      .catch(() => setTodayError(true))
  }, [branchId])

  // Fetch tomorrow lazily (only when tab is switched)
  useEffect(() => {
    if (activeTab !== "tomorrow" || hasFetchedTomorrow.current || !branchId) return
    hasFetchedTomorrow.current = true
    const date = formatDate(1)
    apiClient
      .get<StaffingRecommendation>(`/staffing/recommendation?branch_id=${branchId}&date=${date}`)
      .then(setTomorrowData)
      .catch(() => setTomorrowError(true))
  }, [activeTab, branchId])

  const tabs: { key: TabKey; label: string; dateLabel: string; icon: React.ReactNode }[] = [
    {
      key: "today",
      label: "Today",
      dateLabel: new Date().toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" }),
      icon: <Clock size={13} />,
    },
    {
      key: "tomorrow",
      label: "Tomorrow",
      dateLabel: new Date(Date.now() + 86_400_000).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" }),
      icon: <Calendar size={13} />,
    },
  ]

  return (
    <div className={cn("bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden", className)}>
      {/* Top accent stripe */}
      <div className="h-0.5 bg-linear-to-r from-[#1A3C5E]/20 via-[#E8A020]/60 to-[#1A3C5E]/20" />

      {/* Header */}
      <div className="px-5 pt-4 pb-0 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#1A3C5E]/8 flex items-center justify-center">
            <Users size={17} className="text-[#1A3C5E]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">📊 Smart Staffing Forecast</h3>
            <p className="text-xs text-gray-400 mt-0.5">AI-powered demand prediction</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-5 pt-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === tab.key
                  ? "bg-white text-[#1A3C5E] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {activeTab === tab.key && (
                <span className="hidden sm:block text-xs text-gray-400 font-normal ml-0.5">
                  · {tab.dateLabel}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-5">
        {activeTab === "today" ? (
          <DayPanel data={todayData} error={todayError} />
        ) : (
          <DayPanel data={tomorrowData} error={tomorrowError} />
        )}
      </div>
    </div>
  )
}

export default DemandPrediction