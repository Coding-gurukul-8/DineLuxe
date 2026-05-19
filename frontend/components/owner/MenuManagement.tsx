"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string | null;
  image_url: string | null;
  is_available: boolean;
  dietary_tags: string[];
}

interface MenuCategory {
  id: string;
  name: string;
  sort_order: number;
  items: MenuItem[];
}

// ── Query keys ─────────────────────────────────────────────────────────────────

const categoriesKey = (branchId: string) => ["menu", "categories", branchId];

// ── Inline "Add Category" form ─────────────────────────────────────────────────

function AddCategoryForm({
  branchId,
  onDone,
}: {
  branchId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post("/menu/categories", { name: name.trim(), branch_id: branchId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoriesKey(branchId) });
      toast.success("Category added");
      onDone();
    },
    onError: () => toast.error("Failed to add category"),
  });

  const submit = () => {
    if (!name.trim()) return;
    mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onDone();
        }}
        placeholder="Category name…"
        className="flex-1 bg-transparent text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none"
      />
      <button
        onClick={submit}
        disabled={isPending || !name.trim()}
        className="p-1.5 rounded-lg bg-[#1A3C5E] text-white disabled:opacity-40 hover:bg-[#15304d] transition"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
      </button>
      <button
        onClick={onDone}
        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

// ── Category accordion row ─────────────────────────────────────────────────────

function CategoryRow({
  category,
  branchId,
}: {
  category: MenuCategory;
  branchId: string;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "cat" | "item"; id: string } | null>(null);

  // Delete category
  const { mutate: deleteCat, isPending: deletingCat } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/menu/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoriesKey(branchId) });
      toast.success("Category deleted");
    },
    onError: () => toast.error("Failed to delete category"),
  });

  // Toggle item availability
  const { mutate: toggleStatus } = useMutation({
    mutationFn: ({ id, is_available }: { id: string; is_available: boolean }) =>
      apiClient.patch(`/menu/items/${id}/status`, { is_available }),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey(branchId) }),
    onError: () => toast.error("Failed to update status"),
  });

  // Delete item
  const { mutate: deleteItem } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/menu/items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoriesKey(branchId) });
      toast.success("Item deleted");
    },
    onError: () => toast.error("Failed to delete item"),
  });

  return (
    <>
      {/* Category header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 transition"
          onClick={() => setOpen((o) => !o)}
        >
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown size={16} className="text-gray-400" />
            ) : (
              <ChevronRight size={16} className="text-gray-400" />
            )}
            <span className="font-semibold text-gray-800">{category.name}</span>
            <span className="text-xs text-gray-400 font-normal">
              ({category.items.length} item{category.items.length !== 1 ? "s" : ""})
            </span>
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => router.push(`/owner/menu/categories?highlight=${category.id}`)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
              title="Manage category"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setDeleteTarget({ type: "cat", id: category.id })}
              disabled={deletingCat}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
              title="Delete category"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Items */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="divide-y divide-gray-50 border-t border-gray-100">
                {category.items.length === 0 && (
                  <p className="px-4 py-4 text-sm text-gray-400 italic">
                    No items yet.{" "}
                    <button
                      onClick={() =>
                        router.push(
                          `/owner/menu/items/new?categoryId=${category.id}`
                        )
                      }
                      className="text-[#1A3C5E] underline underline-offset-2"
                    >
                      Add one
                    </button>
                  </p>
                )}

                {category.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition"
                  >
                    {/* Image thumbnail */}
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
                    )}

                    {/* Name + description */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-400 truncate">
                          {item.description}
                        </p>
                      )}
                      {item.dietary_tags?.length > 0 && (
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {item.dietary_tags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-medium"
                            >
                              {t.replace("_", " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <span className="text-sm font-bold text-[#1A3C5E] flex-shrink-0">
                      ₹{item.price.toLocaleString("en-IN")}
                    </span>

                    {/* Status badge */}
                    <span
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0",
                        item.is_available
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {item.is_available ? "Available" : "Unavailable"}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Toggle availability */}
                      <button
                        onClick={() =>
                          toggleStatus({ id: item.id, is_available: !item.is_available })
                        }
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition"
                        title={item.is_available ? "Mark unavailable" : "Mark available"}
                      >
                        {item.is_available ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() =>
                          router.push(`/owner/menu/items/${item.id}/edit`)
                        }
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        title="Edit item"
                      >
                        <Pencil size={14} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget({ type: "item", id: item.id })}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                        title="Delete item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add item shortcut */}
                <div className="px-4 py-2.5 border-t border-dashed border-gray-100">
                  <button
                    onClick={() =>
                      router.push(
                        `/owner/menu/items/new?categoryId=${category.id}`
                      )
                    }
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#1A3C5E] transition"
                  >
                    <Plus size={13} />
                    Add item to {category.name}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={deleteTarget?.type === "cat" ? "Delete Category?" : "Delete Item?"}
        message={
          deleteTarget?.type === "cat"
            ? "This will permanently delete the category and all its items. This action cannot be undone."
            : "This will permanently delete this menu item. This action cannot be undone."
        }
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === "cat") deleteCat(deleteTarget.id);
          else deleteItem(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MenuManagement() {
  const { branchId } = useAuth();
  const router = useRouter();
  const [showAddCategory, setShowAddCategory] = useState(false);

  const selectedBranchId = branchId ?? "";

  const {
    data: categories = [],
    isLoading,
    isError,
  } = useQuery<MenuCategory[]>({
    queryKey: categoriesKey(selectedBranchId),
    queryFn: () =>
      apiClient.get<MenuCategory[]>(
        `/menu/branch/${selectedBranchId}/categories`
      ),
    enabled: !!selectedBranchId,
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Menu</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/owner/menu/categories")}
            className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            Manage Categories
          </button>
          <button
            onClick={() => setShowAddCategory((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <Plus size={15} />
            Category
          </button>
          <button
            onClick={() => router.push("/owner/menu/items/new")}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#1A3C5E] text-white rounded-xl hover:bg-[#15304d] transition"
          >
            <Plus size={15} />
            Add Item
          </button>
        </div>
      </div>

      {/* Inline add-category form */}
      <AnimatePresence>
        {showAddCategory && (
          <AddCategoryForm
            branchId={selectedBranchId}
            onDone={() => setShowAddCategory(false)}
          />
        )}
      </AnimatePresence>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-gray-100 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="py-10 text-center text-sm text-red-500">
          Failed to load menu. Please refresh.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && categories.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          <p className="text-sm">No categories yet.</p>
          <button
            onClick={() => setShowAddCategory(true)}
            className="mt-2 text-sm text-[#1A3C5E] underline underline-offset-2"
          >
            Create your first category
          </button>
        </div>
      )}

      {/* Category accordions */}
      <div className="space-y-3">
        {categories.map((cat) => (
          <CategoryRow key={cat.id} category={cat} branchId={selectedBranchId} />
        ))}
      </div>
    </div>
  );
}