"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronLeft, Calendar, Clock, Users, QrCode, X, RefreshCcw, Search } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { cn, formatDate, formatTime } from "@/lib/utils";

type BookingStatus = "pending" | "confirmed" | "arrived" | "seated" | "no_show" | "cancelled";

interface BookingReview {
  id: string;
  user?: { id: string };
  user_id?: string;
}

interface Booking {
  id: string;
  created_at: string;
  arrival_time: string;
  status: BookingStatus;
  people_count: number;
  special_requests?: string | null;
  branch_id: string;
  branch?: { id?: string; name: string; address?: string } | null;
  restaurant?: { id?: string; name?: string } | null;
  qr_code_url?: string | null;
}

const PAGE_SIZE = 20;
const TABS = ["upcoming", "past", "cancelled"] as const;
type TabKey = (typeof TABS)[number];

function isUpcomingBooking(booking: Booking) {
  return ["pending", "confirmed", "arrived"].includes(booking.status);
}

function isPastBooking(booking: Booking) {
  return ["seated", "no_show"].includes(booking.status);
}

function formatBookingDateTime(dateValue: string) {
  const date = new Date(dateValue);
  return {
    date: date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    time: date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
  };
}

export default function CustomerProfileBookingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [page, setPage] = useState(1);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedQr, setSelectedQr] = useState<Booking | null>(null);

  const bookingsQuery = useQuery({
    queryKey: ["customer", "profile", "bookings", page],
    queryFn: () => apiClient.get<Booking[]>(`/bookings/user/me?page=${page}&limit=${PAGE_SIZE}`),
  });

  useEffect(() => {
    if (!bookingsQuery.data) return;

    setBookings((prev) => {
      if (page === 1) return bookingsQuery.data;
      const merged = new Map(prev.map((booking) => [booking.id, booking]));
      for (const booking of bookingsQuery.data) merged.set(booking.id, booking);
      return Array.from(merged.values());
    });
  }, [bookingsQuery.data, page]);

  const restaurantIds = useMemo(
    () => Array.from(new Set(bookings.map((booking) => booking.restaurant?.id).filter(Boolean) as string[])),
    [bookings],
  );

  const reviewQueries = useQueries({
    queries: restaurantIds.map((restaurantId) => ({
      queryKey: ["customer", "profile", "booking-review-status", restaurantId, user?.id],
      queryFn: () => apiClient.get<BookingReview[]>(`/reviews/restaurant/${restaurantId}`),
      enabled: Boolean(restaurantId && user?.id),
    })),
  });

  const reviewedRestaurantIds = useMemo(() => {
    const ids = new Set<string>();
    reviewQueries.forEach((query, index) => {
      const restaurantId = restaurantIds[index];
      const reviews = query.data ?? [];
      if (!restaurantId || !user?.id) return;
      if (reviews.some((review) => (review.user?.id ?? review.user_id) === user.id)) {
        ids.add(restaurantId);
      }
    });
    return ids;
  }, [reviewQueries, restaurantIds, user?.id]);

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) =>
      apiClient.patch(`/bookings/${bookingId}/cancel`, { reason: "Customer requested cancellation" }),
    onSuccess: async () => {
      toast.success("Booking cancelled");
      await qc.invalidateQueries({ queryKey: ["customer", "profile", "bookings"] });
      setPage(1);
      setBookings([]);
    },
    onError: (err: Error) => toast.error(err.message || "Could not cancel booking"),
  });

  const upcoming = useMemo(
    () => bookings.filter((booking) => isUpcomingBooking(booking) && new Date(booking.arrival_time).getTime() >= Date.now()),
    [bookings],
  );
  const past = useMemo(
    () => bookings.filter((booking) => isPastBooking(booking)).sort((a, b) => new Date(b.arrival_time).getTime() - new Date(a.arrival_time).getTime()),
    [bookings],
  );
  const cancelled = useMemo(
    () => bookings.filter((booking) => booking.status === "cancelled"),
    [bookings],
  );

  const visible = tab === "upcoming" ? upcoming : tab === "past" ? past : cancelled;
  const isLoading = bookingsQuery.isLoading && bookings.length === 0;
  const hasMorePast = bookingsQuery.data?.length === PAGE_SIZE;

  const canCancelBooking = (booking: Booking) => {
    if (booking.status !== "pending") return false;
    const hoursUntil = (new Date(booking.arrival_time).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntil > 2;
  };

  const openReview = (booking: Booking) => {
    const restaurantId = booking.restaurant?.id;
    if (!restaurantId) return;
    router.push(`/customer/restaurant/${restaurantId}#reviews`);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">
      <div
        className="px-4 pt-12 pb-8 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #0D2A45 55%, #2A1A0A 100%)" }}
      >
        <div className="absolute -top-8 -right-8 w-44 h-44 rounded-full bg-[#E8A020]/10" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
          >
            <ChevronLeft size={18} className="text-white" />
          </motion.button>
          <div>
            <p className="text-[#E8A020] text-xs font-semibold uppercase tracking-widest">Profile</p>
            <h1 className="text-white font-bold text-xl">My Bookings</h1>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3 text-white/70 text-sm">
          <Calendar size={16} className="text-[#E8A020]" />
          <span>{bookingsQuery.isLoading ? "Loading bookings…" : `${bookings.length} booking${bookings.length === 1 ? "" : "s"} found`}</span>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {TABS.map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "py-2.5 rounded-xl text-sm font-semibold border transition-colors",
                tab === key
                  ? "bg-[#1A3C5E] text-white border-[#1A3C5E]"
                  : "bg-white text-gray-700 border-gray-100",
              )}
            >
              {key === "upcoming" ? "Upcoming" : key === "past" ? "Past" : "Cancelled"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="bg-white rounded-2xl border border-gray-100 p-4 h-36 animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-6">
            {tab === "upcoming" ? (
              <EmptyState
                variant="bookings"
                title="No upcoming bookings. Book a table to dine in style!"
                action={{ label: "Find Restaurants", onClick: () => router.push("/customer/home") }}
              />
            ) : tab === "past" ? (
              <EmptyState variant="bookings" title="No past bookings yet." />
            ) : (
              <EmptyState variant="bookings" title="No cancelled bookings." />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {visible.map((booking, index) => {
                const { date, time } = formatBookingDateTime(booking.arrival_time);
                const restaurantName = booking.restaurant?.name ?? booking.branch?.name ?? "Restaurant";
                const branchName = booking.branch?.name && booking.restaurant?.name && booking.branch.name !== booking.restaurant.name ? booking.branch.name : undefined;
                const hasRestaurantReview = booking.restaurant?.id ? reviewedRestaurantIds.has(booking.restaurant.id) : false;
                const showReview = tab === "past" && !hasRestaurantReview && Boolean(booking.restaurant?.id);

                const badge =
                  tab === "upcoming"
                    ? booking.status === "pending"
                      ? { status: "pending", className: "" }
                      : booking.status === "arrived"
                        ? { status: "arrived", className: "" }
                        : { status: "confirmed", className: "" }
                    : tab === "past"
                      ? booking.status === "no_show"
                        ? { status: "no_show", className: "" }
                        : { status: "completed", className: "" }
                      : { status: "cancelled", className: "border border-red-200 bg-white text-red-600" };

                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate">{restaurantName}</p>
                        {branchName && <p className="text-xs text-gray-400 mt-0.5 truncate">{branchName}</p>}
                        <div className="mt-3 space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Clock size={13} className="text-gray-400" />
                            <span>{date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={13} className="text-gray-400" />
                            <span>{time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users size={13} className="text-gray-400" />
                            <span>👥 {booking.people_count} guests</span>
                          </div>
                        </div>
                      </div>

                      <StatusBadge status={badge.status} className={badge.className}>
                        {tab === "past" && booking.status !== "no_show" ? "Completed" : undefined}
                      </StatusBadge>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedQr(booking)}
                        className="flex-1 min-w-35 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <QrCode size={14} /> View QR
                      </button>

                      {tab === "upcoming" && canCancelBooking(booking) && (
                        <button
                          type="button"
                          onClick={() => cancelMutation.mutate(booking.id)}
                          className="flex-1 min-w-35 py-2.5 rounded-xl text-sm font-semibold text-[#C0392B] bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <X size={14} /> Cancel Booking
                        </button>
                      )}

                      {tab === "past" && (
                        <>
                          <button
                            type="button"
                            onClick={() => router.push(`/customer/booking?branchId=${booking.branch_id}`)}
                            className="flex-1 min-w-35 py-2.5 rounded-xl text-sm font-semibold text-[#E8A020] bg-[#E8A020]/10 hover:bg-[#E8A020]/20 transition-colors flex items-center justify-center gap-2"
                          >
                            <RefreshCcw size={14} /> Book Again
                          </button>

                          {showReview && (
                            <button
                              type="button"
                              onClick={() => openReview(booking)}
                              className="flex-1 min-w-35 py-2.5 rounded-xl text-sm font-semibold text-[#1A3C5E] bg-[#1A3C5E]/10 hover:bg-[#1A3C5E]/20 transition-colors flex items-center justify-center gap-2"
                            >
                              <Search size={14} /> Leave Review
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {tab === "past" && hasMorePast && (
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={bookingsQuery.isFetching}
                className="w-full py-3 rounded-2xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {bookingsQuery.isFetching ? "Loading more…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedQr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedQr(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Booking QR</p>
                  <h3 className="text-base font-bold text-gray-900">{selectedQr.restaurant?.name ?? selectedQr.branch?.name ?? "Reservation"}</h3>
                </div>
                <button type="button" onClick={() => setSelectedQr(null)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>

              {selectedQr.qr_code_url ? (
                <img src={selectedQr.qr_code_url} alt="Booking QR" className="w-full rounded-2xl border border-gray-100" />
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-500">
                  QR not available for this booking.
                </div>
              )}

              <button type="button" onClick={() => setSelectedQr(null)} className="mt-4 w-full py-3 rounded-2xl bg-[#1A3C5E] text-white text-sm font-semibold">
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

