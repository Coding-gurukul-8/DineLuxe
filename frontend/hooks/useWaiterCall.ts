"use client";

import { useCallback, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface WaiterCallEvent {
  order_id: string;
  branch_id: string;
  table_id?: string | null;
  created_at?: string;
}

interface UseWaiterCallOptions {
  branchId?: string;
  onWaiterCall?: (payload: WaiterCallEvent) => void;
}

export function useWaiterCall({ branchId, onWaiterCall }: UseWaiterCallOptions = {}) {
  const [lastEvent, setLastEvent] = useState<WaiterCallEvent | null>(null);

  const handleEvent = useCallback(
    (payload: WaiterCallEvent) => {
      setLastEvent(payload);
      onWaiterCall?.(payload);
    },
    [onWaiterCall]
  );

  const { isConnected, error } = useSupabaseRealtime<WaiterCallEvent>({
    channel: branchId ? `branch:${branchId}` : undefined,
    event: "customer_call_waiter",
    enabled: !!branchId,
    onEvent: handleEvent,
  });

  return { lastEvent, isConnected, error };
}