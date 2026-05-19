"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Check,
  Mail,
  Search,
  ChevronDown,
  Store,
  AlertCircle,
} from "lucide-react";

import PageWrapper from "@/components/layout/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Status action button ─────────────────────────────────────────────────────

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
        <Ban size={13} />
        Suspend
      </button>
    );
  }

  if (restaurant.status === "suspended" || restaurant.status === "pending") {
    return (
      <button
        disabled={isPending}
        onClick={() => onMutate({ id: restaurant.id, newStatus: "active" })}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 transition"
        title="Activate restaurant"
      >
        <Check size={13} />
        Activate
      </button>
    );
  }

  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminRestaurantsPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  // ── Fetch all restaurants ─────────────────────────────────────────────────
  // GET /admin/restaurants?page=1&limit=20
  // The backend getRestaurants() returns { data, count } — we read .data but
  // the apiClient already unwraps the outer ApiResponse envelope (json.data),
  // so depending on what the controller returns we might get an array directly
  // or { data: [], count: N }. Handle both shapes below.
  const { data: raw, isLoading, isError } = useQuery({
    queryKey: ["admin", "restaurants"],
    queryFn: () =>
      apiClient.get<Restaurant[] | { data: Restaurant[]; count: number }>(
        "/admin/restaurants?page=1&limit=20"
      ),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  // Normalise: backend may return array or { data, count }
  const restaurants: Restaurant[] = useMemo(() => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if ("data" in raw && Array.isArray(raw.data)) return raw.data;
    return [];
  }, [raw]);

  // ── Status mutation ───────────────────────────────────────────────────────
  // PATCH /restaurants/:id/status  → { status: "active" | "suspended" }
  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      apiClient.patch(`/restaurants/${id}/status`, { status: newStatus }),
    onSuccess: (_, vars) => {
      toast.success(
        `Restaurant ${vars.newStatus === "active" ? "activated" : "suspended"} successfully`
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "restaurants"] });
    },
    onError: () => toast.error("Failed to update restaurant status"),
  });

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return restaurants.filter((r) => {
      const matchesStatus =
        statusFilter === "all" || r.status === statusFilter;
      const matchesSearch =
        !needle ||
        r.name?.toLowerCase().includes(needle) ||
        r.owner?.name?.toLowerCase().includes(needle) ||
        r.owner?.email?.toLowerCase().includes(needle) ||
        r.city?.toLowerCase().includes(needle);
      return matchesStatus && matchesSearch;
    });
  }, [restaurants, search, statusFilter]);

  const STATUS_OPTIONS = ["all", "active", "pending", "suspended"];

  return (
    <PageWrapper
      title="Restaurants"
      subtitle="Manage all restaurants on the platform"
    >
      <div className="space-y-5">

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, owner, or city…"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all"
                  ? "All Status"
                  : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Summary pills */}
        {!isLoading && (
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            {[
              {
                label: "Total",
                count: restaurants.length,
                color: "bg-gray-100 text-gray-600",
              },
              {
                label: "Active",
                count: restaurants.filter((r) => r.status === "active").length,
                color: "bg-green-100 text-green-700",
              },
              {
                label: "Pending",
                count: restaurants.filter((r) => r.status === "pending").length,
                color: "bg-yellow-100 text-yellow-700",
              },
              {
                label: "Suspended",
                count: restaurants.filter((r) => r.status === "suspended")
                  .length,
                color: "bg-red-100 text-red-700",
              },
            ].map((pill) => (
              <span
                key={pill.label}
                className={cn("px-3 py-1 rounded-full", pill.color)}
              >
                {pill.count} {pill.label}
              </span>
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
            <AlertCircle size={16} />
            Failed to load restaurants. Check your permissions and try again.
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-white rounded-xl border border-gray-100 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Table */}
        {!isLoading && (
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  {[
                    "Restaurant",
                    "Owner",
                    "City",
                    "Status",
                    "Revenue",
                    "Joined",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className="px-5 py-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((r) => (
                  <>
                    {/* Main row */}
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() =>
                        setExpanded(expanded === r.id ? null : r.id)
                      }
                    >
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#1A3C5E]/10 flex items-center justify-center text-[#1A3C5E] font-bold text-sm shrink-0">
                            {r.name?.slice(0, 2).toUpperCase()}
                          </div>
                          <p className="font-semibold text-gray-900">
                            {r.name}
                          </p>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="px-5 py-4">
                        <p className="text-gray-900">{r.owner?.name ?? "—"}</p>
                        <p className="text-xs text-gray-400">
                          {r.owner?.email ?? ""}
                        </p>
                      </td>

                      {/* City */}
                      <td className="px-5 py-4 text-gray-600">
                        {r.city ?? r.branches?.[0]?.city ?? "—"}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge status={r.status} size="sm" />
                      </td>

                      {/* Revenue */}
                      <td className="px-5 py-4 font-medium text-gray-800">
                        {formatCurrency(r.totalRevenue ?? 0)}
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-4 text-gray-500 text-xs">
                        {r.createdAt ? formatDate(r.createdAt) : "—"}
                      </td>

                      {/* Actions */}
                      <td
                        className="px-5 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <StatusActionButton
                            restaurant={r}
                            onMutate={(p) => statusMutation.mutate(p)}
                            isPending={statusMutation.isPending}
                          />
                          {r.owner?.email && (
                            <a
                              href={`mailto:${r.owner.email}`}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                              title="Email owner"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail size={14} />
                            </a>
                          )}
                          <ChevronDown
                            size={14}
                            className={cn(
                              "text-gray-400 transition-transform",
                              expanded === r.id && "rotate-180"
                            )}
                          />
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row — branches detail */}
                    {expanded === r.id && (
                      <tr key={`${r.id}-detail`} className="bg-blue-50/30">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-semibold uppercase text-gray-500 mb-2">
                                Branches ({r.branches?.length ?? 0})
                              </p>
                              {r.branches?.length ? (
                                r.branches.map((b) => (
                                  <div
                                    key={b.id ?? b.name}
                                    className="flex items-center gap-2 mb-1.5"
                                  >
                                    <span
                                      className={cn(
                                        "h-2 w-2 rounded-full shrink-0",
                                        b.active
                                          ? "bg-green-500"
                                          : "bg-gray-300"
                                      )}
                                    />
                                    <span className="text-sm text-gray-700">
                                      {b.name}
                                    </span>
                                    {b.city && (
                                      <span className="text-xs text-gray-400">
                                        — {b.city}
                                      </span>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-gray-400">
                                  No branches on record
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase text-gray-500 mb-2">
                                Owner Contact
                              </p>
                              <p className="text-sm text-gray-700">
                                {r.owner?.name ?? "—"}
                              </p>
                              <p className="text-xs text-gray-400">
                                {r.owner?.email ?? "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Store size={32} className="opacity-30" />
                        <p className="text-sm">No restaurants match your filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}