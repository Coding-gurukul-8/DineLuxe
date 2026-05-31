"use client";

import { useCallback, useMemo, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface LocationUpdateEvent {
  lat: number;
  lon: number;
  distance_km?: number;
  eta_minutes?: number;
  delivery_id?: string;
  order_id?: string;
}

interface DeliveryCompleteEvent {
  delivery_id?: string;
  order_id?: string;
  status?: string;
  delivered_at?: string;
}

interface UseDeliveryTrackingOptions {
  orderId?: string;
  deliveryId?: string;
  onLocationUpdate?: (payload: LocationUpdateEvent) => void;
  onDelivered?: (payload: DeliveryCompleteEvent) => void;
}

export function useDeliveryTracking({
  orderId,
  deliveryId,
  onLocationUpdate,
  onDelivered,
}: UseDeliveryTrackingOptions = {}) {
  const [lastLocation, setLastLocation] = useState<LocationUpdateEvent | null>(null);
  const [lastComplete, setLastComplete] = useState<DeliveryCompleteEvent | null>(null);

  const channelName = useMemo(() => {
    if (deliveryId) return `delivery:${deliveryId}`;
    if (orderId) return `order:${orderId}`;
    return undefined;
  }, [deliveryId, orderId]);

  const handleLocation = useCallback(
    (payload: LocationUpdateEvent) => {
      if (deliveryId && payload.delivery_id && payload.delivery_id !== deliveryId) return;
      if (orderId && payload.order_id && payload.order_id !== orderId) return;
      setLastLocation(payload);
      onLocationUpdate?.(payload);
    },
    [deliveryId, orderId, onLocationUpdate]
  );

  const handleComplete = useCallback(
    (payload: DeliveryCompleteEvent) => {
      if (deliveryId && payload.delivery_id && payload.delivery_id !== deliveryId) return;
      if (orderId && payload.order_id && payload.order_id !== orderId) return;
      setLastComplete(payload);
      onDelivered?.(payload);
    },
    [deliveryId, orderId, onDelivered]
  );

  const locationState = useSupabaseRealtime<LocationUpdateEvent>({
    channel: channelName,
    event: "location_update",
    enabled: !!channelName,
    onEvent: handleLocation,
  });

  const completeState = useSupabaseRealtime<DeliveryCompleteEvent>({
    channel: channelName,
    event: "delivery_complete",
    enabled: !!channelName,
    onEvent: handleComplete,
  });

  return {
    lastLocation,
    lastComplete,
    isConnected: locationState.isConnected || completeState.isConnected,
    error: locationState.error ?? completeState.error,
  };
}