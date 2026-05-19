"use client";

/**
 * hooks/useOrderStatus.ts
 *
 * Subscribes to real-time order:status events for a specific order
 * AND polls GET /orders/:orderId every 30s as a fallback.
 *
 * Fixes vs. old version:
 * - Event name: "order:status"  (was WS_EVENTS.ORDER_STATUS_UPDATED = "order_status_updated")
 * - Room: does not join a per-order room — the caller's useRealtime already
 *   joins the branch room where the backend fans out order events
 * - Polling: adds a 30s setInterval on GET /orders/:orderId
 * - Return shape: { status, order }  (was { orderStatus })
 * - Fetches the full order object, not just the status field
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { apiClient } from "@/lib/api-client";
import { OrderStatus } from "@/lib/constants";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  status: OrderStatus;
  [key: string]: unknown; // pass-through for other fields
}

interface OrderStatusEvent {
  orderId: string;
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

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useOrderStatus(orderId?: string): UseOrderStatusReturn {
  const { branchId, role } = useAuth();

  // useRealtime requires a valid branchId — gate it
  const realtimeEnabled = !!branchId && !!orderId;

  const { on, off } = useRealtime({
    branchId: branchId ?? "",
    role: (role as "host" | "kitchen" | "manager" | "waiter") ?? "waiter",
  });

  const [order, setOrder]     = useState<Order | null>(null);
  const [status, setStatus]   = useState<OrderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Keep a stable ref so the socket handler can read latest orderId
  const orderIdRef = useRef(orderId);
  useEffect(() => { orderIdRef.current = orderId; }, [orderId]);

  // ── REST fetch ───────────────────────────────────────────────────────────────

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

  // ── Initial fetch + 30s poll ─────────────────────────────────────────────────

  useEffect(() => {
    if (!orderId) return;

    fetchOrder();
    const interval = setInterval(fetchOrder, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [orderId, fetchOrder]);

  // ── Socket subscription ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!realtimeEnabled) return;

    const handler = (payload: OrderStatusEvent) => {
      // Only update state if this event is for our order
      if (payload.orderId !== orderIdRef.current) return;
      setStatus(payload.status);
      setOrder((prev) => (prev ? { ...prev, status: payload.status } : prev));
    };

    // Backend emits "order:status"
    on<OrderStatusEvent>("order:status", handler);

    return () => {
      off<OrderStatusEvent>("order:status", handler);
    };
  }, [realtimeEnabled, on, off]);

  return { status, order, isLoading, error, refetch: fetchOrder };
}