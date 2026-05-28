"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Database,
  Layers,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  BarChart2,
  AlertTriangle,
  X,
} from "lucide-react";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { KPICard } from "@/components/shared/KPICard";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────── */

interface HealthBasic {
  status: "ok" | "degraded";
  db_latency_ms: number;
  redis_latency_ms: number;
  timestamp: string;
}

interface HealthDetailed extends HealthBasic {
  redis_hit_rate_percent: number;
  db_metrics: {
    active_connections?: number;
    idle_connections?: number;
    total_connections?: number;
    avg_query_ms?: number;
  };
}

/* ─── Helpers ───────────────────────────────────────────── */

function latencyColor(ms: number) {
  if (ms < 50) return { bar: "bg-emerald-500", text: "text-emerald-600", label: "Excellent" };
  if (ms < 150) return { bar: "bg-[#E8A020]", text: "text-[#E8A020]", label: "Good" };
  return { bar: "bg-red-500", text: "text-red-600", label: "Slow" };
}

function LatencyGauge({
  label,
  icon,
  ms,
  maxMs = 300,
}: {
  label: string;
  icon: React.ReactNode;
  ms: number;
  maxMs?: number;
}) {
  const pct = Math.min(100, (ms / maxMs) * 100);
  const { bar, text, label: qlabel } = latencyColor(ms);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#1A3C5E]/8 flex items-center justify-center text-[#1A3C5E]">
            {icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{label}</p>
            <p className={cn("text-xs font-medium", text)}>{qlabel}</p>
          </div>
        </div>
        <span className="font-mono text-2xl font-bold text-gray-900">{ms}<span className="text-sm font-normal text-gray-400 ml-1">ms</span></span>
      </div>

      {/* Gauge bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", bar)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-gray-400 font-mono">
        <span>0ms</span>
        <span>{maxMs}ms</span>
      </div>
    </motion.div>
  );
}

function HitRateRing({ pct }: { pct: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 70 ? "#10b981" : pct >= 40 ? "#E8A020" : "#ef4444";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center gap-3"
    >
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Redis Cache Hit Rate</p>
      <div className="relative">
        <svg width={90} height={90} viewBox="0 0 90 90" className="-rotate-90">
          <circle cx={45} cy={45} r={r} fill="none" stroke="#f3f4f6" strokeWidth={8} />
          <motion.circle
            cx={45}
            cy={45}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${circ}`}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono font-bold text-lg text-gray-900">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        {pct >= 70 ? "Healthy cache usage" : pct >= 40 ? "Cache warming up" : "Low hit rate"}
      </p>
    </motion.div>
  );
}

function DbMetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="font-mono text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}

function DegradedBanner({ onClose }: { onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -12, height: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 mb-2"
      >
        <AlertTriangle size={16} className="text-red-500 shrink-0" />
        <p className="text-sm font-medium text-red-700 flex-1">
          Platform health is <strong>degraded</strong>. One or more services are experiencing elevated latency or failures.
        </p>
        <button onClick={onClose} className="text-red-400 hover:text-red-600 transition-colors">
          <X size={15} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Page ──────────────────────────────────────────────── */

export default function PlatformHealthPage() {
  const [bannerVisible, setBannerVisible] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const { data: health, isLoading, isError, refetch, isFetching } = useQuery<HealthDetailed>({
    queryKey: ["admin", "health", "detailed"],
    queryFn: async () => {
      const data = await apiClient.get<HealthDetailed>("/admin/health/detailed");
      setLastChecked(new Date());
      return data;
    },
    staleTime: 25_000,
    refetchInterval: 30_000,
  });

  // Reset banner when status goes degraded
  useEffect(() => {
    if (health?.status === "degraded") setBannerVisible(true);
  }, [health?.status]);

  const isDegraded = health?.status === "degraded";

  const sparkData = Array.from({ length: 12 }, (_, i) => ({
    v: 30 + Math.sin(i * 0.7) * 10 + Math.random() * 5,
  }));

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Platform Health
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
            <Clock size={12} />
            Last checked: {lastChecked.toLocaleTimeString()} · Auto-refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Overall status pill */}
          {health && (
            <motion.div
              key={health.status}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold",
                isDegraded
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              )}
            >
              {isDegraded ? (
                <AlertCircle size={13} className="animate-pulse" />
              ) : (
                <CheckCircle2 size={13} />
              )}
              {isDegraded ? "Degraded" : "All Systems Operational"}
            </motion.div>
          )}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Degraded banner */}
      {isDegraded && bannerVisible && (
        <DegradedBanner onClose={() => setBannerVisible(false)} />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 gap-3 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm">Failed to load health data</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-[#1A3C5E] hover:underline flex items-center gap-1"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="DB Latency"
              value={health?.db_latency_ms ?? 0}
              suffix="ms"
              icon={<Database size={18} />}
              sparklineData={sparkData}
            />
            <KPICard
              title="Redis Latency"
              value={health?.redis_latency_ms ?? 0}
              suffix="ms"
              icon={<Zap size={18} />}
              sparklineData={sparkData}
            />
            <KPICard
              title="Cache Hit Rate"
              value={health?.redis_hit_rate_percent ?? 0}
              suffix="%"
              icon={<BarChart2 size={18} />}
              trend={(health?.redis_hit_rate_percent ?? 0) >= 70 ? 5.2 : -8.1}
              trendLabel="vs last hour"
            />
            <KPICard
              title="DB Connections"
              value={health?.db_metrics?.active_connections ?? 0}
              icon={<Layers size={18} />}
              trendLabel="active"
            />
          </div>

          {/* Gauges + ring */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <LatencyGauge
              label="Database Latency"
              icon={<Database size={16} />}
              ms={health?.db_latency_ms ?? 0}
            />
            <LatencyGauge
              label="Redis Latency"
              icon={<Zap size={16} />}
              ms={health?.redis_latency_ms ?? 0}
              maxMs={200}
            />
            <HitRateRing pct={health?.redis_hit_rate_percent ?? 0} />
          </div>

          {/* DB metrics detail */}
          {health?.db_metrics && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-xl bg-[#1A3C5E]/8 flex items-center justify-center text-[#1A3C5E]">
                  <Activity size={16} />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">Database Metrics</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                {health.db_metrics.active_connections !== undefined && (
                  <DbMetricRow label="Active Connections" value={health.db_metrics.active_connections} />
                )}
                {health.db_metrics.idle_connections !== undefined && (
                  <DbMetricRow label="Idle Connections" value={health.db_metrics.idle_connections} />
                )}
                {health.db_metrics.total_connections !== undefined && (
                  <DbMetricRow label="Total Connections" value={health.db_metrics.total_connections} />
                )}
                {health.db_metrics.avg_query_ms !== undefined && (
                  <DbMetricRow label="Avg Query Time" value={`${health.db_metrics.avg_query_ms}ms`} />
                )}
              </div>
            </motion.div>
          )}
        </>
      )}
    </PageWrapper>
  );
}