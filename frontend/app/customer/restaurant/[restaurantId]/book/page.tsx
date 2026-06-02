"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { toast } from "sonner";
import {
  ArrowLeft, Calendar, Clock, Users, CheckCircle2,
  ChevronRight, ChevronLeft, FileText, MapPin, Loader2,
  // INTEGRATION ADDITION: Icons for new features
  Heart, UtensilsCrossed, PartyPopper,
} from "lucide-react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
// INTEGRATION ADDITION: SocialDining component (from P1 Prompt 15)
import { SocialDining } from "@/components/customer/SocialDining";

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

// INTEGRATION ADDITION: Table preference type returned by
// GET /api/v1/customer-preferences/tables/:branchId
interface TablePreference {
  table_id: string;
  table_label: string;   // e.g. "Table 7 (Window)"
  preference_count: number;
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
// INTEGRATION ADDITION: Added step 3 "Dining Group" after the confirmation step
const STEPS = ["Date & Time", "Guests", "Confirm", "Group"] as const;

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

  // INTEGRATION ADDITION: Confirmed booking ID stored after successful creation
  // so the social dining step can reference it.
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);

  // INTEGRATION ADDITION: Whether user dismissed the social dining step
  const [skippedSocialDining, setSkippedSocialDining] = useState(false);

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

  // INTEGRATION ADDITION: Fetch the customer's preferred table for this branch.
  // Uses GET /api/v1/customer-preferences/tables/:branchId — only runs once
  // branch is known and returns silently (retry: false) to avoid blocking the page.
  const { data: tablePreference, isLoading: loadingTablePref } = useQuery<TablePreference>({
    queryKey: ["table-preference", branch?.id],
    queryFn: () =>
      apiClient.get<TablePreference>(
        `/customer-preferences/tables/${branch!.id}`
      ),
    enabled: !!branch?.id,
    retry: false,
    // staleTime: 5 minutes — preferences don't change that often
    staleTime: 5 * 60 * 1000,
  });

  // INTEGRATION ADDITION: Pre-populate notes field with preferred table info
  // when the preference loads and notes haven't been manually edited yet.
  useEffect(() => {
    if (tablePreference?.table_label && notes === "") {
      setNotes(`Preferred table: ${tablePreference.table_label}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablePreference]);

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
        // INTEGRATION ADDITION: include preferred table in payload if available
        ...(tablePreference ? { preferred_table_id: tablePreference.table_id } : {}),
      });
    },
    onSuccess: (booking) => {
      toast.success("Booking confirmed! 🎉");
      // INTEGRATION ADDITION: Store booking ID and advance to social dining step
      // instead of immediately navigating away.
      setConfirmedBookingId(booking.id);
      setStep(3); // step 3 = Social Dining
    },
    onError: (err: Error) => toast.error(err.message || "Booking failed"),
  });

  // ── Step validation ────────────────────────────────────────────────────────
  const canNext =
    (step === 0 && !!selectedDate) ||
    (step === 1 && peopleCount >= 1) ||
    step === 2;

  const goNext = () => setStep((s) => Math.min(s + 1, 3));
  const goBack = () => {
    if (step === 0) router.back();
    // INTEGRATION ADDITION: From social dining step, go to booking detail
    else if (step === 3 && confirmedBookingId) {
      router.push(`/customer/booking/${confirmedBookingId}`);
    } else {
      setStep((s) => s - 1);
    }
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

          {/* INTEGRATION ADDITION: "Your usual table" chip shown on step 1 when preference exists */}
          {step === 1 && tablePreference && !loadingTablePref && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-4"
            >
              <Heart size={13} className="text-rose-500 fill-rose-500 shrink-0" />
              <p className="text-xs font-semibold text-rose-600">
                Your usual table ❤️
              </p>
              <span className="ml-auto text-[10px] text-rose-400 font-medium truncate max-w-[140px]">
                {tablePreference.table_label}
              </span>
            </motion.div>
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
                  {/* INTEGRATION ADDITION: Show inline note about pre-selected table */}
                  {tablePreference && (
                    <p className="mt-1.5 text-[10px] text-rose-500 flex items-center gap-1">
                      <Heart size={9} className="fill-rose-500" />
                      Your usual table ({tablePreference.table_label}) has been included above.
                    </p>
                  )}
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
                    // INTEGRATION ADDITION: Show preferred table row if available
                    ...(tablePreference
                      ? [
                          {
                            icon: <Heart size={16} className="text-rose-500 fill-rose-500" />,
                            label: "Preferred Table",
                            value: `${tablePreference.table_label} ❤️`,
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

            {/* INTEGRATION ADDITION ──────────────────────────────────────────
                Step 3: Social Dining — shown after booking is confirmed.
                Renders the SocialDining component with the confirmed booking ID.
                User can create a group or skip to their booking detail page.
            ─────────────────────────────────────────────────────────────────── */}
            {step === 3 && confirmedBookingId && (
              <motion.div
                key="step-3"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2 }}
              >
                {/* Success banner */}
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-800">Booking Confirmed! 🎉</p>
                    <p className="text-xs text-emerald-600">
                      Ref: {confirmedBookingId.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Social dining CTA copy */}
                <div className="flex items-center gap-2 mb-4">
                  <PartyPopper size={16} className="text-[#E8A020]" />
                  <h2 className="text-base font-bold text-gray-900">
                    Want to pre-order with friends?
                  </h2>
                </div>
                <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                  Create a group for your table → invite friends, pre-order together,
                  and have food ready the moment you arrive.
                </p>

                {/* INTEGRATION ADDITION: SocialDining component */}
                <SocialDining
                  bookingId={confirmedBookingId}
                  isOrganizer={true}
                />

                {/* Skip link */}
                {!skippedSocialDining && (
                  <button
                    onClick={() => {
                      setSkippedSocialDining(true);
                      router.push(`/customer/booking/${confirmedBookingId}`);
                    }}
                    className="w-full mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors py-2 text-center"
                  >
                    Skip for now — go to my booking →
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation — hidden on step 3 (social dining handles its own CTAs) */}
          {step < 3 && (
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
          )}

          {/* INTEGRATION ADDITION: On step 3, show a "View My Booking" full-width button */}
          {step === 3 && confirmedBookingId && (
            <div className="mt-6">
              <Button
                onClick={() => router.push(`/customer/booking/${confirmedBookingId}`)}
                className="w-full h-12 rounded-xl bg-brand-primary text-white hover:bg-brand-primary/90"
              >
                <UtensilsCrossed size={16} className="mr-2" />
                View My Booking
              </Button>
            </div>
          )}
        </div>

        {/* Walk-in queue shortcut — hidden on step 3 since booking is already done */}
        {step < 3 && (
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
        )}
      </div>
    </div>
  );
}