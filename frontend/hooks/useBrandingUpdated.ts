"use client";

import { useCallback, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface BrandingUpdatedEvent {
  restaurant_id: string;
  updated_at?: string;
}

interface UseBrandingUpdatedOptions {
  restaurantId?: string;
  onBrandingUpdated?: (payload: BrandingUpdatedEvent) => void;
}

export function useBrandingUpdated({
  restaurantId,
  onBrandingUpdated,
}: UseBrandingUpdatedOptions = {}) {
  const [lastEvent, setLastEvent] = useState<BrandingUpdatedEvent | null>(null);

  const handleEvent = useCallback(
    (payload: BrandingUpdatedEvent) => {
      if (restaurantId && payload.restaurant_id !== restaurantId) return;
      setLastEvent(payload);
      onBrandingUpdated?.(payload);
    },
    [onBrandingUpdated, restaurantId]
  );

  const { isConnected, error } = useSupabaseRealtime<BrandingUpdatedEvent>({
    channel: restaurantId ? `restaurant:${restaurantId}` : undefined,
    event: "branding_updated",
    enabled: !!restaurantId,
    onEvent: handleEvent,
  });

  return { lastEvent, isConnected, error };
}