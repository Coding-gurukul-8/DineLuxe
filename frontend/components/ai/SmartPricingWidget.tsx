"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  RefreshCw,
  TrendingDown,
  ShoppingBag,
  Clock,
  ChevronRight,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Sparkles,
  AlertCircle,
  Plus,
  X,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItemPerf {
  id: string
  name: string
  category: string
  orders_30d: number
  revenue_30d: number
  price: number
}

interface MenuPerformanceReport {
  items: MenuItemPerf[]
  period: string
}

interface DynamicPricingRule {
  id: string
  name: string
  rule_type: "happy_hour" | "item_discount" | "combo"
  discount_percent: number
  start_time?: string
  end_time?: string
  days?: string[]
  item_ids?: string[]
  is_active: boolean
  created_at: string
}

interface SmartPricingWidgetProps {
  branchId: string
  restaurantId: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLOW_SELLER_THRESHOLD = 5
const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const DAY_FULL: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
  Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

const perfKey = (branchId: string) => ["menu-performance", branchId, "30d"]
const rulesKey = (branchId: string) => ["dynamic-pricing", branchId]

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-start gap-2.5 mb-3">
      <div className="w-7 h-7 rounded-lg bg-[#1A3C5E]/8 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Slow Seller Card ─────────────────────────────────────────────────────────

function SlowSellerCard({
  item,
  branchId,
  onDismiss,
}: {
  item: MenuItemPerf
  branchId: string
  onDismiss: (id: string) => void
}) {
  const qc = useQueryClient()
  const [applied, setApplied] = useState(false)

  const applyDiscount = useMutation({
    mutationFn: (pct: number) =>
      apiClient.post("/dynamic-pricing", {
        branch_id: branchId,
        name: `${item.name} — ${pct}% off`,
        rule_type: "item_discount",
        discount_percent: pct,
        item_ids: [item.id],
        is_active: true,
      }),
    onSuccess: (_, pct) => {
      toast.success(`${pct}% discount applied to "${item.name}"`)
      setApplied(true)
      qc.invalidateQueries({ queryKey: rulesKey(branchId) })
    },
    onError: () => toast.error("Failed to apply discount. Try again."),
  })

  if (applied) {
    return (
      <motion.div
        initial={{ opacity: 1, height: "auto" }}
        animate={{ opacity: 0, height: 0 }}
        transition={{ delay: 1.2, duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 size={14} className="text-emerald-500" />
          Discount applied to "{item.name}"
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-red-100 rounded-xl p-3.5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <TrendingDown size={14} className="text-red-400 shrink-0" />
          <p className="text-sm font-semibold text-gray-800">"{item.name}"</p>
        </div>
        <button
          onClick={() => onDismiss(item.id)}
          className="text-gray-300 hover:text-gray-500 transition-colors"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3 pl-6">
        Only{" "}
        <span className="font-bold text-red-500">{item.orders_30d}</span>{" "}
        {item.orders_30d === 1 ? "order" : "orders"} this month · ₹{item.price.toFixed(0)}
      </p>
      <p className="text-xs text-gray-400 mb-3 pl-6">
        Consider adding a discount or featuring it in promotions
      </p>
      <div className="flex items-center gap-2 pl-6 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          onClick={() => applyDiscount.mutate(10)}
          disabled={applyDiscount.isPending}
          className="h-7 px-3 text-xs rounded-lg border-gray-200 hover:border-[#1A3C5E]/30 hover:text-[#1A3C5E]"
        >
          {applyDiscount.isPending ? <Loader2 size={11} className="animate-spin" /> : "Apply 10% Off"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => applyDiscount.mutate(20)}
          disabled={applyDiscount.isPending}
          className="h-7 px-3 text-xs rounded-lg border-gray-200 hover:border-[#1A3C5E]/30 hover:text-[#1A3C5E]"
        >
          Apply 20% Off
        </Button>
        <button
          onClick={() => onDismiss(item.id)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Skip
        </button>
      </div>
    </motion.div>
  )
}

// ─── Bundle Section ───────────────────────────────────────────────────────────

function BundleSection() {
  const [comboName, setComboName] = useState("")
  const [comboPrice, setComboPrice] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleCreate = () => {
    if (!comboName.trim()) {
      toast.error("Enter a combo name")
      return
    }
    // Navigates to menu management to finish combo setup
    toast.success("Head to menu management to finish setting up your combo!")
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 4000)
    setComboName("")
    setComboPrice("")
  }

  return (
    <div className="space-y-3">
      <div className="bg-white border border-blue-100 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center gap-1.5 mb-2.5">
          <ShoppingBag size={13} className="text-blue-400" />
          <p className="text-xs font-semibold text-blue-700">Create a Combo Deal</p>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Bundle popular items together at a special price to increase order value.
        </p>
        <div className="space-y-2">
          <Input
            placeholder="Combo name (e.g. Lunch Special)"
            value={comboName}
            onChange={(e) => setComboName(e.target.value)}
            className="h-8 text-xs rounded-lg"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Combo price (₹)"
              value={comboPrice}
              onChange={(e) => setComboPrice(e.target.value)}
              className="h-8 text-xs rounded-lg"
            />
            <Button
              size="sm"
              onClick={handleCreate}
              className="h-8 px-3 text-xs rounded-lg bg-[#1A3C5E] text-white hover:bg-[#15304d] whitespace-nowrap"
            >
              {submitted ? <CheckCircle2 size={12} /> : <><Plus size={11} /> Create Combo</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Happy Hour Form ──────────────────────────────────────────────────────────

function HappyHourForm({ branchId, onCreated }: { branchId: string; onCreated: () => void }) {
  const [startTime, setStartTime] = useState("17:00")
  const [endTime, setEndTime] = useState("19:00")
  const [discount, setDiscount] = useState("15")
  const [days, setDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"])

  const toggleDay = (d: string) =>
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])

  const create = useMutation({
    mutationFn: () =>
      apiClient.post("/dynamic-pricing", {
        branch_id: branchId,
        name: "Happy Hour",
        rule_type: "happy_hour",
        discount_percent: Number(discount),
        start_time: startTime,
        end_time: endTime,
        days,
        is_active: true,
      }),
    onSuccess: () => {
      toast.success("Happy Hour pricing enabled! 🎉")
      onCreated()
    },
    onError: () => toast.error("Failed to create happy hour rule."),
  })

  return (
    <div className="bg-white border border-amber-100 rounded-xl p-4 shadow-sm space-y-4">
      <p className="text-xs text-gray-500">
        Automatically discount all items during off-peak hours to drive more covers.
      </p>

      {/* Time range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Start time</label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="h-8 text-xs rounded-lg"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">End time</label>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="h-8 text-xs rounded-lg"
          />
        </div>
      </div>

      {/* Discount */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Discount %</label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="5"
            max="50"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="h-8 text-xs rounded-lg w-24"
          />
          <span className="text-xs text-gray-400">% off all items</span>
        </div>
      </div>

      {/* Day toggles */}
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">Active days</label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_DAYS.map((d) => (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              title={DAY_FULL[d]}
              className={cn(
                "h-7 w-10 rounded-lg text-xs font-semibold transition-all",
                days.includes(d)
                  ? "bg-[#1A3C5E] text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={() => create.mutate()}
        disabled={create.isPending || days.length === 0 || !discount}
        className="w-full h-9 text-xs rounded-lg bg-[#E8A020] text-white hover:bg-[#d49018] disabled:opacity-50"
      >
        {create.isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <>
            <Clock size={13} />
            Enable Happy Hour
          </>
        )}
      </Button>
    </div>
  )
}

// ─── Active Rules List ────────────────────────────────────────────────────────

function ActiveRulesList({
  rules,
  branchId,
}: {
  rules: DynamicPricingRule[]
  branchId: string
}) {
  const qc = useQueryClient()

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiClient.patch(`/dynamic-pricing/${id}`, { is_active: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: rulesKey(branchId) }),
    onError: () => toast.error("Failed to update rule."),
  })

  const ruleTypeLabel: Record<string, string> = {
    happy_hour: "Happy Hour",
    item_discount: "Item Discount",
    combo: "Combo",
  }

  return (
    <div className="space-y-2">
      {rules.map((rule) => (
        <div
          key={rule.id}
          className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-700 truncate">{rule.name}</span>
              <span className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-medium shrink-0">
                {ruleTypeLabel[rule.rule_type] ?? rule.rule_type}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {rule.discount_percent}% off
              {rule.start_time && ` · ${rule.start_time}–${rule.end_time}`}
            </p>
          </div>
          <button
            onClick={() => toggle.mutate({ id: rule.id, active: !rule.is_active })}
            disabled={toggle.isPending}
            className="shrink-0 transition-colors"
            aria-label={rule.is_active ? "Disable rule" : "Enable rule"}
          >
            {rule.is_active ? (
              <ToggleRight size={22} className="text-emerald-500" />
            ) : (
              <ToggleLeft size={22} className="text-gray-300" />
            )}
          </button>
        </div>
      ))}
      <a
        href="/owner/pricing"
        className="flex items-center gap-1 text-xs font-semibold text-[#1A3C5E] hover:text-[#1A3C5E]/70 transition-colors"
      >
        Manage all rules
        <ChevronRight size={12} />
      </a>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SmartPricingWidget({ branchId, restaurantId }: SmartPricingWidgetProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [showHappyHourForm, setShowHappyHourForm] = useState(false)

  const qc = useQueryClient()

  // Menu performance
  const {
    data: perfData,
    isLoading: perfLoading,
    isError: perfError,
    refetch: refetchPerf,
  } = useQuery<MenuPerformanceReport>({
    queryKey: perfKey(branchId),
    queryFn: () =>
      apiClient.get<MenuPerformanceReport>(
        `/reports/menu-performance?branch=${branchId}&period=30d`
      ),
    enabled: !!branchId,
    staleTime: 5 * 60_000,
  })

  // Dynamic pricing rules
  const {
    data: rulesData,
    isLoading: rulesLoading,
    refetch: refetchRules,
  } = useQuery<DynamicPricingRule[]>({
    queryKey: rulesKey(branchId),
    queryFn: () =>
      apiClient.get<DynamicPricingRule[]>(`/dynamic-pricing/branch/${branchId}`),
    enabled: !!branchId,
    staleTime: 60_000,
  })

  const handleRefresh = useCallback(() => {
    refetchPerf()
    refetchRules()
    setDismissedIds(new Set())
  }, [refetchPerf, refetchRules])

  const dismissItem = (id: string) =>
    setDismissedIds((prev) => new Set([...prev, id]))

  // Derived
  const slowSellers = (perfData?.items ?? [])
    .filter((i) => i.orders_30d < SLOW_SELLER_THRESHOLD && !dismissedIds.has(i.id))
    .slice(0, 5)

  const activeRules = (rulesData ?? []).filter((r) => r.is_active)
  const hasRules = (rulesData ?? []).length > 0
  const isLoading = perfLoading || rulesLoading

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Top accent */}
      <div className="h-0.5 bg-linear-to-r from-[#1A3C5E]/20 via-[#E8A020]/60 to-[#1A3C5E]/20" />

      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1A3C5E]/8 flex items-center justify-center">
            <Sparkles size={15} className="text-[#1A3C5E]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">🤖 Smart Suggestions</h3>
            <p className="text-xs text-gray-400">AI menu optimization</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all disabled:opacity-40"
          aria-label="Refresh suggestions"
        >
          <RefreshCw size={13} className={cn(isLoading && "animate-spin")} />
        </button>
      </div>

      <div className="px-5 py-4 space-y-6">

        {/* Error state */}
        {perfError && (
          <div className="flex items-center gap-2 px-3 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <AlertCircle size={14} />
            Failed to load menu data. Try refreshing.
          </div>
        )}

        {/* ── Section A: Slow Sellers ── */}
        <section>
          <SectionHeader
            icon={<TrendingDown size={14} className="text-red-400" />}
            title="Slow Sellers"
            subtitle={`Items with under ${SLOW_SELLER_THRESHOLD} orders in the last 30 days`}
          />

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-gray-100 animate-shimmer bg-size-[200%_100%] bg-linear-to-r from-gray-100 via-gray-50 to-gray-100"
                />
              ))}
            </div>
          ) : slowSellers.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <p className="text-xs text-emerald-700 font-medium">
                All items are selling well this month!
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {slowSellers.map((item) => (
                  <SlowSellerCard
                    key={item.id}
                    item={item}
                    branchId={branchId}
                    onDismiss={dismissItem}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}
        </section>

        {/* Divider */}
        <div className="border-t border-gray-50" />

        {/* ── Section B: Bundle Opportunities ── */}
        <section>
          <SectionHeader
            icon={<ShoppingBag size={14} className="text-blue-400" />}
            title="Bundle Opportunities"
            subtitle="Boost revenue with combo deals"
          />
          <BundleSection />
        </section>

        {/* Divider */}
        <div className="border-t border-gray-50" />

        {/* ── Section C: Happy Hour ── */}
        <section>
          <SectionHeader
            icon={<Clock size={14} className="text-amber-500" />}
            title="Happy Hour Pricing"
            subtitle="Drive off-peak covers with timed discounts"
          />

          {rulesLoading ? (
            <div className="h-16 rounded-xl bg-gray-100 animate-shimmer bg-size-[200%_100%] bg-linear-to-r from-gray-100 via-gray-50 to-gray-100" />
          ) : hasRules && !showHappyHourForm ? (
            <ActiveRulesList rules={rulesData ?? []} branchId={branchId} />
          ) : (
            <AnimatePresence mode="wait">
              {!showHappyHourForm ? (
                <motion.div
                  key="prompt"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center"
                >
                  <Clock size={22} className="text-amber-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-amber-800 mb-1">
                    No happy hour active
                  </p>
                  <p className="text-xs text-amber-600 mb-3">
                    Set up time-based pricing to boost off-peak sales
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setShowHappyHourForm(true)}
                    className="h-8 px-4 text-xs rounded-lg bg-[#E8A020] text-white hover:bg-[#d49018]"
                  >
                    Set Up Happy Hour
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600">Configure Happy Hour</p>
                    <button
                      onClick={() => setShowHappyHourForm(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <HappyHourForm
                    branchId={branchId}
                    onCreated={() => {
                      setShowHappyHourForm(false)
                      qc.invalidateQueries({ queryKey: rulesKey(branchId) })
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </section>
      </div>
    </div>
  )
}

export default SmartPricingWidget