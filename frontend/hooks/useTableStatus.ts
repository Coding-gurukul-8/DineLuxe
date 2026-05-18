"use client";

import { useState, useEffect, useCallback } from "react";
import { useRealtime } from "./useRealtime";
import { apiClient } from "@/lib/api-client";
import { WS_EVENTS, TABLE_STATUS } from "@/lib/constants";

export type TableStatus = (typeof TABLE_STATUS)[keyof typeof TABLE_STATUS];

export interface TableStatusPayload {
  tableId: string;
  status: TableStatus;
  updatedAt: string;
}

export function useTableStatus(tableId?: string) {
  const { on, joinRoom } = useRealtime();
  const [tableStatus, setTableStatus] = useState<TableStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!tableId) return;
    try {
      setIsLoading(true);
      const data = await apiClient.get<{ status: TableStatus }>(`/tables/${tableId}`);
      setTableStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch table status");
    } finally {
      setIsLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    if (!tableId) return;

    fetchStatus();
    joinRoom(`table:${tableId}`);

    const unsubTableStatus = on<TableStatusPayload>(
      WS_EVENTS.TABLE_STATUS_CHANGED,
      (payload) => {
        if (payload.tableId === tableId) {
          setTableStatus(payload.status);
        }
      }
    );

    return () => {
      unsubTableStatus();
    };
  }, [tableId, fetchStatus, joinRoom, on]);

  return { tableStatus, isLoading, error, refetch: fetchStatus };
}
