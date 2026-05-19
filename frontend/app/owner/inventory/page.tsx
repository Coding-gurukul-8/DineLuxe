"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Plus, Package, AlertTriangle, Pencil, Trash2, Check, X,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number;
  is_low_stock: boolean;
}

interface AddItemForm {
  name: string;
  unit: string;
  quantity: string;
  min_quantity: string;
}

// ── Add Item Modal ────────────────────────────────────────────────────────────

function AddItemModal({
  open,
  branchId,
  onClose,
}: {
  open: boolean;
  branchId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AddItemForm>({
    name: "",
    unit: "",
    quantity: "",
    min_quantity: "",
  });
  const [errors, setErrors] = useState<Partial<AddItemForm>>({});

  const mutation = useMutation({
    mutationFn: (body: {
      branch_id: string;
      name: string;
      unit: string;
      quantity: number;
      min_quantity: number;
    }) => apiClient.post("/inventory", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", "branch", branchId] });
      toast.success("Item added to inventory");
      onClose();
      setForm({ name: "", unit: "", quantity: "", min_quantity: "" });
      setErrors({});
    },
    onError: () => toast.error("Failed to add item"),
  });

  const validate = (): boolean => {
    const e: Partial<AddItemForm> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.unit.trim()) e.unit = "Unit is required";
    if (!form.quantity || isNaN(Number(form.quantity)) || Number(form.quantity) < 0)
      e.quantity = "Enter a valid quantity";
    if (!form.min_quantity || isNaN(Number(form.min_quantity)) || Number(form.min_quantity) < 0)
      e.min_quantity = "Enter a valid minimum";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    mutation.mutate({
      branch_id: branchId,
      name: form.name.trim(),
      unit: form.unit.trim(),
      quantity: Number(form.quantity),
      min_quantity: Number(form.min_quantity),
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Add Inventory Item</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Item Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Basmati Rice"
              className={cn(
                "w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-brand-primary/30 transition",
                errors.name ? "border-red-400" : "border-gray-200"
              )}
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit
            </label>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              placeholder="e.g. kg, litre, pcs"
              className={cn(
                "w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-brand-primary/30 transition",
                errors.unit ? "border-red-400" : "border-gray-200"
              )}
            />
            {errors.unit && (
              <p className="text-xs text-red-500 mt-1">{errors.unit}</p>
            )}
          </div>

          {/* Quantity + Min side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Qty
              </label>
              <input
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantity: e.target.value }))
                }
                placeholder="0"
                className={cn(
                  "w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-brand-primary/30 transition",
                  errors.quantity ? "border-red-400" : "border-gray-200"
                )}
              />
              {errors.quantity && (
                <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Qty
              </label>
              <input
                type="number"
                min={0}
                value={form.min_quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, min_quantity: e.target.value }))
                }
                placeholder="0"
                className={cn(
                  "w-full px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-brand-primary/30 transition",
                  errors.min_quantity ? "border-red-400" : "border-gray-200"
                )}
              />
              {errors.min_quantity && (
                <p className="text-xs text-red-500 mt-1">{errors.min_quantity}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Add Item
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Inline Edit Row ───────────────────────────────────────────────────────────

function InventoryRow({
  item,
  branchId,
  onDeleteRequest,
}: {
  item: InventoryItem;
  branchId: string;
  onDeleteRequest: (item: InventoryItem) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(item.quantity));
  const [minQty, setMinQty] = useState(String(item.min_quantity));
  const [name, setName] = useState(item.name);

  const patchMutation = useMutation({
    mutationFn: (body: { quantity?: number; min_quantity?: number; name?: string }) =>
      apiClient.patch(`/inventory/${item.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", "branch", branchId] });
      toast.success(`${item.name} updated`);
      setEditing(false);
    },
    onError: () => toast.error("Failed to update item"),
  });

  const handleUpdate = () => {
    const body: { quantity?: number; min_quantity?: number; name?: string } = {};
    const newQty = Number(qty);
    const newMin = Number(minQty);
    const newName = name.trim();
    if (!isNaN(newQty) && newQty !== item.quantity) body.quantity = newQty;
    if (!isNaN(newMin) && newMin !== item.min_quantity) body.min_quantity = newMin;
    if (newName && newName !== item.name) body.name = newName;
    if (Object.keys(body).length === 0) { setEditing(false); return; }
    patchMutation.mutate(body);
  };

  const handleCancel = () => {
    setQty(String(item.quantity));
    setMinQty(String(item.min_quantity));
    setName(item.name);
    setEditing(false);
  };

  return (
    <tr
      className={cn(
        "border-b border-gray-100 transition-colors",
        item.is_low_stock ? "bg-red-50/40" : "bg-white hover:bg-gray-50/60"
      )}
    >
      {/* Name */}
      <td className="px-4 py-3">
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
        ) : (
          <div className="flex items-center gap-2">
            {item.is_low_stock && (
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
            )}
            <span className="text-sm font-medium text-gray-900">{item.name}</span>
          </div>
        )}
      </td>

      {/* Unit */}
      <td className="px-4 py-3 text-sm text-gray-500">{item.unit}</td>

      {/* Quantity */}
      <td className="px-4 py-3">
        {editing ? (
          <input
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-primary/30 text-center"
          />
        ) : (
          <span
            className={cn(
              "text-sm font-semibold",
              item.is_low_stock ? "text-red-600" : "text-gray-800"
            )}
          >
            {item.quantity}{" "}
            <span className="text-xs font-normal text-gray-400">{item.unit}</span>
          </span>
        )}
      </td>

      {/* Min Qty */}
      <td className="px-4 py-3">
        {editing ? (
          <input
            type="number"
            min={0}
            value={minQty}
            onChange={(e) => setMinQty(e.target.value)}
            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-primary/30 text-center"
          />
        ) : (
          <span className="text-sm text-gray-500">
            {item.min_quantity}{" "}
            <span className="text-xs text-gray-400">{item.unit}</span>
          </span>
        )}
      </td>

      {/* Status Badge */}
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
            item.is_low_stock
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-700"
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              item.is_low_stock ? "bg-red-500" : "bg-green-500"
            )}
          />
          {item.is_low_stock ? "Low Stock" : "OK"}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 justify-end">
          {editing ? (
            <>
              <button
                onClick={handleUpdate}
                disabled={patchMutation.isPending}
                className="p-1.5 rounded-lg bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-60 transition-colors"
                title="Save"
              >
                {patchMutation.isPending ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                ) : (
                  <Check size={14} />
                )}
              </button>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                title="Cancel"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDeleteRequest(item)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OwnerInventoryPage() {
  const { branchId } = useAuth();
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);

  const { data: rawItems = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["inventory", "branch", branchId],
    queryFn: () =>
      apiClient.get<InventoryItem[]>(`/inventory/branch/${branchId}`),
    enabled: !!branchId,
    refetchInterval: 60_000,
  });

  // Sort low-stock items to the top
  const items = [...rawItems].sort((a, b) => {
    if (a.is_low_stock && !b.is_low_stock) return -1;
    if (!a.is_low_stock && b.is_low_stock) return 1;
    return a.name.localeCompare(b.name);
  });

  const lowCount = items.filter((i) => i.is_low_stock).length;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/inventory/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", "branch", branchId] });
      toast.success(`${deleteTarget?.name ?? "Item"} removed`);
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete item"),
  });

  return (
    <PageWrapper
      title="Inventory"
      subtitle="Manage stock levels for this branch"
      action={
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-sm font-medium hover:bg-brand-primary/90 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Add Item
        </motion.button>
      }
    >
      {/* Summary bar */}
      <div className="flex items-center gap-5 text-sm">
        <span className="flex items-center gap-1.5 text-gray-500">
          <Package size={15} />
          {isLoading ? "Loading…" : `${items.length} item${items.length !== 1 ? "s" : ""}`}
        </span>
        {lowCount > 0 && (
          <span className="flex items-center gap-1.5 text-red-600 font-medium">
            <AlertTriangle size={14} />
            {lowCount} low-stock item{lowCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Package size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No inventory items yet</p>
            <p className="text-gray-400 text-sm mt-1">
              Click "Add Item" to start tracking stock for this branch.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Name
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Unit
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Min Qty
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {items.map((item) => (
                    <InventoryRow
                      key={item.id}
                      item={item}
                      branchId={branchId!}
                      onDeleteRequest={setDeleteTarget}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add modal */}
      <AnimatePresence>
        {showAddModal && branchId && (
          <AddItemModal
            open={showAddModal}
            branchId={branchId}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Inventory Item"
        message={`Remove "${deleteTarget?.name}" from inventory? This cannot be undone.`}
        confirmLabel={deleteMutation.isPending ? "Deleting…" : "Delete"}
        variant="danger"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageWrapper>
  );
}