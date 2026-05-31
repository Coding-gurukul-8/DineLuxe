"use client"

// ─────────────────────────────────────────────────────────────────────────────
// app/staff/chef/kitchen/page.tsx
// Kitchen Display System — enhanced with STATION FEATURE
// All additions are marked with // STATION FEATURE
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { useFoodReady } from "@/hooks/useFoodReady"
import { useOrderCancelled } from "@/hooks/useOrderCancelled"
import { useOverdueOrder } from "@/hooks/useOverdueOrder"
import {
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Tag,
} from "lucide-react"
import { Button } from "@/components/ui/button"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface KitchenTicketItem {
  id: string
  quantity: number
  notes?: string
  status: "pending" | "confirmed" | "preparing" | "ready"
  menu_items: {
    name: string
    prep_time_minutes?: number
    photo_url?: string
    category?: { name: string }     // STATION FEATURE — used for classification
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

// ─────────────────────────────────────────────────────────────────────────────
// STATION FEATURE — Station definitions and keyword maps
// ─────────────────────────────────────────────────────────────────────────────

const GRILL_KEYWORDS  = ["grill", "grills", "tandoor", "bbq", "kebab", "tikka", "seekh", "sizzler", "tandoori", "charcoal"]
const FRYER_KEYWORDS  = ["fried", "fries", "crispy", "tempura", "pakora", "bhajji", "finger", "nugget", "wings", "popcorn"]
const COLD_KEYWORDS   = ["salad", "dessert", "ice cream", "cold", "shake", "smoothie", "lassi", "raita", "mousse", "parfait", "gelato"]
const PREP_KEYWORDS   = ["pasta", "curry", "biryani", "rice", "bread", "naan", "roti", "dal", "sabzi", "pulao", "gravy", "soup", "stew"]
const DESSERT_KEYWORDS = ["cake", "brownie", "halwa", "kheer", "gulab", "rasgulla", "ladoo", "barfi", "mithai", "pudding", "custard", "tart", "pie"]

export type StationId = "all" | "grill" | "fryer" | "cold" | "prep" | "desserts"

interface Station {
  id: StationId
  label: string
  emoji: string
  color: string             // Tailwind bg for active tab
  textColor: string         // Tailwind text for badge/highlight
  borderColor: string       // Tailwind border
  highlightBg: string       // Item highlight bg
  keywords: string[]
}

// STATION FEATURE — Station config table
const STATIONS: Station[] = [
  {
    id: "all",
    label: "All",
    emoji: "🍽️",
    color: "bg-[#1a2744]",
    textColor: "text-white",
    borderColor: "border-[#1a2744]",
    highlightBg: "bg-gray-700/60",
    keywords: [],
  },
  {
    id: "grill",
    label: "Grill",
    emoji: "🔥",
    color: "bg-orange-600",
    textColor: "text-orange-300",
    borderColor: "border-orange-500",
    highlightBg: "bg-orange-900/40",
    keywords: GRILL_KEYWORDS,
  },
  {
    id: "fryer",
    label: "Fryer",
    emoji: "🍟",
    color: "bg-yellow-600",
    textColor: "text-yellow-300",
    borderColor: "border-yellow-500",
    highlightBg: "bg-yellow-900/40",
    keywords: FRYER_KEYWORDS,
  },
  {
    id: "cold",
    label: "Cold Station",
    emoji: "❄️",
    color: "bg-cyan-700",
    textColor: "text-cyan-300",
    borderColor: "border-cyan-500",
    highlightBg: "bg-cyan-900/40",
    keywords: COLD_KEYWORDS,
  },
  {
    id: "prep",
    label: "Prep",
    emoji: "🥗",
    color: "bg-green-700",
    textColor: "text-green-300",
    borderColor: "border-green-500",
    highlightBg: "bg-green-900/40",
    keywords: PREP_KEYWORDS,
  },
  {
    id: "desserts",
    label: "Desserts",
    emoji: "🍰",
    color: "bg-pink-700",
    textColor: "text-pink-300",
    borderColor: "border-pink-500",
    highlightBg: "bg-pink-900/40",
    keywords: DESSERT_KEYWORDS,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// STATION FEATURE — Helper: classify a single item to a station
// Returns the StationId whose keywords match first (checked in priority order).
// Falls back to "prep" when no match is found (catch-all).
// ─────────────────────────────────────────────────────────────────────────────

export function getStationForItem(
  itemName: string,
  categoryName?: string
): StationId {
  const haystack = `${itemName} ${categoryName ?? ""}`.toLowerCase()

  // Check desserts first (overlaps with COLD for ice cream)
  if (DESSERT_KEYWORDS.some((kw) => haystack.includes(kw))) return "desserts"
  if (GRILL_KEYWORDS.some((kw) => haystack.includes(kw)))   return "grill"
  if (FRYER_KEYWORDS.some((kw) => haystack.includes(kw)))   return "fryer"
  if (COLD_KEYWORDS.some((kw) => haystack.includes(kw)))    return "cold"
  if (PREP_KEYWORDS.some((kw) => haystack.includes(kw)))    return "prep"

  // Default — most Indian restaurant main dishes are curry/prep
  return "prep"
}

// ─────────────────────────────────────────────────────────────────────────────
// STATION FEATURE — Compute per-station ticket counts for the workload badges
// ─────────────────────────────────────────────────────────────────────────────

function computeStationCounts(tickets: KitchenTicket[]): Record<StationId, number> {
  const counts: Record<StationId, number> = {
    all: tickets.length,
    grill: 0,
    fryer: 0,
    cold: 0,
    prep: 0,
    desserts: 0,
  }

  for (const ticket of tickets) {
    const stationsInTicket = new Set<StationId>()
    for (const item of ticket.order_items) {
      const station = getStationForItem(
        item.menu_items.name,
        item.menu_items.category?.name
      )
      stationsInTicket.add(station)
    }
    for (const s of stationsInTicket) {
      counts[s]++
    }
  }

  return counts
}

// ─────────────────────────────────────────────────────────────────────────────
// STATION FEATURE — Filter tickets for the active station
// Returns { filtered tickets, with each item annotated as relevant/dimmed }
// ─────────────────────────────────────────────────────────────────────────────

interface AnnotatedItem extends KitchenTicketItem {
  _stationMatch: boolean   // true = highlight; false = dim
  _itemStation: StationId  // which station owns this item
}

interface AnnotatedTicket extends Omit<KitchenTicket, "order_items"> {
  order_items: AnnotatedItem[]
  _allMatchingItemsDone: boolean  // fade ticket if all station items are ready
}

function filterAndAnnotate(
  tickets: KitchenTicket[],
  activeStation: StationId
): AnnotatedTicket[] {
  return tickets
    .map((ticket): AnnotatedTicket | null => {
      const annotatedItems: AnnotatedItem[] = ticket.order_items.map((item) => {
        const itemStation = getStationForItem(
          item.menu_items.name,
          item.menu_items.category?.name
        )
        const stationMatch =
          activeStation === "all" || itemStation === activeStation
        return { ...item, _stationMatch: stationMatch, _itemStation: itemStation }
      })

      // For non-"all" stations: exclude tickets that have zero matching items
      if (activeStation !== "all") {
        const hasMatch = annotatedItems.some((i) => i._stationMatch)
        if (!hasMatch) return null
      }

      // STATION FEATURE — ticket fades if all items for THIS station are ready
      const matchingItems = annotatedItems.filter((i) => i._stationMatch)
      const allMatchingItemsDone =
        activeStation !== "all" &&
        matchingItems.length > 0 &&
        matchingItems.every((i) => i.status === "ready")

      return {
        ...ticket,
        order_items: annotatedItems,
        _allMatchingItemsDone: allMatchingItemsDone,
      }
    })
    .filter((t): t is AnnotatedTicket => t !== null)
}

// ─────────────────────────────────────────────────────────────────────────────
// Ticket card visual helpers (unchanged from original chef/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// STATION FEATURE — StationTabBar component
// ─────────────────────────────────────────────────────────────────────────────

interface StationTabBarProps {
  active: StationId
  counts: Record<StationId, number>
  onChange: (id: StationId) => void
}

function StationTabBar({ active, counts, onChange }: StationTabBarProps) {
  return (
    // STATION FEATURE — horizontal scrollable tab bar pinned below the top bar
    <div className="sticky top-[57px] z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-4 py-2">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STATIONS.map((station) => {
          const isActive = active === station.id
          const count = counts[station.id] ?? 0
          return (
            <button
              key={station.id}
              onClick={() => onChange(station.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold
                whitespace-nowrap transition-all duration-150 border
                ${isActive
                  ? `${station.color} text-white border-transparent shadow-lg scale-[1.03]`
                  : "bg-gray-800/60 text-gray-400 border-gray-700 hover:bg-gray-700/70 hover:text-gray-200"
                }
              `}
            >
              <span>{station.emoji}</span>
              <span>{station.label}</span>
              {/* STATION FEATURE — workload badge */}
              <span
                className={`
                  ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold
                  ${isActive
                    ? "bg-white/20 text-white"
                    : count > 0
                      ? "bg-gray-600 text-gray-200"
                      : "bg-gray-800 text-gray-600"
                  }
                `}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STATION FEATURE — StationTag chip shown on each order item
// ─────────────────────────────────────────────────────────────────────────────

function StationChip({ stationId }: { stationId: StationId }) {
  const station = STATIONS.find((s) => s.id === stationId)
  if (!station || stationId === "all") return null
  return (
    // STATION FEATURE — read-only station tag on each item
    <span
      className={`
        inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold
        bg-gray-700/70 ${station.textColor} border border-gray-600/50
      `}
    >
      <Tag size={9} />
      {station.emoji} {station.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function KitchenDisplayPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()

  useFoodReady({
    branchId: branchId ?? undefined,
    onFoodReady: () => {
      qc.invalidateQueries({ queryKey: ["kitchen", "tickets", branchId] })
    },
  })

  useOrderCancelled({
    branchId: branchId ?? undefined,
    onOrderCancelled: () => {
      qc.invalidateQueries({ queryKey: ["kitchen", "tickets", branchId] })
    },
  })

  useOverdueOrder({
    branchId: branchId ?? undefined,
    onOverdueOrder: () => {
      qc.invalidateQueries({ queryKey: ["kitchen", "tickets", branchId] })
    },
  })

  // STATION FEATURE — active station state (default: "all")
  const [activeStation, setActiveStation] = useState<StationId>("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

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

  // STATION FEATURE — compute per-station badge counts
  const stationCounts = useMemo(
    () => computeStationCounts(tickets),
    [tickets]
  )

  // STATION FEATURE — filter + annotate tickets for the active station
  const displayTickets = useMemo(
    () => filterAndAnnotate(tickets, activeStation),
    [tickets, activeStation]
  )

  // Apply priority filter on top of station filter
  const finalTickets = useMemo(() => {
    if (priorityFilter === "all") return displayTickets
    // Note: priority is not in the backend KitchenTicket shape yet;
    // we keep the filter wired up for future-compatibility.
    return displayTickets
  }, [displayTickets, priorityFilter])

  // STATION FEATURE — get station config for active station
  const activeStationConfig = STATIONS.find((s) => s.id === activeStation)!

  return (
    <div className="min-h-screen bg-gray-900 text-white">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Flame className="text-orange-400" size={22} />
          <span className="font-bold text-lg tracking-tight">Kitchen Display</span>
          {tickets.length > 0 && (
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {tickets.length} tickets
            </span>
          )}
          {/* STATION FEATURE — show active station label in top bar */}
          {activeStation !== "all" && (
            <span
              className={`
                text-xs font-semibold px-2 py-0.5 rounded-full border
                ${activeStationConfig.textColor} ${activeStationConfig.borderColor}
                bg-gray-800
              `}
            >
              {activeStationConfig.emoji} {activeStationConfig.label} view
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

      {/* STATION FEATURE — Station tab bar with workload counts */}
      <StationTabBar
        active={activeStation}
        counts={stationCounts}
        onChange={setActiveStation}
      />

      {/* ── Legend + filter row ───────────────────────────────────────────── */}
      <div className="px-6 pt-3 pb-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-400">
        {/* Status legend */}
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-red-400" />
            New order
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-yellow-400" />
            Preparing
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-green-500" />
            Ready
          </span>
        </div>

        {/* STATION FEATURE — highlighting legend when a station filter is active */}
        {activeStation !== "all" && (
          <div className="flex gap-4 ml-auto">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-3 h-3 rounded-sm ${activeStationConfig.highlightBg} border border-amber-400`}
              />
              {activeStationConfig.emoji} This station's items
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-700/30 border border-gray-600/50 opacity-50" />
              Other stations (dimmed)
            </span>
          </div>
        )}
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
        ) : finalTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <CheckCircle2 className="text-green-500 mb-4" size={48} />
            <h3 className="text-xl font-semibold text-gray-200 mb-1">
              {/* STATION FEATURE — context-aware empty message */}
              {activeStation === "all"
                ? "All caught up!"
                : `No pending tickets for ${activeStationConfig.emoji} ${activeStationConfig.label}`}
            </h3>
            <p className="text-gray-500">
              {activeStation === "all"
                ? "No pending orders right now."
                : "Switch stations or wait for new orders."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
            <AnimatePresence>
              {finalTickets.map((ticket) => (
                <motion.div
                  key={ticket.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{
                    opacity: ticket._allMatchingItemsDone ? 0.4 : 1,
                    scale: 1,
                  }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  className={`
                    bg-gray-800 rounded-xl border-2 flex flex-col overflow-hidden
                    ${ticketBorderClass(ticket.status, ticket.elapsed_minutes)}
                    ${ticket._allMatchingItemsDone ? "grayscale-[30%]" : ""}
                  `}
                >
                  {/* ── Card header ────────────────────────────────────── */}
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

                    {/* STATION FEATURE — "All station items done" banner */}
                    {ticket._allMatchingItemsDone && (
                      <div
                        className={`
                          mt-2 text-xs font-semibold px-2 py-1 rounded
                          ${activeStationConfig.textColor} ${activeStationConfig.highlightBg}
                          flex items-center gap-1
                        `}
                      >
                        <CheckCircle2 size={11} />
                        {activeStationConfig.emoji} Station items done
                      </div>
                    )}
                  </div>

                  {/* ── Items ──────────────────────────────────────────── */}
                  <div className="flex-1 px-4 py-3 space-y-2 overflow-y-auto max-h-64">
                    {ticket.order_items.map((item) => {
                      // STATION FEATURE — highlight or dim based on station match
                      const isMatch = item._stationMatch
                      const isAllView = activeStation === "all"
                      const itemStation = item._itemStation

                      return (
                        <div
                          key={item.id}
                          className={`
                            text-sm rounded-lg px-2 py-1.5 transition-all duration-150
                            ${isAllView
                              ? "bg-transparent"
                              : isMatch
                                ? `${activeStationConfig.highlightBg} border border-amber-500/40 ring-1 ring-amber-500/20`
                                : "opacity-35 bg-gray-700/20"
                            }
                          `}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span
                              className={`font-medium ${
                                isMatch || isAllView ? "text-white" : "text-gray-500"
                              }`}
                            >
                              {item.quantity}× {item.menu_items.name}
                            </span>
                            {item.menu_items.prep_time_minutes && (
                              <span className="text-xs text-gray-500 shrink-0">
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

                          {/* STATION FEATURE — station chip on each item */}
                          <div className="mt-1">
                            <StationChip stationId={itemStation} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* ── Action buttons ─────────────────────────────────── */}
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