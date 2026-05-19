"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { QueryBoundary } from "@/components/shared/QueryBoundary";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { handleApiError } from "@/lib/handle-error";
import { formatCurrency } from "@/lib/utils";
import type { MenuItem, MenuCategory, PublicMenu } from "@/types/api";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChefHat,
  Loader2,
} from "lucide-react";

type StatusFilter = "all" | "available" | "sold_out" | "hidden";
type MenuCategoryResponse = MenuCategory & { menu_items?: MenuItem[] };
type MenuResponse = PublicMenu | MenuCategoryResponse[];

export default function MenuItemsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { branchId } = useAuth();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch full menu (categories + items together)
  const {
    data: menu,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<MenuResponse>({
    queryKey: ["owner", "menu", branchId],
    queryFn: () => apiClient.get<MenuResponse>(`/menu/branch/${branchId}`),
    enabled: !!branchId,
  });

  const categories: MenuCategoryResponse[] = Array.isArray(menu)
    ? menu
    : menu?.categories ?? [];

  const allItems: MenuItem[] = categories.flatMap(
    (c) => c.items ?? c.menu_items ?? []
  );

  // Client-side filtering
  const filtered = allItems.filter((item) => {
    const matchSearch =
      search.trim() === "" ||
      item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      categoryFilter === "all" || item.category_id === categoryFilter;
    const matchStatus = statusFilter === "all" || item.status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  // Toggle availability
  const toggleAvailability = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MenuItem["status"] }) =>
      apiClient.patch(`/menu/items/${id}/status`, { status }),
    onSuccess: () => {
      toast.success("Item status updated.");
      qc.invalidateQueries({ queryKey: ["owner", "menu", branchId] });
    },
    onError: (err) => toast.error(handleApiError(err)),
  });

  // Delete item
  const deleteItem = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/menu/items/${id}`),
    onSuccess: () => {
      toast.success("Item deleted.");
      setDeletingId(null);
      qc.invalidateQueries({ queryKey: ["owner", "menu", branchId] });
    },
    onError: (err) => {
      toast.error(handleApiError(err));
      setDeletingId(null);
    },
  });

  const handleDelete = (item: MenuItem) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setDeletingId(item.id);
    deleteItem.mutate(item.id);
  };

  return (
    <PageWrapper
      title="Menu Items"
      subtitle="Manage all dishes across your menu"
      action={
        <Button
          onClick={() => router.push("/owner/menu/items/new")}
          className="bg-[#1A3C5E] hover:bg-[#15304d] text-white"
        >
          <Plus size={16} className="mr-2" />
          Add Item
        </Button>
      }
    >
      {/* Filters bar */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:border-[#1A3C5E] focus:ring-2 focus:ring-[#1A3C5E]/20 outline-none"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 outline-none cursor-pointer"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 outline-none cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="available">Available</option>
          <option value="sold_out">Sold Out</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {/* Item count */}
      {!isLoading && !isError && (
        <p className="text-sm text-gray-500">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          {search || categoryFilter !== "all" || statusFilter !== "all"
            ? " (filtered)"
            : ""}
        </p>
      )}

      {/* Content */}
      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        loadingMessage="Loading menu..."
      >
        {filtered.length === 0 ? (
          <EmptyState
            variant={search ? "search" : "menu"}
            title={search ? "No items found" : "No menu items yet"}
            message={
              search
                ? `Nothing matched "${search}"`
                : "Add your first dish to get started."
            }
            action={
              !search
                ? {
                    label: "Add Item",
                    onClick: () => router.push("/owner/menu/items/new"),
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((item, i) => {
              const category = categories.find((c) => c.id === item.category_id);
              const isAvailable = item.status === "available";
              const tags = item.dietary_tags ?? [];

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                >
                  <Card className="p-4 flex gap-4 hover:shadow-md transition-shadow">
                    {/* Thumbnail */}
                    {item.photo_url ? (
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0 bg-gray-100"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                        <ChefHat size={20} className="text-gray-300" />
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-medium text-gray-900 truncate leading-snug">
                          {item.name}
                        </p>
                        <StatusBadge status={item.status} size="sm" />
                      </div>

                      {category && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {category.name}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(item.price)}
                        </p>
                        {tags.length > 0 && (
                          <div className="flex gap-1">
                            {tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action row */}
                      <div className="flex items-center gap-1 mt-3">
                        {/* Edit */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-gray-500 hover:text-[#1A3C5E]"
                          onClick={() =>
                            router.push(`/owner/menu/items/${item.id}/edit`)
                          }
                        >
                          <Pencil size={14} />
                        </Button>

                        {/* Toggle availability */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 px-2 ${
                            isAvailable
                              ? "text-green-600 hover:bg-green-50"
                              : "text-gray-400 hover:bg-gray-50"
                          }`}
                          disabled={toggleAvailability.isPending}
                          onClick={() =>
                            toggleAvailability.mutate({
                              id: item.id,
                              status: isAvailable ? "sold_out" : "available",
                            })
                          }
                          title={isAvailable ? "Mark sold out" : "Mark available"}
                        >
                          {isAvailable ? (
                            <ToggleRight size={16} />
                          ) : (
                            <ToggleLeft size={16} />
                          )}
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-red-400 hover:text-red-600 hover:bg-red-50"
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item)}
                        >
                          {deletingId === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </QueryBoundary>
    </PageWrapper>
  );
}