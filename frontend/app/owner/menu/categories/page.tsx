"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  GripVertical,
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

// ── Query key ──────────────────────────────────────────────────────────────────

const catsKey = (branchId: string) => ["menu", "categories", branchId];

// ── Sortable row ───────────────────────────────────────────────────────────────

function SortableCategoryRow({
  category,
  branchId,
  isHighlighted,
}: {
  category: Category;
  branchId: string;
  isHighlighted: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const [showDelete, setShowDelete] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  // Update category name
  const { mutate: updateCat, isPending: updating } = useMutation({
    mutationFn: () =>
      apiClient.patch(`/menu/categories/${category.id}`, {
        name: editName.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catsKey(branchId) });
      toast.success("Category updated");
      setEditing(false);
    },
    onError: () => toast.error("Failed to update category"),
  });

  // Delete category
  const { mutate: deleteCat, isPending: deleting } = useMutation({
    mutationFn: () => apiClient.delete(`/menu/categories/${category.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catsKey(branchId) });
      toast.success("Category deleted");
    },
    onError: () => toast.error("Failed to delete category"),
  });

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-3 bg-white rounded-xl border px-4 py-3 shadow-sm transition-shadow",
          isDragging ? "shadow-lg opacity-80 border-[#1A3C5E]/30" : "border-gray-100",
          isHighlighted && !isDragging && "ring-2 ring-[#1A3C5E]/30 border-[#1A3C5E]/20"
        )}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          aria-label="Drag to reorder"
        >
          <GripVertical size={18} />
        </button>

        {/* Sort order badge */}
        <span className="text-xs font-bold text-gray-300 w-5 text-center flex-shrink-0">
          {category.sort_order}
        </span>

        {/* Name / inline edit */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editName.trim()) updateCat();
                if (e.key === "Escape") {
                  setEditName(category.name);
                  setEditing(false);
                }
              }}
              className="w-full text-sm font-medium text-gray-800 bg-transparent border-b border-[#1A3C5E]/40 focus:outline-none pb-0.5"
            />
          ) : (
            <p className="text-sm font-semibold text-gray-800 truncate">
              {category.name}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {editing ? (
            <>
              <button
                onClick={() => { if (editName.trim()) updateCat(); }}
                disabled={updating || !editName.trim()}
                className="p-1.5 rounded-lg bg-[#1A3C5E] text-white disabled:opacity-40 hover:bg-[#15304d] transition"
              >
                {updating ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={13} />
                )}
              </button>
              <button
                onClick={() => { setEditName(category.name); setEditing(false); }}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                title="Edit name"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setShowDelete(true)}
                disabled={deleting}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                title="Delete category"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDelete}
        title="Delete Category?"
        message={`Deleting "${category.name}" will permanently remove it and all its menu items. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setShowDelete(false)}
        onConfirm={() => { setShowDelete(false); deleteCat(); }}
      />
    </>
  );
}

// ── Add category inline form ───────────────────────────────────────────────────

function AddCategoryRow({
  branchId,
  nextSortOrder,
  onDone,
}: {
  branchId: string;
  nextSortOrder: number;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post("/menu/categories", {
        name: name.trim(),
        branch_id: branchId,
        sort_order: nextSortOrder,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catsKey(branchId) });
      toast.success("Category added");
      onDone();
    },
    onError: () => toast.error("Failed to add category"),
  });

  return (
    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
      <Plus size={16} className="text-blue-400 flex-shrink-0" />
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) mutate();
          if (e.key === "Escape") onDone();
        }}
        placeholder="New category name…"
        className="flex-1 bg-transparent text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none"
      />
      <button
        onClick={() => { if (name.trim()) mutate(); }}
        disabled={isPending || !name.trim()}
        className="p-1.5 rounded-lg bg-[#1A3C5E] text-white disabled:opacity-40 hover:bg-[#15304d] transition"
      >
        {isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
      </button>
      <button
        onClick={onDone}
        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { branchId } = useAuth();
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");
  const qc = useQueryClient();

  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [reorderPending, setReorderPending] = useState(false);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: catsKey(branchId ?? ""),
    queryFn: () =>
      apiClient.get<Category[]>(`/menu/branch/${branchId}/categories`),
    enabled: !!branchId,
  });

  // Sync server state → local (only when not mid-drag)
  useEffect(() => {
    setLocalCategories([...categories].sort((a, b) => a.sort_order - b.sort_order));
  }, [categories]);

  // Reorder mutation
  const { mutate: reorder } = useMutation({
    mutationFn: (payload: { id: string; sort_order: number }[]) =>
      apiClient.patch("/menu/categories/reorder", { categories: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catsKey(branchId ?? "") });
      setReorderPending(false);
    },
    onError: () => {
      toast.error("Failed to save order");
      setLocalCategories(
        [...categories].sort((a, b) => a.sort_order - b.sort_order)
      );
      setReorderPending(false);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localCategories.findIndex((c) => c.id === active.id);
    const newIndex = localCategories.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(localCategories, oldIndex, newIndex).map(
      (cat, i) => ({ ...cat, sort_order: i + 1 })
    );

    setLocalCategories(reordered);
    setReorderPending(true);

    reorder(reordered.map((c) => ({ id: c.id, sort_order: c.sort_order })));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Drag to reorder · click{" "}
            <span className="inline-flex items-center gap-0.5">
              <Pencil size={11} />
            </span>{" "}
            to rename
          </p>
        </div>

        <div className="flex items-center gap-2">
          {reorderPending && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              Saving order…
            </span>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1A3C5E] text-white text-sm font-semibold rounded-xl hover:bg-[#15304d] transition"
          >
            <Plus size={15} />
            Add Category
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && localCategories.length === 0 && !showAdd && (
        <div className="py-16 text-center text-gray-400">
          <p className="text-sm">No categories yet.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-2 text-sm text-[#1A3C5E] underline underline-offset-2"
          >
            Create your first category
          </button>
        </div>
      )}

      {/* Sortable list */}
      {!isLoading && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localCategories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {localCategories.map((cat) => (
                <SortableCategoryRow
                  key={cat.id}
                  category={cat}
                  branchId={branchId ?? ""}
                  isHighlighted={cat.id === highlight}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Inline add form */}
      {showAdd && (
        <AddCategoryRow
          branchId={branchId ?? ""}
          nextSortOrder={localCategories.length + 1}
          onDone={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}