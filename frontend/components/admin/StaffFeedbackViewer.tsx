"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Flag,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  SlidersHorizontal,
  Building2,
} from "lucide-react";

import { SentimentBadge } from "@/components/shared/SentimentBadge";
import { AlertBanner } from "@/components/shared/AlertBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { KPICard } from "@/components/shared/KPICard";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type SentimentLabel = "positive" | "neutral" | "negative";
type DateRange = "7d" | "30d" | "all";
type SentimentFilter = "all" | SentimentLabel;

/**
 * PRIVACY NOTE:
 * This interface intentionally omits any identifying fields.
 * Never add: staff_id, user_id, employee_id, name, email.
 * The backend must enforce this; we also enforce it at the component boundary.
 */
interface StaffFeedback {
  id: string;
  role_label: string;       // e.g. "A Waiter" — anonymised server-side
  branch_name: string;
  feedback_text: string;
  sentiment: SentimentLabel;
  sentiment_score?: number;
  is_flagged: boolean;
  created_at: string;
}

interface FeedbackResponse {
  data: StaffFeedback[];
  total: number;
  page: number;
  page_size: number;
}

interface SentimentStats {
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
  total: number;
}

interface RestaurantOption {
  id: string;
  name: string;
}

interface Props {
  restaurantId?: string;
  isAdminView: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "all": "All Time",
};

const SENTIMENT_FILTERS: { key: SentimentFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "positive", label: "Positive" },
  { key: "neutral", label: "Neutral" },
  { key: "negative", label: "Negative" },
];

// ─── URL builders ─────────────────────────────────────────────────────────────

function buildFeedbackUrl(
  isAdminView: boolean,
  restaurantId: string | undefined,
  sentiment: SentimentFilter,
  dateRange: DateRange,
  page: number
): string {
  const params = new URLSearchParams();
  if (restaurantId) params.set("restaurant_id", restaurantId);
  if (sentiment !== "all") params.set("sentiment", sentiment);
  if (dateRange !== "all") params.set("date_range", dateRange);
  params.set("page", String(page));
  params.set("page_size", String(PAGE_SIZE));
  const base = isAdminView ? "/staff-feedback/admin" : "/staff-feedback";
  return `${base}?${params.toString()}`;
}

function buildStatsUrl(
  isAdminView: boolean,
  restaurantId: string | undefined,
  dateRange: DateRange
): string {
  const params = new URLSearchParams();
  if (restaurantId) params.set("restaurant_id", restaurantId);
  if (dateRange !== "all") params.set("date_range", dateRange);
  const base = isAdminView
    ? "/staff-feedback/admin/stats"
    : "/staff-feedback/stats";
  return `${base}?${params.toString()}`;
}

function relativeDate(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

// ─── Strip identifying fields (defence-in-depth) ──────────────────────────────

function sanitizeFeedback(raw: StaffFeedback): StaffFeedback {
  return {
    id: raw.id,
    role_label: raw.role_label,
    branch_name: raw.branch_name,
    feedback_text: raw.feedback_text,
    sentiment: raw.sentiment,
    sentiment_score: raw.sentiment_score,
    is_flagged: raw.is_flagged,
    created_at: raw.created_at,
    // Anything else from the server response is intentionally dropped here
  };
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  sentiment: SentimentFilter;
  onSentiment: (v: SentimentFilter) => void;
  dateRange: DateRange;
  onDateRange: (v: DateRange) => void;
  branches: { id: string; name: string }[];
  selectedBranch: string;
  onBranch: (v: string) => void;
  restaurants: RestaurantOption[];
  selectedRestaurant: string;
  onRestaurant: (v: string) => void;
  isAdminView: boolean;
}

function FilterBar({
  sentiment,
  onSentiment,
  dateRange,
  onDateRange,
  branches,
  selectedBranch,
  onBranch,
  restaurants,
  selectedRestaurant,
  onRestaurant,
  isAdminView,
}: FilterBarProps) {
  const selectCls =
    "h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 outline-none focus:border-[#1A3C5E] focus:ring-2 focus:ring-[#1A3C5E]/10 transition";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SlidersHorizontal size={14} className="text-gray-400 shrink-0" />

      {/* Restaurant (admin only) */}
      {isAdminView && restaurants.length > 0 && (
        <select
          value={selectedRestaurant}
          onChange={(e) => onRestaurant(e.target.value)}
          className={selectCls}
        >
          <option value="">All restaurants</option>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}

      {/* Branch */}
      {branches.length > 0 && (
        <select
          value={selectedBranch}
          onChange={(e) => onBranch(e.target.value)}
          className={selectCls}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}

      {/* Sentiment pill group */}
      <div className="flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden">
        {SENTIMENT_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSentiment(key)}
            className={cn(
              "h-9 px-3.5 text-xs font-semibold transition border-r border-gray-100 last:border-0",
              sentiment === key
                ? "bg-[#1A3C5E] text-white"
                : "text-gray-500 hover:bg-gray-50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Date range pill group */}
      <div className="flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden">
        {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onDateRange(key)}
            className={cn(
              "h-9 px-3.5 text-xs font-semibold transition border-r border-gray-100 last:border-0",
              dateRange === key
                ? "bg-[#1A3C5E] text-white"
                : "text-gray-500 hover:bg-gray-50"
            )}
          >
            {DATE_RANGE_LABELS[key]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── FeedbackCard ─────────────────────────────────────────────────────────────

interface FeedbackCardProps {
  item: StaffFeedback;
  isAdminView: boolean;
  onFlag: (id: string, flag: boolean) => void;
  isFlagging: boolean;
}

function FeedbackCard({ item, isAdminView, onFlag, isFlagging }: FeedbackCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22 }}
      className={cn(
        "rounded-2xl border bg-white px-5 py-4 transition-shadow hover:shadow-sm",
        item.is_flagged ? "border-amber-200 bg-amber-50/20" : "border-gray-100"
      )}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <SentimentBadge
            sentiment={item.sentiment}
            score={item.sentiment_score}
            size="sm"
          />

          {/* Branch chip */}
          <span className="inline-flex items-center gap-1 rounded-full bg-[#1A3C5E]/8 px-2.5 py-0.5 text-[10px] font-semibold text-[#1A3C5E]">
            <Building2 size={9} />
            {item.branch_name}
          </span>

          {/* Flagged badge */}
          {item.is_flagged && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              🚩 Flagged for follow-up
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-gray-400">{relativeDate(item.created_at)}</span>

          {/* Flag/unflag — admin only, icon-only, deliberately subtle */}
          {isAdminView && (
            <button
              type="button"
              disabled={isFlagging}
              onClick={() => onFlag(item.id, !item.is_flagged)}
              title={item.is_flagged ? "Remove flag" : "Flag for follow-up"}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:opacity-40",
                item.is_flagged
                  ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                  : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
              )}
            >
              <Flag size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Anonymised role attribution */}
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {item.role_label} says…
      </p>

      {/* Feedback body */}
      <p className="text-sm leading-relaxed text-gray-800">{item.feedback_text}</p>
    </motion.div>
  );
}

// ─── Paginator ────────────────────────────────────────────────────────────────

function Paginator({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 pt-1">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="text-xs font-medium text-gray-500">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

// ─── StaffFeedbackViewer ──────────────────────────────────────────────────────

export function StaffFeedbackViewer({ restaurantId, isAdminView }: Props) {
  const qc = useQueryClient();

  const [sentiment, setSentiment] = useState<SentimentFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedRestaurant, setSelectedRestaurant] = useState(restaurantId ?? "");
  const [page, setPage] = useState(1);
  const [flaggingId, setFlaggingId] = useState<string | null>(null);

  const resetPage = () => setPage(1);

  // Effective restaurant ID — admin can change via dropdown; owner is fixed
  const effectiveRestaurantId = isAdminView
    ? (selectedRestaurant || undefined)
    : restaurantId;

  // ── Restaurant list (admin only) ───────────────────────────────────────────
  const { data: restaurantList } = useQuery<RestaurantOption[]>({
    queryKey: ["admin-restaurant-list-feedback"],
    queryFn: () =>
      apiClient.get<RestaurantOption[]>("/restaurants?fields=id,name&limit=200"),
    enabled: isAdminView,
    staleTime: 5 * 60_000,
  });

  // ── Branch list ────────────────────────────────────────────────────────────
  const { data: branchList } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["branches-feedback", effectiveRestaurantId],
    queryFn: () =>
      apiClient.get<{ id: string; name: string }[]>(
        `/restaurants/${effectiveRestaurantId}/branches?fields=id,name`
      ),
    enabled: !!effectiveRestaurantId,
    staleTime: 5 * 60_000,
  });

  // ── Sentiment stats ────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<SentimentStats>({
    queryKey: ["staff-feedback-stats", isAdminView, effectiveRestaurantId, dateRange],
    queryFn: () =>
      apiClient.get<SentimentStats>(
        buildStatsUrl(isAdminView, effectiveRestaurantId, dateRange)
      ),
    staleTime: 60_000,
  });

  // ── Feedback list ──────────────────────────────────────────────────────────
  const {
    data: feedbackData,
    isLoading: feedbackLoading,
    isError,
  } = useQuery<FeedbackResponse>({
    queryKey: [
      "staff-feedback-list",
      isAdminView,
      effectiveRestaurantId,
      selectedBranch,
      sentiment,
      dateRange,
      page,
    ],
    queryFn: () =>
      apiClient.get<FeedbackResponse>(
        buildFeedbackUrl(isAdminView, effectiveRestaurantId, sentiment, dateRange, page)
      ),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  // ── Flag mutation ──────────────────────────────────────────────────────────
  const { mutate: flagMutate } = useMutation({
    mutationFn: ({ id, flag }: { id: string; flag: boolean }) =>
      apiClient.patch(`/staff-feedback/${id}/flag`, { is_flagged: flag }),
    onMutate: ({ id }) => setFlaggingId(id),
    onSettled: () => {
      setFlaggingId(null);
      qc.invalidateQueries({ queryKey: ["staff-feedback-list"] });
    },
  });

  // ── Sanitised items (privacy defence-in-depth) ─────────────────────────────
  const items = useMemo<StaffFeedback[]>(() => {
    return (feedbackData?.data ?? []).map(sanitizeFeedback);
  }, [feedbackData]);

  const showNegativeWarning = (stats?.negative_pct ?? 0) > 30;
  const restaurants = restaurantList ?? [];
  const branches = branchList ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
          ))
        ) : (
          <>
            <KPICard
              title="Positive"
              value={Math.round(stats?.positive_pct ?? 0)}
              suffix="%"
              icon={<span className="text-xl leading-none">🟢</span>}
            />
            <KPICard
              title="Neutral"
              value={Math.round(stats?.neutral_pct ?? 0)}
              suffix="%"
              icon={<span className="text-xl leading-none">🟡</span>}
            />
            <KPICard
              title="Negative"
              value={Math.round(stats?.negative_pct ?? 0)}
              suffix="%"
              icon={<span className="text-xl leading-none">🔴</span>}
              className={showNegativeWarning ? "border-red-200" : undefined}
            />
          </>
        )}
      </div>

      {/* Warning banner */}
      <AnimatePresence>
        {showNegativeWarning && (
          <motion.div
            key="neg-warning"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <AlertBanner
              type="warning"
              message="⚠️ High negative sentiment detected across some branches. Consider reviewing operations or conducting staff meetings."
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <FilterBar
        sentiment={sentiment}
        onSentiment={(v) => { setSentiment(v); resetPage(); }}
        dateRange={dateRange}
        onDateRange={(v) => { setDateRange(v); resetPage(); }}
        branches={branches}
        selectedBranch={selectedBranch}
        onBranch={(v) => { setSelectedBranch(v); resetPage(); }}
        restaurants={restaurants}
        selectedRestaurant={selectedRestaurant}
        onRestaurant={(v) => { setSelectedRestaurant(v); resetPage(); }}
        isAdminView={isAdminView}
      />

      {/* Feedback list */}
      {isError ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
          Failed to load feedback. Please try again.
        </div>
      ) : feedbackLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-gray-100 animate-pulse"
              style={{ animationDelay: `${i * 55}ms` }}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="text-gray-300" size={32} />}
          title="No feedback submitted yet"
          message="Anonymous staff feedback will appear here once submitted."
        />
      ) : (
        <>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <FeedbackCard
                  key={item.id}
                  item={item}
                  isAdminView={isAdminView}
                  onFlag={(id, flag) => flagMutate({ id, flag })}
                  isFlagging={flaggingId === item.id}
                />
              ))}
            </AnimatePresence>
          </div>

          <Paginator
            page={page}
            total={feedbackData?.total ?? 0}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />

          {feedbackData && feedbackData.total > 0 && (
            <p className="text-center text-[11px] text-gray-400">
              Showing {items.length} of {feedbackData.total} entries
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default StaffFeedbackViewer;