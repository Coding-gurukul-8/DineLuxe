"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function WaiterPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [showNewOrderPanel, setShowNewOrderPanel] = useState(false)
  const [menuSearch, setMenuSearch] = useState("")
  const [draft, setDraft] = useState<DraftItem[]>([])
  const [specialInstructions, setSpecialInstructions] = useState("")

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
              {tables.map((table) => (
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
                  }`}
                >
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
              ))}
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