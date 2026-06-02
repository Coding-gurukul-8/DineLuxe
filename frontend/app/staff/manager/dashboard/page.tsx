"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  ShoppingBag,
  Users,
  IndianRupee,
  Clock,
  AlertCircle,
  // AI INTEGRATION — new icons for the 3 new sections
  ChefHat,
  Package,
  UserCheck,
  Timer,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { KPICard } from "@/components/shared/KPICard";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FloorMap, type FloorTable } from "@/components/floor/FloorMap";
import PageWrapper from "@/components/layout/PageWrapper";
import { WS_EVENTS } from "@/lib/constants";
import { formatCurrency, elapsedMinutes, cn } from "@/lib/utils";
import DemandPrediction from "@/components/ai/DemandPrediction";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * GET /branches/:id/live-stats
 * Returns: { tables: Record<string,number>, total_tables, active_orders,
 *            staff_on_duty, revenue_today }
 */
interface LiveStats {
  tables: Record<string, number>;
  total_tables: number;
  active_orders: number;
  staff_on_duty: number;
  revenue_today: number;
}

/**
 * GET /tables/branch/:branchId
 * DB columns: id, label, capacity, status, shape, floor_number, zone, x_pos, y_pos
 */
interface BranchTable {
  id: string;
  label: string;
  capacity: number;
  status: "free" | "occupied" | "reserved" | "cleaning" | "maintenance";
  shape: "round" | "square" | "rectangle" | "booth";
  floor_number: number;
  zone: string;
  x_pos: number | null;
  y_pos: number | null;
}

/**
 * GET /orders/branch/:branchId/active
 */
interface OrderItem {
  id: string;
  status: string;
  menu_items: { name: string } | null;
}

interface ActiveOrder {
  id: string;
  status: string;
  created_at: string;
  tables: { label: string } | null;
  order_items: OrderItem[];
  total?: number;
}

/**
 * GET /queue/branch/:branchId
 * Returns PAGINATED: { data: QueueEntry[], total, page, limit }
 */
interface QueueEntry {
  id: string;
  position: number;
  guest_name: string | null;
  people_count: number;
  status: "waiting" | "arrived";
  created_at: string;
  users: { name: string | null; phone: string | null } | null;
}

interface PaginatedQueue {
  data: QueueEntry[];
  total: number;
  page: number;
  limit: number;
}

// AI INTEGRATION — Waiter Workload type
// GET /waiter-assignment/workloads?branch_id=
// From waiter-assignment.service.ts WaiterWorkload interface
interface WaiterWorkload {
  waiter_id: string;
  waiter_name: string;
  active_tables: number;
  active_orders: number;
  pending_serves: number; // order_items with status='ready' not yet served
  score: number;          // (active_tables × 3) + (active_orders × 1) + (pending_serves × 0.5)
}

// AI INTEGRATION — Inventory Alert type
// GET /inventory/branch/:branchId/alerts
// Returns normalizeInventoryItem[] — has .name, .quantity, .min_threshold, .unit
interface InventoryAlert {
  id: string;
  ingredient_name: string;
  name: string;            // alias of ingredient_name from normalizer
  unit: string;
  quantity: number;        // current_quantity coerced to number
  min_threshold: number;   // reorder_threshold coerced to number
  stock_ratio: number;
}

// AI INTEGRATION — Kitchen Performance type
// GET /reports/kitchen-performance?branch_id=&from=today&to=today
// Returned from get_kitchen_performance RPC. We read avg_prep_time_minutes.
interface KitchenPerfRow {
  avg_prep_time_minutes?: number;
  avg_prep_time?: number;    // fallback field name
  total_orders?: number;
  date?: string;
}

// ── Adapter: BranchTable → FloorTable ────────────────────────────────────────

const TABLE_DEFAULT_SIZE: Record<BranchTable["shape"], { w: number; h: number }> = {
  round:     { w: 64, h: 64 },
  square:    { w: 64, h: 64 },
  rectangle: { w: 112, h: 56 },
  booth:     { w: 80, h: 64 },
};

function toFloorTable(t: BranchTable, index: number): FloorTable {
  const size = TABLE_DEFAULT_SIZE[t.shape] ?? { w: 64, h: 64 };
  const col = index % 6;
  const row = Math.floor(index / 6);
  return {
    id: t.id,
    label: t.label,
    capacity: t.capacity,
    status: t.status,
    shape: t.shape === "booth" ? "rectangle" : t.shape,
    x: t.x_pos ?? 40 + col * 120,
    y: t.y_pos ?? 40 + row * 120,
    width: size.w,
    height: size.h,
  };
}

// ── Order Ticket Card ─────────────────────────────────────────────────────────

function OrderTicketCard({ order }: { order: ActiveOrder }) {
  const mins = elapsedMinutes(order.created_at);
  const isOverdue = mins > 20;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-2.5 transition",
        isOverdue
          ? "border-red-200 bg-red-50"
          : "border-gray-100 bg-white shadow-sm"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900">
            {order.tables?.label ?? "Takeaway"}
          </span>
          <StatusBadge status={order.status} size="sm" />
        </div>
        <span
          className={cn(
            "flex items-center gap-1 text-xs font-semibold",
            isOverdue ? "text-red-600" : "text-gray-500"
          )}
        >
          <Clock size={11} />
          {mins}m
          {isOverdue && " ⚠ overdue"}
        </span>
      </div>

      {/* Items */}
      <div className="space-y-1">
        {(order.order_items ?? []).slice(0, 3).map((item) => (
          <div key={item.id} className="flex items-center gap-2 text-xs text-gray-600">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                item.status === "ready"
                  ? "bg-green-500"
                  : item.status === "preparing"
                    ? "bg-amber-500"
                    : "bg-gray-300"
              )}
            />
            <span className="truncate">{item.menu_items?.name ?? "Item"}</span>
          </div>
        ))}
        {order.order_items.length > 3 && (
          <p className="text-xs text-gray-400 pl-3.5">
            +{order.order_items.length - 3} more
          </p>
        )}
      </div>

      {order.total !== undefined && (
        <p className="text-sm font-semibold text-[#1A3C5E]">
          {formatCurrency(order.total)}
        </p>
      )}
    </div>
  );
}

// ── Queue Feed Entry ──────────────────────────────────────────────────────────

function QueueFeedRow({ entry }: { entry: QueueEntry }) {
  const name = entry.guest_name ?? entry.users?.name ?? "Guest";
  const waitMins = elapsedMinutes(entry.created_at);

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1A3C5E]/10 text-xs font-bold text-[#1A3C5E]">
          {entry.position}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
          <p className="text-xs text-gray-400">
            {entry.people_count}p · {waitMins}m wait
          </p>
        </div>
      </div>
      <span
        className={cn(
          "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
          entry.status === "arrived"
            ? "bg-green-100 text-green-700"
            : "bg-amber-100 text-amber-700"
        )}
      >
        {entry.status}
      </span>
    </div>
  );
}

// AI INTEGRATION ─────────────────────────────────────────────────────────────
// Staff Workload Section
// Fetches GET /api/v1/waiter-assignment/workloads?branch_id={branchId}
// Auto-refreshes every 30 seconds (via refetchInterval).
// Spec: display table with Waiter Name | Tables | Active Orders | Pending Serves | Score
// Score color: 0-8 🟢, 9-15 🟡, 16+ 🔴

function workloadScoreEmoji(score: number): { emoji: string; colorClass: string } {
  if (score >= 16) return { emoji: "🔴", colorClass: "text-red-600 bg-red-50 border-red-200" };
  if (score >= 9)  return { emoji: "🟡", colorClass: "text-amber-700 bg-amber-50 border-amber-200" };
  return               { emoji: "🟢", colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200" };
}

function StaffWorkloadSection({ branchId }: { branchId: string }) {
  const {
    data: workloads = [],
    isLoading,
    isError,
    dataUpdatedAt,
    refetch,
  } = useQuery<WaiterWorkload[]>({
    queryKey: ["mgr", "workloads", branchId],
    queryFn: () =>
      apiClient.get<WaiterWorkload[]>(
        `/waiter-assignment/workloads?branch_id=${branchId}`
      ),
    enabled: !!branchId,
    refetchInterval: 30_000,  // auto-refresh every 30 s per spec
    staleTime: 0,
  });

  const lastRefreshed = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#1A3C5E]/8 flex items-center justify-center">
            <UserCheck size={15} className="text-[#1A3C5E]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Staff Workload</h2>
            {lastRefreshed && (
              <p className="text-[10px] text-gray-400">Updated {lastRefreshed} · refreshes every 30s</p>
            )}
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all"
          aria-label="Refresh workloads"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 px-3 py-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
          <AlertCircle size={13} />
          Failed to load workload data.
        </div>
      ) : workloads.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No waiters on duty</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Waiter Name
                </th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Tables
                </th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Active Orders
                </th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Pending Serves
                </th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {workloads.map((w) => {
                const { emoji, colorClass } = workloadScoreEmoji(w.score);
                return (
                  <tr key={w.waiter_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-2.5 px-2">
                      <span className="font-medium text-gray-800">{w.waiter_name}</span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="font-semibold text-gray-700">{w.active_tables}</span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="font-semibold text-gray-700">{w.active_orders}</span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={cn(
                          "font-semibold",
                          w.pending_serves > 0 ? "text-amber-600" : "text-gray-500"
                        )}
                      >
                        {w.pending_serves}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border",
                          colorClass
                        )}
                      >
                        {emoji} {w.score.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 flex-wrap">
            {[
              { emoji: "🟢", label: "Light (0–8)" },
              { emoji: "🟡", label: "Moderate (9–15)" },
              { emoji: "🔴", label: "Heavy — consider reassigning (16+)" },
            ].map(({ emoji, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <span>{emoji}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// AI INTEGRATION ─────────────────────────────────────────────────────────────
// Inventory Alert Section
// Fetches GET /api/v1/inventory/branch/{branchId}/alerts
// Listens for WS inventory_low events to trigger an instant re-fetch.
// Displays: "⚠️ 3 items running low: Chicken Breast, Basmati Rice, Cooking Oil"

function InventoryAlertSection({
  branchId,
  onRefetch,
}: {
  branchId: string;
  onRefetch?: (fn: () => void) => void;
}) {
  const {
    data: alerts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<InventoryAlert[]>({
    queryKey: ["mgr", "inventory-alerts", branchId],
    queryFn: () =>
      apiClient.get<InventoryAlert[]>(`/inventory/branch/${branchId}/alerts`),
    enabled: !!branchId,
    refetchInterval: 60_000,  // poll every 60 s; WS event also triggers instant refresh
    staleTime: 30_000,
  });

  // Expose refetch so parent can trigger on WS inventory_low event
  useEffect(() => {
    onRefetch?.(refetch);
  }, [refetch, onRefetch]);

  if (isLoading) {
    return (
      <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
    );
  }

  if (isError || alerts.length === 0) return null; // silent if no alerts

  const names = alerts
    .slice(0, 5)
    .map((a) => a.name ?? a.ingredient_name)
    .join(", ");

  const criticalCount = alerts.filter((a) => a.stock_ratio === 0).length;

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <Package size={16} className="text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">
          ⚠️ {alerts.length} item{alerts.length !== 1 ? "s" : ""} running low
        </p>
        <p className="text-xs text-amber-700 mt-0.5 truncate">
          {names}
          {alerts.length > 5 && ` and ${alerts.length - 5} more`}
        </p>
        {criticalCount > 0 && (
          <p className="text-xs text-red-600 font-semibold mt-1">
            🔴 {criticalCount} item{criticalCount > 1 ? "s" : ""} completely out of stock
          </p>
        )}
      </div>
      <a
        href="/staff/manager/inventory"
        className="text-xs font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap transition-colors shrink-0 mt-0.5"
      >
        Manage →
      </a>
    </div>
  );
}

// AI INTEGRATION ─────────────────────────────────────────────────────────────
// Kitchen Performance Quick Stat
// Fetches GET /api/v1/reports/kitchen-performance?branch_id=&from=today&to=today
// Displays: "Avg Prep Time: 18 min (Target: 15 min)" with color indicator
// green if avg ≤ target, amber if 1-5 min over, red if 6+ min over

const KITCHEN_PREP_TARGET_MINUTES = 15;

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

function KitchenPerformanceStat({ branchId }: { branchId: string }) {
  const today = getTodayDateString();

  const { data: perfRows = [], isLoading } = useQuery<KitchenPerfRow[]>({
    queryKey: ["mgr", "kitchen-perf", branchId, today],
    queryFn: () =>
      apiClient.get<KitchenPerfRow[]>(
        `/reports/kitchen-performance?branch_id=${branchId}&from=${today}&to=${today}`
      ),
    enabled: !!branchId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="h-10 w-56 rounded-lg bg-gray-100 animate-pulse" />
    );
  }

  // Aggregate avg_prep_time_minutes across all rows (the RPC may return per-item rows)
  const validRows = perfRows.filter(
    (r) =>
      (r.avg_prep_time_minutes ?? r.avg_prep_time) != null &&
      Number((r.avg_prep_time_minutes ?? r.avg_prep_time)) > 0
  );

  if (validRows.length === 0) return null;

  const avgMins = Math.round(
    validRows.reduce(
      (sum, r) => sum + Number(r.avg_prep_time_minutes ?? r.avg_prep_time ?? 0),
      0
    ) / validRows.length
  );

  const diff = avgMins - KITCHEN_PREP_TARGET_MINUTES;
  let colorClass: string;
  let Icon: typeof TrendingUp;

  if (diff <= 0) {
    colorClass = "text-emerald-700 bg-emerald-50 border-emerald-200";
    Icon = TrendingDown;
  } else if (diff <= 5) {
    colorClass = "text-amber-700 bg-amber-50 border-amber-200";
    Icon = TrendingUp;
  } else {
    colorClass = "text-red-700 bg-red-50 border-red-200";
    Icon = TrendingUp;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold",
        colorClass
      )}
    >
      <ChefHat size={13} />
      <span>
        Avg Prep Time:{" "}
        <span className="font-bold">{avgMins} min</span>
        {" "}
        <span className="font-normal opacity-70">(Target: {KITCHEN_PREP_TARGET_MINUTES} min)</span>
      </span>
      <Icon size={12} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManagerPage() {
  const { branchId } = useAuth();
  const qc = useQueryClient();
  const { on } = useRealtime({ branchId: branchId ?? "", role: "manager" });

  // AI INTEGRATION — hold ref to inventory refetch so WS event can trigger it
  const [inventoryRefetch, setInventoryRefetch] = useState<(() => void) | null>(null);

  const handleInventoryRefetch = useCallback((fn: () => void) => {
    setInventoryRefetch(() => fn);
  }, []);

  // ── Live Stats — GET /branches/:id/live-stats every 30 s ──────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<LiveStats>({
    queryKey: ["mgr", "live-stats", branchId],
    queryFn: () =>
      apiClient.get<LiveStats>(`/branches/${branchId}/live-stats`),
    enabled: !!branchId,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  // ── Tables — GET /tables/branch/:branchId every 30 s ─────────────────────
  const { data: tables = [], isLoading: tablesLoading } = useQuery<BranchTable[]>({
    queryKey: ["mgr", "tables", branchId],
    queryFn: () =>
      apiClient.get<BranchTable[]>(`/tables/branch/${branchId}`),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  // ── Active Orders — GET /orders/branch/:branchId/active every 15 s ───────
  const { data: orders = [], isLoading: ordersLoading } = useQuery<ActiveOrder[]>({
    queryKey: ["mgr", "orders", branchId],
    queryFn: () =>
      apiClient.get<ActiveOrder[]>(`/orders/branch/${branchId}/active`),
    enabled: !!branchId,
    refetchInterval: 15_000,
  });

  // ── Queue — GET /queue/branch/:branchId every 30 s ────────────────────────
  const { data: queuePage } = useQuery<PaginatedQueue>({
    queryKey: ["mgr", "queue", branchId],
    queryFn: () =>
      apiClient.get<PaginatedQueue>(`/queue/branch/${branchId}`),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });
  const queueEntries = queuePage?.data ?? [];

  // ── WebSocket invalidation ────────────────────────────────────────────────
  useEffect(() => {
    if (!branchId) return;
    const unsubs = [
      on(WS_EVENTS.TABLE_STATUS_CHANGED, () =>
        qc.invalidateQueries({ queryKey: ["mgr", "tables", branchId] })
      ),
      on(WS_EVENTS.ORDER_CREATED, () =>
        qc.invalidateQueries({ queryKey: ["mgr", "orders", branchId] })
      ),
      on(WS_EVENTS.ORDER_STATUS_UPDATED, () => {
        qc.invalidateQueries({ queryKey: ["mgr", "orders", branchId] });
        // AI INTEGRATION — order status changes affect waiter workload scores
        qc.invalidateQueries({ queryKey: ["mgr", "workloads", branchId] });
      }),
      on(WS_EVENTS.QUEUE_UPDATED, () =>
        qc.invalidateQueries({ queryKey: ["mgr", "queue", branchId] })
      ),
      // AI INTEGRATION — listen for inventory_low WS event and trigger instant alert refresh
      on(WS_EVENTS.INVENTORY_LOW, () => {
        qc.invalidateQueries({ queryKey: ["mgr", "inventory-alerts", branchId] });
        inventoryRefetch?.();
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [branchId, on, qc, inventoryRefetch]);

  // ── Derived values ────────────────────────────────────────────────────────
  const occupiedCount = stats?.tables?.occupied ?? 0;
  const overdueCount = orders.filter((o) => elapsedMinutes(o.created_at) > 20).length;
  const floorTables = tables.map(toFloorTable);

  return (
    <PageWrapper
      title="Manager Dashboard"
      subtitle="Live floor overview · updates every 15–30 seconds"
    >
      <div className="space-y-6">

        {/* ── KPI Row ─────────────────────────────────────────────────── */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonCard variant="stat" count={4} />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Tables Occupied"
              value={`${occupiedCount} / ${stats?.total_tables ?? 0}`}
              icon={<LayoutGrid size={18} />}
            />
            <KPICard
              title="Active Orders"
              value={stats?.active_orders ?? 0}
              icon={<ShoppingBag size={18} />}
              change={overdueCount > 0 ? `${overdueCount} overdue` : undefined}
              changeType={overdueCount > 0 ? "negative" : undefined}
            />
            <KPICard
              title="Staff On Duty"
              value={stats?.staff_on_duty ?? 0}
              icon={<Users size={18} />}
            />
            <KPICard
              title="Revenue Today"
              value={formatCurrency(stats?.revenue_today ?? 0)}
              icon={<IndianRupee size={18} />}
            />
          </div>
        )}

        {/* AI INTEGRATION ──────────────────────────────────────────────── */}
        {/* Inventory Alert Banner + Kitchen Performance quick stat         */}
        {/* Positioned: between KPI cards and the main grid, per spec       */}
        {branchId && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Inventory Alert — full width if kitchen stat not visible, else flex-1 */}
            <div className="flex-1">
              <InventoryAlertSection
                branchId={branchId}
                onRefetch={handleInventoryRefetch}
              />
            </div>
            {/* Kitchen Performance quick stat — right-aligned badge */}
            <div className="shrink-0">
              <KitchenPerformanceStat branchId={branchId} />
            </div>
          </div>
        )}
        {/* END AI INTEGRATION ─────────────────────────────────────────── */}

        {/* AI INTEGRATION ──────────────────────────────────────────────── */}
        {/* DemandPrediction widget                                         */}
        {/* REPOSITIONED: now below KPI cards, above floor map + orders    */}
        {/* Previously it was below Active Orders — this is the correct    */}
        {/* position per the product spec.                                  */}
        {branchId && (
          <DemandPrediction branchId={branchId} className="w-full" />
        )}
        {/* END AI INTEGRATION ─────────────────────────────────────────── */}

        {/* ── Main grid: Floor map + Event feed ──────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Floor Map — readOnly, manager can see status only */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Live Floor</h2>
              <span className="text-xs text-gray-400">
                {tables.length} tables · {occupiedCount} occupied
              </span>
            </div>
            {tablesLoading ? (
              <div className="skeleton h-64 rounded-lg" />
            ) : (
              <FloorMap
                tables={floorTables}
                branchId={branchId ?? ""}
                readOnly
              />
            )}
          </div>

          {/* Queue Event Feed */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Queue</h2>
              {queuePage?.total !== undefined && (
                <span className="text-xs font-semibold text-[#1A3C5E]">
                  {queuePage.total} waiting
                </span>
              )}
            </div>

            {queueEntries.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-400">Queue is empty</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-0 max-h-130">
                {queueEntries.map((entry) => (
                  <QueueFeedRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI INTEGRATION ──────────────────────────────────────────────── */}
        {/* Staff Workload Section                                           */}
        {/* Positioned: between floor map grid and active orders            */}
        {/* Auto-refreshes every 30 s; WS ORDER_STATUS_UPDATED also         */}
        {/* invalidates the workload query key (see useEffect above)        */}
        {branchId && (
          <StaffWorkloadSection branchId={branchId} />
        )}
        {/* END AI INTEGRATION ─────────────────────────────────────────── */}

        {/* ── Active Orders Grid ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Active Orders</h2>
            {overdueCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                <AlertCircle size={13} />
                {overdueCount} overdue (&gt;20 min)
              </span>
            )}
          </div>

          {ordersLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <SkeletonCard variant="card" count={3} />
            </div>
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No active orders
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {orders.map((order) => (
                <OrderTicketCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>

      </div>
    </PageWrapper>
  );
}