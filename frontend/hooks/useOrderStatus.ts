"use client";

import { useState, useEffect, useCallback } from "react";
import { useRealtime } from "./useRealtime";
import { apiClient } from "@/lib/api-client";
import { WS_EVENTS, ORDER_STATUS } from "@/lib/constants";

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export interface OrderStatusPayload {
  orderId: string;
  status: OrderStatus;
  updatedAt: string;
}

export function useOrderStatus(orderId?: string) {
  const { on, joinRoom } = useRealtime();
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!orderId) return;
    try {
      setIsLoading(true);
      const data = await apiClient.get<{ status: OrderStatus }>(`/orders/${orderId}`);
      setOrderStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch order status");
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    fetchStatus();
    joinRoom(`order:${orderId}`);

    const unsubStatusUpdated = on<OrderStatusPayload>(
      WS_EVENTS.ORDER_STATUS_UPDATED,
      (payload) => {
        if (payload.orderId === orderId) {
          setOrderStatus(payload.status);
        }
      }
    );

    return () => {
      unsubStatusUpdated();
    };
  }, [orderId, fetchStatus, joinRoom, on]);

  return { orderStatus, isLoading, error, refetch: fetchStatus };
}
