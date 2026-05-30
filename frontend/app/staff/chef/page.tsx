"use client"

// ─────────────────────────────────────────────────────────────────────────────
// app/staff/chef/page.tsx
// Chef home — enhanced with STATION FEATURE (Step 2: Station Tags on items)
// All additions are marked with // STATION FEATURE
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import {
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Tag,
} from "lucide-react"
import { Button } from "@/components/ui/button"

// STATION FEATURE — import the shared station helper from the KDS page
// (In a real project, move getStationForItem + STATIONS to lib/stations.ts)
// For now we inline the minimal version needed here.

type StationId = "all" | "grill" | "fryer" | "cold" | "prep" | "desserts"

const GRILL_KEYWORDS   = ["grill", "grills", "tandoor", "bbq", "kebab", "tikka", "seekh", "sizzler", "tandoori", "charcoal"]
const FRYER_KEYWORDS   = ["fried", "fries", "crispy", "tempura", "pakora", "bhajji", "finger", "nugget", "wings", "popcorn"]
const COLD_KEYWORDS    = ["salad", "dessert", "ice cream", "cold", "shake", "smoothie", "lassi", "raita", "mousse", "parfait", "gelato"]
const PREP_KEYWORDS    = ["pasta", "curry", "biryani", "rice", "bread", "naan", "roti", "dal", "sabzi", "pulao", "gravy", "soup", "stew"]
const DESSERT_KEYWORDS = ["cake", "brownie", "halwa", "kheer", "gulab", "rasgulla", "ladoo", "barfi", "mithai", "pudding", "custard", "tart", "pie"]

// STATION FEATURE — classify a menu item name/category to a station
function getStationForItem(itemName: string, categoryName?: string): StationId {
  const haystack = `${itemName} ${categoryName ?? ""}`.toLowerCase()
  if (DESSERT_KEYWORDS.some((kw) => haystack.includes(kw))) return "desserts"
  if (GRILL_KEYWORDS.some((kw) => haystack.includes(kw)))   return "grill"
  if (FRYER_KEYWORDS.some((kw) => haystack.includes(kw)))   return "fryer"
  if (COLD_KEYWORDS.some((kw) => haystack.includes(kw)))    return "cold"
  if (PREP_KEYWORDS.some((kw) => haystack.includes(kw)))    return "prep"
  return "prep"
}

// STATION FEATURE — station display metadata
const STATION_META: Record<StationId, { emoji: string; label: string; color: string }> = {
  all:      { emoji: "🍽️", label: "All",          color: "text-gray-400" },
  grill:    { emoji: "🔥", label: "Grill",        color: "text-orange-400" },
  fryer:    { emoji: "🍟", label: "Fryer",        color: "text-yellow-400" },
  cold:     { emoji: "❄️", label: "Cold Station", color: "text-cyan-400" },
  prep:     { emoji: "🥗", label: "Prep",         color: "text-green-400" },
  desserts: { emoji: "🍰", label: "Desserts",     color: "text-pink-400" },
}

// STATION FEATURE — read-only station chip component
function StationTag({ stationId }: { stationId: StationId }) {
  const meta = STATION_META[stationId]
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold
        bg-gray-700/60 border border-gray-600/40 ${meta.color}
      `}
      title={`Handled by: ${meta.label} station`}
    >
      <Tag size={9} />
      {meta.emoji} {meta.label}
    </span>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface KitchenTicketItem {
  id: string
  quantity: number
  notes?: string
  status: "pending" | "confirmed" | "preparing" | "ready"
  menu_items: {
    name: string
    prep_time_minutes?: number
    photo_url?: string
    category?: { name: string }     // STATION FEATURE — for classification
  }
}

interface KitchenTicket {
  id: string
  status: string
  created_at: string
  elapsed_minutes: number
  tables?: { label: string; floor_number: number } | null
  order_items: KitchenTicketItem[]
}

// ── Border/badge helpers ──────────────────────────────────────────────────────

function ticketBorderClass(status: string, elapsed: number): string {
  if (status === "ready")     return "border-green-500"
  if (status === "preparing") return "border-yellow-400"
  return elapsed >= 10 ? "border-red-600" : "border-red-400"
}

function ticketHeaderBg(status: string, elapsed: number): string {
  if (status === "ready")     return "bg-green-900/30"
  if (status === "preparing") return "bg-yellow-900/30"
  return elapsed >= 10 ? "bg-red-900/40" : "bg-red-900/20"
}

function statusLabel(status: string): string {
  if (status === "ready")     return "Ready"
  if (status === "preparing") return "Preparing"
  return "New"
}

function statusChipClass(status: string): string {
  if (status === "ready")     return "bg-green-500/20 text-green-300"
  if (status === "preparing") return "bg-yellow-500/20 text-yellow-300"
  return "bg-red-500/20 text-red-300"
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChefKDSPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()

  const {
    data: tickets = [],
    isLoading,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["kitchen", "tickets", branchId],
    queryFn: () =>
      apiClient.get<KitchenTicket[]>(`/kitchen/branch/${branchId}/tickets`),
    enabled: !!branchId,
    refetchInterval: 15_000,
    select: (data) =>
      [...data].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
  })

  useEffect(() => {
    // Nothing extra needed — refetchInterval handles it
  }, [dataUpdatedAt])

  const updateStatus = useMutation({
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: string
      status: "preparing" | "ready"
    }) => apiClient.patch(`/kitchen/orders/${orderId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitchen", "tickets", branchId] })
    },
  })

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : "—"

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flame className="text-orange-400" size={22} />
          <span className="font-bold text-lg tracking-tight">Kitchen Display</span>
          {tickets.length > 0 && (
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {tickets.length} tickets
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <span>Updated {lastUpdated}</span>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-2 flex gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2 border-red-400 bg-transparent" />
          New order
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2 border-yellow-400 bg-transparent" />
          Preparing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-2 border-green-500 bg-transparent" />
          Ready
        </span>
        {/* STATION FEATURE — legend note */}
        <span className="ml-auto flex items-center gap-1.5 text-gray-500">
          <Tag size={10} />
          Station tags shown on each item (read-only)
        </span>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="px-6 pb-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-52 rounded-xl bg-gray-800 animate-pulse border-2 border-gray-700"
              />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <CheckCircle2 className="text-green-500 mb-4" size={48} />
            <h3 className="text-xl font-semibold text-gray-200 mb-1">All caught up!</h3>
            <p className="text-gray-500">No pending orders right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
            <AnimatePresence>
              {tickets.map((ticket) => (
                <motion.div
                  key={ticket.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`bg-gray-800 rounded-xl border-2 ${ticketBorderClass(
                    ticket.status,
                    ticket.elapsed_minutes
                  )} flex flex-col overflow-hidden`}
                >
                  {/* Card header */}
                  <div
                    className={`px-4 py-3 ${ticketHeaderBg(
                      ticket.status,
                      ticket.elapsed_minutes
                    )}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-white text-sm">
                          {ticket.tables
                            ? `Table ${ticket.tables.label}`
                            : "Takeaway"}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(ticket.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusChipClass(
                            ticket.status
                          )}`}
                        >
                          {statusLabel(ticket.status)}
                        </span>
                        {ticket.elapsed_minutes > 0 && (
                          <span
                            className={`text-xs flex items-center gap-1 ${
                              ticket.elapsed_minutes >= 15
                                ? "text-red-400"
                                : ticket.elapsed_minutes >= 8
                                  ? "text-yellow-400"
                                  : "text-gray-400"
                            }`}
                          >
                            <Clock size={11} />
                            {ticket.elapsed_minutes}m ago
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex-1 px-4 py-3 space-y-2 overflow-y-auto max-h-60">
                    {ticket.order_items.map((item) => {
                      // STATION FEATURE — classify each item and show its station tag
                      const itemStation = getStationForItem(
                        item.menu_items.name,
                        item.menu_items.category?.name
                      )
                      return (
                        <div key={item.id} className="text-sm">
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-white">
                              {item.quantity}× {item.menu_items.name}
                            </span>
                            {item.menu_items.prep_time_minutes && (
                              <span className="text-xs text-gray-500 ml-2 shrink-0">
                                {item.menu_items.prep_time_minutes}m
                              </span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1">
                              <AlertTriangle size={11} />
                              {item.notes}
                            </p>
                          )}
                          {/* STATION FEATURE — read-only station assignment chip */}
                          <div className="mt-1">
                            <StationTag stationId={itemStation} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Action buttons */}
                  <div className="px-4 pb-4 pt-2 border-t border-gray-700">
                    {ticket.status === "confirmed" && (
                      <Button
                        className="w-full bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold h-9"
                        onClick={() =>
                          updateStatus.mutate({
                            orderId: ticket.id,
                            status: "preparing",
                          })
                        }
                        disabled={updateStatus.isPending}
                      >
                        Start Preparing
                      </Button>
                    )}
                    {ticket.status === "preparing" && (
                      <Button
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold h-9"
                        onClick={() =>
                          updateStatus.mutate({
                            orderId: ticket.id,
                            status: "ready",
                          })
                        }
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle2 size={15} className="mr-1.5" />
                        Mark Ready
                      </Button>
                    )}
                    {ticket.status === "ready" && (
                      <div className="flex items-center justify-center gap-1.5 text-green-400 text-sm font-medium py-1">
                        <CheckCircle2 size={15} />
                        Ready for pickup
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}