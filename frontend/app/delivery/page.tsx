"use client"

import Link from "next/link"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Bike, CheckCircle2, Clock, IndianRupee, MapPin, Navigation, PackageCheck, Phone, Star } from "lucide-react"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"

export default function DeliveryPartnerPage() {
  const { data: activeDeliveries = [], refetch } = useQuery({
    queryKey: ["delivery", "active"],
    queryFn: () => apiClient.get<any[]>("/delivery/partner/active"),
    refetchInterval: 15_000,
  })

  const { data: earningsData } = useQuery({
    queryKey: ["delivery", "earnings", "today"],
    queryFn: () => apiClient.get<any>("/delivery/partner/earnings?period=today"),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/delivery/${id}/status`, { status }),
    onSuccess: () => {
      toast.success("Delivery updated")
      refetch()
    },
    onError: () => toast.error("Failed to update delivery"),
  })

  const tasks = Array.isArray(activeDeliveries) ? activeDeliveries : [activeDeliveries].filter(Boolean)

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="bg-[#1A3C5E] px-4 pb-20 pt-8 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/70">Delivery Partner</p>
              <h1 className="mt-1 text-2xl font-bold">Live Delivery Console</h1>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/12">
              <Bike size={24} />
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto -mt-12 max-w-5xl space-y-5 px-4 pb-10">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric icon={PackageCheck} label="Active jobs" value={String(tasks.length)} />
          <Metric icon={Clock} label="Avg delivery" value={earningsData?.avgDeliveryMinutes ? `${earningsData.avgDeliveryMinutes}m` : "—"} />
          <Metric icon={IndianRupee} label="Today earned" value={earningsData?.todayEarnings ? `Rs ${earningsData.todayEarnings.toLocaleString("en-IN")}` : "Rs 0"} />
        </div>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-950">Assigned Deliveries</h2>
            </div>
            <Link href="/delivery/earnings" className="inline-flex min-h-12 items-center rounded-lg border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">
              Earnings
            </Link>
          </div>

          <div className="mt-5 grid gap-4">
            {tasks.length === 0 && (
              <p className="text-center py-8 text-gray-400">No active deliveries</p>
            )}
            {tasks.map((task: any) => (
              <article key={task.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      #{task.id?.slice(0, 8).toUpperCase()}
                    </p>
                    <h3 className="mt-1 text-base font-bold text-gray-950">
                      {task.order?.branch?.name ?? "Restaurant"}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Customer: {task.order?.customer?.name ?? "—"}
                    </p>
                  </div>
                  <StatusBadge status={task.status} size="sm" />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Info icon={MapPin} label="Distance" value={task.distanceKm ? `${task.distanceKm} km` : "—"} />
                  <Info icon={Clock} label="ETA" value={task.etaMinutes ? `${task.etaMinutes} min` : "—"} />
                  <Info icon={Star} label="Priority" value={task.priority ?? "Standard"} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <button
                    onClick={() => toast.info("Opening navigation…")}
                    className="inline-flex min-h-[60px] items-center justify-center gap-2 rounded-lg bg-[#1A3C5E] px-4 text-sm font-bold text-white transition hover:bg-[#15304d]"
                  >
                    <Navigation size={18} />
                    Navigate
                  </button>
                  <button
                    onClick={() => task.order?.customer?.phone
                      ? window.open(`tel:${task.order.customer.phone}`)
                      : toast.info("No phone number")}
                    className="inline-flex min-h-[60px] items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                  >
                    <Phone size={18} />
                    Call
                  </button>
                  <button
                    onClick={() => statusMutation.mutate({ id: task.id, status: "delivered" })}
                    disabled={statusMutation.isPending}
                    className="inline-flex min-h-[60px] items-center justify-center gap-2 rounded-lg bg-[#1E7E34] px-4 text-sm font-bold text-white transition hover:bg-[#17682a] disabled:opacity-50"
                  >
                    <CheckCircle2 size={18} />
                    Mark Done
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-2 text-xl font-bold text-gray-950">{value}</p>
        </div>
        <Icon size={22} className="text-[#1A3C5E]" />
      </div>
    </div>
  )
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-1 text-sm font-bold text-gray-900">{value}</p>
    </div>
  )
}
