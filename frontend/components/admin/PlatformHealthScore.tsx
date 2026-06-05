"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, animate, useMotionValue } from "framer-motion";
import { ShieldCheck, RefreshCw, Clock } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface HealthScoreComponent {
  name: string;
  score: number;
  max: number;
  color: "green" | "yellow" | "orange" | "red";
}

export interface HealthScoreResult {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  label: string;
  components: HealthScoreComponent[];
  computed_at: string;
}

/* ─── Grade configuration ────────────────────────────────────────────────── */

const GRADE_CONFIG = {
  A: { from: "#1E7E34", to: "#27AE60", glow: "rgba(39,174,96,0.40)" },
  B: { from: "#1A6B5A", to: "#1ABC9C", glow: "rgba(26,188,156,0.40)" },
  C: { from: "#E67E22", to: "#F39C12", glow: "rgba(243,156,18,0.40)" },
  D: { from: "#E74C3C", to: "#E67E22", glow: "rgba(231,76,60,0.40)" },
  F: { from: "#922B21", to: "#E74C3C", glow: "rgba(146,43,33,0.50)" },
} as const;

const COMPONENT_BAR: Record<HealthScoreComponent["color"], string> = {
  green:  "#27AE60",
  yellow: "#F1C40F",
  orange: "#E67E22",
  red:    "#E74C3C",
};

/* ─── Animated counter ───────────────────────────────────────────────────── */

function AnimatedCounter({ target }: { target: number }) {
  const mv   = useMotionValue(0);
  const ref  = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const ctrl  = animate(mv, target, { duration: 1.5, ease: "easeOut" });
    const unsub = mv.on("change", (v) => {
      if (ref.current) ref.current.textContent = String(Math.round(v));
    });
    return () => { ctrl.stop(); unsub(); };
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span ref={ref} className="tabular-nums">0</span>;
}

/* ─── Circular score ring ────────────────────────────────────────────────── */

function ScoreRing({
  score,
  grade,
}: {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
}) {
  const { to: ringColor, glow } = GRADE_CONFIG[grade];
  const r    = 58;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
      {/* Glow halo */}
      <div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: glow, opacity: 0.7 }}
      />

      {/* SVG ring */}
      <svg
        width={160}
        height={160}
        viewBox="0 0 160 160"
        className="absolute -rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle cx={80} cy={80} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={10} />
        {/* Progress */}
        <motion.circle
          cx={80} cy={80} r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={String(circ)}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.15 }}
        />
      </svg>

      {/* Score text */}
      <div className="relative z-10 flex flex-col items-center leading-none select-none">
        <span
          className="font-black text-white tabular-nums"
          style={{ fontSize: 56, lineHeight: 1 }}
        >
          <AnimatedCounter target={score} />
        </span>
        <span className="text-white/50 text-xs font-semibold tracking-widest uppercase mt-1">
          / 100
        </span>
      </div>
    </div>
  );
}

/* ─── Component breakdown row ────────────────────────────────────────────── */

function ComponentRow({
  component,
  index,
}: {
  component: HealthScoreComponent;
  index: number;
}) {
  const pct      = Math.min(100, (component.score / component.max) * 100);
  const barColor = COMPONENT_BAR[component.color];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.55 + index * 0.07 }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-white/65">{component.name}</span>
        <span className="text-xs font-bold text-white tabular-nums">
          {component.score}
          <span className="text-white/35 font-normal">/{component.max}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.0, ease: "easeOut", delay: 0.65 + index * 0.07 }}
        />
      </div>
    </motion.div>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{ background: "linear-gradient(135deg,#1A3C5E,#2C5F8A)", minHeight: 380 }}
    >
      <div className="p-6 flex flex-col items-center gap-6">
        <div className="w-40 h-40 rounded-full bg-white/10" />
        <div className="space-y-1.5 text-center">
          <div className="w-20 h-7 rounded-full bg-white/10 mx-auto" />
          <div className="w-44 h-4 rounded-full bg-white/10 mx-auto" />
        </div>
        <div className="w-full space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="flex justify-between mb-1">
                <div className="w-28 h-3 rounded-full bg-white/10" />
                <div className="w-10 h-3 rounded-full bg-white/10" />
              </div>
              <div className="h-1.5 rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Relative time ──────────────────────────────────────────────────────── */

function relativeTime(isoStr: string): string {
  const diffMs  = Date.now() - new Date(isoStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 15)  return "just now";
  if (diffSec < 60)  return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr  = Math.floor(diffMin / 60);
  return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
}

/* ─── Main component ─────────────────────────────────────────────────────── */

interface PlatformHealthScoreProps {
  className?: string;
}

export function PlatformHealthScore({ className }: PlatformHealthScoreProps) {
  const [, forceRender] = useState(0);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<HealthScoreResult>({
    queryKey: ["admin", "health", "score"],
    queryFn:  () => apiClient.get<HealthScoreResult>("/admin/health/score"),
    staleTime:       4 * 60 * 1_000,  // stay fresh for 4 min
    refetchInterval: 5 * 60 * 1_000,  // auto-refresh every 5 min
  });

  // Re-render every 30s so the "Updated X ago" label stays current
  useEffect(() => {
    if (!data?.computed_at) return;
    const id = setInterval(() => forceRender((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [data?.computed_at]);

  if (isLoading) return <Skeleton />;

  const grade = data?.grade ?? "B";
  const cfg   = GRADE_CONFIG[grade];

  if (isError || !data) {
    return (
      <div
        className={cn("rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-3 py-12", className)}
        style={{ background: `linear-gradient(135deg,${GRADE_CONFIG.B.from},${GRADE_CONFIG.B.to})` }}
      >
        <ShieldCheck size={28} className="text-white/30" />
        <p className="text-sm text-white/50">Health score unavailable</p>
        <button
          onClick={() => refetch()}
          className="text-xs text-white/60 hover:text-white underline transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn("relative rounded-2xl overflow-hidden shadow-xl", className)}
      style={{ background: `linear-gradient(135deg,${cfg.from} 0%,${cfg.to} 100%)` }}
    >
      {/* Subtle grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }}
      />

      <div className="relative p-6">
        {/* ── Header row ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <ShieldCheck size={15} className="text-white" />
            </div>
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-[0.12em]">
              Platform Health Score
            </span>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh now"
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={cn("text-white", isFetching && "animate-spin")} />
          </button>
        </div>

        {/* ── Score ring + grade + label ──────────────────────────────── */}
        <div className="flex flex-col items-center gap-4 mb-6">
          <ScoreRing score={data.score} grade={grade} />

          <div className="text-center space-y-0.5">
            <motion.div
              key={grade}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex items-baseline justify-center gap-2"
            >
              <span className="font-black text-white" style={{ fontSize: 36, lineHeight: 1 }}>
                {grade}
              </span>
              <span className="text-white/50 font-semibold text-xs uppercase tracking-wider">
                Grade
              </span>
            </motion.div>
            <p className="text-white/75 text-sm font-medium">
              Platform Health:{" "}
              <span className="text-white font-bold">{data.label}</span>
            </p>
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────── */}
        <div className="h-px bg-white/10 mb-5" />

        {/* ── Component breakdown ─────────────────────────────────────── */}
        <div className="space-y-4">
          {data.components.map((c, i) => (
            <ComponentRow key={c.name} component={c} index={i} />
          ))}
        </div>

        {/* ── Footer timestamp ─────────────────────────────────────────── */}
        <div className="mt-5 flex items-center gap-1.5 text-white/35">
          <Clock size={10} />
          <span className="text-[10px] font-medium">
            Updated {relativeTime(data.computed_at)}
          </span>
          <span className="text-[10px]">· Auto-refreshes every 5 min</span>
        </div>
      </div>
    </motion.div>
  );
}

export default PlatformHealthScore;
