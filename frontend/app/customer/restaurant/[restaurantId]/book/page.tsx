"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { toast } from "sonner";
import {
  ArrowLeft, Calendar, Clock, Users, CheckCircle2,
  ChevronRight, ChevronLeft, FileText, MapPin, Loader2,
} from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Branch {
  id: string; name: string; address: string; city: string;
  opening_time: string; closing_time: string; is_active: boolean;
}
interface Restaurant {
  id: string; name: string; cuisine_type: string; logo_url: string; branches: Branch[];
}
interface Booking {
  id: string; branch_id: string; booking_date: string;
  booking_time: string; people_count: number; status: string; notes?: string;
}

interface Props {
  params: Promise<{ restaurantId: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 15 }, (_, i) => String(i + 9).padStart(2, "0")); // 09–23
const MINUTES = ["00", "15", "30", "45"];

function toISO(date: Date) {
  return date.toISOString().split("T")[0];
}

// ── Step bar (same as global booking page) ────────────────────────────────────
const STEPS = ["Date & Time", "Guests", "Confirm"] as const;

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, idx) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                idx < current
                  ? "bg-brand-primary text-white"
                  : idx === current
                  ? "bg-brand-primary text-white ring-4 ring-brand-primary/20"
                  : "bg-gray-100 text-gray-400"
              )}
            >
              {idx < current ? <CheckCircle2 size={16} /> : idx + 1}
            </div>
            <span
              className={cn(
                "text-[10px] mt-1 font-medium whitespace-nowrap",
                idx <= current ? "text-brand-primary" : "text-gray-400"
              )}
            >
              {label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={cn(
                "h-0.5 flex-1 mx-1 mb-5 transition-all",
                idx < current ? "bg-brand-primary" : "bg-gray-100"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RestaurantBookPage({ params }: Props) {
  const { restaurantId } = use(params);
  const router = useRouter();

  // form state — branch is pre-filled from restaurant.branches[0]
  const [step, setStep] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedHour, setSelectedHour] = useState("19");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [peopleCount, setPeopleCount] = useState(2);
  const [notes, setNotes] = useState("");

  // Date bounds
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);

  // ── Restaurant ─────────────────────────────────────────────────────────────
  const { data: restaurant, isLoading: loadingRestaurant } = useQuery<Restaurant>({
    queryKey: ["restaurant", restaurantId],
    queryFn: () => apiClient.get<Restaurant>(`/restaurants/${restaurantId}`),
    enabled: !!restaurantId,
  });

  const branch =
    restaurant?.branches?.find((b) => b.is_active) ?? restaurant?.branches?.[0];

  // ── Submit booking ─────────────────────────────────────────────────────────
  const { mutate: createBooking, isPending: isSubmitting } = useMutation({
    mutationFn: () => {
      if (!branch || !selectedDate) throw new Error("Missing required fields");
      return apiClient.post<Booking>("/bookings", {
        branch_id: branch.id,
        people_count: peopleCount,
        booking_date: toISO(selectedDate),
        booking_time: `${selectedHour}:${selectedMinute}`,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: (booking) => {
      toast.success("Booking confirmed!");
      router.push(`/customer/booking/${booking.id}`);
    },
    onError: (err: Error) => toast.error(err.message || "Booking failed"),
  });

  // ── Step validation ────────────────────────────────────────────────────────
  const canNext =
    (step === 0 && !!selectedDate) ||
    (step === 1 && peopleCount >= 1) ||
    step === 2;

  const goNext = () => setStep((s) => Math.min(s + 1, 2));
  const goBack = () => {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  };

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-brand-primary px-4 pt-12 pb-8 text-white">
        <button
          onClick={goBack}
          className="mb-4 flex items-center gap-1 text-white/70 hover:text-white text-sm"
        >
          <ChevronLeft size={16} /> Back
        </button>

        {loadingRestaurant ? (
          <div className="skeleton h-8 w-40 rounded bg-white/20" />
        ) : (
          <>
            <div className="flex items-center gap-3 mb-1">
              {restaurant?.logo_url && (
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  className="w-9 h-9 rounded-lg border-2 border-white/30 object-cover bg-white"
                />
              )}
              <h1 className="text-xl font-bold">{restaurant?.name}</h1>
            </div>
            <p className="text-white/70 text-sm">Reserve a table</p>
          </>
        )}
      </div>

      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">

          {/* Pre-filled branch banner */}
          {branch && (
            <div className="flex items-center gap-2 bg-brand-primary/5 border border-brand-primary/20 rounded-xl px-3 py-2.5 mb-6">
              <MapPin size={14} className="text-brand-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-brand-primary truncate">{branch.name}</p>
                <p className="text-[10px] text-gray-500 truncate">
                  {branch.address}, {branch.city}
                  {branch.opening_time && branch.closing_time
                    ? ` · ${branch.opening_time}–${branch.closing_time}`
                    : ""}
                </p>
              </div>
              <CheckCircle2 size={14} className="text-brand-primary shrink-0 ml-auto" />
            </div>
          )}

          <StepBar current={step} />

          <AnimatePresence mode="wait">
            {/* ── Step 0: Date & Time ────────────────────────────────────── */}
            {step === 0 && (
              <motion.div
                key="step-0"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar size={18} className="text-brand-primary" /> Pick a Date & Time
                </h2>

                <div className="flex justify-center mb-4">
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={{ before: today, after: maxDate }}
                    className="rounded-xl"
                    styles={{ caption: { color: "#1A3C5E" } }}
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <Clock size={14} className="text-brand-primary" /> Select time
                  </p>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Hour</label>
                      <select
                        value={selectedHour}
                        onChange={(e) => setSelectedHour(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      >
                        {HOURS.map((h) => (
                          <option key={h} value={h}>{h}:00</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Minute</label>
                      <select
                        value={selectedMinute}
                        onChange={(e) => setSelectedMinute(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      >
                        {MINUTES.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {selectedDate && (
                    <p className="mt-3 text-center text-sm text-brand-primary font-medium">
                      {selectedDate.toLocaleDateString("en-IN", {
                        weekday: "long", day: "numeric", month: "long",
                      })} at {selectedHour}:{selectedMinute}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Step 1: Guests + Notes ─────────────────────────────────── */}
            {step === 1 && (
              <motion.div
                key="step-1"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users size={18} className="text-brand-primary" /> Party Details
                </h2>

                {/* Stepper */}
                <div className="flex items-center justify-center gap-6 bg-gray-50 rounded-2xl p-6 mb-6">
                  <button
                    onClick={() => setPeopleCount((n) => Math.max(1, n - 1))}
                    className="w-12 h-12 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center text-xl font-bold text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
                  >
                    −
                  </button>
                  <div className="text-center">
                    <p className="text-5xl font-bold text-brand-primary">{peopleCount}</p>
                    <p className="text-sm text-gray-500 mt-1">{peopleCount === 1 ? "Guest" : "Guests"}</p>
                  </div>
                  <button
                    onClick={() => setPeopleCount((n) => Math.min(20, n + 1))}
                    className="w-12 h-12 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center text-xl font-bold text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>

                {/* Quick presets */}
                <div className="flex gap-2 justify-center mb-6">
                  {[1, 2, 4, 6, 8].map((n) => (
                    <button
                      key={n}
                      onClick={() => setPeopleCount(n)}
                      className={cn(
                        "w-10 h-10 rounded-full text-sm font-semibold transition-all",
                        peopleCount === n
                          ? "bg-brand-primary text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5 block">
                    <FileText size={14} className="text-brand-primary" /> Special requests (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Allergies, occasion, seating preferences…"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Confirmation summary ───────────────────────────── */}
            {step === 2 && (
              <motion.div
                key="step-2"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-brand-primary" /> Review & Confirm
                </h2>

                <div className="space-y-3">
                  {[
                    {
                      icon: <MapPin size={16} className="text-brand-primary" />,
                      label: "Restaurant",
                      value: branch
                        ? `${restaurant?.name} — ${branch.address}, ${branch.city}`
                        : restaurant?.name ?? "—",
                    },
                    {
                      icon: <Calendar size={16} className="text-brand-primary" />,
                      label: "Date",
                      value: selectedDate?.toLocaleDateString("en-IN", {
                        weekday: "long", day: "numeric", month: "long", year: "numeric",
                      }) ?? "—",
                    },
                    {
                      icon: <Clock size={16} className="text-brand-primary" />,
                      label: "Time",
                      value: `${selectedHour}:${selectedMinute}`,
                    },
                    {
                      icon: <Users size={16} className="text-brand-primary" />,
                      label: "Guests",
                      value: `${peopleCount} ${peopleCount === 1 ? "person" : "people"}`,
                    },
                    ...(notes
                      ? [
                          {
                            icon: <FileText size={16} className="text-brand-primary" />,
                            label: "Notes",
                            value: notes,
                          },
                        ]
                      : []),
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="shrink-0 mt-0.5">{icon}</div>
                      <div>
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="text-sm font-medium text-gray-900">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-xs text-center text-gray-400">
                  By confirming, you agree to the reservation policy. A confirmation will be sent
                  once the restaurant accepts your booking.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={goBack}
              className="flex-1 rounded-xl h-12"
              disabled={isSubmitting}
            >
              <ChevronLeft size={16} className="mr-1" /> Back
            </Button>

            {step < 2 ? (
              <Button
                onClick={goNext}
                disabled={!canNext}
                className="flex-1 h-12 rounded-xl bg-brand-primary text-white hover:bg-brand-primary/90"
              >
                Continue <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button
                onClick={() => createBooking()}
                disabled={isSubmitting || !branch}
                className="flex-1 h-12 rounded-xl bg-brand-primary text-white hover:bg-brand-primary/90"
              >
                {isSubmitting ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Booking…</>
                ) : (
                  <><CheckCircle2 size={16} className="mr-2" /> Confirm Booking</>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Walk-in queue shortcut */}
        <Link href={`/customer/restaurant/${restaurantId}/queue`}>
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all active:scale-[0.99]">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Users size={18} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">Prefer to walk in?</p>
              <p className="text-xs text-gray-400">Join the live walk-in queue instead</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 shrink-0" />
          </div>
        </Link>
      </div>
    </div>
  );
}