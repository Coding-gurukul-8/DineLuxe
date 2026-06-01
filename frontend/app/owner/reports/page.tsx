"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  Package,
  IndianRupee,
  Star,
  Timer,
  MapPin,
  ChevronDown,
  ChevronUp,
  Clock,
  Route,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"

// ─── Types ────────────────────────────────────────────────────────────────────

type DateFilter = "week" | "month" | "all"
type StatusFilter = "all" | "completed" | "failed"

interface DeliveryHistoryItem {
  id: string
  restaurantName: string
  deliveryArea: string
  completedAt: string // ISO string
  durationMinutes: number
  distanceKm: number
  earnings: number
  status: "completed" | "failed"
  rating?: number
}

interface DeliveryHistoryResponse {
  deliveries: DeliveryHistoryItem[]
  total: number
  page: number
  limit: number
}

interface PartnerStats {
  totalDeliveries: number
  totalEarned: number
  averageRating: number
  avgDurationMinutes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <Icon size={18} className="shrink-0 text-[#1A3C5E]" />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <p className="mt-0.5 text-base font-bold text-gray-950">{value}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: "completed" | "failed" }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
        Completed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">
      Failed
    </span>
  )
}

function DeliveryCard({ delivery }: { delivery: DeliveryHistoryItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <article
      className="cursor-pointer rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Summary row */}
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-gray-950">
              {delivery.restaurantName}
            </h3>
            <StatusBadge status={delivery.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin size={13} />
              {delivery.deliveryArea}
            </span>
            <span>{formatDate(delivery.completedAt)}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-base font-bold text-[#1E7E34]">
            ₹{delivery.earnings.toFixed(2)}
          </span>
          {delivery.rating != null && (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
              <Star size={12} fill="currentColor" />
              {delivery.rating.toFixed(1)}
            </span>
          )}
          <span className="text-gray-400">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Detail
              icon={Clock}
              label="Duration"
              value={`${delivery.durationMinutes} min`}
            />
            <Detail
              icon={Route}
              label="Distance"
              value={`${delivery.distanceKm.toFixed(1)} km`}
            />
            <Detail
              icon={IndianRupee}
              label="Earnings"
              value={`₹${delivery.earnings.toFixed(2)}`}
            />
            <Detail
              icon={Star}
              label="Rating"
              value={delivery.rating != null ? `⭐ ${delivery.rating.toFixed(1)}` : "Not rated"}
            />
          </div>
        </div>
      )}
    </article>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Icon size={13} />
        {label}
      </div>
      <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeliveryHistoryPage() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [page, setPage] = useState(1)
  const [allDeliveries, setAllDeliveries] = useState<DeliveryHistoryItem[]>([])

  // Stats
  const { data: stats } = useQuery<PartnerStats>({
    queryKey: ["delivery", "partner", "stats"],
    queryFn: () => apiClient.get<PartnerStats>("/delivery/partner/stats"),
  })

  // History (paginated)
  const { data: historyPage, isFetching } = useQuery<DeliveryHistoryResponse>({
    queryKey: ["delivery", "partner", "history", dateFilter, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(dateFilter !== "all" && { period: dateFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      })
      const result = await apiClient.get<DeliveryHistoryResponse>(
        `/delivery/partner/history?${params}`
      )
      // Append to accumulated list for "load more" pattern
      if (page === 1) {
        setAllDeliveries(result.deliveries ?? [])
      } else {
        setAllDeliveries((prev) => [...prev, ...(result.deliveries ?? [])])
      }
      return result
    },
    keepPreviousData: true,
  })

  // Reset page when filters change
  function applyDateFilter(f: DateFilter) {
    setDateFilter(f)
    setPage(1)
    setAllDeliveries([])
  }

  function applyStatusFilter(f: StatusFilter) {
    setStatusFilter(f)
    setPage(1)
    setAllDeliveries([])
  }

  const hasMore =
    historyPage != null &&
    allDeliveries.length < historyPage.total

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/delivery"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-950">Delivery History</h1>
            <p className="text-sm text-gray-500">Showing all your past deliveries</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip
            icon={Package}
            label="Total Deliveries"
            value={stats?.totalDeliveries != null ? String(stats.totalDeliveries) : "—"}
          />
          <StatChip
            icon={IndianRupee}
            label="Total Earned"
            value={stats?.totalEarned != null ? `₹${stats.totalEarned.toLocaleString("en-IN")}` : "—"}
          />
          <StatChip
            icon={Star}
            label="Avg Rating"
            value={stats?.averageRating != null ? stats.averageRating.toFixed(1) : "—"}
          />
          <StatChip
            icon={Timer}
            label="Avg Duration"
            value={stats?.avgDurationMinutes != null ? `${stats.avgDurationMinutes} min` : "—"}
          />
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date filter */}
          <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white text-sm font-semibold shadow-sm">
            {(
              [
                { label: "This Week", value: "week" as DateFilter },
                { label: "This Month", value: "month" as DateFilter },
                { label: "All Time", value: "all" as DateFilter },
              ] as const
            ).map(({ label, value }) => (
              <button
                key={value}
                onClick={() => applyDateFilter(value)}
                className={`min-h-10 px-4 transition ${
                  dateFilter === value
                    ? "bg-[#1A3C5E] text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white text-sm font-semibold shadow-sm">
            {(
              [
                { label: "All", value: "all" as StatusFilter },
                { label: "Completed", value: "completed" as StatusFilter },
                { label: "Failed", value: "failed" as StatusFilter },
              ] as const
            ).map(({ label, value }) => (
              <button
                key={value}
                onClick={() => applyStatusFilter(value)}
                className={`min-h-10 px-4 transition ${
                  statusFilter === value
                    ? "bg-[#1A3C5E] text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Delivery list */}
        <section className="space-y-3">
          {isFetching && page === 1 && (
            <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
          )}

          {!isFetching && allDeliveries.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white py-16 text-center shadow-sm">
              <Package size={40} className="mx-auto text-gray-300" />
              <p className="mt-3 text-sm font-semibold text-gray-500">
                No deliveries yet.
              </p>
              <p className="mt-1 text-sm text-gray-400">
                Accept your first delivery to see it here.
              </p>
            </div>
          )}

          {allDeliveries.map((delivery) => (
            <DeliveryCard key={delivery.id} delivery={delivery} />
          ))}
        </section>

        {/* Load more */}
        {hasMore && (
          <div className="pt-1 text-center">
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={isFetching}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
            >
              {isFetching ? "Loading…" : "Load More"}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}