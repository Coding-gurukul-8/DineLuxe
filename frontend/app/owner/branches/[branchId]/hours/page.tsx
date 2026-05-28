"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  Loader2,
  AlertCircle,
  Save,
  Building2,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface DayHours {
  open: string;   // "HH:MM"
  close: string;  // "HH:MM"
  closed: boolean;
}

type OperatingHours = Record<DayKey, DayHours>;

interface Branch {
  id: string;
  name: string;
  operating_hours: OperatingHours | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: "mon", label: "Monday",    short: "Mon" },
  { key: "tue", label: "Tuesday",   short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday",  short: "Thu" },
  { key: "fri", label: "Friday",    short: "Fri" },
  { key: "sat", label: "Saturday",  short: "Sat" },
  { key: "sun", label: "Sunday",    short: "Sun" },
];

const DEFAULT_HOURS: DayHours = { open: "09:00", close: "22:00", closed: false };

function buildDefaultHours(): OperatingHours {
  return Object.fromEntries(
    DAYS.map(({ key }) => [key, { ...DEFAULT_HOURS }])
  ) as OperatingHours;
}

function parseHours(raw: OperatingHours | null | undefined): OperatingHours {
  const defaults = buildDefaultHours();
  if (!raw) return defaults;
  const result: Partial<OperatingHours> = {};
  for (const { key } of DAYS) {
    const day = raw[key];
    result[key] = {
      open:   day?.open   ?? "09:00",
      close:  day?.close  ?? "22:00",
      closed: day?.closed ?? false,
    };
  }
  return result as OperatingHours;
}

function formatDuration(open: string, close: string): string {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const mins = (ch * 60 + cm) - (oh * 60 + om);
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DayRow({
  day,
  hours,
  onChange,
}: {
  day: (typeof DAYS)[number];
  hours: DayHours;
  onChange: (key: DayKey, next: DayHours) => void;
}) {
  const duration = !hours.closed && hours.open < hours.close
    ? formatDuration(hours.open, hours.close)
    : null;

  return (
    <motion.div
      layout
      className={cn(
        "flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 rounded-2xl border transition-colors",
        hours.closed
          ? "bg-gray-50 border-gray-100"
          : "bg-white border-gray-100 shadow-sm"
      )}
    >
      {/* Day name */}
      <div className="sm:w-28 shrink-0">
        <p className={cn(
          "text-sm font-semibold",
          hours.closed ? "text-gray-400" : "text-gray-800"
        )}>
          {day.label}
        </p>
        {duration && (
          <p className="text-[11px] text-[#E8A020] font-medium mt-0.5">{duration} open</p>
        )}
        {hours.closed && (
          <p className="text-[11px] text-gray-400 mt-0.5">Closed all day</p>
        )}
      </div>

      {/* Time inputs */}
      <div className={cn(
        "flex items-center gap-2 flex-1 transition-opacity",
        hours.closed && "opacity-30 pointer-events-none"
      )}>
        <div className="relative flex-1">
          <Clock size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="time"
            value={hours.open}
            onChange={(e) => onChange(day.key, { ...hours, open: e.target.value })}
            disabled={hours.closed}
            className="w-full pl-7 pr-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#1A3C5E]/20 focus:border-[#1A3C5E] transition bg-white"
          />
        </div>
        <span className="text-gray-400 text-sm font-medium shrink-0">to</span>
        <div className="relative flex-1">
          <Clock size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="time"
            value={hours.close}
            onChange={(e) => onChange(day.key, { ...hours, close: e.target.value })}
            disabled={hours.closed}
            className="w-full pl-7 pr-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#1A3C5E]/20 focus:border-[#1A3C5E] transition bg-white"
          />
        </div>
      </div>

      {/* Closed toggle */}
      <button
        type="button"
        onClick={() => onChange(day.key, { ...hours, closed: !hours.closed })}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0",
          hours.closed
            ? "bg-gray-200 text-gray-500 hover:bg-gray-300"
            : "bg-red-50 text-red-500 hover:bg-red-100 border border-red-100"
        )}
      >
        {hours.closed ? (
          <>
            <ToggleLeft size={14} /> Closed
          </>
        ) : (
          <>
            <ToggleRight size={14} /> Open
          </>
        )}
      </button>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BranchHoursPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [hours, setHours] = useState<OperatingHours>(buildDefaultHours());
  const [isDirty, setIsDirty] = useState(false);

  // ── Load branch ────────────────────────────────────────────────────────────
  const { data: branch, isLoading, isError } = useQuery<Branch>({
    queryKey: ["branches", branchId],
    queryFn: () => apiClient.get<Branch>(`/branches/${branchId}`),
    staleTime: 60_000,
    enabled: !!branchId,
  });

  useEffect(() => {
    if (branch) {
      setHours(parseHours(branch.operating_hours));
      setIsDirty(false);
    }
  }, [branch]);

  // ── Save mutation ──────────────────────────────────────────────────────────
  const { mutate: saveHours, isPending: isSaving } = useMutation({
    mutationFn: () =>
      apiClient.patch(`/branches/${branchId}`, { operating_hours: hours }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches", branchId] });
      setIsDirty(false);
      toast.success("Operating hours saved successfully");
    },
    onError: () => toast.error("Failed to save operating hours"),
  });

  function handleDayChange(key: DayKey, next: DayHours) {
    setHours((prev) => ({ ...prev, [key]: next }));
    setIsDirty(true);
  }

  function handleApplyWeekdays(key: DayKey) {
    const source = hours[key];
    const weekdays: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];
    setHours((prev) => {
      const next = { ...prev };
      weekdays.forEach((d) => { next[d] = { ...source }; });
      return next;
    });
    setIsDirty(true);
    toast.success("Applied to all weekdays");
  }

  // ── Summary stats ──────────────────────────────────────────────────────────
  const openDays = DAYS.filter(({ key }) => !hours[key].closed).length;

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30 transition"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Operating Hours
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
            <Building2 size={13} />
            {isLoading ? "Loading…" : branch?.name ?? `Branch ${branchId}`}
          </p>
        </div>

        {/* Save button */}
        <button
          onClick={() => saveHours()}
          disabled={!isDirty || isSaving}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition",
            isDirty && !isSaving
              ? "bg-[#1A3C5E] text-white hover:bg-[#15304d] shadow-sm"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          {isSaving ? (
            <><Loader2 size={14} className="animate-spin" /> Saving…</>
          ) : isDirty ? (
            <><Save size={14} /> Save Changes</>
          ) : (
            <><CheckCircle2 size={14} /> Saved</>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 gap-3 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm">Failed to load branch data</p>
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          {/* Summary banner */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#1A3C5E]/5 rounded-xl border border-[#1A3C5E]/10">
            <Clock size={16} className="text-[#1A3C5E] shrink-0" />
            <p className="text-sm text-gray-600">
              Open <strong className="text-[#1A3C5E]">{openDays} day{openDays !== 1 ? "s" : ""}</strong> per week.
              Toggle any day to mark it as closed.
            </p>
          </div>

          {/* Day rows */}
          <div className="space-y-2">
            {DAYS.map((day, idx) => (
              <motion.div
                key={day.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <DayRow
                  day={day}
                  hours={hours[day.key]}
                  onChange={handleDayChange}
                />
              </motion.div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setHours(buildDefaultHours());
                  setIsDirty(true);
                }}
                className="px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Reset to defaults
              </button>
              <button
                type="button"
                onClick={() => {
                  setHours((prev) => {
                    const next = { ...prev };
                    DAYS.forEach(({ key }) => { next[key] = { ...next[key], closed: false }; });
                    return next;
                  });
                  setIsDirty(true);
                }}
                className="px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
              >
                Open all days
              </button>
              <button
                type="button"
                onClick={() => {
                  const sat: DayKey = "sat";
                  const sun: DayKey = "sun";
                  setHours((prev) => ({
                    ...prev,
                    [sat]: { ...prev[sat], closed: true },
                    [sun]: { ...prev[sun], closed: true },
                  }));
                  setIsDirty(true);
                }}
                className="px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Close weekends
              </button>
              <button
                type="button"
                onClick={() => handleApplyWeekdays("mon")}
                className="px-3.5 py-2 rounded-xl border border-[#1A3C5E]/20 bg-[#1A3C5E]/5 text-xs font-medium text-[#1A3C5E] hover:bg-[#1A3C5E]/10 transition"
              >
                Apply Mon hours to all weekdays
              </button>
            </div>
          </div>

          {/* Sticky save on mobile */}
          {isDirty && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="sticky bottom-4 sm:hidden"
            >
              <button
                onClick={() => saveHours()}
                disabled={isSaving}
                className="w-full py-3 rounded-2xl bg-[#1A3C5E] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xl disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                {isSaving ? "Saving…" : "Save Operating Hours"}
              </button>
            </motion.div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}