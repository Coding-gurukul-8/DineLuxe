"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  LayoutGrid,
  ChevronRight,
  Loader2,
  CalendarDays,
  AlertCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { FloorMap, type FloorTable } from "@/components/floor/FloorMap";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import PageWrapper from "@/components/layout/PageWrapper";
import { WS_EVENTS } from "@/lib/constants";
import { cn, elapsedMinutes, formatTime } from "@/lib/utils";
import { useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * GET /tables/branch/:branchId
 * DB columns: id, label, capacity, status, shape, floor_number, zone, x_pos, y_pos
 * PROMPT WAS WRONG — "table_number", "x", "y", "width", "height", "floor"
 * do NOT exist. Correct fields: label, x_pos, y_pos, floor_number, zone.
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
 * GET /queue/branch/:branchId
 * Returns PAGINATED: { data: QueueEntry[], total, page, limit }
 * PROMPT WAS WRONG — it says "returns QueueEntry[]" (bare array). It does not.
 */
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

/**
 * GET /bookings/branch/:branchId
 * Returns PAGINATED: { data: Booking[], total, page, limit }
 * PROMPT WAS WRONG — it says "returns Booking[]". It does not.
 * Booking status: 'pending' | 'confirmed' | 'arrived' | 'seated' | 'no_show' | 'cancelled'
 */
interface Booking {
  id: string;
  arrival_time: string;
  party_size: number;
  status: "pending" | "confirmed" | "arrived" | "seated" | "no_show" | "cancelled";
  special_requests: string | null;
  users: { name: string | null; phone: string | null } | null;
  tables: { label: string } | null;
}

interface PaginatedBookings {
  data: Booking[];
  total: number;
  page: number;
  limit: number;
}

// ── Table → FloorTable adapter ────────────────────────────────────────────────

const TABLE_SIZE: Record<BranchTable["shape"], { w: number; h: number }> = {
  round:     { w: 64, h: 64 },
  square:    { w: 64, h: 64 },
  rectangle: { w: 112, h: 56 },
  booth:     { w: 80, h: 64 },
};

function toFloorTable(t: BranchTable, index: number): FloorTable {
  const { w, h } = TABLE_SIZE[t.shape] ?? { w: 64, h: 64 };
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
    width: w,
    height: h,
  };
}

// ── Table Picker Modal ────────────────────────────────────────────────────────

function TablePickerModal({
  tables,
  partySize,
  onPick,
  onClose,
  isPending,
}: {
  tables: BranchTable[];
  partySize: number;
  onPick: (tableId: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const available = tables.filter((t) => t.status === "free");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Assign Table</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Party of {partySize} · {available.length} tables available
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Table grid */}
        <div className="p-4 max-h-72 overflow-y-auto">
          {available.length === 0 ? (
            <div className="py-10 text-center">
              <LayoutGrid size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No free tables right now</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {available.map((t) => {
                const fits = t.capacity >= partySize;
                return (
                  <button
                    key={t.id}
                    onClick={() => fits && onPick(t.id)}
                    disabled={!fits || isPending}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border-2 py-4 gap-1 transition",
                      fits
                        ? "border-green-300 bg-green-50 hover:bg-green-100 text-green-800"
                        : "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-60"
                    )}
                    title={!fits ? `Only ${t.capacity} seats` : `Assign to ${t.label}`}
                  >
                    <span className="font-bold text-base">{t.label}</span>
                    <span className="text-xs flex items-center gap-1">
                      <Users size={10} />
                      {t.capacity}
                    </span>
                    {!fits && (
                      <span className="text-[10px] text-gray-400">too small</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Queue Entry Card ──────────────────────────────────────────────────────────

function QueueEntryCard({
  entry,
  tables,
  onAction,
}: {
  entry: QueueEntry;
  tables: BranchTable[];
  onAction: () => void;
}) {
  const qc = useQueryClient();
  const { branchId } = useAuth();
  const [showTablePicker, setShowTablePicker] = useState(false);

  const name = entry.guest_name ?? entry.users?.name ?? "Guest";
  const phone = entry.guest_phone ?? entry.users?.phone ?? null;
  const waitMins = elapsedMinutes(entry.created_at);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["host", "queue", branchId] });
    qc.invalidateQueries({ queryKey: ["host", "tables", branchId] });
    onAction();
  };

  const { mutate: markArrived, isPending: arriving } = useMutation({
    mutationFn: () => apiClient.patch(`/queue/${entry.id}/arrive`, {}),
    onSuccess: () => { toast.success(`${name} marked as arrived`); invalidate(); },
    onError: () => toast.error("Failed to mark arrived"),
  });

  const { mutate: markNoShow, isPending: noShowing } = useMutation({
    mutationFn: () => apiClient.patch(`/queue/${entry.id}/no-show`, {}),
    onSuccess: () => { toast.success(`${name} marked as no-show`); invalidate(); },
    onError: () => toast.error("Failed to mark no-show"),
  });

  // PATCH /queue/:id/assign-table body: { table_id }
  const { mutate: assignTable, isPending: assigning } = useMutation({
    mutationFn: (tableId: string) =>
      apiClient.patch(`/queue/${entry.id}/assign-table`, { table_id: tableId }),
    onSuccess: () => {
      toast.success(`${name} seated`);
      setShowTablePicker(false);
      invalidate();
    },
    onError: () => toast.error("Failed to assign table"),
  });

  const anyPending = arriving || noShowing || assigning;

  return (
    <>
      <div
        className={cn(
          "bg-white rounded-xl border p-4 space-y-3 shadow-sm transition",
          entry.status === "arrived" && "border-green-200 bg-green-50/50"
        )}
      >
        {/* Position badge + name */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1A3C5E] text-sm font-bold text-white">
              {entry.position}
            </span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{name}</p>
              {phone && (
                <p className="text-xs text-gray-400">{phone}</p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold text-gray-500 flex items-center gap-1 justify-end">
              <Users size={11} /> {entry.people_count}
            </p>
            <p
              className={cn(
                "text-xs font-medium mt-0.5 flex items-center gap-1 justify-end",
                waitMins > 20 ? "text-red-500" : "text-gray-400"
              )}
            >
              <Clock size={11} /> {waitMins}m
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
              entry.status === "arrived"
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            )}
          >
            {entry.status}
          </span>
          {waitMins > 20 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500">
              <AlertCircle size={10} /> Long wait
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          {entry.status === "waiting" && (
            <button
              onClick={() => markArrived()}
              disabled={anyPending}
              className="flex items-center justify-center gap-1 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              {arriving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Arrived
            </button>
          )}
          <button
            onClick={() => setShowTablePicker(true)}
            disabled={anyPending}
            className="flex items-center justify-center gap-1 py-2 rounded-lg bg-[#1A3C5E] text-white text-xs font-semibold hover:bg-[#15304d] transition disabled:opacity-50"
          >
            {assigning ? <Loader2 size={12} className="animate-spin" /> : <LayoutGrid size={12} />}
            Seat
          </button>
          <button
            onClick={() => {
              if (confirm(`Mark ${name} as no-show?`)) markNoShow();
            }}
            disabled={anyPending}
            className="flex items-center justify-center gap-1 py-2 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition disabled:opacity-50"
          >
            {noShowing ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
            No Show
          </button>
        </div>
      </div>

      {showTablePicker && (
        <TablePickerModal
          tables={tables}
          partySize={entry.people_count}
          onPick={(tableId) => assignTable(tableId)}
          onClose={() => setShowTablePicker(false)}
          isPending={assigning}
        />
      )}
    </>
  );
}

// ── Booking Row ───────────────────────────────────────────────────────────────

const BOOKING_STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  arrived:   "bg-teal-100 text-teal-700",
  seated:    "bg-green-100 text-green-700",
  no_show:   "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

function BookingRow({ booking }: { booking: Booking }) {
  const qc = useQueryClient();
  const { branchId } = useAuth();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["host", "bookings", branchId] });

  // PATCH /bookings/:id/arrived
  const { mutate: markArrived, isPending: arriving } = useMutation({
    mutationFn: () => apiClient.patch(`/bookings/${booking.id}/arrived`, {}),
    onSuccess: () => { toast.success("Guest marked as arrived"); invalidate(); },
    onError: () => toast.error("Failed to update booking"),
  });

  // PATCH /bookings/:id/seat
  const { mutate: markSeated, isPending: seating } = useMutation({
    mutationFn: () => apiClient.patch(`/bookings/${booking.id}/seat`, {}),
    onSuccess: () => { toast.success("Guest seated"); invalidate(); },
    onError: () => toast.error("Failed to seat guest"),
  });

  // PATCH /bookings/:id/no-show
  const { mutate: markNoShow, isPending: noShowing } = useMutation({
    mutationFn: () => apiClient.patch(`/bookings/${booking.id}/no-show`, {}),
    onSuccess: () => { toast.success("Marked as no-show"); invalidate(); },
    onError: () => toast.error("Failed to update booking"),
  });

  const name = booking.users?.name ?? "Guest";
  const phone = booking.users?.phone ?? null;
  const anyPending = arriving || seating || noShowing;
  const isDone = ["seated", "no_show", "cancelled"].includes(booking.status);

  return (
    <div
      className={cn(
        "bg-white rounded-xl border p-4 space-y-3 shadow-sm",
        isDone && "opacity-60"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{name}</p>
          {phone && <p className="text-xs text-gray-400">{phone}</p>}
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <Clock size={10} />
            {formatTime(booking.arrival_time)}
            <span className="ml-1 flex items-center gap-0.5">
              <Users size={10} /> {booking.party_size}
            </span>
          </p>
        </div>
        <span
          className={cn(
            "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
            BOOKING_STATUS_STYLES[booking.status] ?? "bg-gray-100 text-gray-500"
          )}
        >
          {booking.status.replace("_", " ")}
        </span>
      </div>

      {booking.tables && (
        <p className="text-xs text-gray-500">
          Table: <span className="font-semibold">{booking.tables.label}</span>
        </p>
      )}

      {booking.special_requests && (
        <p className="text-xs text-gray-400 italic line-clamp-1">
          "{booking.special_requests}"
        </p>
      )}

      {/* Actions — only shown for actionable statuses */}
      {!isDone && (
        <div className="flex gap-1.5">
          {booking.status === "confirmed" && (
            <button
              onClick={() => markArrived()}
              disabled={anyPending}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition disabled:opacity-50"
            >
              {arriving ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
              Arrived
            </button>
          )}
          {booking.status === "arrived" && (
            <button
              onClick={() => markSeated()}
              disabled={anyPending}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              {seating ? <Loader2 size={11} className="animate-spin" /> : <ChevronRight size={11} />}
              Seat
            </button>
          )}
          <button
            onClick={() => {
              if (confirm(`Mark ${name}'s booking as no-show?`)) markNoShow();
            }}
            disabled={anyPending}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition disabled:opacity-50"
          >
            {noShowing ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
            No Show
          </button>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HostPage() {
  const { branchId } = useAuth();
  const qc = useQueryClient();
  const { on, joinRoom } = useRealtime();

  // ── Queue — paginated, refetch every 20 s ─────────────────────────────────
  const {
    data: queuePage,
    isLoading: queueLoading,
    isError: queueError,
    refetch: refetchQueue,
  } = useQuery<PaginatedQueue>({
    queryKey: ["host", "queue", branchId],
    queryFn: () =>
      apiClient.get<PaginatedQueue>(`/queue/branch/${branchId}`),
    enabled: !!branchId,
    refetchInterval: 20_000,
    staleTime: 0,
  });
  const queueEntries = queuePage?.data ?? [];

  // ── Bookings — today, refetch every 60 s ──────────────────────────────────
  const {
    data: bookingsPage,
    isLoading: bookingsLoading,
    isError: bookingsError,
    refetch: refetchBookings,
  } = useQuery<PaginatedBookings>({
    queryKey: ["host", "bookings", branchId],
    // Backend ignores ?date=today — it always filters to current day server-side
    queryFn: () =>
      apiClient.get<PaginatedBookings>(`/bookings/branch/${branchId}`),
    enabled: !!branchId,
    refetchInterval: 60_000,
  });
  const bookings = bookingsPage?.data ?? [];

  // ── Tables — refetch every 20 s ───────────────────────────────────────────
  const {
    data: tables = [],
    isLoading: tablesLoading,
  } = useQuery<BranchTable[]>({
    queryKey: ["host", "tables", branchId],
    queryFn: () =>
      apiClient.get<BranchTable[]>(`/tables/branch/${branchId}`),
    enabled: !!branchId,
    refetchInterval: 20_000,
  });

  // ── WebSocket — instant invalidation on queue/table events ───────────────
  useEffect(() => {
    if (!branchId) return;
    joinRoom(`branch:${branchId}:host`);
    const unsubs = [
      on(WS_EVENTS.QUEUE_UPDATED, () =>
        qc.invalidateQueries({ queryKey: ["host", "queue", branchId] })
      ),
      on(WS_EVENTS.TABLE_STATUS_CHANGED, () =>
        qc.invalidateQueries({ queryKey: ["host", "tables", branchId] })
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [branchId, on, joinRoom, qc]);

  const floorTables = tables.map(toFloorTable);
  const freeTables = tables.filter((t) => t.status === "free").length;
  const activeBookings = bookings.filter(
    (b) => !["seated", "no_show", "cancelled"].includes(b.status)
  );

  return (
    <PageWrapper
      title="Host Station"
      subtitle="Queue management, bookings, and floor status"
    >
      {/* No branch guard */}
      {!branchId && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertCircle size={16} />
          No branch assigned. Please contact your manager.
        </div>
      )}

      {branchId && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ── LEFT: Queue ──────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Walk-in Queue
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {queuePage?.total ?? 0} waiting ·{" "}
                  {queueEntries.filter((e) => e.status === "arrived").length} arrived
                </p>
              </div>
            </div>

            {queueLoading && <SkeletonCard variant="card" count={3} />}

            {queueError && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-sm text-gray-500">Failed to load queue</p>
                <button
                  onClick={() => refetchQueue()}
                  className="text-xs text-[#1A3C5E] underline"
                >
                  Retry
                </button>
              </div>
            )}

            {!queueLoading && !queueError && queueEntries.length === 0 && (
              <div className="py-12 text-center rounded-xl border border-dashed border-gray-200">
                <Users size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Queue is empty</p>
              </div>
            )}

            {!queueLoading && !queueError && (
              <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                {queueEntries.map((entry) => (
                  <QueueEntryCard
                    key={entry.id}
                    entry={entry}
                    tables={tables}
                    onAction={() =>
                      qc.invalidateQueries({
                        queryKey: ["host", "queue", branchId],
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── MIDDLE: Bookings ─────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Today's Bookings
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {bookingsPage?.total ?? 0} total ·{" "}
                  {activeBookings.length} pending action
                </p>
              </div>
              <CalendarDays size={16} className="text-gray-400" />
            </div>

            {bookingsLoading && <SkeletonCard variant="card" count={3} />}

            {bookingsError && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-sm text-gray-500">Failed to load bookings</p>
                <button
                  onClick={() => refetchBookings()}
                  className="text-xs text-[#1A3C5E] underline"
                >
                  Retry
                </button>
              </div>
            )}

            {!bookingsLoading && !bookingsError && bookings.length === 0 && (
              <div className="py-12 text-center rounded-xl border border-dashed border-gray-200">
                <CalendarDays size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No bookings today</p>
              </div>
            )}

            {!bookingsLoading && !bookingsError && (
              <div className="space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                {/* Active bookings first */}
                {activeBookings.map((b) => (
                  <BookingRow key={b.id} booking={b} />
                ))}
                {/* Completed/done bookings — dimmed */}
                {bookings
                  .filter((b) =>
                    ["seated", "no_show", "cancelled"].includes(b.status)
                  )
                  .map((b) => (
                    <BookingRow key={b.id} booking={b} />
                  ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Floor map ──────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Floor Status
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {freeTables} of {tables.length} tables free
                </p>
              </div>
              <LayoutGrid size={16} className="text-gray-400" />
            </div>

            {tablesLoading ? (
              <div className="skeleton h-64 w-full rounded-xl" />
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                <FloorMap
                  tables={floorTables}
                  branchId={branchId}
                  readOnly
                  onTableClick={(t) => {
                    // Read-only hint — clicking shows table info via toast
                    toast.info(
                      `Table ${t.label} · ${t.status} · ${t.capacity} seats`
                    );
                  }}
                />
              </div>
            )}

            {/* Table status summary pills */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["free", "Free", "bg-green-100 text-green-700"],
                  ["occupied", "Occupied", "bg-red-100 text-red-700"],
                  ["reserved", "Reserved", "bg-amber-100 text-amber-700"],
                  ["cleaning", "Cleaning", "bg-gray-100 text-gray-600"],
                ] as const
              ).map(([status, label, cls]) => {
                const count = tables.filter((t) => t.status === status).length;
                return (
                  <span
                    key={status}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                      cls
                    )}
                  >
                    {label}
                    <span className="font-bold">{count}</span>
                  </span>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </PageWrapper>
  );
}