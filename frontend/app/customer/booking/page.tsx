"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { toast } from "sonner";
import {
  Calendar, Clock, Users, CheckCircle2,
  ChevronLeft, ChevronRight, MapPin, FileText, Loader2,
} from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
interface Branch { id: string; name: string; address: string; city: string; is_active: boolean }
interface Restaurant { id: string; name: string; cuisine_type: string; logo_url: string; branches: Branch[] }
interface Booking {
  id: string; branch_id: string; booking_date: string; booking_time: string;
  people_count: number; status: string; notes?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 15 }, (_, i) => {
  const h = i + 9; // 09:00 – 23:00
  return `${String(h).padStart(2, "0")}`;
});
const MINUTES = ["00", "15", "30", "45"];

function toISO(date: Date) {
  return date.toISOString().split("T")[0];
}

// ── Step indicator ────────────────────────────────────────────────────────────
const STEPS = ["Branch", "Date & Time", "Guests", "Confirm"] as const;

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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CustomerBookingPage() {
  const router = useRouter();

  // form state
  const [step, setStep] = useState(0);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedHour, setSelectedHour] = useState("19");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [peopleCount, setPeopleCount] = useState(2);
  const [notes, setNotes] = useState("");

  // Date bounds: today → today + 30 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);

  // ── Nearby restaurants ───────────────────────────────────────────────────
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCoords({ lat: 20.5937, lng: 78.9629 })
    );
  }, []);

  const { data: restaurants = [], isLoading: loadingRestaurants } = useQuery<Restaurant[]>({
    queryKey: ["restaurants", "nearby", coords],
    queryFn: () =>
      apiClient.get<Restaurant[]>(
        `/restaurants/nearby?lat=${coords!.lat}&lng=${coords!.lng}&radius=50`
      ),
    enabled: !!coords,
  });

  // ── Submit booking ───────────────────────────────────────────────────────
  const { mutate: createBooking, isPending: isSubmitting } = useMutation({
    mutationFn: () => {
      if (!selectedBranch || !selectedDate) throw new Error("Missing fields");
      return apiClient.post<Booking>("/bookings", {
        branch_id: selectedBranch.id,
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

  // ── Step validation ──────────────────────────────────────────────────────
  const canNext =
    (step === 0 && !!selectedBranch) ||
    (step === 1 && !!selectedDate) ||
    (step === 2 && peopleCount >= 1) ||
    step === 3;

  const goNext = () => setStep((s) => Math.min(s + 1, 3));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-brand-primary px-4 pt-12 pb-8 text-white">
        <button onClick={() => step === 0 ? router.back() : goBack()} className="mb-4 flex items-center gap-1 text-white/70 hover:text-white text-sm">
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="text-2xl font-bold">Reserve a Table</h1>
        <p className="text-white/70 text-sm mt-1">Book your dining experience</p>
      </div>

      <div className="px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <StepBar current={step} />

          <AnimatePresence mode="wait">
            {/* ── Step 0: Branch selection ─────────────────────────────────── */}
            {step === 0 && (
              <motion.div key="step-0" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
                <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <MapPin size={18} className="text-brand-primary" /> Choose a Restaurant
                </h2>
                <p className="text-sm text-gray-500 mb-4">Showing restaurants near you</p>

                {loadingRestaurants ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="skeleton h-20 rounded-xl" />
                    ))}
                  </div>
                ) : restaurants.length === 0 ? (
                  <p className="text-center py-10 text-gray-400">No restaurants found nearby</p>
                ) : (
                  <div className="space-y-3">
                    {restaurants.map((r) => {
                      const branch = r.branches?.find((b) => b.is_active) ?? r.branches?.[0];
                      if (!branch) return null;
                      const isSelected = selectedBranch?.id === branch.id;
                      return (
                        <button
                          key={r.id}
                          onClick={() => { setSelectedRestaurant(r); setSelectedBranch(branch); }}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                            isSelected
                              ? "border-brand-primary bg-brand-primary/5"
                              : "border-gray-100 hover:border-gray-200"
                          )}
                        >
                          <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                            {r.logo_url ? (
                              <img src={r.logo_url} alt={r.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-lg font-bold text-gray-400">{r.name[0]}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 truncate">{r.name}</p>
                            <p className="text-xs text-gray-500 truncate">{r.cuisine_type}</p>
                            <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                              <MapPin size={10} />{branch.address}, {branch.city}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 size={20} className="text-brand-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Step 1: Date & Time ──────────────────────────────────────── */}
            {step === 1 && (
              <motion.div key="step-1" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar size={18} className="text-brand-primary" /> Date & Time
                </h2>

                {/* Day picker */}
                <div className="flex justify-center mb-4">
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={{ before: today, after: maxDate }}
                    modifiersClassNames={{
                      selected: "rdp-day_selected",
                      today: "rdp-day_today",
                    }}
                    className="rounded-xl"
                    styles={{
                      caption: { color: "#1A3C5E" },
                    }}
                  />
                </div>

                {/* Time selector */}
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
                      {selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} at {selectedHour}:{selectedMinute}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Guests + Notes ───────────────────────────────────── */}
            {step === 2 && (
              <motion.div key="step-2" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Users size={18} className="text-brand-primary" /> Party Details
                </h2>

                {/* Stepper */}
                <div className="flex items-center justify-center gap-6 bg-gray-50 rounded-2xl p-6 mb-6">
                  <button
                    onClick={() => setPeopleCount((n) => Math.max(1, n - 1))}
                    className="w-12 h-12 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center text-xl font-bold text-gray-700 hover:bg-gray-100 transition-colors active:scale-95"
                  >
                    −
                  </button>
                  <div className="text-center">
                    <p className="text-5xl font-bold text-brand-primary">{peopleCount}</p>
                    <p className="text-sm text-gray-500 mt-1">{peopleCount === 1 ? "Guest" : "Guests"}</p>
                  </div>
                  <button
                    onClick={() => setPeopleCount((n) => Math.min(20, n + 1))}
                    className="w-12 h-12 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center text-xl font-bold text-gray-700 hover:bg-gray-100 transition-colors active:scale-95"
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

            {/* ── Step 3: Confirmation summary ─────────────────────────────── */}
            {step === 3 && (
              <motion.div key="step-3" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }}>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-brand-primary" /> Review Booking
                </h2>

                <div className="space-y-3">
                  {[
                    {
                      icon: <MapPin size={16} className="text-brand-primary" />,
                      label: "Restaurant",
                      value: `${selectedRestaurant?.name} — ${selectedBranch?.address}, ${selectedBranch?.city}`,
                    },
                    {
                      icon: <Calendar size={16} className="text-brand-primary" />,
                      label: "Date",
                      value: selectedDate?.toLocaleDateString("en-IN", {
                        weekday: "long", day: "numeric", month: "long", year: "numeric",
                      }),
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
                      ? [{ icon: <FileText size={16} className="text-brand-primary" />, label: "Notes", value: notes }]
                      : []),
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="shrink-0 mt-0.5">{icon}</div>
                      <div>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-sm font-medium text-gray-900">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-4 text-xs text-center text-gray-400">
                  By confirming, you agree to our reservation policy. A confirmation will be sent once the restaurant accepts your booking.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={goBack}
                className="flex-1 rounded-xl h-12"
                disabled={isSubmitting}
              >
                <ChevronLeft size={16} className="mr-1" /> Back
              </Button>
            )}
            {step < 3 ? (
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
                disabled={isSubmitting}
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
      </div>
    </div>
  );
}