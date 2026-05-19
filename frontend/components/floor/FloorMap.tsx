"use client";

/**
 * components/floor/FloorMap.tsx
 *
 * CHANGES FROM ORIGINAL:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. FloorTable interface corrected to match what callers pass after mapping
 *    from DB columns (x_pos/y_pos → x/y; width/height with defaults).
 *    The original used the same interface — kept compatible.
 *
 * 2. TABLE_STATUS_COLORS — original referenced the constants map but the DB
 *    status values are 'free'|'occupied'|'reserved'|'cleaning'|'maintenance'.
 *    The legend now maps all five values including 'maintenance'.
 *
 * 3. readOnly=true no longer wraps tables in DndContext at all, avoiding the
 *    DragOverlay + mutation wiring for view-only consumers (manager, host).
 *
 * 4. onTableClick is correctly forwarded in both readOnly and draggable modes.
 *
 * 5. DraggableTable click handler: original had a bug where the click event
 *    fired on every drag-end because DnD listeners consume pointerdown.
 *    Fixed by checking delta distance before treating as a click.
 *
 * 6. Canvas height is controlled via `height` prop (default 520px) so
 *    consumers can adapt to their layout without CSS overrides.
 */

import { useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  DragOverlay,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { apiClient } from "@/lib/api-client";
import { TABLE_STATUS_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * FloorTable is what FloorMap receives — callers must adapt DB rows to this
 * shape before passing them in (see toFloorTable adapter in manager/host pages).
 *
 * DB row columns:       FloorTable field:
 *   label           →  label
 *   x_pos           →  x
 *   y_pos           →  y
 *   (no DB column)  →  width  (caller provides default by shape)
 *   (no DB column)  →  height (caller provides default by shape)
 *   shape           →  shape  ('booth' is normalised to 'rectangle' by caller)
 */
export interface FloorTable {
  id: string;
  label: string;
  capacity: number;
  status: "free" | "occupied" | "reserved" | "cleaning" | "maintenance";
  shape: "round" | "square" | "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FloorMapProps {
  tables: FloorTable[];
  branchId: string;
  readOnly?: boolean;
  /** Called when a table shape is clicked in both readOnly and draggable modes */
  onTableClick?: (table: FloorTable) => void;
  /** Canvas height in pixels (default: 520) */
  height?: number;
}

// ── Status colour map ─────────────────────────────────────────────────────────
// Pulls from constants so the palette is defined in one place.
// Falls back to a neutral grey for any unlisted status.

function statusColor(status: string): string {
  return (
    TABLE_STATUS_COLORS[status as keyof typeof TABLE_STATUS_COLORS] ?? "#7F8C8D"
  );
}

// ── Table shape renderer ──────────────────────────────────────────────────────

function TableShape({
  table,
  onClick,
  style,
  isDragging,
  className,
}: {
  table: FloorTable;
  onClick?: () => void;
  style?: React.CSSProperties;
  isDragging?: boolean;
  className?: string;
}) {
  const color = statusColor(table.status);
  const isRound = table.shape === "round";

  return (
    <div
      onClick={onClick}
      style={{
        width: table.width,
        height: table.height,
        backgroundColor: color + "22",
        borderColor: color,
        borderWidth: 2,
        borderRadius: isRound ? "50%" : 8,
        opacity: isDragging ? 0.35 : 1,
        cursor: onClick ? "pointer" : "default",
        transition: "opacity 0.15s",
        ...style,
      }}
      className={cn(
        "flex flex-col items-center justify-center select-none",
        onClick && "hover:scale-105 transition-transform",
        className
      )}
      role={onClick ? "button" : undefined}
      aria-label={
        onClick
          ? `Table ${table.label}, ${table.status}, ${table.capacity} seats`
          : undefined
      }
    >
      <span className="text-xs font-bold text-gray-800 leading-tight">
        {table.label}
      </span>
      <span className="text-[10px] text-gray-500">{table.capacity}p</span>
    </div>
  );
}

// ── Draggable table wrapper ───────────────────────────────────────────────────

function DraggableTable({
  table,
  onClick,
}: {
  table: FloorTable;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: table.id });

  // Distinguish a click from a drag: if the transform distance is tiny
  // (≤ 4 px) treat it as a tap — DnD still fires dragEnd on mouseup.
  const handleClick = useCallback(() => {
    if (!onClick) return;
    const moved =
      Math.abs(transform?.x ?? 0) + Math.abs(transform?.y ?? 0);
    if (moved <= 4) onClick();
  }, [onClick, transform]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        position: "absolute",
        left: table.x,
        top: table.y,
        transform: CSS.Translate.toString(transform),
        touchAction: "none",
      }}
    >
      <TableShape
        table={{ ...table, x: 0, y: 0 }}
        onClick={handleClick}
        isDragging={isDragging}
      />
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const entries: [string, string][] = [
    ["free", "Free"],
    ["occupied", "Occupied"],
    ["reserved", "Reserved"],
    ["cleaning", "Cleaning"],
    ["maintenance", "Maint."],
  ];

  return (
    <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 border border-gray-100 shadow-sm">
      <div className="flex flex-col gap-1">
        {entries.map(([status, label]) => (
          <span
            key={status}
            className="flex items-center gap-2 text-[10px] text-gray-600"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: statusColor(status) }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FloorMap({
  tables,
  branchId,
  readOnly = false,
  onTableClick,
  height = 520,
}: FloorMapProps) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Only wired when readOnly=false — position updates via PATCH /tables/:id/position
  const { mutate: updatePosition } = useMutation({
    mutationFn: ({
      tableId,
      x,
      y,
    }: {
      tableId: string;
      x: number;
      y: number;
    }) => apiClient.patch(`/tables/${tableId}/position`, { x, y }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["floor", "tables", branchId] }),
    onError: () => toast.error("Failed to save table position"),
  });

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event;
      setActiveId(null);
      // Ignore micro-movements (treated as clicks by DraggableTable)
      if (Math.abs(delta.x) + Math.abs(delta.y) <= 4) return;
      const table = tables.find((t) => t.id === active.id);
      if (!table) return;
      updatePosition({
        tableId: String(active.id),
        x: Math.max(0, table.x + delta.x),
        y: Math.max(0, table.y + delta.y),
      });
    },
    [tables, updatePosition]
  );

  const activeTable = activeId ? tables.find((t) => t.id === activeId) : null;

  return (
    <div
      className="relative bg-[#F5F3EE] rounded-xl border border-gray-200 overflow-hidden"
      style={{ width: "100%", height }}
      role="img"
      aria-label="Restaurant floor map"
    >
      {/* Grid background */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
        aria-hidden
      >
        <defs>
          <pattern
            id="floorGrid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#CBD5E1"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#floorGrid)" />
      </svg>

      {/* Empty state */}
      {tables.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-gray-400">No tables configured</p>
        </div>
      )}

      {/* readOnly — plain positioned divs, no DnD overhead */}
      {readOnly &&
        tables.map((t) => (
          <div
            key={t.id}
            style={{ position: "absolute", left: t.x, top: t.y }}
          >
            <TableShape
              table={{ ...t, x: 0, y: 0 }}
              onClick={onTableClick ? () => onTableClick(t) : undefined}
            />
          </div>
        ))}

      {/* Draggable mode — full DnD context */}
      {!readOnly && (
        <DndContext
          onDragStart={(e) => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {tables.map((t) => (
            <DraggableTable
              key={t.id}
              table={t}
              onClick={onTableClick ? () => onTableClick(t) : undefined}
            />
          ))}
          <DragOverlay dropAnimation={null}>
            {activeTable && (
              <TableShape
                table={{ ...activeTable, x: 0, y: 0 }}
                isDragging
                style={{ position: "relative" }}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      <Legend />
    </div>
  );
}

export default FloorMap;