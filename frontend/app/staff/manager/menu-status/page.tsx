"use client"

/**
 * app/staff/manager/menu-status/page.tsx
 *
 * API CONTRACT FIXES (audit 2026-06-02)
 * ──────────────────────────────────────
 * MISMATCH 1 — GET /menu/items?branch_id=:branchId
 *   This path does NOT exist in menu.routes.ts. The GET /menu/items route is
 *   not defined at all (only POST /menu/items for creating items exists).
 *   The correct public read endpoints are:
 *     GET /menu/branch/:branchId          — full menu
 *     GET /menu/branch/:branchId/items    — same, items alias
 *   FIX: Use GET /menu/branch/:branchId/items  ✓
 *
 * MISMATCH 2 — PATCH /menu/items/:id  { is_available }
 *   menu.routes.ts defines two separate item-mutation routes:
 *     PATCH /menu/items/:id          → handleUpdateItem  (general field updates)
 *     PATCH /menu/items/:id/status   → handleUpdateItemStatus  (availability toggle)
 *   Sending `is_available` to the general update route may work if the schema
 *   accepts it, but the purpose-built endpoint for toggling availability is
 *   PATCH /menu/items/:id/status. Using the correct, narrow endpoint is safer
 *   (it validates only the status field and has proper RBAC).
 *   FIX: Use PATCH /menu/items/:id/status  { is_available }  ✓
 *
 * Already-correct calls (no change needed)
 * ─────────────────────────────────────────
 * • All UI/filter logic is frontend-only — no further API calls.
 */

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, RefreshCw, AlertCircle,
  ChefHat, X, CheckCircle2, XCircle,
  Utensils,
} from "lucide-react"
import { toast } from "sonner"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { useDebounce } from "@/hooks/useDebounce"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string
  name: string
  category: string
  price: number
  is_available: boolean
  description?: string
  prep_time?: number
}

// ── Toggle Switch ──────────────────────────────────────────────────────────────

function AvailabilityToggle({
  isAvailable,
  onChange,
  isPending,
}: {
  isAvailable: boolean
  onChange: (v: boolean) => void
  isPending: boolean
}) {
  return (
    <button
      onClick={() => !isPending && onChange(!isAvailable)}
      disabled={isPending}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors duration-200",
        isAvailable
          ? "bg-emerald-500 border-emerald-500"
          : "bg-gray-200 border-gray-200",
        isPending && "opacity-60 cursor-wait"
      )}
      aria-label={isAvailable ? "Available — click to mark sold out" : "Sold out — click to mark available"}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow-sm",
          isAvailable ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  )
}

// ── Menu Item Row ──────────────────────────────────────────────────────────────

function MenuItemRow({
  item,
  onToggle,
  isToggling,
}: {
  item: MenuItem
  onToggle: (available: boolean) => void
  isToggling: boolean
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn(
        "flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-colors",
        item.is_available
          ? "bg-white border-gray-100"
          : "bg-gray-50 border-gray-100 opacity-70"
      )}
    >
      {/* Status dot */}
      <div className={cn(
        "w-2.5 h-2.5 rounded-full shrink-0",
        item.is_available ? "bg-emerald-500" : "bg-gray-300"
      )} />

      {/* Item info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn(
            "text-sm font-semibold truncate",
            item.is_available ? "text-gray-900" : "text-gray-400 line-through"
          )}>
            {item.name}
          </p>
          {!item.is_available && (
            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
              SOLD OUT
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">{item.category}</span>
          {item.prep_time && (
            <span className="text-xs text-gray-300">· {item.prep_time} min prep</span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="hidden sm:block text-sm font-mono font-semibold text-gray-600 shrink-0">
        ₹{item.price.toFixed(0)}
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn(
          "hidden md:block text-xs font-semibold",
          item.is_available ? "text-emerald-600" : "text-gray-400"
        )}>
          {item.is_available ? "Available" : "Sold Out"}
        </span>
        <AvailabilityToggle
          isAvailable={item.is_available}
          onChange={onToggle}
          isPending={isToggling}
        />
      </div>
    </motion.div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ManagerMenuStatusPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [filterAvail, setFilterAvail] = useState<"all" | "available" | "sold_out">("all")
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search, 250)

  /**
   * FIX 1: Was GET /menu/items?branch_id=:branchId — route doesn't exist.
   * Correct endpoint: GET /menu/branch/:branchId/items  ✓  (menu.routes.ts)
   */
  const { data: items = [], isLoading, isError, refetch, isFetching } = useQuery<MenuItem[]>({
    queryKey: ["menu", "items", branchId],
    queryFn: () => apiClient.get<MenuItem[]>(`/menu/branch/${branchId}/items`),
    enabled: !!branchId,
    staleTime: 30_000,
  })

  /**
   * FIX 2: Was PATCH /menu/items/:id { is_available } — general update route.
   * Correct endpoint: PATCH /menu/items/:id/status { is_available }  ✓
   * This is the purpose-built availability-toggle endpoint (menu.routes.ts).
   */
  const { mutate: toggleAvailability } = useMutation({
    mutationFn: ({ itemId, is_available }: { itemId: string; is_available: boolean }) =>
      apiClient.patch(`/menu/items/${itemId}/status`, { is_available }),
    onMutate: ({ itemId }) => setTogglingId(itemId),
    onSuccess: (_, { itemId, is_available }) => {
      qc.setQueryData<MenuItem[]>(["menu", "items", branchId], (prev) =>
        prev?.map((i) => i.id === itemId ? { ...i, is_available } : i) ?? []
      )
      toast.success(is_available ? "Item marked as available" : "Item marked as sold out")
    },
    onError: () => toast.error("Failed to update availability"),
    onSettled: () => setTogglingId(null),
  })

  // ── Category grouping ──────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return items.filter((i) => {
      const matchSearch = !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
      const matchAvail =
        filterAvail === "all" ||
        (filterAvail === "available" && i.is_available) ||
        (filterAvail === "sold_out" && !i.is_available)
      return matchSearch && matchAvail
    })
  }, [items, debouncedSearch, filterAvail])

  const categories = useMemo(() => {
    const cats = new Set(filtered.map((i) => i.category))
    return Array.from(cats).sort()
  }, [filtered])

  const availableCount = items.filter((i) => i.is_available).length
  const soldOutCount = items.length - availableCount

  return (
    <PageWrapper
      title="Menu Status"
      subtitle="Toggle item availability in real-time"
      action={
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
        </button>
      }
    >
      {/* Summary */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <Utensils size={16} className="text-gray-400" />
            <div>
              <p className="text-2xl font-bold font-mono text-gray-900">{items.length}</p>
              <p className="text-xs text-gray-400">Total Items</p>
            </div>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-100 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <div>
              <p className="text-2xl font-bold font-mono text-gray-900">{availableCount}</p>
              <p className="text-xs text-emerald-600 font-medium">Available</p>
            </div>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-100 px-4 py-3 flex items-center gap-3">
            <XCircle size={16} className="text-red-500" />
            <div>
              <p className="text-2xl font-bold font-mono text-gray-900">{soldOutCount}</p>
              <p className="text-xs text-red-500 font-medium">Sold Out</p>
            </div>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 flex-1 min-w-52 max-w-sm">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items or categories…"
            className="flex-1 text-sm outline-none placeholder:text-gray-400 bg-transparent"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-gray-300 hover:text-gray-500">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          {(["all", "available", "sold_out"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterAvail(f)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-semibold capitalize transition",
                filterAvail === f
                  ? f === "available"
                    ? "bg-emerald-500 text-white"
                    : f === "sold_out"
                    ? "bg-red-500 text-white"
                    : "bg-[#1A3C5E] text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
              )}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 gap-3 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm">Failed to load menu items</p>
          <button onClick={() => refetch()} className="text-sm text-[#1A3C5E] hover:underline">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400 gap-3">
          <ChefHat size={28} className="text-gray-300" />
          <p className="text-sm font-medium">No items match your search</p>
        </div>
      ) : (
        <div className="space-y-5">
          {categories.map((category) => {
            const categoryItems = filtered.filter((i) => i.category === category)
            if (!categoryItems.length) return null
            return (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Category header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {category}
                  </h3>
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400 font-mono">{categoryItems.length}</span>
                </div>

                <div className="space-y-2">
                  <AnimatePresence>
                    {categoryItems.map((item) => (
                      <MenuItemRow
                        key={item.id}
                        item={item}
                        onToggle={(available) =>
                          toggleAvailability({ itemId: item.id, is_available: available })
                        }
                        isToggling={togglingId === item.id}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </PageWrapper>
  )
}