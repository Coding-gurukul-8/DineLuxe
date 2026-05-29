"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ban,
  Check,
  Search,
  ChevronDown,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  X,
} from "lucide-react";

import PageWrapper from "@/components/layout/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

interface Restaurant {
  id: string;
  name: string;
  status: "active" | "pending" | "suspended";
  owner?: { name?: string; email?: string };
  city?: string;
  branches?: { id: string; name: string; city?: string; active?: boolean }[];
  totalRevenue?: number;
  createdAt?: string;
}

type AdminRestaurantsResponse = {
  data: Restaurant[];
  count?: number;
};

type SortKey = "name" | "status" | "totalRevenue" | "createdAt";
type SortDir = "asc" | "desc";

function normalizeRestaurants(
  payload: AdminRestaurantsResponse | Restaurant[] | null | undefined
): Restaurant[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function StatusActionButton({
  restaurant,
  onMutate,
  isPending,
}: {
  restaurant: Restaurant;
  onMutate: (payload: { id: string; newStatus: string }) => void;
  isPending: boolean;
}) {
  if (restaurant.status === "active") {
    return (
      <button
        disabled={isPending}
        onClick={() => onMutate({ id: restaurant.id, newStatus: "suspended" })}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition"
        title="Suspend restaurant"
      >
        <Ban size={12} /> Suspend
      </button>
    );
  }

  return (
    <button
      disabled={isPending}
      onClick={() => onMutate({ id: restaurant.id, newStatus: "active" })}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 transition"
      title="Activate restaurant"
    >
      <Check size={12} /> Activate
    </button>
  );
}

function DetailPanel({
  restaurant,
  onClose,
}: {
  restaurant: Restaurant;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.tr key="detail">
        <td colSpan={6} className="p-0">
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-gray-50/80 border-t border-gray-100"
          >
            <div className="px-6 py-5">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold text-gray-900">
                  {restaurant.name} — Details
                </h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                    Owner
                  </p>
                  <p className="text-gray-700">{restaurant.owner?.name ?? "—"}</p>
                  <p className="text-xs text-gray-400">{restaurant.owner?.email ?? ""}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                    Total Revenue
                  </p>
                  <p className="font-mono font-semibold text-[#E8A020]">
                    {restaurant.totalRevenue != null
                      ? formatCurrency(restaurant.totalRevenue)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                    Branches
                  </p>
                  <p className="text-gray-700">
                    {restaurant.branches?.length ?? 0} branch(es)
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                    City
                  </p>
                  <p className="text-gray-700">{restaurant.city ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                    Joined
                  </p>
                  <p className="text-gray-700">
                    {restaurant.createdAt ? formatDate(restaurant.createdAt) : "—"}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </td>
      </motion.tr>
    </AnimatePresence>
  );
}

export default function AdminRestaurantsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "pending" | "suspended"
  >("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: restaurants = [], isLoading, isError } = useQuery<Restaurant[]>({
    queryKey: ["admin", "restaurants"],
    queryFn: async () => {
      const result = await apiClient.get<AdminRestaurantsResponse | Restaurant[]>(
        "/admin/restaurants"
      );
      return normalizeRestaurants(result);
    },
    staleTime: 30_000,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      apiClient.patch(`/admin/restaurants/${id}/status`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "restaurants"] });
      toast.success("Restaurant status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let list = restaurants.filter((r) => {
      const matchSearch =
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.owner?.email?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
    list = [...list].sort((a, b) => {
      let av: string | number = (a as any)[sortKey] ?? "";
      let bv: string | number = (b as any)[sortKey] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [restaurants, search, statusFilter, sortKey, sortDir]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey !== col ? (
      <ChevronDown size={12} className="text-gray-300" />
    ) : sortDir === "asc" ? (
      <ArrowUp size={12} className="text-[#1A3C5E]" />
    ) : (
      <ArrowDown size={12} className="text-[#1A3C5E]" />
    );

  const ThBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(col)}
      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition-colors"
    >
      {label} <SortIcon col={col} />
    </button>
  );

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Restaurants
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {filtered.length} results
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-50 max-w-xs">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search restaurants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "active", "pending", "suspended"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors",
                statusFilter === s
                  ? "bg-[#1A3C5E] text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="w-8 px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded"
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? new Set(filtered.map((r) => r.id))
                          : new Set()
                      )
                    }
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <ThBtn col="name" label="Name" />
                </th>
                <th className="px-4 py-3 text-left">
                  <ThBtn col="status" label="Status" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">
                  Owner
                </th>
                <th className="px-4 py-3 text-right hidden md:table-cell">
                  <ThBtn col="totalRevenue" label="Revenue" />
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="h-5 bg-gray-100 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                : isError
                  ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-12 text-center text-sm text-gray-400"
                        >
                          <div className="inline-flex items-center gap-2">
                            <AlertCircle size={16} className="text-red-400" />
                            Failed to load restaurants
                          </div>
                        </td>
                      </tr>
                    )
                  : filtered.map((r, idx) => (
                      <Fragment key={r.id}>
                        <motion.tr
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.04 }}
                          className={cn(
                            "border-t border-gray-50 group relative hover:bg-gray-50/50 transition-colors",
                            selected.has(r.id) && "bg-[#1A3C5E]/3"
                          )}
                        >
                          <td className="w-8 px-4 py-3.5">
                            <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[#E8A020] opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                            <input
                              type="checkbox"
                              className="rounded"
                              checked={selected.has(r.id)}
                              onChange={() => toggleSelect(r.id)}
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-sm font-medium text-gray-800">{r.name}</p>
                            {r.city && (
                              <p className="text-xs text-gray-400">{r.city}</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-4 py-3.5 hidden md:table-cell">
                            <p className="text-xs text-gray-600">
                              {r.owner?.name ?? "—"}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {r.owner?.email ?? ""}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 text-right hidden md:table-cell">
                            <span className="font-mono text-sm font-semibold text-[#E8A020]">
                              {r.totalRevenue != null
                                ? formatCurrency(r.totalRevenue)
                                : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              <StatusActionButton
                                restaurant={r}
                                onMutate={(p) => statusMutation.mutate(p)}
                                isPending={statusMutation.isPending}
                              />
                              <button
                                onClick={() =>
                                  setExpandedId(expandedId === r.id ? null : r.id)
                                }
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1A3C5E] transition-colors px-2 py-1.5 rounded-lg hover:bg-[#1A3C5E]/8"
                              >
                                View
                                <ChevronRight
                                  size={12}
                                  className={cn(
                                    "transition-transform",
                                    expandedId === r.id && "rotate-90"
                                  )}
                                />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                        {expandedId === r.id && (
                          <DetailPanel
                            restaurant={r}
                            onClose={() => setExpandedId(null)}
                          />
                        )}
                      </Fragment>
                    ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1A3C5E] text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 z-50"
          >
            <span className="text-sm font-medium">{selected.size} selected</span>
            <div className="h-4 w-px bg-white/20" />
            <button
              className="flex items-center gap-1.5 text-sm font-medium text-emerald-300 hover:text-emerald-200 transition-colors"
              onClick={() => {
                selected.forEach((id) =>
                  statusMutation.mutate({ id, newStatus: "active" })
                );
                setSelected(new Set());
              }}
            >
              <Check size={14} /> Activate All
            </button>
            <button
              className="flex items-center gap-1.5 text-sm font-medium text-red-300 hover:text-red-200 transition-colors"
              onClick={() => {
                selected.forEach((id) =>
                  statusMutation.mutate({ id, newStatus: "suspended" })
                );
                setSelected(new Set());
              }}
            >
              <Ban size={14} /> Suspend All
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-white/40 hover:text-white/70 transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </PageWrapper>
  );
}
