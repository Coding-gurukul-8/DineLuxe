"use client";

import { useCallback, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface FoodReadyEvent {
  order_id: string;
  branch_id: string;
}

interface UseFoodReadyOptions {
  branchId?: string;
  onFoodReady?: (payload: FoodReadyEvent) => void;
}

export function useFoodReady({ branchId, onFoodReady }: UseFoodReadyOptions = {}) {
  const [lastEvent, setLastEvent] = useState<FoodReadyEvent | null>(null);

  const handleEvent = useCallback(
    (payload: FoodReadyEvent) => {
      setLastEvent(payload);
      onFoodReady?.(payload);
    },
    [onFoodReady]
  );

  const { isConnected, error } = useSupabaseRealtime<FoodReadyEvent>({
    channel: branchId ? `branch:${branchId}` : undefined,
    event: "food_ready",
    enabled: !!branchId,
    onEvent: handleEvent,
  });

  return { lastEvent, isConnected, error };
}