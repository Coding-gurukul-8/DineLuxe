"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, Users, Search, Filter, Check, X } from "lucide-react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"

export default function OwnerBookingsPage() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "completed">("upcoming")
  const [searchQuery, setSearchQuery] = useState("")
  const { branchId } = useAuth()
  const queryClient = useQueryClient()

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", "branch", branchId],
    queryFn: () => apiClient.get<any[]>(`/bookings/branch/${branchId}`),
    enabled: !!branchId,
    refetchInterval: 30_000,
  })

  const confirmMutation = useMutation({
    mutationFn: (bookingId: string) =>
      apiClient.patch(`/bookings/${bookingId}/arrived`, {}),
    onSuccess: () => {
      toast.success("Booking confirmed")
      queryClient.invalidateQueries({ queryKey: ["bookings", "branch", branchId] })
    },
    onError: () => toast.error("Failed to confirm booking"),
  })

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) =>
      apiClient.patch(`/bookings/${bookingId}/cancel`, { reason: "Cancelled by owner" }),
    onSuccess: () => {
      toast.success("Booking cancelled")
      queryClient.invalidateQueries({ queryKey: ["bookings", "branch", branchId] })
    },
    onError: () => toast.error("Failed to cancel booking"),
  })

  const UPCOMING_STATUSES = ["pending", "confirmed"]
  const COMPLETED_STATUSES = ["arrived", "seated", "no_show", "cancelled"]

  const upcomingBookings = bookings.filter((b: any) => UPCOMING_STATUSES.includes(b.status))
  const completedBookings = bookings.filter((b: any) => COMPLETED_STATUSES.includes(b.status))

  const filteredBookings = (activeTab === "upcoming" ? upcomingBookings : completedBookings).filter(
    (b: any) =>
      !searchQuery ||
      b.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customer?.phone?.includes(searchQuery)
  )

  return (
    <PageWrapper title="Bookings" subtitle="Manage table reservations">
      {/* Search and Filter */}
      <div className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
        <button className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
          <Filter size={20} className="text-gray-600" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("upcoming")}
          className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
            activeTab === "upcoming"
              ? "bg-brand-primary text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Upcoming ({upcomingBookings.length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
            activeTab === "completed"
              ? "bg-brand-primary text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Completed ({completedBookings.length})
        </button>
      </div>

      {isLoading && <div className="text-center py-12 text-gray-500">Loading bookings…</div>}

      {/* Bookings List */}
      <div className="space-y-4">
        {!isLoading && filteredBookings.length === 0 && (
          <p className="text-center py-12 text-gray-500">No bookings found</p>
        )}
        {filteredBookings.map((booking: any) => (
          <motion.div
            key={booking.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-md border border-gray-100 p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {booking.customer?.name ?? "Guest"}
                </h3>
                <p className="text-sm text-gray-500">{booking.customer?.phone ?? ""}</p>
              </div>
              <StatusBadge status={booking.status} />
            </div>

            <div className="flex items-center gap-4 mb-3 text-sm">
              <div className="flex items-center gap-1 text-gray-600">
                <Calendar size={14} />
                <span>{new Date(booking.scheduledAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Clock size={14} />
                <span>{new Date(booking.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Users size={14} />
                <span>{booking.partySize} guests</span>
              </div>
            </div>

            {booking.table?.label && (
              <div className="text-sm text-gray-600 mb-3">
                Table: <span className="font-medium">{booking.table.label}</span>
              </div>
            )}

            {booking.notes && (
              <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded-lg mb-3">
                {booking.notes}
              </div>
            )}

            {booking.status === "pending" && (
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  disabled={confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate(booking.id)}
                  className="flex-1 bg-green-500 hover:bg-green-600"
                >
                  <Check size={14} className="mr-1" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(booking.id)}
                  className="flex-1 text-red-500 hover:bg-red-50"
                >
                  <X size={14} className="mr-1" />
                  Cancel
                </Button>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </PageWrapper>
  )
}
