"use client";

import { useCallback, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface OrderCancelledEvent {
  order_id: string;
  branch_id: string;
  reason?: string | null;
}

interface UseOrderCancelledOptions {
  branchId?: string;
  orderId?: string;
  onOrderCancelled?: (payload: OrderCancelledEvent) => void;
}

export function useOrderCancelled({
  branchId,
  orderId,
  onOrderCancelled,
}: UseOrderCancelledOptions = {}) {
  const [lastEvent, setLastEvent] = useState<OrderCancelledEvent | null>(null);

  const handleEvent = useCallback(
    (payload: OrderCancelledEvent) => {
      if (orderId && payload.order_id !== orderId) return;
      setLastEvent(payload);
      onOrderCancelled?.(payload);
    },
    [orderId, onOrderCancelled]
  );

  const { isConnected, error } = useSupabaseRealtime<OrderCancelledEvent>({
    channel: branchId ? `branch:${branchId}` : undefined,
    event: "order_cancelled",
    enabled: !!branchId,
    onEvent: handleEvent,
  });

  return { lastEvent, isConnected, error };
}