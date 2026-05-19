"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  CalendarDays, Calendar, Clock, Users,
  ChevronRight, PlusCircle, Inbox,
} from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Booking {
  id: string;
  branch_id: string;
  booking_date: string;   // "YYYY-MM-DD"
  booking_time: string;   // "HH:mm"
  people_count: number;
  status: "pending" | "confirmed" | "seated" | "cancelled" | "no_show";
  notes?: string;
  branch?: { name: string; address: string; city: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [h, min] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${((h % 12) || 12)}:${String(min).padStart(2, "0")} ${ampm}`;
}

function isUpcoming(b: Booking) {
  return ["pending", "confirmed"].includes(b.status);
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyBookings() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-brand-primary/10 flex items-center justify-center mb-4">
        <Inbox size={36} className="text-brand-primary" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-1">No bookings yet</h3>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        Reserve a table at your favourite restaurant and your bookings will appear here.
      </p>
      <Link href="/customer/booking">
        <Button className="bg-brand-primary text-white rounded-xl px-6 h-11 hover:bg-brand-primary/90">
          <PlusCircle size={16} className="mr-2" /> Make a Booking
        </Button>
      </Link>
    </div>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────
function BookingCard({ booking, index }: { booking: Booking; index: number }) {
  const upcoming = isUpcoming(booking);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={`/customer/booking/${booking.id}`} className="block">
        <div
          className={cn(
            "bg-white rounded-2xl border shadow-sm overflow-hidden transition-all active:scale-[0.99] hover:shadow-md",
            upcoming ? "border-brand-primary/20" : "border-gray-100"
          )}
        >
          {/* Top accent strip for upcoming */}
          {upcoming && (
            <div className="h-1 w-full bg-gradient-to-r from-brand-primary to-brand-secondary" />
          )}

          <div className="p-4 flex items-start gap-3">
            {/* Date block */}
            <div
              className={cn(
                "shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center",
                upcoming ? "bg-brand-primary/10" : "bg-gray-50"
              )}
            >
              {(() => {
                const [y, m, d] = booking.booking_date.split("-").map(Number);
                const date = new Date(y, m - 1, d);
                return (
                  <>
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase",
                        upcoming ? "text-brand-primary" : "text-gray-400"
                      )}
                    >
                      {date.toLocaleDateString("en-IN", { month: "short" })}
                    </span>
                    <span
                      className={cn(
                        "text-2xl font-bold leading-none",
                        upcoming ? "text-brand-primary" : "text-gray-500"
                      )}
                    >
                      {date.getDate()}
                    </span>
                    <span
                      className={cn(
                        "text-[10px]",
                        upcoming ? "text-brand-primary/70" : "text-gray-400"
                      )}
                    >
                      {date.toLocaleDateString("en-IN", { weekday: "short" })}
                    </span>
                  </>
                );
              })()}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-semibold text-gray-900 text-sm truncate">
                  {booking.branch?.name ?? `Branch ${booking.branch_id.slice(-6).toUpperCase()}`}
                </p>
                <StatusBadge status={booking.status} size="sm" />
              </div>

              {booking.branch?.address && (
                <p className="text-xs text-gray-400 truncate mb-2">
                  {booking.branch.address}, {booking.branch.city}
                </p>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {formatTime(booking.booking_time)}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  {booking.people_count} {booking.people_count === 1 ? "guest" : "guests"}
                </span>
              </div>
            </div>

            {/* Arrow */}
            <ChevronRight size={16} className="text-gray-300 shrink-0 mt-1" />
          </div>

          {/* Booking ID footer */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 font-mono">
              #{booking.id.slice(-10).toUpperCase()}
            </p>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Page skeleton ─────────────────────────────────────────────────────────────
function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-28 rounded-2xl" />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CustomerBookingHistoryPage() {
  const router = useRouter();

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ["bookings", "user", "me"],
    queryFn: () => apiClient.get<Booking[]>("/bookings/user/me"),
  });

  // Sort: upcoming first (by date asc), then past (by date desc)
  const upcoming = bookings
    .filter(isUpcoming)
    .sort((a, b) => a.booking_date.localeCompare(b.booking_date));

  const past = bookings
    .filter((b) => !isUpcoming(b))
    .sort((a, b) => b.booking_date.localeCompare(a.booking_date));

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-brand-primary px-4 pt-12 pb-8 text-white">
        <h1 className="text-2xl font-bold">My Bookings</h1>
        <p className="text-white/70 text-sm mt-1">Your table reservations</p>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* New booking CTA */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Link href="/customer/booking">
            <div className="bg-white rounded-2xl border border-brand-primary/20 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all active:scale-[0.99]">
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center shrink-0">
                <PlusCircle size={20} className="text-brand-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">New Reservation</p>
                <p className="text-xs text-gray-400">Book a table at any restaurant</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </Link>
        </motion.div>

        {isLoading ? (
          <HistorySkeleton />
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <EmptyBookings />
          </div>
        ) : (
          <>
            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <CalendarDays size={14} className="text-brand-primary" />
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Upcoming ({upcoming.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {upcoming.map((b, i) => (
                    <BookingCard key={b.id} booking={b} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Past */}
            {past.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3 px-1 mt-2">
                  <Calendar size={14} className="text-gray-400" />
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Past ({past.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {past.map((b, i) => (
                    <BookingCard key={b.id} booking={b} index={i} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}