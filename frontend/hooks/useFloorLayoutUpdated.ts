"use client";

import { useCallback, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface FloorLayoutUpdatedEvent {
  layout_id: string;
  version?: number;
  branch_id?: string;
}

interface UseFloorLayoutUpdatedOptions {
  branchId?: string;
  onFloorLayoutUpdated?: (payload: FloorLayoutUpdatedEvent) => void;
}

export function useFloorLayoutUpdated({
  branchId,
  onFloorLayoutUpdated,
}: UseFloorLayoutUpdatedOptions = {}) {
  const [lastEvent, setLastEvent] = useState<FloorLayoutUpdatedEvent | null>(null);

  const handleEvent = useCallback(
    (payload: FloorLayoutUpdatedEvent) => {
      if (branchId && payload.branch_id && payload.branch_id !== branchId) return;
      setLastEvent(payload);
      onFloorLayoutUpdated?.(payload);
    },
    [branchId, onFloorLayoutUpdated]
  );

  const { isConnected, error } = useSupabaseRealtime<FloorLayoutUpdatedEvent>({
    channel: branchId ? `branch:${branchId}` : undefined,
    event: "floor_layout_updated",
    enabled: !!branchId,
    onEvent: handleEvent,
  });

  return { lastEvent, isConnected, error };
}