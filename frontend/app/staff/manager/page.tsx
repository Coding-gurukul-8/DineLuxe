"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  ShoppingBag,
  Users,
  IndianRupee,
  Clock,
  AlertCircle,
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
import { formatCurrency, elapsedMinutes, timeAgo, cn } from "@/lib/utils";
import DemandPrediction from "@/components/ai/DemandPrediction";

// ── Types ─────────────────────────────────────────────────────────────────────
// Actual backend shapes — not the ones described in the prompt.

/**
 * GET /branches/:id/live-stats
 * Returns: { tables: Record<string,number>, total_tables, active_orders,
 *            staff_on_duty, revenue_today }
 *
 * PROMPT WAS WRONG — it listed tables_total, tables_occupied, queue_length
 * which do NOT exist in the backend response. The correct fields are:
 *   tables.occupied  → occupied count (from the Record)
 *   total_tables     → total table count
 *   active_orders    → active order count
 *   revenue_today    → revenue computed from paid order_items today
 * There is no queue_length in live-stats; it requires a separate queue fetch.
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
 * Note: table_number does NOT exist — the column is `label`.
 *       x/y/width/height do NOT exist — columns are x_pos, y_pos (no dimensions stored).
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
 * Returns Order[] with nested order_items and tables.
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
 * The prompt incorrectly states it returns a bare QueueEntry[].
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

// ── Adapter: BranchTable → FloorTable ────────────────────────────────────────
// FloorMap expects { id, label, capacity, status, shape, x, y, width, height }
// DB stores x_pos/y_pos with no width/height — we use defaults so the map
// renders even for tables that haven't been positioned in the floor editor.

const TABLE_DEFAULT_SIZE: Record<BranchTable["shape"], { w: number; h: number }> = {
  round:     { w: 64, h: 64 },
  square:    { w: 64, h: 64 },
  rectangle: { w: 112, h: 56 },
  booth:     { w: 80, h: 64 },
};

function toFloorTable(t: BranchTable, index: number): FloorTable {
  const size = TABLE_DEFAULT_SIZE[t.shape] ?? { w: 64, h: 64 };
  // Spread tables in a grid when no position is saved
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManagerPage() {
  const { branchId } = useAuth();
  const qc = useQueryClient();
  const { on } = useRealtime({ branchId: branchId ?? "", role: "manager" });

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
  // Response is paginated: { data: QueueEntry[], total, ... }
  // Prompt incorrectly says it returns a bare QueueEntry[].
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
      on(WS_EVENTS.ORDER_STATUS_UPDATED, () =>
        qc.invalidateQueries({ queryKey: ["mgr", "orders", branchId] })
      ),
      on(WS_EVENTS.QUEUE_UPDATED, () =>
        qc.invalidateQueries({ queryKey: ["mgr", "queue", branchId] })
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [branchId, on, qc]);

  // ── Derived values ────────────────────────────────────────────────────────
  // live-stats.tables is a Record<status, count> — NOT a simple number.
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

        {/* ── Main grid: Floor map + Event feed ──────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Floor Map — readOnly, manager can see status only (edit via floor editor) */}
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

        {/* ── AI Demand Prediction ─────────────────────────────────── */}
        {branchId && (
          <div className="mt-2">
            <DemandPrediction branchId={branchId} className="w-full" />
          </div>
        )}

      </div>
    </PageWrapper>
  );
}