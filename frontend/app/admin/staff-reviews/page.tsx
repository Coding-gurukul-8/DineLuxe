"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareText, ChevronDown, Store } from "lucide-react";

import PageWrapper from "@/components/layout/PageWrapper";
import { StaffFeedbackViewer } from "@/components/admin/StaffFeedbackViewer";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RestaurantOption {
  id: string;
  name: string;
  status: "active" | "suspended" | "pending" | "inactive";
}

type RestaurantsPayload =
  | RestaurantOption[]
  | { data: RestaurantOption[]; count?: number };

function normalizeRestaurants(payload: RestaurantsPayload | null): RestaurantOption[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

// ─── Restaurant Selector ──────────────────────────────────────────────────────

interface RestaurantSelectorProps {
  restaurants: RestaurantOption[];
  isLoading: boolean;
  selected: string;
  onSelect: (id: string) => void;
}

function RestaurantSelector({
  restaurants,
  isLoading,
  selected,
  onSelect,
}: RestaurantSelectorProps) {
  const selectedName =
    restaurants.find((r) => r.id === selected)?.name ?? null;

  return (
    <div className="relative w-full sm:w-72">
      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1A3C5E]">
        <Store size={15} />
      </div>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        disabled={isLoading}
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white",
          "pl-9 pr-9 text-sm font-medium text-gray-700 outline-none transition",
          "focus:border-[#1A3C5E] focus:ring-2 focus:ring-[#1A3C5E]/10",
          "disabled:opacity-60 disabled:cursor-wait"
        )}
      >
        <option value="">— Select a restaurant —</option>
        {restaurants.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
            {r.status !== "active" ? ` (${r.status})` : ""}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>
  );
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

function SelectRestaurantPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A3C5E]/8">
        <MessageSquareText size={28} className="text-[#1A3C5E]" />
      </div>
      <h3 className="text-base font-semibold text-gray-800">
        Select a restaurant to view feedback
      </h3>
      <p className="mt-1.5 max-w-xs text-sm text-gray-400">
        Choose a restaurant from the dropdown above to browse anonymous staff
        feedback and sentiment analysis.
      </p>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffReviewsPage() {
  const { user } = useAuth();
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  const { data: rawRestaurants, isLoading: restaurantsLoading } = useQuery<
    RestaurantsPayload
  >({
    queryKey: ["admin-restaurants-for-reviews"],
    queryFn: () =>
      apiClient.get<RestaurantsPayload>("/restaurants?limit=500"),
    staleTime: 5 * 60_000,
  });

  const restaurants = normalizeRestaurants(rawRestaurants ?? null);

  const selectedName =
    restaurants.find((r) => r.id === selectedRestaurantId)?.name ?? null;

  return (
    <PageWrapper
      title="Staff Reviews"
      subtitle="Anonymous workplace feedback submitted by staff"
    >
      <div className="space-y-6">
        {/* Restaurant selector row */}
        <div className="flex flex-wrap items-center gap-4">
          <RestaurantSelector
            restaurants={restaurants}
            isLoading={restaurantsLoading}
            selected={selectedRestaurantId}
            onSelect={(id) => setSelectedRestaurantId(id)}
          />

          {/* Selected restaurant label */}
          <AnimatePresence>
            {selectedName && (
              <motion.span
                key={selectedName}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="text-sm font-semibold text-[#1A3C5E]"
              >
                {selectedName}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Conditional content */}
        <AnimatePresence mode="wait">
          {!selectedRestaurantId ? (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <SelectRestaurantPlaceholder />
            </motion.div>
          ) : (
            <motion.div
              key={selectedRestaurantId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
            >
              <StaffFeedbackViewer
                restaurantId={selectedRestaurantId}
                isAdminView={true}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  );
}