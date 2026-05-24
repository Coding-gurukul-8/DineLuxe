"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Calendar, Clock, Users, CheckCircle2, ChevronLeft, ChevronRight,
  MapPin, FileText, Loader2, Minus, Plus, Store, Star, Utensils,
} from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Branch { id: string; name: string; address: string; city: string; is_active: boolean }
interface Restaurant {
  id: string; name: string; cuisine_type?: string; logo_url?: string;
  avg_rating?: number; description?: string; branches: Branch[];
}
interface Booking {
  id: string; branch_id: string; booking_date: string;
  booking_time: string; people_count: number; status: string; notes?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TIME_SLOTS = [
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00",
];
function toISO(date: Date) { return date.toISOString().split("T")[0]; }

// Steps: 0=Restaurant, 1=Branch, 2=Date&Time, 3=Guests, 4=Confirm
const STEPS = ["Restaurant", "Branch", "Date & Time", "Guests", "Confirm"] as const;
type Step = 0 | 1 | 2 | 3 | 4;

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti() {
  const particles = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    color: ["#E8A020","#1A3C5E","#C0392B","#27AE60","#F0B840","#2A5C8E"][i % 6],
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    size: 6 + Math.random() * 8,
    duration: 1.2 + Math.random() * 1,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <motion.div key={p.id}
          initial={{ y: -20, x: `${p.x}vw`, opacity: 1, rotate: 0, scale: 1 }}
          animate={{ y: "110vh", opacity: 0, rotate: 720, scale: 0.5 }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          className="absolute top-0 rounded-sm"
          style={{ width: p.size, height: p.size, backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}

// ── Animated Check ────────────────────────────────────────────────────────────
function AnimatedCheck() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <motion.circle cx="40" cy="40" r="36" stroke="#27AE60" strokeWidth="4" fill="none"
        initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }} />
      <motion.path d="M24 40 L35 51 L56 29" stroke="#27AE60" strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round" fill="none"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }} />
    </svg>
  );
}

// ── Step Bar ──────────────────────────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  return (
    <div className="flex items-center mb-8 overflow-x-auto pb-1">
      {STEPS.map((label, idx) => (
        <div key={label} className="flex items-center flex-1 last:flex-none min-w-0">
          <div className="flex flex-col items-center shrink-0">
            <motion.div
              animate={{
                backgroundColor: idx <= current ? "#E8A020" : "#F3F4F6",
                scale: idx === current ? 1.15 : 1,
              }}
              transition={{ type: "spring", stiffness: 300 }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ color: idx <= current ? "white" : "#9CA3AF" }}
            >
              {idx < current ? <CheckCircle2 size={14} /> : idx + 1}
            </motion.div>
            <span className={cn(
              "text-[9px] mt-1 font-semibold whitespace-nowrap",
              idx <= current ? "text-[#E8A020]" : "text-gray-400"
            )}>
              {label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <motion.div
              animate={{ backgroundColor: idx < current ? "#E8A020" : "#F3F4F6" }}
              transition={{ duration: 0.4 }}
              className="h-0.5 flex-1 mx-1 mb-5 rounded-full"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ selected, onSelect }: { selected: Date | null; onSelect: (d: Date) => void }) {
  const [viewDate, setViewDate] = useState(new Date());
  const today = new Date(); today.setHours(0,0,0,0);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleString("default", { month: "long", year: "numeric" });
  const cells: (Date | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <ChevronLeft size={16} className="text-gray-600" />
        </motion.button>
        <span className="text-sm font-bold text-gray-900">{monthName}</span>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <ChevronRight size={16} className="text-gray-600" />
        </motion.button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const isPast = date < today;
          const isSelected = selected && toISO(date) === toISO(selected);
          const isToday = toISO(date) === toISO(today);
          return (
            <motion.button key={i} whileTap={{ scale: 0.85 }} disabled={!!isPast}
              onClick={() => onSelect(date)}
              className={cn(
                "aspect-square rounded-full text-xs font-medium transition-all flex items-center justify-center",
                isPast ? "text-gray-200 cursor-not-allowed" :
                isSelected ? "bg-[#E8A020] text-white shadow-md ring-2 ring-[#E8A020]/30" :
                isToday ? "border-2 border-[#E8A020] text-[#E8A020]" :
                "text-gray-700 hover:bg-gray-100"
              )}>
              {date.getDate()}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BookingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [notes, setNotes] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: restaurants = [], isLoading: restsLoading } = useQuery({
    queryKey: ["restaurants"],
    queryFn: () => apiClient.get<Restaurant[]>("/restaurants"),
  });

  const activeBranches = (selectedRestaurant?.branches ?? []).filter((b) => b.is_active);

  const { mutate: createBooking, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post<Booking>("/bookings", {
        branchId: selectedBranch!.id,
        booking_date: toISO(selectedDate!),
        booking_time: selectedTime!,
        people_count: guestCount,
        notes: notes || undefined,
      }),
    onSuccess: (booking) => {
      setConfirmedBooking(booking);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      setStep(4);
    },
    onError: () => toast.error("Could not create booking. Please try again."),
  });

  // ── Navigation ─────────────────────────────────────────────────────────────
  function goNext() {
    if (step === 3) { createBooking(); return; }
    setStep((s) => (s + 1) as Step);
  }
  function goBack() {
    // When going back from branch step, also clear selected branch
    if (step === 1) setSelectedBranch(null);
    setStep((s) => Math.max(0, s - 1) as Step);
  }

  const canProceed = [
    !!selectedRestaurant,
    !!selectedBranch,
    !!selectedDate && !!selectedTime,
    guestCount >= 1,
    true,
  ][step];

  return (
    <PageWrapper>
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 px-4 pt-4">
        {step > 0 && step < 4 && (
          <motion.button whileTap={{ scale: 0.9 }} onClick={goBack}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <ChevronLeft size={18} className="text-gray-700" />
          </motion.button>
        )}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Book a Table</h1>
          <p className="text-xs text-gray-500">{STEPS[step]}</p>
        </div>
      </div>

      <div className="px-4">
        <StepBar current={step} />

        <AnimatePresence mode="wait">

          {/* ── Step 0: Choose Restaurant ────────────────────────────── */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }} className="space-y-3">
              <p className="text-sm text-gray-500 mb-4">Which restaurant would you like to visit?</p>

              {restsLoading
                ? [1,2,3].map((n) => <div key={n} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)
                : restaurants.length === 0
                  ? (
                    <div className="text-center py-12 text-sm text-gray-400 space-y-2">
                      <Store size={32} className="mx-auto text-gray-300" />
                      <p>No restaurants available</p>
                    </div>
                  )
                  : restaurants.map((restaurant) => (
                    <motion.button key={restaurant.id} whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedRestaurant(restaurant);
                        setSelectedBranch(null); // reset branch when restaurant changes
                        goNext();
                      }}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl border-2 transition-all bg-white",
                        selectedRestaurant?.id === restaurant.id
                          ? "border-[#E8A020] bg-[#E8A020]/5 shadow-md"
                          : "border-gray-100 hover:border-[#E8A020]/40"
                      )}>
                      <div className="flex items-center gap-3">
                        {/* Logo / placeholder */}
                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {restaurant.logo_url
                            ? <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" />
                            : <Utensils size={20} className="text-gray-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-gray-900 text-sm truncate">{restaurant.name}</p>
                            {selectedRestaurant?.id === restaurant.id && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 400 }}>
                                <CheckCircle2 size={18} className="text-[#E8A020] shrink-0" />
                              </motion.div>
                            )}
                          </div>
                          {restaurant.cuisine_type && (
                            <p className="text-xs text-gray-500 mt-0.5">{restaurant.cuisine_type}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5">
                            {restaurant.avg_rating && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Star size={11} className="text-[#E8A020] fill-[#E8A020]" />
                                <span>{restaurant.avg_rating.toFixed(1)}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Store size={11} />
                              <span>{restaurant.branches.filter(b => b.is_active).length} branch{restaurant.branches.filter(b => b.is_active).length !== 1 ? "es" : ""}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))
              }
            </motion.div>
          )}

          {/* ── Step 1: Choose Branch ────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }} className="space-y-3">
              {/* Selected restaurant chip */}
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#1A3C5E]/5 rounded-xl">
                <Utensils size={14} className="text-[#1A3C5E] shrink-0" />
                <span className="text-xs font-semibold text-[#1A3C5E] truncate">{selectedRestaurant?.name}</span>
              </div>
              <p className="text-sm text-gray-500 mb-2">Select a location near you</p>

              {activeBranches.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400 space-y-2">
                  <MapPin size={32} className="mx-auto text-gray-300" />
                  <p>No active branches for this restaurant</p>
                </div>
              ) : (
                activeBranches.map((branch) => (
                  <motion.button key={branch.id} whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedBranch(branch);
                      goNext();
                    }}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border-2 transition-all bg-white",
                      selectedBranch?.id === branch.id
                        ? "border-[#E8A020] bg-[#E8A020]/5 shadow-md"
                        : "border-gray-100 hover:border-[#E8A020]/40"
                    )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{branch.name}</p>
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                          <MapPin size={11} />
                          <span className="truncate">{branch.address}, {branch.city}</span>
                        </div>
                      </div>
                      {selectedBranch?.id === branch.id && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 400 }}>
                          <CheckCircle2 size={20} className="text-[#E8A020] shrink-0" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                ))
              )}
            </motion.div>
          )}

          {/* ── Step 2: Date & Time ──────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }} className="space-y-5">
              <MiniCalendar selected={selectedDate} onSelect={setSelectedDate} />
              {selectedDate && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <p className="text-sm font-bold text-gray-800 mb-3">Select a time</p>
                  <div className="grid grid-cols-4 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const isPast = selectedDate && toISO(selectedDate) === toISO(new Date()) &&
                        slot <= new Date().toTimeString().slice(0,5);
                      return (
                        <motion.button key={slot} whileTap={{ scale: 0.92 }} disabled={!!isPast}
                          onClick={() => setSelectedTime(slot)}
                          className={cn(
                            "py-2 rounded-xl text-xs font-semibold border-2 transition-all",
                            isPast ? "border-gray-100 text-gray-300 line-through bg-gray-50 cursor-not-allowed" :
                            selectedTime === slot
                              ? "border-[#E8A020] bg-[#E8A020] text-white shadow-md"
                              : "border-gray-200 text-gray-700 bg-white hover:border-[#E8A020]/50"
                          )}>
                          {slot}
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── Step 3: Guests & Notes ───────────────────────────────── */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }} className="space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <p className="text-sm font-bold text-gray-800 mb-5">Number of Guests</p>
                <div className="flex items-center justify-center gap-6">
                  <motion.button whileTap={{ scale: 0.85 }} onClick={() => setGuestCount((n) => Math.max(1, n - 1))}
                    className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <Minus size={18} className="text-gray-700" />
                  </motion.button>
                  <AnimatePresence mode="wait">
                    <motion.span key={guestCount}
                      initial={{ opacity: 0, y: -12, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.8 }}
                      transition={{ type: "spring", stiffness: 400, damping: 22 }}
                      className="text-5xl font-bold text-[#1A3C5E] w-16 text-center tabular-nums">
                      {guestCount}
                    </motion.span>
                  </AnimatePresence>
                  <motion.button whileTap={{ scale: 0.85 }} onClick={() => setGuestCount((n) => Math.min(20, n + 1))}
                    className="w-12 h-12 rounded-full bg-[#E8A020] flex items-center justify-center shadow-md">
                    <Plus size={18} className="text-white" />
                  </motion.button>
                </div>
                <p className="text-center text-xs text-gray-400 mt-4">
                  {guestCount === 1 ? "Just you" : `Party of ${guestCount}`}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <label className="text-sm font-bold text-gray-800 block mb-2">
                  Special requests <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Dietary requirements, special occasion, seating preference…"
                  rows={3}
                  className="w-full text-sm bg-gray-50 rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E8A020]/40 resize-none" />
              </div>

              {/* Summary card */}
              <div className="bg-[#1A3C5E]/5 rounded-2xl p-4 space-y-2 text-sm">
                <p className="font-bold text-gray-800 text-xs uppercase tracking-wider mb-3">Booking Summary</p>
                <div className="flex items-center gap-2 text-gray-600">
                  <Utensils size={13} className="text-[#E8A020] shrink-0" />
                  <span className="font-semibold text-gray-900">{selectedRestaurant?.name}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin size={13} className="text-gray-400 shrink-0" />
                  <span>{selectedBranch?.name} — {selectedBranch?.city}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar size={13} className="text-gray-400 shrink-0" />
                  <span>{selectedDate?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock size={13} className="text-gray-400 shrink-0" />
                  <span>{selectedTime}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Users size={13} className="text-gray-400 shrink-0" />
                  <span>{guestCount} guest{guestCount !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Confirmed ────────────────────────────────────── */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="space-y-5">
              <div className="flex flex-col items-center py-6">
                <AnimatedCheck />
                <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }} className="text-xl font-bold text-gray-900 mt-4">
                  Booking Confirmed!
                </motion.h2>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                  className="text-sm text-gray-500 mt-1">See you soon 🎉</motion.p>
              </div>

              {confirmedBooking && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Utensils size={15} className="text-[#E8A020]" />
                    <span className="font-semibold text-gray-900">{selectedRestaurant?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin size={15} className="text-gray-400" />
                    <span>{selectedBranch?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar size={15} className="text-gray-400" />
                    <span>{selectedDate?.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock size={15} className="text-gray-400" />
                    <span>{selectedTime}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users size={15} className="text-gray-400" />
                    <span>{guestCount} guest{guestCount !== 1 ? "s" : ""}</span>
                  </div>
                  {notes && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <FileText size={15} className="text-gray-400 mt-0.5" />
                      <span>{notes}</span>
                    </div>
                  )}
                </motion.div>
              )}

              <motion.button whileTap={{ scale: 0.97 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }} onClick={() => router.push("/customer/home")}
                className="w-full bg-[#1A3C5E] text-white font-bold py-4 rounded-2xl shadow-lg">
                Back to Home
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 1.3 }} onClick={() => router.push("/customer/booking/history")}
                className="w-full border-2 border-[#1A3C5E]/20 text-[#1A3C5E] font-semibold py-3.5 rounded-2xl">
                View Booking History
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Continue / Confirm button */}
        {step < 4 && step !== 0 && step !== 1 && (
          <motion.div layout className="mt-8 pb-6">
            <motion.button whileTap={{ scale: 0.97 }} disabled={!canProceed || isPending} onClick={goNext}
              className={cn(
                "w-full py-4 rounded-2xl font-bold text-white text-base shadow-lg transition-all",
                canProceed ? "bg-[#E8A020] shadow-[#E8A020]/30" : "bg-gray-200 cursor-not-allowed"
              )}>
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin" />Confirming…
                </span>
              ) : step === 3 ? "Confirm Booking" : "Continue"}
            </motion.button>
          </motion.div>
        )}
      </div>
    </PageWrapper>
  );
}
