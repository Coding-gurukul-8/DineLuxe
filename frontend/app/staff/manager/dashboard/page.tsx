"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  ShoppingCart,
  Clock,
  RefreshCw,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { KPICard } from "@/components/shared/KPICard";
import { FloorMap, type FloorTable } from "@/components/floor/FloorMap";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { useTableStatus } from "@/hooks/useTableStatus";
import { formatCurrency, elapsedMinutes, formatTime, cn } from "@/lib/utils";

interface KPIData {
  activeTables: number;
  activeOrders: number;
  revenue: number;
  avgWaitTime: number;
}

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

interface Booking {
  id: string;
  customer_name?: string;
  people_count: number;
  arrival_time: string;
  special_requests: string | null;
  status: "pending" | "confirmed" | "arrived" | "seated" | "no_show" | "cancelled";
  table?: { label: string } | null;
}

interface QueueEntry {
  id: string;
  position: number;
  guest_name: string | null;
  guest_phone: string | null;
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

interface ActiveOrder {
  id: string;
  status: string;
  created_at: string;
  tables: { label: string } | null;
  order_items: Array<{
    id: string;
    status: string;
    menu_items: { name: string } | null;
  }>;
  total?: number;
}

const TABLE_DEFAULT_SIZE: Record<BranchTable["shape"], { w: number; h: number }> = {
  round: { w: 64, h: 64 },
  square: { w: 64, h: 64 },
  rectangle: { w: 112, h: 56 },
  booth: { w: 80, h: 64 },
};

function toFloorTable(table: BranchTable, index: number): FloorTable {
  const size = TABLE_DEFAULT_SIZE[table.shape] ?? { w: 64, h: 64 };
  const col = index % 6;
  const row = Math.floor(index / 6);
  return {
    id: table.id,
    label: table.label,
    capacity: table.capacity,
    status: table.status,
    shape: table.shape === "booth" ? "rectangle" : table.shape,
    x: table.x_pos ?? 40 + col * 120,
    y: table.y_pos ?? 40 + row * 120,
    width: size.w,
    height: size.h,
  };
}

function LiveEventFeed({ branchId }: { branchId: string }) {
  const [events, setEvents] = useState<Array<{ id: string; type: string; message: string; at: string }>>([]);
  const { on } = useRealtime({ branchId, role: "manager" });

  useEffect(() => {
    const unsub1 = on<any>("order:new", (p) =>
      setEvents((ev) =>
        [{ id: p.id ?? String(Date.now()), type: "order", message: `New order #${p.order_number ?? "—"}`, at: new Date().toLocaleTimeString() }, ...ev].slice(0, 15)
      )
    );
    const unsub2 = on<any>("table:status", (p) =>
      setEvents((ev) =>
        [{ id: String(Date.now()), type: "table", message: `Table ${p.tableId ?? p.table_number ?? "—"} updated`, at: new Date().toLocaleTimeString() }, ...ev].slice(0, 15)
      )
    );
    const unsub3 = on<any>("booking:new", (p) =>
      setEvents((ev) =>
        [{ id: p.id ?? String(Date.now()), type: "booking", message: `Booking: ${p.customer_name ?? p.users?.name ?? "Guest"} (${p.party_size ?? p.people_count ?? "?"} guests)`, at: new Date().toLocaleTimeString() }, ...ev].slice(0, 15)
      )
    );
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [on]);

  const typeStyle: Record<string, string> = {
    order: "border-l-[#E8A020] bg-[#E8A020]/5",
    table: "border-l-[#1A3C5E] bg-[#1A3C5E]/5",
    booking: "border-l-emerald-400 bg-emerald-50/60",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Live Events</h3>
        <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>
      <div className="space-y-1.5 overflow-y-auto max-h-85 scrollbar-none">
        <AnimatePresence initial={false}>
          {events.length === 0 && <p className="text-xs text-gray-400 text-center py-8">No events yet…</p>}
          {events.map((ev) => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, x: 12, backgroundColor: "#fef3c7" }}
              animate={{ opacity: 1, x: 0, backgroundColor: "transparent" }}
              transition={{ duration: 0.35 }}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs border-l-2",
                typeStyle[ev.type] ?? "border-l-gray-200 bg-gray-50"
              )}
            >
              <span className="font-medium text-gray-700 truncate">{ev.message}</span>
              <span className="text-[10px] text-gray-400 font-mono ml-2 shrink-0">{ev.at}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BookingTimeline({ bookings }: { bookings: Booking[] }) {
  const hourStart = 10;
  const hourEnd = 23;
  const totalMinutes = (hourEnd - hourStart) * 60;
  const now = new Date();
  const nowMinutes = (now.getHours() - hourStart) * 60 + now.getMinutes();
  const nowPct = Math.max(0, Math.min(100, (nowMinutes / totalMinutes) * 100));

  const statusColors: Record<string, string> = {
    confirmed: "bg-[#1A3C5E] text-white",
    arrived: "bg-[#E8A020] text-white",
    seated: "bg-[#E8A020] text-white",
    pending: "bg-slate-300 text-slate-700",
    completed: "bg-gray-300 text-gray-600",
    cancelled: "bg-red-200 text-red-700 opacity-50",
    no_show: "bg-red-200 text-red-700 opacity-50",
  };

  const toMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return (h - hourStart) * 60 + m;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">Today's Booking Timeline</h3>
      <div className="relative">
        <div className="flex mb-2">
          {Array.from({ length: hourEnd - hourStart + 1 }, (_, i) => i + hourStart).map((h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-gray-400 font-mono">{h}h</div>
          ))}
        </div>

        <div className="relative h-20 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
          {nowMinutes >= 0 && nowMinutes <= totalMinutes && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-20" style={{ left: `${nowPct}%` }}>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-400" />
            </div>
          )}

          {bookings.map((b) => {
            const startMin = toMinutes(b.arrival_time);
            const durMin = 90;
            const left = (startMin / totalMinutes) * 100;
            const width = (durMin / totalMinutes) * 100;
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                style={{
                  left: `${Math.max(0, left)}%`,
                  width: `${Math.min(100 - left, width)}%`,
                  top: "20%",
                  height: "60%",
                  originX: 0,
                }}
                className={cn(
                  "absolute rounded-lg px-1.5 overflow-hidden flex items-center",
                  statusColors[b.status] ?? "bg-gray-200"
                )}
                title={`${b.customer_name ?? b.table?.label ?? "Guest"} — ${b.people_count} guests @ ${b.arrival_time}`}
              >
                <span className="text-[9px] font-semibold truncate">
                  {(b.customer_name ?? b.table?.label ?? "Guest").split(" ")[0]} ({b.people_count})
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ManagerDashboardPage() {
  const { branchId } = useAuth();
  const qc = useQueryClient();
  const { on } = useRealtime({ branchId: branchId ?? "", role: "manager" });
  const { tableStatuses } = useTableStatus({ branchId: branchId ?? "", role: "manager" });

  const { data: kpi, isLoading: kpiLoading, refetch: refetchKpi } = useQuery<KPIData>({
    queryKey: ["manager", "kpi", branchId],
    queryFn: () => apiClient.get<KPIData>(`/analytics/branch-kpi${branchId ? `?branch_id=${branchId}` : ""}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: !!branchId,
  });

  const { data: tables = [], isLoading: tablesLoading, refetch: refetchTables } = useQuery<BranchTable[]>({
    queryKey: ["manager", "tables", branchId],
    queryFn: () => apiClient.get<BranchTable[]>(`/tables/branch/${branchId}`),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery<ActiveOrder[]>({
    queryKey: ["manager", "orders", branchId],
    queryFn: () => apiClient.get<ActiveOrder[]>(`/orders/branch/${branchId}/active`),
    enabled: !!branchId,
    refetchInterval: 15_000,
  });

  const { data: queuePage } = useQuery<PaginatedQueue>({
    queryKey: ["manager", "queue", branchId],
    queryFn: () => apiClient.get<PaginatedQueue>(`/queue/branch/${branchId}`),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["manager", "bookings", branchId],
    queryFn: () => apiClient.get<Booking[]>(`/bookings/branch/${branchId}`),
    enabled: !!branchId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!branchId) return;
    const unsubs = [
      on("table:status", () => qc.invalidateQueries({ queryKey: ["manager", "tables", branchId] })),
      on("table:status_changed", () => qc.invalidateQueries({ queryKey: ["manager", "tables", branchId] })),
      on("order:new", () => qc.invalidateQueries({ queryKey: ["manager", "orders", branchId] })),
      on("order:updated", () => qc.invalidateQueries({ queryKey: ["manager", "orders", branchId] })),
      on("booking:new", () => qc.invalidateQueries({ queryKey: ["manager", "bookings", branchId] })),
      on("booking:updated", () => qc.invalidateQueries({ queryKey: ["manager", "bookings", branchId] })),
      on("queue:updated", () => qc.invalidateQueries({ queryKey: ["manager", "queue", branchId] })),
    ];
    return () => unsubs.forEach((u) => u());
  }, [branchId, on, qc]);

  const floorTables = useMemo(() => tables.map(toFloorTable), [tables]);
  const occupiedCount = kpi?.activeTables ?? 0;

  const sparkRevenue = Array.from({ length: 7 }, (_, i) => ({
    v: (kpi?.revenue ?? 10000) * (0.6 + ((i + 1) / 10)),
  }));

  const queueEntries = queuePage?.data ?? [];
  const overdueCount = orders.filter((o) => elapsedMinutes(o.created_at) > 20).length;

  return (
    <PageWrapper title="Manager Dashboard" subtitle="Live floor overview · updates every 15–30 seconds">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">Operations</p>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "Playfair Display, serif" }}>
              Manager Dashboard
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <button
            onClick={() => {
              refetchKpi();
              refetchTables();
              refetchOrders();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiLoading ? (
            <SkeletonCard variant="stat" count={4} />
          ) : (
            <>
              <KPICard
                title="Active Tables"
                value={kpi?.activeTables ?? occupiedCount}
                trend={0}
                icon={<Users size={18} />}
              />
              <KPICard
                title="Active Orders"
                value={kpi?.activeOrders ?? 0}
                trend={8.2}
                trendLabel={overdueCount > 0 ? `${overdueCount} overdue` : "vs yesterday"}
                icon={<ShoppingCart size={18} />}
              />
              <KPICard
                title="Revenue Today"
                value={kpi?.revenue ?? 0}
                prefix="$"
                formatValue={(n) => (n / 100).toFixed(0)}
                trend={5.1}
                sparklineData={sparkRevenue}
                icon={<Zap size={18} />}
              />
              <KPICard
                title="Avg Wait Time"
                value={kpi?.avgWaitTime ?? 0}
                suffix=" min"
                trend={-3.2}
                trendLabel="vs yesterday"
                icon={<Clock size={18} />}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
              <FloorMap tables={floorTables} branchId={branchId ?? ""} readOnly />
            )}
          </div>

          <LiveEventFeed branchId={branchId ?? ""} />
        </div>

        <BookingTimeline bookings={bookings} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Active Orders</h2>
              {overdueCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
                  <Clock size={13} />
                  {overdueCount} overdue (&gt;20 min)
                </span>
              )}
            </div>

            {ordersLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <SkeletonCard variant="card" count={3} />
              </div>
            ) : orders.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No active orders</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{order.tables?.label ?? "Takeaway"}</span>
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                          {order.status}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-semibold text-gray-500">
                        <Clock size={11} />
                        {elapsedMinutes(order.created_at)}m
                      </span>
                    </div>
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
                    </div>
                    {order.total !== undefined && (
                      <p className="text-sm font-semibold text-[#1A3C5E]">{formatCurrency(order.total)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Queue</h2>
              {queuePage?.total !== undefined && <span className="text-xs font-semibold text-[#1A3C5E]">{queuePage.total} waiting</span>}
            </div>

            {queueEntries.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-gray-400">Queue is empty</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-0 max-h-130">
                {queueEntries.map((entry) => {
                  const name = entry.guest_name ?? entry.users?.name ?? "Guest";
                  const waitMins = elapsedMinutes(entry.created_at);
                  return (
                    <div key={entry.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1A3C5E]/10 text-xs font-bold text-[#1A3C5E]">{entry.position}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                          <p className="text-xs text-gray-400">{entry.people_count}p · {waitMins}m wait</p>
                        </div>
                      </div>
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0", entry.status === "arrived" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>{entry.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}