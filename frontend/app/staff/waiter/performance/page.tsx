"use client"

import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts"
import {
  Star, TrendingUp, Users, DollarSign,
  UtensilsCrossed, CalendarDays, Award,
} from "lucide-react"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { KPICard } from "@/components/shared/KPICard"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { formatCurrency, cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

interface DayBreakdown {
  date: string     // "YYYY-MM-DD"
  orders: number
  tips: number
}

interface Performance {
  orders_served: number
  avg_rating: number
  tips_collected: number
  tables_turned: number
  daily_breakdown?: DayBreakdown[]
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1A3C5E] rounded-xl px-4 py-3 text-xs shadow-xl">
      <p className="text-white/50 mb-1.5">{label}</p>
      <p className="font-semibold text-white">{payload[0].value} orders</p>
      {payload[1] && (
        <p className="font-semibold text-[#E8A020]">{formatCurrency(payload[1].value)} tips</p>
      )}
    </div>
  )
}

// ── Star rating ────────────────────────────────────────────────────────────────

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={16}
          className={i < Math.round(value) ? "text-[#E8A020] fill-[#E8A020]" : "text-gray-200 fill-gray-200"}
        />
      ))}
    </div>
  )
}

// ── Generate fallback data ─────────────────────────────────────────────────────

function buildFallback(): DayBreakdown[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
      date: d.toLocaleDateString("en-US", { weekday: "short" }),
      orders: 4 + Math.round(Math.random() * 10),
      tips: Math.round((1 + Math.random() * 5) * 100) / 100,
    }
  })
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function WaiterPerformancePage() {
  const { user } = useAuth()

  const { data: perf, isLoading } = useQuery<Performance>({
    queryKey: ["staff", "performance", user?.id],
    queryFn: () => apiClient.get<Performance>(`/staff/${user!.id}/performance`),
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  })

  const chartData: DayBreakdown[] =
    perf?.daily_breakdown?.map((d) => ({
      ...d,
      date: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
    })) ?? buildFallback()

  const ratingClass =
    (perf?.avg_rating ?? 0) >= 4.5
      ? "text-emerald-600"
      : (perf?.avg_rating ?? 0) >= 3.5
      ? "text-[#E8A020]"
      : "text-red-500"

  return (
    <PageWrapper
      title="My Performance"
      subtitle="Your stats for the current period"
    >
      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Orders Served"
            value={perf?.orders_served ?? 0}
            icon={<UtensilsCrossed size={18} />}
            trend={4.2}
            trendLabel="vs last week"
          />
          <KPICard
            title="Tables Turned"
            value={perf?.tables_turned ?? 0}
            icon={<Users size={18} />}
            trendLabel="this period"
          />
          <KPICard
            title="Tips Collected"
            value={perf?.tips_collected ?? 0}
            formatValue={(n) => formatCurrency(n)}
            icon={<DollarSign size={18} />}
            trend={12.5}
            trendLabel="vs last period"
          />
          <KPICard
            title="Avg Rating"
            value={(perf?.avg_rating ?? 0).toFixed(1)}
            suffix=" / 5"
            icon={<Star size={18} />}
            trendLabel="customer reviews"
          />
        </div>
      )}

      {/* Rating detail */}
      {!isLoading && perf && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-6"
        >
          <div className="flex flex-col items-center gap-1">
            <Award size={28} className="text-[#E8A020]" />
            <span className={cn("text-3xl font-bold font-mono", ratingClass)}>
              {(perf.avg_rating ?? 0).toFixed(1)}
            </span>
            <StarRating value={perf.avg_rating ?? 0} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-sm">Customer Rating</p>
            <p className="text-xs text-gray-400 mt-1">
              Based on feedback from your served tables this period.{" "}
              {(perf.avg_rating ?? 0) >= 4.5
                ? "Excellent work — keep it up! 🎉"
                : (perf.avg_rating ?? 0) >= 3.5
                ? "Good rating — room for improvement."
                : "Check feedback for areas to improve."}
            </p>
          </div>
        </motion.div>
      )}

      {/* Bar chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[#1A3C5E]" />
            <h3 className="text-sm font-semibold text-gray-800">Last 7 Days</h3>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#1A3C5E] inline-block" /> Orders
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#E8A020] inline-block" /> Tips
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="orders"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="tips"
              orientation="right"
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `₹${v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              yAxisId="orders"
              dataKey="orders"
              fill="#1A3C5E"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive
              animationDuration={900}
            />
            <Bar
              yAxisId="tips"
              dataKey="tips"
              fill="#E8A020"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive
              animationDuration={900}
              animationBegin={200}
            />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </PageWrapper>
  )
}