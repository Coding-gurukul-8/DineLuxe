"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Clock,
  Calendar,
  Users2,
} from "lucide-react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Shift {
  id: string;
  staff_id: string;
  date: string;        // "YYYY-MM-DD"
  start_time: string;  // "HH:MM"
  end_time: string;    // "HH:MM"
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const startStr = start.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const endStr = end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

const ROLE_COLORS: Record<string, string> = {
  manager:  "bg-[#1A3C5E]/12 text-[#1A3C5E] border-[#1A3C5E]/20",
  waiter:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  chef:     "bg-orange-50 text-orange-700 border-orange-200",
  cashier:  "bg-violet-50 text-violet-700 border-violet-200",
  host:     "bg-pink-50 text-pink-700 border-pink-200",
  delivery: "bg-sky-50 text-sky-700 border-sky-200",
};

// ── Add Shift Modal ────────────────────────────────────────────────────────────

function AddShiftModal({
  staffId,
  staffName,
  date,
  onClose,
}: {
  staffId: string;
  staffName: string;
  date: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime]     = useState("17:00");
  const [error, setError]         = useState("");

  const { mutate: addShift, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post(`/staff/${staffId}/shifts`, {
        date,
        start_time: startTime,
        end_time: endTime,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      toast.success("Shift added successfully");
      onClose();
    },
    onError: () => {
      toast.error("Failed to add shift");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (startTime >= endTime) {
      setError("End time must be after start time");
      return;
    }
    setError("");
    addShift();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900">Add Shift</h3>
            <p className="text-xs text-gray-400 mt-0.5">{staffName} · {date}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600">Start Time</label>
              <div className="relative">
                <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => { setStartTime(e.target.value); setError(""); }}
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-[#1A3C5E]/20 focus:border-[#1A3C5E] transition"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600">End Time</label>
              <div className="relative">
                <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => { setEndTime(e.target.value); setError(""); }}
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-[#1A3C5E]/20 focus:border-[#1A3C5E] transition"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle size={12} /> {error}
            </p>
          )}

          {/* Duration preview */}
          {!error && startTime < endTime && (
            <div className="px-3 py-2 bg-[#1A3C5E]/5 rounded-xl text-xs text-gray-600 flex items-center gap-1.5">
              <Clock size={12} className="text-[#1A3C5E]" />
              Duration:{" "}
              {(() => {
                const [sh, sm] = startTime.split(":").map(Number);
                const [eh, em] = endTime.split(":").map(Number);
                const mins = (eh * 60 + em) - (sh * 60 + sm);
                return `${Math.floor(mins / 60)}h ${mins % 60}m`;
              })()}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl bg-[#1A3C5E] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#15304d] disabled:opacity-60 transition"
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add Shift
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Shift Cell ────────────────────────────────────────────────────────────────

function ShiftCell({
  shift,
  role,
  onAddClick,
}: {
  shift?: Shift;
  role: string;
  onAddClick: () => void;
}) {
  if (shift) {
    return (
      <div className={cn(
        "rounded-lg border px-2 py-1.5 text-center min-h-10 flex flex-col items-center justify-center",
        ROLE_COLORS[role] ?? "bg-gray-50 text-gray-600 border-gray-200"
      )}>
        <span className="text-[11px] font-semibold leading-tight">{shift.start_time}</span>
        <span className="text-[9px] text-current/60 leading-tight">–</span>
        <span className="text-[11px] font-semibold leading-tight">{shift.end_time}</span>
      </div>
    );
  }

  return (
    <button
      onClick={onAddClick}
      className="w-full min-h-10 rounded-lg border border-dashed border-gray-200 text-gray-300 hover:border-[#1A3C5E]/40 hover:text-[#1A3C5E] hover:bg-[#1A3C5E]/4 transition flex items-center justify-center"
    >
      <Plus size={13} />
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
  const { branchId } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [addModal, setAddModal] = useState<{
    staffId: string;
    staffName: string;
    date: string;
  } | null>(null);

  // ── Fetch staff ────────────────────────────────────────────────────────────
  const { data: staff = [], isLoading: staffLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff", "branch", branchId],
    queryFn: () => apiClient.get<StaffMember[]>(`/staff/branch/${branchId}`),
    enabled: !!branchId,
    staleTime: 60_000,
  });

  // ── Fetch shifts for the week ──────────────────────────────────────────────
  const weekEnd = addDays(weekStart, 6);
  const { data: shifts = [], isLoading: shiftsLoading } = useQuery<Shift[]>({
    queryKey: ["shifts", branchId, toISO(weekStart)],
    queryFn: () =>
      apiClient.get<Shift[]>(
        `/staff/shifts?branch_id=${branchId}&from=${toISO(weekStart)}&to=${toISO(weekEnd)}`
      ),
    enabled: !!branchId,
    staleTime: 30_000,
  });

  const isLoading = staffLoading || shiftsLoading;

  // ── Compute week dates ─────────────────────────────────────────────────────
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // ── Shift lookup: staffId + date → shift ──────────────────────────────────
  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift>();
    shifts.forEach((s) => map.set(`${s.staff_id}:${s.date}`, s));
    return map;
  }, [shifts]);

  const isToday = (date: Date) =>
    toISO(date) === toISO(new Date());

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Shift Schedule
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
            <Calendar size={13} />
            {formatWeekRange(weekStart)}
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30 transition"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition"
          >
            This Week
          </button>
          <button
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30 transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Summary chips */}
      {!isLoading && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-100 rounded-xl px-3 py-1.5 shadow-sm">
            <Users2 size={13} className="text-[#1A3C5E]" />
            {staff.length} staff members
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-100 rounded-xl px-3 py-1.5 shadow-sm">
            <Clock size={13} className="text-[#E8A020]" />
            {shifts.length} shifts this week
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
            <Users2 size={28} className="text-gray-300" />
            <p className="text-sm">No staff found for this branch</p>
          </div>
        ) : (
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {/* Staff column header */}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide w-44">
                  Staff Member
                </th>
                {weekDates.map((date, i) => (
                  <th
                    key={i}
                    className={cn(
                      "px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide w-24",
                      isToday(date) ? "text-[#E8A020]" : "text-gray-400"
                    )}
                  >
                    <div>{DAYS[i]}</div>
                    <div className={cn(
                      "text-[11px] font-normal mt-0.5 font-mono",
                      isToday(date) ? "text-[#E8A020]" : "text-gray-300"
                    )}>
                      {date.getDate()}/{date.getMonth() + 1}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((member, idx) => (
                <motion.tr
                  key={member.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="border-b border-gray-50 last:border-0"
                >
                  {/* Staff name */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className={cn(
                        "text-[10px] font-medium capitalize mt-0.5",
                        ROLE_COLORS[member.role]?.split(" ")[1] ?? "text-gray-400"
                      )}>
                        {member.role}
                      </p>
                    </div>
                  </td>

                  {/* Day cells */}
                  {weekDates.map((date, di) => {
                    const dateStr = toISO(date);
                    const shift = shiftMap.get(`${member.id}:${dateStr}`);
                    return (
                      <td
                        key={di}
                        className={cn(
                          "px-2 py-2",
                          isToday(date) && "bg-[#E8A020]/4"
                        )}
                      >
                        <ShiftCell
                          shift={shift}
                          role={member.role}
                          onAddClick={() =>
                            setAddModal({
                              staffId: member.id,
                              staffName: `${member.first_name} ${member.last_name}`,
                              date: dateStr,
                            })
                          }
                        />
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-1">
        {Object.entries(ROLE_COLORS).map(([role, cls]) => (
          <div
            key={role}
            className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium capitalize", cls)}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
            {role}
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-gray-200 text-[11px] text-gray-400">
          <Plus size={10} /> Empty = click to add shift
        </div>
      </div>

      {/* Add Shift Modal */}
      <AnimatePresence>
        {addModal && (
          <AddShiftModal
            staffId={addModal.staffId}
            staffName={addModal.staffName}
            date={addModal.date}
            onClose={() => setAddModal(null)}
          />
        )}
      </AnimatePresence>
    </PageWrapper>
  );
}