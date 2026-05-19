"use client";

/**
 * hooks/useTableStatus.ts
 *
 * Maintains a live Record<tableId, TableStatus> for all tables in a branch,
 * updated via real-time "table:status" events.
 *
 * Fixes vs. old version:
 * - Accepts branchId (not tableId) — tracks ALL tables, not one
 * - Event name: "table:status"  (was WS_EVENTS.TABLE_STATUS_CHANGED = "table_status_changed")
 * - Return shape: { tableStatuses: Record<string, TableStatus> }
 *   (was { tableStatus: TableStatus | null } for a single table)
 * - Joins the branch room via useRealtime; does not try to join "table:${tableId}"
 */

import { useState, useEffect, useCallback } from "react";
import { useRealtime, type RealtimeRole } from "@/hooks/useRealtime";
import { TableStatus } from "@/lib/constants";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TableStatusEvent {
  tableId: string;
  status: TableStatus;
}

interface UseTableStatusOptions {
  branchId: string;
  /** Which branch room to subscribe as. Defaults to "host". */
  role?: RealtimeRole;
}

interface UseTableStatusReturn {
  /** Live map of every table ID → its current status */
  tableStatuses: Record<string, TableStatus>;
  /** Update a single table's status locally (for optimistic updates) */
  setTableStatus: (tableId: string, status: TableStatus) => void;
  /** Whether the socket is currently connected */
  isConnected: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useTableStatus({
  branchId,
  role = "host",
}: UseTableStatusOptions): UseTableStatusReturn {
  const { on, off, isConnected } = useRealtime({ branchId, role });

  // Record<tableId, status> — updated whenever a table:status event arrives
  const [tableStatuses, setTableStatuses] = useState<Record<string, TableStatus>>({});

  // ── Socket subscription ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!branchId) return;

    const handler = (payload: TableStatusEvent) => {
      setTableStatuses((prev) => ({
        ...prev,
        [payload.tableId]: payload.status,
      }));
    };

    // Backend emits "table:status"
    on<TableStatusEvent>("table:status", handler);

    return () => {
      off<TableStatusEvent>("table:status", handler);
    };
  }, [branchId, on, off]);

  // ── Optimistic local setter ──────────────────────────────────────────────────

  const setTableStatus = useCallback(
    (tableId: string, status: TableStatus) => {
      setTableStatuses((prev) => ({ ...prev, [tableId]: status }));
    },
    []
  );

  return { tableStatuses, setTableStatus, isConnected };
}