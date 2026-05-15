"use client"

import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ban, Check, ChevronDown, Mail, Search, SlidersHorizontal, X } from "lucide-react"
import PageWrapper from "@/components/layout/PageWrapper"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"

export default function AdminRestaurantsPage() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [expanded, setExpanded] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ["admin", "restaurants"],
    queryFn: () => apiClient.get<any[]>("/admin/restaurants"),
    refetchInterval: 60_000,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      apiClient.patch(`/admin/restaurants/${id}/status`, { status: newStatus }),
    onSuccess: (_, vars) => {
      toast.success(`Restaurant ${vars.newStatus}`)
      queryClient.invalidateQueries({ queryKey: ["admin", "restaurants"] })
    },
    onError: () => toast.error("Failed to update status"),
  })

  const statusOptions = ["all", "active", "pending", "suspended"]

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return restaurants
      .filter((r: any) => status === "all" || r.status === status)
      .filter((r: any) =>
        !needle ||
        r.name?.toLowerCase().includes(needle) ||
        r.owner?.name?.toLowerCase().includes(needle) ||
        r.owner?.email?.toLowerCase().includes(needle)
      )
  }, [restaurants, search, status])

  return (
    <PageWrapper title="Restaurants" subtitle="Manage all restaurants on the platform">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search restaurants…"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-500">Loading restaurants…</div>}

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              {["Restaurant", "Owner", "Status", "Revenue", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((r: any) => (
              <>
                <tr
                  key={r.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-sm">
                        {r.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-500">{r.city ?? r.branches?.[0]?.city ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-gray-900">{r.owner?.name}</p>
                    <p className="text-xs text-gray-500">{r.owner?.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={r.status} size="sm" />
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    Rs {(r.totalRevenue ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {r.status === "pending" && (
                        <button
                          onClick={() => statusMutation.mutate({ id: r.id, newStatus: "active" })}
                          className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"
                          title="Approve"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {r.status === "active" && (
                        <button
                          onClick={() => statusMutation.mutate({ id: r.id, newStatus: "suspended" })}
                          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                          title="Suspend"
                        >
                          <Ban size={14} />
                        </button>
                      )}
                      {r.status === "suspended" && (
                        <button
                          onClick={() => statusMutation.mutate({ id: r.id, newStatus: "active" })}
                          className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"
                          title="Reactivate"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <a
                        href={`mailto:${r.owner?.email}`}
                        className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                        title="Email owner"
                      >
                        <Mail size={14} />
                      </a>
                      <ChevronDown
                        size={14}
                        className={cn("text-gray-400 transition-transform", expanded === r.id && "rotate-180")}
                      />
                    </div>
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr key={`${r.id}-expanded`} className="bg-blue-50/30">
                    <td colSpan={5} className="px-5 py-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Branches</p>
                          {(r.branches ?? []).map((b: any) => (
                            <div key={b.id ?? b.name} className="flex items-center gap-2 mb-1">
                              <span className={cn("h-2 w-2 rounded-full", b.active ? "bg-green-500" : "bg-gray-300")} />
                              <span className="text-sm text-gray-700">{b.name}</span>
                              <span className="text-xs text-gray-400">— {b.manager ?? "No manager"}</span>
                            </div>
                          ))}
                          {!r.branches?.length && <p className="text-sm text-gray-400">No branches</p>}
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Joined</p>
                          <p className="text-sm text-gray-700">
                            {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">No restaurants found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageWrapper>
  )
}
