"use client";

import { useCallback, useState } from "react";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

interface PaymentConfirmedEvent {
  event: string;
  order_id: string;
  branch_id: string;
  paid_at: string;
}

interface UsePaymentConfirmedOptions {
  branchId?: string;
  role?: "cashier" | "manager";
  onPaymentConfirmed?: (payload: PaymentConfirmedEvent) => void;
}

export function usePaymentConfirmed({
  branchId,
  role = "cashier",
  onPaymentConfirmed,
}: UsePaymentConfirmedOptions = {}) {
  const [lastEvent, setLastEvent] = useState<PaymentConfirmedEvent | null>(null);

  const handleEvent = useCallback(
    (payload: PaymentConfirmedEvent) => {
      setLastEvent(payload);
      onPaymentConfirmed?.(payload);
    },
    [onPaymentConfirmed]
  );

  const { isConnected, error } = useSupabaseRealtime<PaymentConfirmedEvent>({
    channel: branchId ? `branch:${branchId}:${role}` : undefined,
    event: "payment_confirmed",
    enabled: !!branchId,
    onEvent: handleEvent,
  });

  return { lastEvent, isConnected, error };
}