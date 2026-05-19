"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { DIETARY_TAGS } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Types

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
});

type FormValues = z.infer<typeof schema>;

// Page

export default function NewMenuItemPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultCategoryId = searchParams.get("categoryId") ?? "";
  const { branchId } = useAuth();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      category_id: defaultCategoryId,
      dietary_tags: [],
      prep_time_minutes: undefined,
      image_url: "",
    },
  });

  const watchedTags = watch("dietary_tags");
  const watchedImageUrl = watch("image_url");

  // Set default category once params are known
  useEffect(() => {
    if (defaultCategoryId) setValue("category_id", defaultCategoryId);
  }, [defaultCategoryId, setValue]);

  // Fetch categories for the select
  const { data: categories = [], isLoading: loadingCats } = useQuery<Category[]>({
    queryKey: ["menu", "categories", branchId],
    queryFn: () =>
      apiClient.get<Category[]>(`/menu/branch/${branchId}/categories`),
    enabled: !!branchId,
  });

  const { mutate: createItem } = useMutation({
    mutationFn: (data: FormValues) =>
      apiClient.post("/menu/items", {
        name: data.name,
        description: data.description || undefined,
        price: data.price,
        category_id: data.category_id,
        branch_id: branchId,
        dietary_tags: data.dietary_tags,
        prep_time_minutes: data.prep_time_minutes || undefined,
        image_url: data.image_url || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu", "categories", branchId] });
      toast.success("Item created successfully");
      router.push("/owner/menu/items");
    },
    onError: () => toast.error("Failed to create item"),
  });

  const toggleTag = (tag: string) => {
    const current = watchedTags ?? [];
    setValue(
      "dietary_tags",
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Menu Item</h1>
          <p className="text-sm text-gray-400">Add a new item to your menu</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit((d) => createItem(d))}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
      >
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Item Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register("name")}
            placeholder="e.g. Paneer Tikka"
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
            placeholder="Short description of the dish..."
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
              placeholder="0.00"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
            />
            {errors.price && (
              <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Prep Time (minutes)
            </label>
            <input
              {...register("prep_time_minutes")}
              type="number"
              min="0"
              placeholder="e.g. 15"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Category <span className="text-red-500">*</span>
          </label>
          {loadingCats ? (
            <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
          ) : (
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
          )}
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
              const active = watchedTags?.includes(tag);
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
            disabled={isSubmitting}
            className="flex-1 py-3 rounded-xl bg-[#1A3C5E] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-[#15304d] transition"
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            Create Item
          </button>
        </div>
      </form>
    </div>
  );
}
