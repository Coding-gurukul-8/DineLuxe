"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft, Calendar, Clock, Users, MapPin,
  FileText, XCircle, Loader2,
} from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Booking {
  id: string;
  branch_id: string;
  booking_date: string;   // ISO date string "YYYY-MM-DD"
  booking_time: string;   // "HH:mm"
  people_count: number;
  status: "pending" | "confirmed" | "seated" | "cancelled" | "no_show";
  notes?: string;
  branch?: { name: string; address: string; city: string };
}

interface Props {
  params: Promise<{ bookingId: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBookingDate(dateStr: string) {
  // dateStr arrives as "YYYY-MM-DD"; parse it safely without timezone shift
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatTime(timeStr: string) {
  // timeStr = "HH:mm"
  const [h, min] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = ((h % 12) || 12);
  return `${hour12}:${String(min).padStart(2, "0")} ${ampm}`;
}

const CANCELLABLE = ["pending", "confirmed"];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function BookingDetailPage({ params }: Props) {
  const { bookingId } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);

  // ── Fetch booking ──────────────────────────────────────────────────────────
  const { data: booking, isLoading, isError } = useQuery<Booking>({
    queryKey: ["booking", bookingId],
    queryFn: () => apiClient.get<Booking>(`/bookings/${bookingId}`),
    enabled: !!bookingId,
  });

  // ── Cancel mutation ────────────────────────────────────────────────────────
  const { mutate: cancelBooking, isPending: isCancelling } = useMutation({
    mutationFn: () =>
      apiClient.patch<Booking>(`/bookings/${bookingId}/cancel`, { reason: "Customer requested cancellation" }),
    onSuccess: () => {
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: ["booking", bookingId] });
      qc.invalidateQueries({ queryKey: ["bookings", "user", "me"] });
      setShowCancel(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Cancellation failed");
      setShowCancel(false);
    },
  });

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-brand-primary h-40" />
        <div className="px-4 -mt-6 space-y-3">
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-6">
        <XCircle size={48} className="text-red-400" />
        <p className="text-gray-600 text-center">Booking not found or you don't have access.</p>
        <Link href="/customer/booking/history" className="text-brand-primary font-semibold text-sm">
          View all bookings
        </Link>
      </div>
    );
  }

  const canCancel = CANCELLABLE.includes(booking.status);

  const details = [
    {
      icon: <Calendar size={18} className="text-brand-primary" />,
      label: "Date",
      value: formatBookingDate(booking.booking_date),
    },
    {
      icon: <Clock size={18} className="text-brand-primary" />,
      label: "Time",
      value: formatTime(booking.booking_time),
    },
    {
      icon: <Users size={18} className="text-brand-primary" />,
      label: "Guests",
      value: `${booking.people_count} ${booking.people_count === 1 ? "person" : "people"}`,
    },
    ...(booking.branch
      ? [
          {
            icon: <MapPin size={18} className="text-brand-primary" />,
            label: "Branch",
            value: `${booking.branch.name} — ${booking.branch.address}, ${booking.branch.city}`,
          },
        ]
      : []),
    ...(booking.notes
      ? [
          {
            icon: <FileText size={18} className="text-brand-primary" />,
            label: "Special requests",
            value: booking.notes,
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Header */}
        <div className="bg-brand-primary px-4 pt-12 pb-10 text-white">
          <Link
            href="/customer/booking/history"
            className="mb-4 flex items-center gap-1 text-white/70 hover:text-white text-sm w-fit"
          >
            <ArrowLeft size={16} /> All bookings
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/60 text-xs mb-1">Booking ID</p>
              <h1 className="text-xl font-bold">#{booking.id.slice(-8).toUpperCase()}</h1>
            </div>
            <StatusBadge status={booking.status} size="lg" />
          </div>
        </div>

        <div className="px-4 -mt-4 space-y-4">
          {/* Detail card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Reservation Details</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {details.map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-3 px-5 py-4">
                  <div className="shrink-0 mt-0.5 w-7 flex justify-center">{icon}</div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-gray-900 leading-snug">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Status timeline */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
          >
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Status</h2>
            <div className="flex items-center gap-1">
              {(["pending", "confirmed", "seated"] as const).map((s, idx) => {
                const statuses = ["pending", "confirmed", "seated", "cancelled", "no_show"];
                const currentIdx = statuses.indexOf(booking.status);
                const thisIdx = statuses.indexOf(s);
                const isActive = thisIdx <= currentIdx && !["cancelled", "no_show"].includes(booking.status);
                const labels: Record<string, string> = {
                  pending: "Pending",
                  confirmed: "Confirmed",
                  seated: "Seated",
                };
                return (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                          isActive ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-400"
                        )}
                      >
                        {idx + 1}
                      </div>
                      <span
                        className={cn(
                          "text-[10px] mt-1 font-medium",
                          isActive ? "text-brand-primary" : "text-gray-400"
                        )}
                      >
                        {labels[s]}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div
                        className={cn(
                          "h-0.5 flex-1 mx-1 mb-4 transition-all",
                          isActive && thisIdx < currentIdx ? "bg-brand-primary" : "bg-gray-100"
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {["cancelled", "no_show"].includes(booking.status) && (
              <div className="mt-3 flex items-center gap-2 bg-red-50 rounded-xl px-4 py-3">
                <XCircle size={16} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-600 font-medium">
                  {booking.status === "cancelled" ? "This booking was cancelled." : "Marked as no-show."}
                </p>
              </div>
            )}
          </motion.div>

          {/* Actions */}
          {canCancel && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <Button
                variant="outline"
                onClick={() => setShowCancel(true)}
                disabled={isCancelling}
                className="w-full h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                {isCancelling ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Cancelling…</>
                ) : (
                  <><XCircle size={16} className="mr-2" /> Cancel Booking</>
                )}
              </Button>
            </motion.div>
          )}

          <Link
            href="/customer/booking"
            className="block text-center text-sm text-brand-primary font-medium py-2"
          >
            Make another booking
          </Link>
        </div>
      </div>

      {/* Cancel confirm dialog */}
      <ConfirmDialog
        isOpen={showCancel}
        title="Cancel this booking?"
        message="This action cannot be undone. The restaurant will be notified."
        confirmLabel="Yes, cancel"
        cancelLabel="Keep booking"
        variant="danger"
        onConfirm={() => cancelBooking()}
        onCancel={() => setShowCancel(false)}
      />
    </>
  );
}