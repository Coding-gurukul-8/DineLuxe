"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DIETARY_TAGS } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Types

interface MenuItemDetail {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  dietary_tags: string[];
  prep_time_minutes: number | null;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

// Schema

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be >= 0"),
  category_id: z.string().min(1, "Please select a category"),
  dietary_tags: z.array(z.string()).default([]),
  prep_time_minutes: z.coerce.number().int().min(0).optional(),
  image_url: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  is_available: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

// Page

export default function EditMenuItemPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params.itemId as string;
  const { branchId } = useAuth();
  const qc = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const watchedTags = watch("dietary_tags") ?? [];
  const watchedImageUrl = watch("image_url");

  // Fetch item details
  const {
    data: item,
    isLoading,
    isError,
  } = useQuery<MenuItemDetail>({
    queryKey: ["menu", "item", itemId],
    queryFn: () => apiClient.get<MenuItemDetail>(`/menu/items/${itemId}`),
    enabled: !!itemId,
  });

  // Fetch categories for the branch
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["menu", "categories", branchId],
    queryFn: () =>
      apiClient.get<Category[]>(`/menu/branch/${branchId}/categories`),
    enabled: !!branchId,
  });

  // Pre-fill form once item loads
  useEffect(() => {
    if (!item) return;
    reset({
      name: item.name,
      description: item.description ?? "",
      price: item.price,
      category_id: item.category_id,
      dietary_tags: item.dietary_tags ?? [],
      prep_time_minutes: item.prep_time_minutes ?? undefined,
      image_url: item.image_url ?? "",
      is_available: item.is_available,
    });
  }, [item, reset]);

  // Update item
  const { mutate: updateItem } = useMutation({
    mutationFn: (data: FormValues) =>
      apiClient.patch(`/menu/items/${itemId}`, {
        name: data.name,
        description: data.description || undefined,
        price: data.price,
        category_id: data.category_id,
        dietary_tags: data.dietary_tags,
        prep_time_minutes: data.prep_time_minutes || undefined,
        image_url: data.image_url || undefined,
        is_available: data.is_available,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu", "categories", branchId] });
      qc.invalidateQueries({ queryKey: ["menu", "item", itemId] });
      toast.success("Item updated");
      router.push("/owner/menu/items");
    },
    onError: () => toast.error("Failed to update item"),
  });

  // Delete item
  const { mutate: deleteItem, isPending: isDeleting } = useMutation({
    mutationFn: () => apiClient.delete(`/menu/items/${itemId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu", "categories", branchId] });
      toast.success("Item deleted");
      router.push("/owner/menu/items");
    },
    onError: () => toast.error("Failed to delete item"),
  });

  const toggleTag = (tag: string) => {
    setValue(
      "dietary_tags",
      watchedTags.includes(tag)
        ? watchedTags.filter((t) => t !== tag)
        : [...watchedTags, tag],
      { shouldDirty: true }
    );
  };

  // Loading / error states

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 flex items-center justify-center gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading item...</span>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-sm text-red-500">Failed to load item.</p>
        <button
          onClick={() => router.back()}
          className="mt-3 text-sm text-[#1A3C5E] underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Edit Item</h1>
            <p className="text-sm text-gray-400 truncate max-w-60">
              {item.name}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowDeleteDialog(true)}
          disabled={isDeleting}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500 border border-red-100 rounded-xl hover:bg-red-50 transition"
        >
          {isDeleting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Trash2 size={14} />
          )}
          Delete
        </button>
      </div>

      <form
        onSubmit={handleSubmit((d) => updateItem(d))}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
      >
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Item Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register("name")}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
          />
          {errors.name && (
            <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Description
          </label>
          <textarea
            {...register("description")}
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
          />
        </div>

        {/* Price + Prep time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Price (₹) <span className="text-red-500">*</span>
            </label>
            <input
              {...register("price")}
              type="number"
              min="0"
              step="0.01"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
            />
            {errors.price && (
              <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Prep Time (min)
            </label>
            <input
              {...register("prep_time_minutes")}
              type="number"
              min="0"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            {...register("category_id")}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20 bg-white"
          >
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {errors.category_id && (
            <p className="text-xs text-red-500 mt-1">
              {errors.category_id.message}
            </p>
          )}
        </div>

        {/* Dietary tags */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">
            Dietary Tags
          </label>
          <div className="flex flex-wrap gap-2">
            {DIETARY_TAGS.map((tag) => {
              const active = watchedTags.includes(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition",
                    active
                      ? "bg-green-100 border-green-400 text-green-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  )}
                >
                  {tag.replace("_", " ")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Image URL */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Image URL
          </label>
          <input
            {...register("image_url")}
            type="url"
            placeholder="https://..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
          />
          {errors.image_url && (
            <p className="text-xs text-red-500 mt-1">
              {errors.image_url.message}
            </p>
          )}
          {watchedImageUrl && !errors.image_url && (
            <img
              src={watchedImageUrl}
              alt="Preview"
              className="mt-2 h-24 w-24 object-cover rounded-xl border border-gray-200"
              onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
            />
          )}
        </div>

        {/* Availability */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_available"
            {...register("is_available")}
            className="rounded"
          />
          <label htmlFor="is_available" className="text-sm text-gray-700 cursor-pointer">
            Available for ordering
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="flex-1 py-3 rounded-xl bg-[#1A3C5E] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-[#15304d] transition"
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </form>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Item?"
        message={`"${item.name}" will be permanently removed from your menu. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={() => {
          setShowDeleteDialog(false);
          deleteItem();
        }}
      />
    </div>
  );
}
