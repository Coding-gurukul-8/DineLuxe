"use client";

import { useCallback, useEffect, useState } from "react";
import { type RealtimeRole } from "@/hooks/useRealtime";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { TableStatus } from "@/lib/constants";

interface TableStatusEvent {
  table_id?: string;
  tableId?: string;
  status: TableStatus;
}

interface UseTableStatusOptions {
  branchId: string;
  role?: RealtimeRole;
}

interface UseTableStatusReturn {
  tableStatuses: Record<string, TableStatus>;
  setTableStatus: (tableId: string, status: TableStatus) => void;
  isConnected: boolean;
}

export function useTableStatus({ branchId, role = "host" }: UseTableStatusOptions): UseTableStatusReturn {
  void role;
  const [tableStatuses, setTableStatuses] = useState<Record<string, TableStatus>>({});

  const handleTableStatus = useCallback((payload: TableStatusEvent) => {
    const tableId = payload.table_id ?? payload.tableId;
    if (!tableId) return;

    setTableStatuses((prev) => ({
      ...prev,
      [tableId]: payload.status,
    }));
  }, []);

  const { isConnected } = useSupabaseRealtime<TableStatusEvent>({
    channel: branchId ? `branch:${branchId}` : undefined,
    event: "table_status_changed",
    enabled: !!branchId,
    onEvent: handleTableStatus,
  });

  useEffect(() => {
    if (!branchId) {
      setTableStatuses({});
    }
  }, [branchId]);

  const setTableStatus = useCallback((tableId: string, status: TableStatus) => {
    setTableStatuses((prev) => ({ ...prev, [tableId]: status }));
  }, []);

  return { tableStatuses, setTableStatus, isConnected };
}