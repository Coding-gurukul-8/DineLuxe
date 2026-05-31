"use client";

import { useCallback, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface InventoryLowEvent {
  branch_id: string;
  items: Array<Record<string, unknown>>;
}

interface UseInventoryLowOptions {
  branchId?: string;
  onInventoryLow?: (payload: InventoryLowEvent) => void;
}

export function useInventoryLow({ branchId, onInventoryLow }: UseInventoryLowOptions = {}) {
  const [lastEvent, setLastEvent] = useState<InventoryLowEvent | null>(null);

  const handleEvent = useCallback(
    (payload: InventoryLowEvent) => {
      if (branchId && payload.branch_id !== branchId) return;
      setLastEvent(payload);
      onInventoryLow?.(payload);
    },
    [branchId, onInventoryLow]
  );

  const { isConnected, error } = useSupabaseRealtime<InventoryLowEvent>({
    channel: branchId ? `manager:${branchId}` : undefined,
    event: "inventory_low",
    enabled: !!branchId,
    onEvent: handleEvent,
  });

  return { lastEvent, isConnected, error };
}