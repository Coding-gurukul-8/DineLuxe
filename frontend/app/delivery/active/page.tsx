"use client"

import Link from "next/link"
import { useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  PackageCheck,
} from "lucide-react"
import OnlineToggle from "@/components/delivery/OnlineToggle"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"

type DeliveryPartnerStatus = "accepted" | "picked_up" | "out_for_delivery" | "delivered"

type DeliveryItem = {
  id: string
  menu_item_id?: string
  name: string
  quantity: number
}

type Delivery = {
  id: string
  status: DeliveryPartnerStatus
  accepted_at?: string
  order?: {
    branch?: {
      name: string
      address: string
    }
    items?: DeliveryItem[]
  }
  customer?: {
    name: string
    address?: {
      area?: string
      landmark?: string
      pincode?: string
    }
  }
  distanceKm?: number
}

function firstName(name: string) {
  return (name ?? "").split(" ")[0] || name
}

function formatElapsedMinutes(iso?: string) {
  if (!iso) return "—"
  const started = new Date(iso).getTime()
  const now = Date.now()
  const mins = Math.max(0, Math.round((now - started) / 60000))
  return `${mins} min${mins === 1 ? "" : "s"} ago`
}

function googleMapsDirections(address: string) {
  const q = encodeURIComponent(address)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

export default function DeliveryActivePage() {
  const params = useSearchParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const partnerId = user?.id ?? ""

  const deliveryId = params.get("id")

  const { data: delivery, isLoading } = useQuery<Delivery>({
    queryKey: ["delivery", "active", deliveryId],
    queryFn: () => apiClient.get<Delivery>(`/delivery/${deliveryId}`),
    enabled: !!deliveryId,
  })

  const elapsed = useMemo(
    () => formatElapsedMinutes(delivery?.accepted_at),
    [delivery?.accepted_at]
  )

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: DeliveryPartnerStatus }) =>
      apiClient.patch(`/delivery/${id}/status`, { status: next }),
    onSuccess: () => {
      toast.success("Delivery updated")
      queryClient.invalidateQueries({ queryKey: ["delivery", "active", deliveryId] })
    },
    onError: () => toast.error("Failed to update delivery status"),
  })

  useEffect(() => {
    if (!deliveryId || !navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        apiClient
          .post(`/delivery/location`, {
            lat: latitude,
            lon: longitude,
            delivery_id: deliveryId,
          })
          .catch(() => {})
      },
      () => {},
      { maximumAge: 5_000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [deliveryId])

  if (!deliveryId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500">
        Missing delivery id
      </div>
    )
  }

  const status = delivery?.status
  const itemsToPickUp = delivery?.order?.items ?? []
  const restaurantAddress = delivery?.order?.branch?.address ?? ""
  const customerAddress = delivery?.customer?.address ?? {}
  const deliveryAddressParts = [
    customerAddress.area,
    customerAddress.landmark,
    customerAddress.pincode,
  ].filter(Boolean)
  const deliveryAddressStr = deliveryAddressParts.join(", ")

  const steps = [
    { label: "Order Accepted", done: Boolean(status), active: status === "accepted" },
    { label: "At Restaurant", done: status === "picked_up" || status === "out_for_delivery" || status === "delivered", active: status === "accepted" },
    { label: "Delivering", done: status === "out_for_delivery" || status === "delivered", active: status === "picked_up" },
    { label: "Delivered", done: status === "delivered", active: status === "out_for_delivery" },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      <section className="bg-[#0D2A45] px-4 pb-8 pt-8 text-white">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/delivery"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/10"
          >
            <ArrowLeft size={14} />
            Back to deliveries
          </Link>

          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white/70">Active Delivery</p>
              <h1 className="mt-2 text-2xl font-bold">
                Delivery ID: #{(deliveryId ?? "").slice(0, 8).toUpperCase()}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {status && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold capitalize">
                    {status.replace(/_/g, " ")}
                  </span>
                )}
                <span className="inline-flex items-center gap-2 text-sm text-white/70">
                  <Clock size={16} /> Started {elapsed}
                </span>
              </div>
            </div>

            {partnerId && (
              <OnlineToggle partnerId={partnerId} initialStatus className="bg-white" />
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-white/10 p-4">
              <div className="grid gap-3">
                {steps.map((step, index) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <div
                      className={
                        "flex h-10 w-10 items-center justify-center rounded-full font-bold " +
                        (step.done
                          ? "bg-green-100 text-green-700"
                          : step.active
                            ? "bg-[#1A3C5E] text-white"
                            : "bg-gray-100 text-gray-400")
                      }
                    >
                      {step.done ? <CheckCircle2 size={18} /> : index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                      <p className="text-xs text-gray-500">
                        {step.active ? "Current" : step.done ? "Completed" : "Pending"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-white/10 p-4">
              <h2 className="text-sm font-bold">Actions</h2>
              <div className="mt-3 grid gap-2">
                {status === "accepted" && (
                  <button
                    onClick={() => updateStatusMutation.mutate({ id: deliveryId, next: "picked_up" })}
                    className="rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700"
                    type="button"
                  >
                    Mark as Picked Up
                  </button>
                )}

                {status === "picked_up" && (
                  <>
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: deliveryId, next: "out_for_delivery" })}
                      className="rounded-lg bg-[#1A3C5E] py-3 font-semibold text-white hover:bg-[#15304d]"
                      type="button"
                    >
                      Start Delivery
                    </button>
                    <button
                      onClick={() => toast.info("Report issue sheet coming soon")}
                      className="rounded-lg border border-white/10 bg-white/10 py-3 font-semibold text-white hover:bg-white/15"
                      type="button"
                    >
                      Report Issue
                    </button>
                  </>
                )}

                {status === "out_for_delivery" && (
                  <>
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: deliveryId, next: "delivered" })}
                      className="rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700"
                      type="button"
                    >
                      Mark as Delivered
                    </button>
                    <button
                      onClick={() => toast.info("Photo proof coming in phase 2")}
                      className="rounded-lg border border-white/10 bg-white/10 py-3 font-semibold text-white hover:bg-white/15"
                      type="button"
                    >
                      Take Photo Proof
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto -mt-6 max-w-5xl px-4 pb-10">
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PackageCheck size={18} className="text-[#1A3C5E]" />
                <h2 className="font-bold text-gray-900">Restaurant Pickup</h2>
              </div>
              <StatusBadge status="active" />
            </div>

            <p className="mt-3 text-sm font-semibold text-gray-800">
              {delivery?.order?.branch?.name ?? "Restaurant"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              <MapPin size={14} className="mr-1 inline" />
              {restaurantAddress || "—"}
            </p>

            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Items to pick up</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {itemsToPickUp.length} item{itemsToPickUp.length === 1 ? "" : "s"} to pick up
              </p>
              <ul className="mt-3 space-y-2">
                {itemsToPickUp.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-gray-800">
                      {item.quantity}× {item.name}
                    </span>
                  </li>
                ))}
                {itemsToPickUp.length === 0 && <li className="text-sm text-gray-400">No items found</li>}
              </ul>
            </div>

            <button
              onClick={() => window.open(googleMapsDirections(restaurantAddress), "_blank")}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A3C5E] py-2.5 font-bold text-white hover:bg-[#15304d]"
              type="button"
            >
              <Navigation size={16} />
              Navigate
            </button>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-[#1A3C5E]" />
                <h2 className="font-bold text-gray-900">Customer Delivery</h2>
              </div>
              <StatusBadge status="active" />
            </div>

            <p className="mt-3 text-sm font-semibold text-gray-800">
              {firstName(delivery?.customer?.name ?? "Customer")}
            </p>
            <p className="mt-1 text-xs text-gray-500">{deliveryAddressStr || "—"}</p>

            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Distance</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {delivery?.distanceKm ? `${delivery.distanceKm} km away` : "—"}
              </p>
            </div>

            <button
              onClick={() => window.open(googleMapsDirections(deliveryAddressStr), "_blank")}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A3C5E] py-2.5 font-bold text-white hover:bg-[#15304d]"
              type="button"
            >
              <Navigation size={16} />
              Navigate
            </button>
          </section>
        </div>

        {isLoading && <div className="mt-6 text-center text-gray-500">Loading active delivery…</div>}

        {!isLoading && !delivery && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle size={16} className="mr-2 inline" />
            Delivery not found.
          </div>
        )}
      </div>
    </main>
  )
}

