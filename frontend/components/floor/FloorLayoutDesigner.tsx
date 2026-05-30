"use client";

/**
 * components/floor/FloorLayoutDesigner.tsx
 *
 * DESIGN MODE editor — lets owners/managers create and publish restaurant floor plans.
 * Completely separate from FloorMap.tsx (which shows live operational status).
 *
 * Architecture:
 *  - Left sidebar: draggable shape palette + floor tabs
 *  - Main canvas: 24×18 grid, drop target, placed tables
 *  - Right panel: selected-table property editor
 *  - Bottom toolbar: undo/redo, save draft, publish
 *  - TableConfigModal: slides up after dropping a new shape
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  KeyboardEvent,
} from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Undo2,
  Redo2,
  Trash2,
  Upload,
  CheckCircle,
  Save,
  Plus,
  Minus,
  Circle,
  Square,
  RectangleHorizontal,
  Sofa,
  Monitor,
  X,
  LayersIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DesignTable {
  id: string;
  label: string;
  x: number; // grid column 0-23
  y: number; // grid row   0-17
  capacity: 2 | 4 | 6 | 8 | 10 | 12;
  shape: "round" | "square" | "rectangle" | "booth";
  zone: "indoor" | "outdoor" | "vip" | "family" | "bar";
  photo_url?: string;
  isNew?: boolean;
}

interface FloorState {
  floors: FloorData[];
}

interface FloorData {
  floor_number: number;
  name: string;
  tables: DesignTable[];
}

export interface FloorLayout {
  id?: string;
  branch_id: string;
  status: "draft" | "published";
  floors: FloorData[];
}

export interface FloorLayoutDesignerProps {
  branchId: string;
  initialLayout?: FloorLayout | null;
  onSave?: (layout: FloorLayout) => void;
  onPublish?: (layout: FloorLayout) => void;
  readOnly?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL = 48; // px per grid cell
const COLS = 24;
const ROWS = 18;
const MAX_HISTORY = 20;
const MAX_FLOORS = 4;

const FLOOR_NAMES = ["Ground", "1F", "2F", "3F"];

const ZONE_META: Record<
  DesignTable["zone"],
  { label: string; color: string; bg: string; border: string }
> = {
  indoor:  { label: "Indoor",  color: "#6B7280", bg: "bg-slate-100",   border: "border-slate-400"   },
  outdoor: { label: "Outdoor", color: "#16A34A", bg: "bg-green-100",   border: "border-green-500"   },
  vip:     { label: "VIP",     color: "#7C3AED", bg: "bg-purple-100",  border: "border-purple-500"  },
  family:  { label: "Family",  color: "#2563EB", bg: "bg-blue-100",    border: "border-blue-500"    },
  bar:     { label: "Bar",     color: "#E8A020", bg: "bg-amber-100",   border: "border-amber-500"   },
};

const SHAPE_META: Record<
  DesignTable["shape"],
  { label: string; icon: React.ReactNode; defaultCapacity: 4 | 6 }
> = {
  round:     { label: "Round",     icon: <Circle size={18} />,              defaultCapacity: 4 },
  square:    { label: "Square",    icon: <Square size={18} />,              defaultCapacity: 4 },
  rectangle: { label: "Rectangle", icon: <RectangleHorizontal size={18} />, defaultCapacity: 6 },
  booth:     { label: "Booth",     icon: <Sofa size={18} />,               defaultCapacity: 6 },
};

const CAPACITIES: Array<2 | 4 | 6 | 8 | 10 | 12> = [2, 4, 6, 8, 10, 12];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `t_${Math.random().toString(36).slice(2, 9)}`;
}

/** Returns table width in grid cells */
function tableColSpan(shape: DesignTable["shape"]): number {
  return shape === "rectangle" || shape === "booth" ? 2 : 1;
}

/** Returns table height in grid cells */
function tableRowSpan(_shape: DesignTable["shape"]): number {
  return 1;
}

function cellsOccupied(t: DesignTable): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  const cs = tableColSpan(t.shape);
  const rs = tableRowSpan(t.shape);
  for (let dc = 0; dc < cs; dc++) {
    for (let dr = 0; dr < rs; dr++) {
      cells.push([t.x + dc, t.y + dr]);
    }
  }
  return cells;
}

function hasCollision(
  tables: DesignTable[],
  candidate: { x: number; y: number; shape: DesignTable["shape"]; id?: string }
): boolean {
  const cs = tableColSpan(candidate.shape);
  const rs = tableRowSpan(candidate.shape);
  for (const t of tables) {
    if (t.id === candidate.id) continue;
    const occupied = cellsOccupied(t);
    for (let dc = 0; dc < cs; dc++) {
      for (let dr = 0; dr < rs; dr++) {
        if (occupied.some(([cx, cy]) => cx === candidate.x + dc && cy === candidate.y + dr)) {
          return true;
        }
      }
    }
  }
  return false;
}

function autoLabel(
  tables: DesignTable[],
  zone: DesignTable["zone"]
): string {
  const prefix = zone === "vip" ? "VIP" : "T";
  const existing = tables
    .filter((t) => t.label.startsWith(prefix))
    .map((t) => parseInt(t.label.replace(prefix, ""), 10))
    .filter((n) => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}${next}`;
}

// ─── Table renderer (design mode) ─────────────────────────────────────────────

function DesignTableCell({
  table,
  isSelected,
  onClick,
  style,
  isDragOverlay,
}: {
  table: DesignTable;
  isSelected?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  isDragOverlay?: boolean;
}) {
  const zone = ZONE_META[table.zone];
  const isRound = table.shape === "round";
  const isRect  = table.shape === "rectangle" || table.shape === "booth";
  const isBooth = table.shape === "booth";

  const widthPx  = tableColSpan(table.shape) * CELL - 4;
  const heightPx = tableRowSpan(table.shape) * CELL - 4;

  return (
    <div
      onClick={onClick}
      style={{
        width:  widthPx,
        height: heightPx,
        borderRadius: isRound
          ? "50%"
          : isBooth
          ? "12px 12px 4px 12px"
          : 8,
        transition: "all 0.15s ease",
        cursor: isDragOverlay ? "grabbing" : onClick ? "pointer" : "default",
        ...style,
      }}
      className={cn(
        "relative flex flex-col items-center justify-center select-none border-2",
        zone.bg,
        zone.border,
        isSelected && "ring-2 ring-[#1A3C5E] ring-offset-1 shadow-lg scale-105",
        !isDragOverlay && onClick && "hover:shadow-md",
        table.isNew && "animate-[scale-in_0.2s_ease-out]"
      )}
    >
      <span className="text-[11px] font-bold text-gray-800 leading-tight">
        {table.label}
      </span>
      <span className="text-[9px] text-gray-500">{table.capacity}p</span>
      {isBooth && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1.5 rounded-b-sm opacity-40"
          style={{ backgroundColor: zone.color }}
        />
      )}
    </div>
  );
}

// ─── Draggable palette item ───────────────────────────────────────────────────

function PaletteItem({
  shape,
  activeZone,
}: {
  shape: DesignTable["shape"];
  activeZone: DesignTable["zone"];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `palette-${shape}`, data: { shape, zone: activeZone } });

  const meta = SHAPE_META[shape];
  const zone = ZONE_META[activeZone];

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      className={cn(
        "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-grab",
        "bg-white border-gray-200 hover:border-[#1A3C5E] hover:bg-[#1A3C5E]/5",
        "transition-all duration-150 select-none touch-none"
      )}
    >
      <div className={cn("rounded-lg p-2", zone.bg)} style={{ color: zone.color }}>
        {meta.icon}
      </div>
      <span className="text-[10px] font-semibold text-gray-600">{meta.label}</span>
    </div>
  );
}

// ─── Canvas drop zone ─────────────────────────────────────────────────────────

function CanvasDropZone({
  tables,
  selectedId,
  onTableClick,
  onTableDragEnd,
}: {
  tables: DesignTable[];
  selectedId: string | null;
  onTableClick: (t: DesignTable) => void;
  onTableDragEnd: (tableId: string, deltaX: number, deltaY: number) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: "canvas" });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative overflow-auto rounded-xl border-2 transition-colors duration-150",
        isOver ? "border-[#1A3C5E]/40 bg-[#1A3C5E]/5" : "border-gray-200 bg-gray-50"
      )}
      style={{ minWidth: COLS * CELL, minHeight: ROWS * CELL }}
    >
      {/* Grid lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={COLS * CELL}
        height={ROWS * CELL}
        aria-hidden
      >
        <defs>
          <pattern id="designGrid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
            <path
              d={`M ${CELL} 0 L 0 0 0 ${CELL}`}
              fill="none"
              stroke="rgba(26,60,94,0.08)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#designGrid)" />
      </svg>

      {/* Empty state */}
      {tables.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: "none" }}
        >
          <div className="border-2 border-dashed border-gray-300 rounded-2xl px-12 py-10 text-center">
            <LayersIcon size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-400">
              Drag a table shape here to start
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Choose a shape from the left panel
            </p>
          </div>
        </div>
      )}

      {/* Placed tables */}
      {tables.map((t) => (
        <PlacedTableWrapper
          key={t.id}
          table={t}
          isSelected={selectedId === t.id}
          onClick={() => onTableClick(t)}
          onDragEnd={onTableDragEnd}
        />
      ))}
    </div>
  );
}

// ─── Placed table (draggable within canvas) ────────────────────────────────────

function PlacedTableWrapper({
  table,
  isSelected,
  onClick,
  onDragEnd,
}: {
  table: DesignTable;
  isSelected: boolean;
  onClick: () => void;
  onDragEnd: (tableId: string, deltaX: number, deltaY: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `placed-${table.id}`, data: { tableId: table.id, placed: true } });

  const handleClick = useCallback(() => {
    const dist = Math.abs(transform?.x ?? 0) + Math.abs(transform?.y ?? 0);
    if (dist <= 4) onClick();
  }, [onClick, transform]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        position:    "absolute",
        left:        table.x * CELL + 2,
        top:         table.y * CELL + 2,
        transform:   CSS.Translate.toString(transform),
        opacity:     isDragging ? 0.3 : 1,
        zIndex:      isSelected ? 10 : 1,
        touchAction: "none",
      }}
    >
      <DesignTableCell
        table={table}
        isSelected={isSelected}
        onClick={handleClick}
      />
    </div>
  );
}

// ─── Table Config Modal ────────────────────────────────────────────────────────

function TableConfigModal({
  open,
  shape,
  initialLabel,
  onPlace,
  onCancel,
}: {
  open: boolean;
  shape: DesignTable["shape"];
  initialLabel: string;
  onPlace: (label: string, capacity: DesignTable["capacity"], zone: DesignTable["zone"]) => void;
  onCancel: () => void;
}) {
  const [label, setLabel]       = useState(initialLabel);
  const [capacity, setCapacity] = useState<DesignTable["capacity"]>(SHAPE_META[shape].defaultCapacity);
  const [zone, setZone]         = useState<DesignTable["zone"]>("indoor");

  // Sync label if initialLabel changes (e.g., zone change)
  useEffect(() => setLabel(initialLabel), [initialLabel]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl p-6"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">Configure Table</h3>
              <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-5 max-w-lg">
              {/* Label */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  Table Label
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/30"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="T1, VIP-1..."
                />
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  Capacity
                </label>
                <div className="flex flex-wrap gap-2">
                  {CAPACITIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCapacity(c)}
                      className={cn(
                        "w-9 h-9 rounded-lg text-sm font-semibold border transition-all duration-100",
                        capacity === c
                          ? "bg-[#1A3C5E] text-white border-[#1A3C5E]"
                          : "bg-white text-gray-600 border-gray-200 hover:border-[#1A3C5E]"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zone */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  Zone
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(ZONE_META) as DesignTable["zone"][]).map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setZone(z)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all duration-100",
                        zone === z
                          ? "text-white border-transparent"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                      )}
                      style={zone === z ? { backgroundColor: ZONE_META[z].color } : {}}
                    >
                      {ZONE_META[z].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!label.trim()) { toast.error("Label is required"); return; }
                  onPlace(label.trim(), capacity, zone);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#1A3C5E] text-white text-sm font-semibold hover:bg-[#152f4a] transition-colors"
              >
                Place Table
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Publish confirm dialog ────────────────────────────────────────────────────

function PublishDialog({
  open,
  tableCount,
  onConfirm,
  onCancel,
  isLoading,
}: {
  open: boolean;
  tableCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#1A3C5E]/10 mb-4 mx-auto">
                <CheckCircle size={22} className="text-[#1A3C5E]" />
              </div>
              <h3 className="text-base font-bold text-gray-900 text-center mb-2">
                Publish Floor Layout?
              </h3>
              <p className="text-sm text-gray-500 text-center mb-5">
                This will make <span className="font-semibold text-gray-700">{tableCount} tables</span> visible
                to staff and customers. Any existing live layout will be replaced.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className="flex-1 py-2.5 rounded-xl bg-[#1A3C5E] text-white text-sm font-semibold hover:bg-[#152f4a] transition-colors disabled:opacity-60"
                >
                  {isLoading ? "Publishing…" : "Publish"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function FloorLayoutDesigner({
  branchId,
  initialLayout,
  onSave,
  onPublish,
  readOnly = false,
}: FloorLayoutDesignerProps) {
  const qc = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────

  const [floors, setFloors] = useState<FloorData[]>(() => {
    if (initialLayout?.floors?.length) return initialLayout.floors;
    return [{ floor_number: 0, name: "Ground", tables: [] }];
  });
  const [activeFloor, setActiveFloor]           = useState(0);
  const [selectedTable, setSelectedTable]       = useState<DesignTable | null>(null);
  const [isDirty, setIsDirty]                   = useState(false);
  const [showConfigModal, setShowConfigModal]   = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [pendingDrop, setPendingDrop]           = useState<{
    x: number; y: number; shape: DesignTable["shape"];
  } | null>(null);
  const [activeZone, setActiveZone]             = useState<DesignTable["zone"]>("indoor");
  const [activeDragId, setActiveDragId]         = useState<string | null>(null);

  // History for undo/redo
  const [history, setHistory]       = useState<FloorState[]>([{ floors }]);
  const [historyIdx, setHistoryIdx] = useState(0);

  // Refs
  const labelInputRef = useRef<HTMLInputElement>(null);

  // ── Load existing layout from API ─────────────────────────────────────────

  const { data: remoteLayout } = useQuery({
    queryKey: ["floor-layout", "design", branchId],
    queryFn:  () => apiClient.get<FloorLayout>(`/floor-layout/branch/${branchId}`),
    enabled:  !!branchId && !initialLayout,
  });

  // Apply remote layout once loaded (only on first successful fetch)
  const appliedRemote = useRef(false);
  useEffect(() => {
    if (!remoteLayout || appliedRemote.current) return;
    if (remoteLayout.floors?.length) {
      appliedRemote.current = true;
      setFloors(remoteLayout.floors);
      setHistory([{ floors: JSON.parse(JSON.stringify(remoteLayout.floors)) }]);
      setHistoryIdx(0);
    }
  }, [remoteLayout]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const { mutate: saveDraft, isPending: isSaving } = useMutation({
    mutationFn: (payload: FloorLayout) =>
      apiClient.post<FloorLayout>(`/floor-layout/branch/${branchId}`, payload),
    onSuccess: (saved) => {
      toast.success("Draft saved");
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ["floor-layout", "design", branchId] });
      onSave?.(saved);
    },
    onError: () => toast.error("Failed to save draft"),
  });

  const { mutate: publishLayout, isPending: isPublishing } = useMutation({
    mutationFn: (payload: FloorLayout) =>
      apiClient.post<FloorLayout>(`/floor-layout/branch/${branchId}/publish`, payload),
    onSuccess: (published) => {
      toast.success("Layout published successfully!");
      setIsDirty(false);
      setShowPublishDialog(false);
      qc.invalidateQueries({ queryKey: ["floor-layout", branchId] });
      onPublish?.(published);
    },
    onError: () => toast.error("Failed to publish layout"),
  });

  // ── Dirty guard ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      // Don't fire when typing in an input
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (e.key === "Escape") {
        setSelectedTable(null);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedTable) {
          e.preventDefault();
          deleteTable(selectedTable.id);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, historyIdx, history]);

  // ── History helpers ────────────────────────────────────────────────────────

  const recordHistory = useCallback(
    (newFloors: FloorData[]) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIdx + 1);
        const next   = [...sliced, { floors: JSON.parse(JSON.stringify(newFloors)) }];
        if (next.length > MAX_HISTORY) next.shift();
        return next;
      });
      setHistoryIdx((i) => Math.min(i + 1, MAX_HISTORY - 1));
    },
    [historyIdx]
  );

  const undo = useCallback(() => {
    if (historyIdx <= 0) return;
    const prev = history[historyIdx - 1];
    setFloors(JSON.parse(JSON.stringify(prev.floors)));
    setHistoryIdx((i) => i - 1);
    setSelectedTable(null);
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const next = history[historyIdx + 1];
    setFloors(JSON.parse(JSON.stringify(next.floors)));
    setHistoryIdx((i) => i + 1);
    setSelectedTable(null);
  }, [history, historyIdx]);

  // ── Floor helpers ──────────────────────────────────────────────────────────

  const currentTables = floors[activeFloor]?.tables ?? [];

  const updateTables = useCallback(
    (updater: (tables: DesignTable[]) => DesignTable[]) => {
      setFloors((prev) => {
        const next = prev.map((f, i) =>
          i === activeFloor ? { ...f, tables: updater(f.tables) } : f
        );
        recordHistory(next);
        return next;
      });
      setIsDirty(true);
    },
    [activeFloor, recordHistory]
  );

  const addFloor = useCallback(() => {
    if (floors.length >= MAX_FLOORS) { toast.info(`Maximum ${MAX_FLOORS} floors`); return; }
    const num  = floors.length;
    const name = FLOOR_NAMES[num] ?? `${num}F`;
    const next = [...floors, { floor_number: num, name, tables: [] }];
    setFloors(next);
    recordHistory(next);
    setActiveFloor(num);
    setIsDirty(true);
  }, [floors, recordHistory]);

  const removeFloor = useCallback(() => {
    const floor = floors[activeFloor];
    if (!floor) return;
    if (floor.tables.length > 0) { toast.error("Remove all tables from this floor first"); return; }
    if (floors.length <= 1) { toast.info("At least one floor is required"); return; }
    const next = floors.filter((_, i) => i !== activeFloor);
    setFloors(next);
    recordHistory(next);
    setActiveFloor(Math.max(0, activeFloor - 1));
    setIsDirty(true);
  }, [floors, activeFloor, recordHistory]);

  // ── DnD handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over, delta } = event;
      const id = String(active.id);

      if (!over || over.id !== "canvas") return;

      // ── Palette drop → open config modal ─────────────────────────────────
      if (id.startsWith("palette-")) {
        const shape = active.data.current?.shape as DesignTable["shape"];
        if (!shape) return;

        // Calculate grid cell from the drop position
        // delta is relative to drag start; we use pointer offset from canvas origin
        const canvasEl = document.getElementById("designer-canvas");
        if (!canvasEl) return;
        const rect = canvasEl.getBoundingClientRect();
        const pointerX = (event.activatorEvent as PointerEvent)?.clientX ?? rect.left + 100;
        const pointerY = (event.activatorEvent as PointerEvent)?.clientY ?? rect.top  + 100;
        // Apply delta to get final position
        const finalX = pointerX + delta.x - rect.left;
        const finalY = pointerY + delta.y - rect.top;

        const col = Math.min(Math.max(Math.floor(finalX / CELL), 0), COLS - tableColSpan(shape));
        const row = Math.min(Math.max(Math.floor(finalY / CELL), 0), ROWS - 1);

        if (hasCollision(currentTables, { x: col, y: row, shape })) {
          toast.error("Position occupied, try another spot");
          return;
        }

        setPendingDrop({ x: col, y: row, shape });
        setShowConfigModal(true);
        return;
      }

      // ── Placed table drag → reposition ────────────────────────────────────
      if (id.startsWith("placed-")) {
        const tableId = active.data.current?.tableId as string;
        const table   = currentTables.find((t) => t.id === tableId);
        if (!table) return;
        if (Math.abs(delta.x) + Math.abs(delta.y) <= 4) return; // click, not drag

        const newX = Math.min(
          Math.max(table.x + Math.round(delta.x / CELL), 0),
          COLS - tableColSpan(table.shape)
        );
        const newY = Math.min(Math.max(table.y + Math.round(delta.y / CELL), 0), ROWS - 1);

        if (hasCollision(currentTables, { x: newX, y: newY, shape: table.shape, id: tableId })) {
          toast.error("Position occupied, try another spot");
          return;
        }

        updateTables((tables) =>
          tables.map((t) => (t.id === tableId ? { ...t, x: newX, y: newY } : t))
        );
      }
    },
    [currentTables, updateTables]
  );

  // ── Place table from modal ─────────────────────────────────────────────────

  const handlePlaceTable = useCallback(
    (label: string, capacity: DesignTable["capacity"], zone: DesignTable["zone"]) => {
      if (!pendingDrop) return;

      // Check duplicate label
      const dupe = currentTables.some(
        (t) => t.label.toLowerCase() === label.toLowerCase()
      );
      if (dupe) { toast.error(`Label "${label}" already exists on this floor`); return; }

      const newTable: DesignTable = {
        id:       generateId(),
        label,
        x:        pendingDrop.x,
        y:        pendingDrop.y,
        capacity,
        shape:    pendingDrop.shape,
        zone,
        isNew:    true,
      };

      updateTables((tables) => [...tables, { ...newTable, isNew: false }]);
      setPendingDrop(null);
      setShowConfigModal(false);
    },
    [pendingDrop, currentTables, updateTables]
  );

  // ── Table property updates ─────────────────────────────────────────────────

  const updateSelectedTable = useCallback(
    (patch: Partial<DesignTable>) => {
      if (!selectedTable) return;
      const updated = { ...selectedTable, ...patch };

      // Check label uniqueness (only if label changed)
      if (patch.label !== undefined) {
        const dupe = currentTables.some(
          (t) => t.id !== selectedTable.id &&
                 t.label.toLowerCase() === patch.label!.toLowerCase()
        );
        if (dupe) { toast.error(`Label "${patch.label}" already exists`); return; }
      }

      setSelectedTable(updated);
      updateTables((tables) =>
        tables.map((t) => (t.id === selectedTable.id ? updated : t))
      );
    },
    [selectedTable, currentTables, updateTables]
  );

  const deleteTable = useCallback(
    (tableId: string) => {
      updateTables((tables) => tables.filter((t) => t.id !== tableId));
      if (selectedTable?.id === tableId) setSelectedTable(null);
    },
    [selectedTable, updateTables]
  );

  // ── Save / Publish ─────────────────────────────────────────────────────────

  const buildPayload = (): FloorLayout => ({
    branch_id: branchId,
    status:    "draft",
    floors:    floors.map((f) => ({
      ...f,
      tables: f.tables.map(({ isNew: _isNew, ...t }) => t),
    })),
  });

  const handleSaveDraft = () => {
    if (readOnly) return;
    saveDraft(buildPayload());
  };

  const handlePublish = () => {
    if (readOnly) return;
    setShowPublishDialog(true);
  };

  const confirmPublish = () => {
    publishLayout({ ...buildPayload(), status: "published" });
  };

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totalTables = floors.reduce((s, f) => s + f.tables.length, 0);
  const floorCount  = floors.filter((f) => f.tables.length > 0).length;

  // ── Drag overlay content ───────────────────────────────────────────────────

  const overlayTable = activeDragId?.startsWith("placed-")
    ? currentTables.find((t) => t.id === activeDragId.replace("placed-", ""))
    : null;

  const overlayShape = activeDragId?.startsWith("palette-")
    ? (activeDragId.replace("palette-", "") as DesignTable["shape"])
    : null;

  // ── Pending drop label ─────────────────────────────────────────────────────

  const pendingLabel = pendingDrop
    ? autoLabel(currentTables, activeZone)
    : "";

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Mobile warning */}
      <div className="md:hidden mb-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
        <Monitor size={16} className="text-amber-600 shrink-0" />
        <p className="text-xs text-amber-700 font-medium">
          Desktop recommended for floor layout editing
        </p>
      </div>

      <div className="flex flex-col h-full min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* ── Main 3-column layout ────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── LEFT SIDEBAR ─────────────────────────────────────────────── */}
          <div className="w-48 shrink-0 border-r border-gray-100 bg-gray-50 flex flex-col">
            <div className="p-3 border-b border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                Add Tables
              </p>

              {/* Shape palette */}
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SHAPE_META) as DesignTable["shape"][]).map((shape) => (
                  <PaletteItem key={shape} shape={shape} activeZone={activeZone} />
                ))}
              </div>

              {/* Zone selector */}
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Zone
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(ZONE_META) as DesignTable["zone"][]).map((z) => (
                    <button
                      key={z}
                      onClick={() => setActiveZone(z)}
                      title={ZONE_META[z].label}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-all duration-100",
                        activeZone === z ? "scale-125 border-gray-800" : "border-transparent hover:scale-110"
                      )}
                      style={{ backgroundColor: ZONE_META[z].color }}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {ZONE_META[activeZone].label}
                </p>
              </div>
            </div>

            {/* Floor tabs */}
            <div className="p-3 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Floors
              </p>
              <div className="flex flex-col gap-1">
                {floors.map((f, i) => (
                  <button
                    key={f.floor_number}
                    onClick={() => { setActiveFloor(i); setSelectedTable(null); }}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-100",
                      activeFloor === i
                        ? "bg-[#1A3C5E] text-white"
                        : "text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    <span>{f.name}</span>
                    {f.tables.length > 0 && (
                      <span className={cn(
                        "ml-1.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5",
                        activeFloor === i ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"
                      )}>
                        {f.tables.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Add / remove floor */}
              <div className="flex gap-1.5 mt-3">
                <button
                  onClick={addFloor}
                  disabled={readOnly || floors.length >= MAX_FLOORS}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-[#1A3C5E] border border-[#1A3C5E]/30 hover:bg-[#1A3C5E]/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus size={12} /> Add
                </button>
                <button
                  onClick={removeFloor}
                  disabled={readOnly || floors.length <= 1}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus size={12} /> Remove
                </button>
              </div>
            </div>
          </div>

          {/* ── MAIN CANVAS ──────────────────────────────────────────────── */}
          <div
            className="flex-1 overflow-auto p-4"
            onClick={(e) => {
              if ((e.target as HTMLElement).id === "designer-canvas" || 
                  (e.target as SVGElement).tagName === "svg" ||
                  (e.target as SVGElement).tagName === "rect") {
                setSelectedTable(null);
              }
            }}
          >
            <div id="designer-canvas">
              <CanvasDropZone
                tables={currentTables}
                selectedId={selectedTable?.id ?? null}
                onTableClick={(t) =>
                  setSelectedTable((prev) => (prev?.id === t.id ? null : t))
                }
                onTableDragEnd={() => {}} // handled in DndContext onDragEnd
              />
            </div>
          </div>

          {/* ── RIGHT PANEL ──────────────────────────────────────────────── */}
          <div className="w-64 shrink-0 border-l border-gray-100 bg-gray-50 flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Properties
              </p>
            </div>

            <div className="flex-1 p-4 overflow-y-auto">
              <AnimatePresence mode="wait">
                {selectedTable ? (
                  <motion.div
                    key={selectedTable.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {/* Label */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Label
                      </label>
                      <input
                        ref={labelInputRef}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/30 bg-white"
                        value={selectedTable.label}
                        disabled={readOnly}
                        onChange={(e) => updateSelectedTable({ label: e.target.value })}
                      />
                    </div>

                    {/* Shape (read-only) */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Shape
                      </label>
                      <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg">
                        <span className="text-gray-400">{SHAPE_META[selectedTable.shape].icon}</span>
                        <span className="text-sm font-medium text-gray-600 capitalize">
                          {selectedTable.shape}
                        </span>
                      </div>
                    </div>

                    {/* Capacity */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Capacity
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {CAPACITIES.map((c) => (
                          <button
                            key={c}
                            disabled={readOnly}
                            onClick={() => updateSelectedTable({ capacity: c })}
                            className={cn(
                              "py-1.5 rounded-lg text-sm font-semibold border transition-all duration-100",
                              selectedTable.capacity === c
                                ? "bg-[#1A3C5E] text-white border-[#1A3C5E]"
                                : "bg-white text-gray-600 border-gray-200 hover:border-[#1A3C5E] disabled:opacity-50"
                            )}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Zone */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Zone
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/30 bg-white disabled:opacity-50"
                        value={selectedTable.zone}
                        disabled={readOnly}
                        onChange={(e) =>
                          updateSelectedTable({ zone: e.target.value as DesignTable["zone"] })
                        }
                      >
                        {(Object.keys(ZONE_META) as DesignTable["zone"][]).map((z) => (
                          <option key={z} value={z}>{ZONE_META[z].label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Photo */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Photo
                      </label>
                      <button
                        disabled={readOnly}
                        onClick={() => {
                          const inp = document.createElement("input");
                          inp.type = "file";
                          inp.accept = "image/*";
                          inp.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              // Placeholder — real impl would upload via API
                              const url = URL.createObjectURL(file);
                              updateSelectedTable({ photo_url: url });
                            }
                          };
                          inp.click();
                        }}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed text-sm font-medium transition-colors",
                          selectedTable.photo_url
                            ? "border-green-300 bg-green-50 text-green-700"
                            : "border-gray-200 text-gray-500 hover:border-[#1A3C5E]/40 hover:text-[#1A3C5E]",
                          readOnly && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Upload size={14} />
                        {selectedTable.photo_url ? "Photo uploaded" : "Upload photo"}
                      </button>
                    </div>

                    {/* Position (read-only) */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                        Position
                      </label>
                      <p className="text-xs text-gray-500 bg-white border border-gray-200 px-3 py-2 rounded-lg">
                        Col {selectedTable.x + 1}, Row {selectedTable.y + 1}
                      </p>
                    </div>

                    {/* Delete */}
                    {!readOnly && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete table "${selectedTable.label}"?`)) {
                            deleteTable(selectedTable.id);
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors mt-2"
                      >
                        <Trash2 size={14} />
                        Delete Table
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full text-center py-12"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <Square size={18} className="text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">Select a table to edit</p>
                    <p className="text-xs text-gray-300 mt-1">Click any table on the canvas</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── BOTTOM TOOLBAR ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white shrink-0">
          {/* Undo / redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={historyIdx <= 0}
              title="Undo (Ctrl+Z)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Undo2 size={13} /> Undo
            </button>
            <button
              onClick={redo}
              disabled={historyIdx >= history.length - 1}
              title="Redo (Ctrl+Y)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Redo2 size={13} /> Redo
            </button>
          </div>

          {/* Summary */}
          <p className="text-xs text-gray-400 font-medium">
            {totalTables > 0 ? (
              <>
                <span className="font-semibold text-gray-700">{totalTables}</span>{" "}
                {totalTables === 1 ? "table" : "tables"} across{" "}
                <span className="font-semibold text-gray-700">{Math.max(floorCount, 1)}</span>{" "}
                {Math.max(floorCount, 1) === 1 ? "floor" : "floors"}
              </>
            ) : (
              "No tables placed yet"
            )}
            {isDirty && (
              <span className="ml-2 inline-flex items-center gap-0.5 text-amber-600">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved
              </span>
            )}
          </p>

          {/* Actions */}
          {!readOnly && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveDraft}
                disabled={isSaving || !isDirty}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1A3C5E] border border-[#1A3C5E] hover:bg-[#1A3C5E]/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={13} />
                {isSaving ? "Saving…" : "Save Draft"}
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing || totalTables === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1A3C5E] hover:bg-[#152f4a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle size={13} />
                Publish Layout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── DragOverlay ──────────────────────────────────────────────────── */}
      <DragOverlay dropAnimation={null}>
        {overlayTable && (
          <DesignTableCell table={overlayTable} isDragOverlay style={{ opacity: 0.85 }} />
        )}
        {overlayShape && (
          <div
            className="flex flex-col items-center justify-center bg-white rounded-xl border-2 border-[#1A3C5E] shadow-xl opacity-90"
            style={{ width: tableColSpan(overlayShape) * CELL - 4, height: CELL - 4 }}
          >
            <span className="text-[#1A3C5E]">{SHAPE_META[overlayShape].icon}</span>
          </div>
        )}
      </DragOverlay>

      {/* ── Table Config Modal ────────────────────────────────────────────── */}
      <TableConfigModal
        open={showConfigModal}
        shape={pendingDrop?.shape ?? "square"}
        initialLabel={pendingLabel}
        onPlace={handlePlaceTable}
        onCancel={() => { setPendingDrop(null); setShowConfigModal(false); }}
      />

      {/* ── Publish confirm ───────────────────────────────────────────────── */}
      <PublishDialog
        open={showPublishDialog}
        tableCount={totalTables}
        onConfirm={confirmPublish}
        onCancel={() => setShowPublishDialog(false)}
        isLoading={isPublishing}
      />
    </DndContext>
  );
}