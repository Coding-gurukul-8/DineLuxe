"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { OrderStatus } from "@/lib/constants";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface Order {
  id: string;
  status: OrderStatus;
  [key: string]: unknown;
}

interface OrderStatusEvent {
  order_id?: string;
  orderId?: string;
  status: OrderStatus;
}

interface UseOrderStatusReturn {
  status: OrderStatus | null;
  order: Order | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const POLL_INTERVAL_MS = 30_000;

export function useOrderStatus(orderId?: string): UseOrderStatusReturn {
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orderIdRef = useRef(orderId);

  useEffect(() => {
    orderIdRef.current = orderId;
  }, [orderId]);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;

    try {
      setIsLoading(true);
      const data = await apiClient.get<Order>(`/orders/${orderId}`);
      setOrder(data);
      setStatus(data.status);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch order");
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    void fetchOrder();
    const interval = setInterval(fetchOrder, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [orderId, fetchOrder]);

  const handleOrderUpdate = useCallback((payload: OrderStatusEvent) => {
    const payloadOrderId = payload.order_id ?? payload.orderId;
    if (!payloadOrderId || payloadOrderId !== orderIdRef.current) return;

    setStatus(payload.status);
    setOrder((prev) => (prev ? { ...prev, status: payload.status } : prev));
  }, []);

  const handleOrderCancelled = useCallback(
    (payload: { order_id?: string; orderId?: string }) => {
      const payloadOrderId = payload.order_id ?? payload.orderId;
      if (!payloadOrderId || payloadOrderId !== orderIdRef.current) return;
      setStatus("cancelled");
      setOrder((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      void fetchOrder();
    },
    [fetchOrder]
  );

  useSupabaseRealtime<OrderStatusEvent>({
    channel: orderId ? `order:${orderId}` : undefined,
    event: "order_status_updated",
    enabled: !!orderId,
    onEvent: handleOrderUpdate,
  });

  useSupabaseRealtime<{ order_id?: string; orderId?: string }>({
    channel: orderId ? `order:${orderId}` : undefined,
    event: "order_cancelled",
    enabled: !!orderId,
    onEvent: handleOrderCancelled,
  });

  return { status, order, isLoading, error, refetch: fetchOrder };
}