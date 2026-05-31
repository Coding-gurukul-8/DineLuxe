"use client";

import { useCallback, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface OverdueOrderEvent {
  order_id: string;
  branch_id: string;
  elapsed_minutes?: number;
}

interface UseOverdueOrderOptions {
  branchId?: string;
  onOverdueOrder?: (payload: OverdueOrderEvent) => void;
}

export function useOverdueOrder({ branchId, onOverdueOrder }: UseOverdueOrderOptions = {}) {
  const [lastEvent, setLastEvent] = useState<OverdueOrderEvent | null>(null);

  const handleEvent = useCallback(
    (payload: OverdueOrderEvent) => {
      setLastEvent(payload);
      onOverdueOrder?.(payload);
    },
    [onOverdueOrder]
  );

  const { isConnected, error } = useSupabaseRealtime<OverdueOrderEvent>({
    channel: branchId ? `branch:${branchId}` : undefined,
    event: "overdue_order",
    enabled: !!branchId,
    onEvent: handleEvent,
  });

  return { lastEvent, isConnected, error };
}