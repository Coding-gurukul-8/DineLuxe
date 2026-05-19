"use client";

/**
 * components/layout/RealtimeToastHandler.tsx
 *
 * Mounts once inside the owner/manager layout. Subscribes to socket events
 * and shows toast notifications for:
 *   - order:new    → "New order placed!"
 *   - order:status → "Order #<shortId> is now <status>"
 *
 * Fixes vs. old version:
 * - Old version had NO socket at all — it HTTP-polled /notifications every 30s
 * - Now uses useRealtime() to subscribe to live socket events
 * - Guards on branchId (not just user) as specified in the task
 * - Event names corrected: "order:new" and "order:status"
 * - Role defaults to "manager" for the owner panel toast handler
 */

import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrderNewEvent {
  order: {
    id: string;
    table_number?: string | number;
    total?: number;
  };
}

interface OrderStatusEvent {
  orderId: string;
  status: string;
}

// ── Short ID helper ────────────────────────────────────────────────────────────

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

// ── Inner component (only rendered when branchId is available) ────────────────

function RealtimeToastSubscriber({ branchId }: { branchId: string }) {
  const { on, off } = useRealtime({ branchId, role: "manager" });

  useEffect(() => {
    // ── order:new ──────────────────────────────────────────────────────────────
    const onOrderNew = (payload: OrderNewEvent) => {
      const tableLabel = payload.order.table_number
        ? ` (Table ${payload.order.table_number})`
        : "";
      toast.success(`New order placed!${tableLabel}`, {
        description: `Order #${shortId(payload.order.id)}`,
        duration: 6_000,
      });
    };

    // ── order:status ───────────────────────────────────────────────────────────
    const onOrderStatus = (payload: OrderStatusEvent) => {
      const humanStatus = payload.status.replace(/_/g, " ");
      toast.info(`Order #${shortId(payload.orderId)} is now ${humanStatus}`, {
        duration: 4_000,
      });
    };

    on<OrderNewEvent>("order:new", onOrderNew);
    on<OrderStatusEvent>("order:status", onOrderStatus);

    return () => {
      off<OrderNewEvent>("order:new", onOrderNew);
      off<OrderStatusEvent>("order:status", onOrderStatus);
    };
  }, [on, off]);

  return null;
}

// ── Exported component ─────────────────────────────────────────────────────────

export function RealtimeToastHandler() {
  const { branchId, isAuthenticated } = useAuth();

  // Only mount the subscriber when authenticated and branchId is known
  if (!isAuthenticated || !branchId) return null;

  return <RealtimeToastSubscriber branchId={branchId} />;
}