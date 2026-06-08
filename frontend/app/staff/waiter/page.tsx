"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"
import { useFoodReady } from "@/hooks/useFoodReady"
import { useWaiterCall } from "@/hooks/useWaiterCall"
import { getSocket } from "@/lib/socket"
import { formatTime } from "@/lib/utils"
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ChefHat,
  RefreshCw,
  X,
  AlertCircle,
  BellRing,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface BranchTable {
  id: string
  label: string
  floor_number: number
  capacity: number
  status: "free" | "occupied" | "reserved" | "cleaning" | "maintenance"
  current_order?: {
    id: string
    status: string
    total: number
    created_at: string
  } | null
}

interface TableOrder {
  id: string
  status: string
  total: number
  created_at: string
  order_items: Array<{
    id: string
    quantity: number
    notes?: string
    menu_items: { name: string; price: number }
  }>
}

interface MenuCategory {
  id: string
  name: string
  items: Array<{
    id: string
    name: string
    price: number
    description?: string
    is_available: boolean
  }>
}

interface DraftItem {
  menu_item_id: string
  name: string
  price: number
  quantity: number
  notes: string
}

// CALL WAITER ADDITION: Shape of the event emitted by the server when a
// customer taps "Call Waiter" in the dine-in view.
interface CallWaiterEvent {
  table_id: string
  table_label: string
  branch_id: string
  order_id: string
  called_at: string
  message: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TABLE_STATUS_STYLE: Record<string, string> = {
  free: "border-green-400 bg-green-50 hover:bg-green-100",
  occupied: "border-red-400 bg-red-50 hover:bg-red-100",
  reserved: "border-blue-400 bg-blue-50 hover:bg-blue-100",
  cleaning: "border-yellow-400 bg-yellow-50 hover:bg-yellow-100",
  maintenance: "border-gray-400 bg-gray-50 hover:bg-gray-100",
}

const TABLE_STATUS_LABEL: Record<string, string> = {
  free: "Free",
  occupied: "Occupied",
  reserved: "Reserved",
  cleaning: "Cleaning",
  maintenance: "Maintenance",
}

// CALL WAITER ADDITION: Play a short attention-grabbing beep via the Web Audio
// API. Mirrors the pattern used in the KDS. Fails silently if the browser
// blocks autoplay.
function playCallAlert() {
  try {
    const ctx = new AudioContext()
    // Two quick ascending beeps to stand out from ambient noise
    const beepAt = (start: number, freq: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.4, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25)
      osc.start(start)
      osc.stop(start + 0.25)
    }
    beepAt(ctx.currentTime, 880)
    beepAt(ctx.currentTime + 0.3, 1100)
  } catch {
    // Autoplay policy blocked — swallow silently
  }
}

// CALL WAITER ADDITION: Human-readable relative time for the alert timestamp
// (e.g. "just now", "2 min ago"). Falls back to HH:MM if older than 10 min.
function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 10) return "just now"
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 10) return `${diffMin} min ago`
  return formatTime(isoString)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WaiterPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()
  const router = useRouter()

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [showNewOrderPanel, setShowNewOrderPanel] = useState(false)
  const [menuSearch, setMenuSearch] = useState("")
  const [draft, setDraft] = useState<DraftItem[]>([])
  const [specialInstructions, setSpecialInstructions] = useState("")

  // CALL WAITER ADDITION: Persistent list of unacknowledged customer calls.
  // Each entry is a CallWaiterEvent. New calls are prepended so the most
  // recent always appears at the top of the banner stack.
  const [callAlerts, setCallAlerts] = useState<CallWaiterEvent[]>([])

  // ── Existing realtime hooks ───────────────────────────────────────────────

  useFoodReady({
    branchId: branchId ?? undefined,
    onFoodReady: () => {
      qc.invalidateQueries({ queryKey: ["waiter"] })
      toast.success("An order is ready to serve")
    },
  })

  useWaiterCall({
    branchId: branchId ?? undefined,
    onWaiterCall: () => {
      // The useWaiterCall hook is kept for backward-compat Supabase Realtime
      // listeners. The Socket.IO handler below is the primary alert path.
    },
  })

  // CALL WAITER ADDITION: Socket.IO event listener for 'customer_call_waiter'.
  // Registers once when the component mounts (or when branchId changes).
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleCallWaiter = (data: CallWaiterEvent) => {
      // Add to top of the persistent alert stack
      setCallAlerts((prev) => {
        // De-duplicate: if same table already has an unacknowledged alert,
        // replace it with the newer one
        const filtered = prev.filter((a) => a.table_id !== data.table_id)
        return [data, ...filtered]
      })
      playCallAlert()
      toast.info(`Table ${data.table_label} is calling for assistance`)
    }

    socket.on("customer_call_waiter", handleCallWaiter)
    return () => {
      socket.off("customer_call_waiter", handleCallWaiter)
    }
  }, [branchId])

  // CALL WAITER ADDITION: Called when waiter taps "On My Way" on an alert.
  const handleAcknowledge = useCallback(
    async (tableId: string, alert: CallWaiterEvent) => {
      try {
        await apiClient.post("/orders/acknowledge-call", { table_id: tableId })
      } catch {
        // Non-fatal — the customer still gets a socket event via the server,
        // but we optimistically remove the alert regardless
      }
      // Remove from persistent alert list
      setCallAlerts((prev) => prev.filter((a) => a.table_id !== tableId))
      // Navigate to that table so the waiter can serve immediately
      setSelectedTableId(tableId)
      router.push(`/staff/waiter?table=${tableId}`)
    },
    [router]
  )

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: tables = [], isLoading: tablesLoading, refetch: refetchTables } = useQuery({
    queryKey: ["waiter", "tables", branchId],
    queryFn: () => apiClient.get<BranchTable[]>(`/tables/branch/${branchId}`),
    enabled: !!branchId,
    refetchInterval: 30_000,
  })

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null

  const { data: tableOrder, isLoading: orderLoading } = useQuery({
    queryKey: ["waiter", "table-order", selectedTableId],
    queryFn: () => apiClient.get<TableOrder | null>(`/orders/table/${selectedTableId}`),
    enabled: !!selectedTableId,
    refetchInterval: 15_000,
  })

  const { data: menuData } = useQuery({
    queryKey: ["menu", branchId],
    queryFn: () => apiClient.get<{ categories: MenuCategory[] }>(`/menu/branch/${branchId}`),
    enabled: !!branchId && showNewOrderPanel,
  })

  const allMenuItems = useMemo(
    () => (menuData?.categories ?? []).flatMap((c) => c.items.filter((i) => i.is_available)),
    [menuData]
  )

  const filteredItems = useMemo(
    () =>
      menuSearch.trim()
        ? allMenuItems.filter((i) =>
            i.name.toLowerCase().includes(menuSearch.toLowerCase())
          )
        : allMenuItems,
    [allMenuItems, menuSearch]
  )

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const createOrder = useMutation({
    mutationFn: () =>
      apiClient.post("/orders", {
        table_id: selectedTableId,
        order_type: "dine_in",
        items: draft.map((d) => ({
          menu_item_id: d.menu_item_id,
          quantity: d.quantity,
          notes: d.notes || undefined,
        })),
        special_instructions: specialInstructions || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waiter", "tables", branchId] })
      qc.invalidateQueries({ queryKey: ["waiter", "table-order", selectedTableId] })
      setShowNewOrderPanel(false)
      setDraft([])
      setSpecialInstructions("")
      setMenuSearch("")
    },
  })

  // ── Draft helpers ─────────────────────────────────────────────────────────────

  const addToDraft = (item: MenuCategory["items"][number]) => {
    setDraft((prev) => {
      const existing = prev.find((d) => d.menu_item_id === item.id)
      if (existing) {
        return prev.map((d) =>
          d.menu_item_id === item.id ? { ...d, quantity: d.quantity + 1 } : d
        )
      }
      return [...prev, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1, notes: "" }]
    })
  }

  const updateQty = (id: string, delta: number) => {
    setDraft((prev) =>
      prev
        .map((d) => (d.menu_item_id === id ? { ...d, quantity: d.quantity + delta } : d))
        .filter((d) => d.quantity > 0)
    )
  }

  const updateNotes = (id: string, notes: string) => {
    setDraft((prev) => prev.map((d) => (d.menu_item_id === id ? { ...d, notes } : d)))
  }

  const draftTotal = draft.reduce((s, d) => s + d.price * d.quantity, 0)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageWrapper title="Waiter Dashboard" subtitle="Manage tables and take orders">

      {/* ── CALL WAITER ADDITION: Persistent alert banner ──────────────────────
          Stacks above the main grid. Each unacknowledged call shows its own
          amber card with an "On My Way" CTA. Dismissing any card calls
          handleAcknowledge which POSTs to /orders/acknowledge-call, fires the
          'waiter_acknowledged' socket event back to the customer, and removes
          the card from the stack. The banner is sticky so the waiter always
          sees it regardless of how far they've scrolled.
      ────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {callAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="sticky top-0 z-30 space-y-2 px-0 pt-0 pb-3 mb-2"
          >
            {callAlerts.map((alert) => (
              <motion.div
                key={`${alert.table_id}-${alert.called_at}`}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, height: 0 }}
                layout
                className="flex items-center justify-between bg-amber-500 text-white rounded-xl px-4 py-3 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  {/* Animated bell */}
                  <motion.div
                    animate={{ rotate: [0, -15, 15, -10, 10, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                  >
                    <BellRing size={20} className="shrink-0" />
                  </motion.div>
                  <div>
                    <p className="font-bold text-sm leading-tight">
                      Table {alert.table_label} needs assistance
                    </p>
                    <p className="text-xs opacity-80 mt-0.5">
                      {formatRelativeTime(alert.called_at)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleAcknowledge(alert.table_id, alert)}
                  className="ml-3 shrink-0 bg-white text-amber-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-50 active:scale-95 transition-transform"
                >
                  On My Way
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── END CALL WAITER ADDITION ─────────────────────────────────────────── */}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 min-h-[calc(100vh-140px)]">

        {/* ── Left: Table Grid ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-lg">Tables</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchTables()}
              className="text-gray-500 gap-1"
            >
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>

          {tablesLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : tables.length === 0 ? (
            <p className="text-center text-gray-400 py-10">No tables found for this branch.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {tables.map((table) => {
                // CALL WAITER ADDITION: Highlight table cards that have a
                // pending unacknowledged customer call with an amber ring.
                const hasPendingCall = callAlerts.some((a) => a.table_id === table.id)
                return (
                  <motion.button
                    key={table.id}
                    onClick={() => {
                      setSelectedTableId(table.id)
                      setShowNewOrderPanel(false)
                    }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                      TABLE_STATUS_STYLE[table.status] ?? "border-gray-300 bg-gray-50"
                    } ${
                      selectedTableId === table.id
                        ? "ring-2 ring-brand-primary ring-offset-1"
                        : ""
                    } ${
                      hasPendingCall
                        ? "ring-2 ring-amber-400 ring-offset-1 animate-pulse"
                        : ""
                    }`}
                  >
                    {/* CALL WAITER ADDITION: Bell badge on table card */}
                    {hasPendingCall && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow">
                        <BellRing size={11} className="text-white" />
                      </span>
                    )}
                    <div className="font-bold text-gray-900 text-sm">
                      Table {table.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {TABLE_STATUS_LABEL[table.status] ?? table.status}
                    </div>
                    {table.current_order && (
                      <div className="mt-1">
                        <StatusBadge status={table.current_order.status} size="sm" />
                      </div>
                    )}
                  </motion.button>
                )
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-gray-100 text-xs text-gray-500">
            {Object.entries(TABLE_STATUS_LABEL).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span
                  className={`w-3 h-3 rounded-sm border ${
                    TABLE_STATUS_STYLE[k]?.split(" ")[0] ?? ""
                  }`}
                />
                {v}
              </span>
            ))}
          </div>
        </div>

        {/* ── Right: Table Detail / Order Panel ────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
          {!selectedTable ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 gap-3">
              <ChefHat size={40} className="text-gray-200" />
              <p className="text-sm">Select a table to view its order</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900 text-lg">
                    Table {selectedTable.label}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Floor {selectedTable.floor_number} · {selectedTable.capacity} seats
                  </p>
                </div>
                <StatusBadge status={selectedTable.status} />
              </div>

              {/* Current Order */}
              {!showNewOrderPanel && (
                <>
                  {orderLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
                      ))}
                    </div>
                  ) : tableOrder ? (
                    <div className="flex-1 overflow-y-auto">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">Current Order</span>
                        <StatusBadge status={tableOrder.status} />
                      </div>
                      <div className="space-y-2 mb-4">
                        {tableOrder.order_items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-sm py-2 border-b border-gray-50"
                          >
                            <div>
                              <span className="font-medium text-gray-800">
                                {item.quantity}× {item.menu_items.name}
                              </span>
                              {item.notes && (
                                <p className="text-xs text-amber-600 mt-0.5">{item.notes}</p>
                              )}
                            </div>
                            <span className="text-gray-600 text-xs">
                              ₹{item.menu_items.price * item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between font-semibold text-sm pt-2">
                        <span>Total</span>
                        <span>₹{tableOrder.total}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-6">
                      No active order on this table.
                    </p>
                  )}

                  {/* New Order CTA */}
                  {selectedTable.status !== "maintenance" && (
                    <Button
                      className="w-full mt-4 gap-2"
                      onClick={() => setShowNewOrderPanel(true)}
                    >
                      <Plus size={16} />
                      New Order
                    </Button>
                  )}
                </>
              )}

              {/* ── New Order Panel ─────────────────────────────────────── */}
              <AnimatePresence>
                {showNewOrderPanel && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex flex-col flex-1 gap-3"
                  >
                    {/* Menu search */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <Input
                          placeholder="Search menu…"
                          value={menuSearch}
                          onChange={(e) => setMenuSearch(e.target.value)}
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                      <button
                        onClick={() => {
                          setShowNewOrderPanel(false)
                          setDraft([])
                          setMenuSearch("")
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Menu items */}
                    <div className="flex-1 overflow-y-auto max-h-48 space-y-1">
                      {filteredItems.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">
                          {menuSearch ? "No items match." : "Loading menu…"}
                        </p>
                      ) : (
                        filteredItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => addToDraft(item)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 text-sm text-left transition-colors"
                          >
                            <span className="text-gray-800">{item.name}</span>
                            <span className="text-gray-500 text-xs">₹{item.price}</span>
                          </button>
                        ))
                      )}
                    </div>

                    {/* Draft cart */}
                    {draft.length > 0 && (
                      <div className="border-t border-gray-100 pt-3 space-y-2 max-h-40 overflow-y-auto">
                        {draft.map((d) => (
                          <div key={d.menu_item_id} className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-gray-800 flex-1 truncate">
                                {d.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => updateQty(d.menu_item_id, -1)}
                                  className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                                >
                                  <Minus size={10} />
                                </button>
                                <span className="w-5 text-center text-sm">{d.quantity}</span>
                                <button
                                  onClick={() => updateQty(d.menu_item_id, 1)}
                                  className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100"
                                >
                                  <Plus size={10} />
                                </button>
                                <button
                                  onClick={() =>
                                    setDraft((p) =>
                                      p.filter((x) => x.menu_item_id !== d.menu_item_id)
                                    )
                                  }
                                  className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 ml-1"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                            <Input
                              placeholder="Notes (e.g. no spice)"
                              value={d.notes}
                              onChange={(e) => updateNotes(d.menu_item_id, e.target.value)}
                              className="h-7 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Special instructions */}
                    <Input
                      placeholder="Special instructions for whole order…"
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      className="text-sm"
                    />

                    {/* Submit */}
                    {createOrder.isError && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Failed to place order. Please try again.
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-semibold text-sm">
                        Total: ₹{draftTotal}
                      </span>
                      <Button
                        size="sm"
                        disabled={draft.length === 0 || createOrder.isPending}
                        onClick={() => createOrder.mutate()}
                        className="gap-1"
                      >
                        <ShoppingCart size={14} />
                        {createOrder.isPending ? "Placing…" : "Place Order"}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}