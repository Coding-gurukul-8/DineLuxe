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
 *
 * // MERGE FEATURE ADDITION ────────────────────────────────────────────────────
 * 7. Added MergedTableInfo interface — describes a pair of merged tables so
 *    FloorMap can render the visual bracket connector and combined label.
 *
 * 8. FloorMapProps gains four new optional props (all default to safe no-ops):
 *      mergeMode           – when true, tables enter merge-selection UX
 *      selectedForMerge    – array of up to 2 table IDs highlighted in blue
 *      onTableSelectForMerge – called when user clicks a FREE table in merge mode
 *      mergedTables        – list of active merges to render as combined entities
 *
 * 9. TableShape gains a mergeSelected style (blue ring) applied when the table
 *    id is in selectedForMerge, and a mergedStyle (navy fill) when the table
 *    is part of an active merged pair.
 *
 * 10. MergeBracket SVG overlay draws a bracket between the two table centres.
 *
 * 11. MergedLegend entry appended to Legend when mergeMode is active.
 *
 * All new props are optional with defaults — zero breaking changes to existing
 * usages of FloorMap in manager, host, or any other consumer.
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

// MERGE FEATURE ADDITION ──────────────────────────────────────────────────────
/**
 * Describes an active merged pair returned from POST /api/v1/tables/merge.
 * The merged record id is stored so we can call POST /tables/:mergedId/unmerge.
 */
export interface MergedTableInfo {
  /** ID of the merged_tables record (used for unmerge endpoint) */
  mergedId: string;
  tableId1: string;
  tableId2: string;
  label1: string;
  label2: string;
  combinedCapacity: number;
}
// END MERGE FEATURE ADDITION ──────────────────────────────────────────────────

interface FloorMapProps {
  tables: FloorTable[];
  branchId: string;
  readOnly?: boolean;
  /** Called when a table shape is clicked in both readOnly and draggable modes */
  onTableClick?: (table: FloorTable) => void;
  /** Canvas height in pixels (default: 520) */
  height?: number;

  // MERGE FEATURE ADDITION ────────────────────────────────────────────────────
  /** When true the floor is in merge-selection mode */
  mergeMode?: boolean;
  /** IDs of tables currently selected for merging (max 2) */
  selectedForMerge?: string[];
  /** Called when a free table is clicked while mergeMode is active */
  onTableSelectForMerge?: (tableId: string) => void;
  /** Active merged pairs to render with bracket + combined label */
  mergedTables?: MergedTableInfo[];
  // END MERGE FEATURE ADDITION ────────────────────────────────────────────────
}

// ── Status colour map ─────────────────────────────────────────────────────────

function statusColor(status: string): string {
  return (
    TABLE_STATUS_COLORS[status as keyof typeof TABLE_STATUS_COLORS] ?? "#7F8C8D"
  );
}

// ── Table shape renderer ──────────────────────────────────────────────────────

// MERGE FEATURE ADDITION ──────────────────────────────────────────────────────
interface TableShapeProps {
  table: FloorTable;
  onClick?: () => void;
  style?: React.CSSProperties;
  isDragging?: boolean;
  className?: string;
  /** True when this table is selected for merging — applies blue ring */
  mergeSelected?: boolean;
  /** True when this table is part of an active merge — applies navy fill */
  isMerged?: boolean;
  /** Combined label to show when merged e.g. "T3+T4" */
  mergedLabel?: string;
  /** Combined capacity to show when merged */
  mergedCapacity?: number;
}
// END MERGE FEATURE ADDITION ──────────────────────────────────────────────────

function TableShape({
  table,
  onClick,
  style,
  isDragging,
  className,
  // MERGE FEATURE ADDITION
  mergeSelected = false,
  isMerged = false,
  mergedLabel,
  mergedCapacity,
  // END MERGE FEATURE ADDITION
}: TableShapeProps) {
  const isRound = table.shape === "round";

  // MERGE FEATURE ADDITION ──────────────────────────────────────────────────
  // Merged tables use a distinct navy colour; selected-for-merge tables keep
  // their status colour but gain a visible blue ring.
  const MERGED_COLOR = "#1A3C5E";
  const color = isMerged ? MERGED_COLOR : statusColor(table.status);

  const displayLabel = isMerged ? (mergedLabel ?? table.label) : table.label;
  const displayCapacity = isMerged ? (mergedCapacity ?? table.capacity) : table.capacity;
  // END MERGE FEATURE ADDITION ──────────────────────────────────────────────

  return (
    <div
      onClick={onClick}
      style={{
        width: table.width,
        height: table.height,
        // MERGE FEATURE ADDITION: merged tables use a solid navy tint
        backgroundColor: isMerged ? `${MERGED_COLOR}18` : color + "22",
        borderColor: color,
        borderWidth: 2,
        borderRadius: isRound ? "50%" : 8,
        opacity: isDragging ? 0.35 : 1,
        cursor: onClick ? "pointer" : "default",
        transition: "opacity 0.15s, box-shadow 0.15s",
        // MERGE FEATURE ADDITION: blue selection ring for selected-for-merge tables
        boxShadow: mergeSelected
          ? "0 0 0 3px #3B82F6, 0 0 0 5px #93C5FD"
          : "none",
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
          ? `Table ${displayLabel}, ${table.status}, ${displayCapacity} seats${mergeSelected ? ", selected for merge" : ""}`
          : undefined
      }
    >
      <span className="text-xs font-bold text-gray-800 leading-tight">
        {displayLabel}
      </span>
      <span className="text-[10px] text-gray-500">{displayCapacity}p</span>
      {/* MERGE FEATURE ADDITION: merged badge */}
      {isMerged && (
        <span className="text-[8px] font-semibold text-[#1A3C5E] leading-none mt-0.5 opacity-70">
          merged
        </span>
      )}
      {/* END MERGE FEATURE ADDITION */}
    </div>
  );
}

// MERGE FEATURE ADDITION ──────────────────────────────────────────────────────
/**
 * SVG bracket drawn on the canvas connecting two merged table centres.
 * Rendered as an absolutely-positioned SVG overlay covering the full canvas.
 */
function MergeBrackets({
  tables,
  mergedPairs,
}: {
  tables: FloorTable[];
  mergedPairs: MergedTableInfo[];
}) {
  if (mergedPairs.length === 0) return null;

  // Build a quick lookup: tableId → FloorTable
  const tableMap = new Map(tables.map((t) => [t.id, t]));

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
      style={{ zIndex: 1 }}
    >
      {mergedPairs.map((pair) => {
        const t1 = tableMap.get(pair.tableId1);
        const t2 = tableMap.get(pair.tableId2);
        if (!t1 || !t2) return null;

        // Centre points of each table
        const cx1 = t1.x + t1.width / 2;
        const cy1 = t1.y + t1.height / 2;
        const cx2 = t2.x + t2.width / 2;
        const cy2 = t2.y + t2.height / 2;

        // Midpoint for the label
        const mx = (cx1 + cx2) / 2;
        const my = (cy1 + cy2) / 2;

        const MERGED_COLOR = "#1A3C5E";

        return (
          <g key={pair.mergedId}>
            {/* Dashed connector line between the two table centres */}
            <line
              x1={cx1}
              y1={cy1}
              x2={cx2}
              y2={cy2}
              stroke={MERGED_COLOR}
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeOpacity={0.6}
            />
            {/* Small circles at each end anchoring the connector */}
            <circle cx={cx1} cy={cy1} r={4} fill={MERGED_COLOR} fillOpacity={0.35} />
            <circle cx={cx2} cy={cy2} r={4} fill={MERGED_COLOR} fillOpacity={0.35} />
            {/* Combined label pill at midpoint */}
            <rect
              x={mx - 22}
              y={my - 9}
              width={44}
              height={18}
              rx={9}
              fill={MERGED_COLOR}
              fillOpacity={0.85}
            />
            <text
              x={mx}
              y={my + 4}
              textAnchor="middle"
              fontSize={9}
              fontWeight="bold"
              fill="white"
              fontFamily="system-ui, sans-serif"
            >
              {pair.label1}+{pair.label2}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
// END MERGE FEATURE ADDITION ──────────────────────────────────────────────────

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

// MERGE FEATURE ADDITION: mergeMode param added to show merged entry
function Legend({ mergeMode = false }: { mergeMode?: boolean }) {
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
        {/* MERGE FEATURE ADDITION: merged legend entry */}
        {mergeMode && (
          <span className="flex items-center gap-2 text-[10px] text-gray-600">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: "#1A3C5E" }}
            />
            Merged
          </span>
        )}
        {/* END MERGE FEATURE ADDITION */}
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
  // MERGE FEATURE ADDITION — all optional with safe defaults
  mergeMode = false,
  selectedForMerge = [],
  onTableSelectForMerge,
  mergedTables = [],
  // END MERGE FEATURE ADDITION
}: FloorMapProps) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

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

  // MERGE FEATURE ADDITION ──────────────────────────────────────────────────
  // Build quick-lookup sets for merge state so we don't iterate in render
  const mergedTableIds = new Set(
    mergedTables.flatMap((m) => [m.tableId1, m.tableId2])
  );
  const mergedByTableId = new Map<string, MergedTableInfo>();
  for (const m of mergedTables) {
    mergedByTableId.set(m.tableId1, m);
    mergedByTableId.set(m.tableId2, m);
  }

  /**
   * Unified click handler for a table cell when readOnly=true.
   * In merge mode: selects/deselects a free table for merging.
   * Otherwise: delegates to onTableClick as before.
   */
  function handleReadOnlyClick(table: FloorTable) {
    if (mergeMode) {
      // Only free tables can be selected for merging
      if (table.status !== "free") {
        toast.warning("Only free tables can be selected for merging");
        return;
      }
      onTableSelectForMerge?.(table.id);
      return;
    }
    onTableClick?.(table);
  }
  // END MERGE FEATURE ADDITION ──────────────────────────────────────────────

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

      {/* MERGE FEATURE ADDITION: SVG bracket overlay for active merged pairs */}
      {mergedTables.length > 0 && (
        <MergeBrackets tables={tables} mergedPairs={mergedTables} />
      )}
      {/* END MERGE FEATURE ADDITION */}

      {/* readOnly — plain positioned divs, no DnD overhead */}
      {readOnly &&
        tables.map((t) => {
          // MERGE FEATURE ADDITION ──────────────────────────────────────────
          const isSelected = selectedForMerge.includes(t.id);
          const mergeInfo = mergedByTableId.get(t.id);
          const isMerged = mergedTableIds.has(t.id);

          // When merged, derive the combined display details
          const mergedLabel = mergeInfo
            ? `${mergeInfo.label1}+${mergeInfo.label2}`
            : undefined;
          const mergedCapacity = mergeInfo?.combinedCapacity;
          // END MERGE FEATURE ADDITION ──────────────────────────────────────

          return (
            <div
              key={t.id}
              // MERGE FEATURE ADDITION: z-index so selected tables pop above the SVG bracket
              style={{ position: "absolute", left: t.x, top: t.y, zIndex: isSelected ? 3 : 2 }}
            >
              <TableShape
                table={{ ...t, x: 0, y: 0 }}
                onClick={() => handleReadOnlyClick(t)}
                // MERGE FEATURE ADDITION
                mergeSelected={isSelected}
                isMerged={isMerged}
                mergedLabel={mergedLabel}
                mergedCapacity={mergedCapacity}
                // END MERGE FEATURE ADDITION
              />
            </div>
          );
        })}

      {/* Draggable mode — full DnD context (merge mode not available in draggable mode) */}
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

      {/* MERGE FEATURE ADDITION: mergeMode prop forwarded to Legend */}
      <Legend mergeMode={mergeMode} />
    </div>
  );
}

export default FloorMap;