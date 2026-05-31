"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";

export type QueueStatus =
  | "waiting"
  | "arrived"
  | "seated"
  | "no_show"
  | "cancelled";

export interface QueueEntry {
  id: string;
  queueId?: string;
  position: number;
  status: QueueStatus;
  estimatedWaitMinutes: number;
  partySize: number;
  userName?: string | null;
  phone?: string | null;
  source?: string | null;
  arrivedAt?: string | null;
  seatedAt?: string | null;
  createdAt: string;
}

interface QueueUpdateEvent {
  branch_id?: string;
  action?: string;
  queue_id?: string;
  position?: number;
}

interface UseQueuePositionReturn {
  position: number | null;
  estimatedWait: number | null;
  entry: QueueEntry | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useQueuePosition(branchId: string): UseQueuePositionReturn {
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyEntry = useCallback(async () => {
    if (!branchId) return;

    try {
      setIsLoading(true);
      const data = await apiClient.get<QueueEntry>(`/queue/me?branch_id=${branchId}`);
      setEntry(data);
      setError(null);
    } catch (err) {
      if ((err as { statusCode?: number })?.statusCode === 404) {
        setEntry(null);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Failed to fetch queue position");
      }
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (!branchId) return;
    void fetchMyEntry();
  }, [branchId, fetchMyEntry]);

  const handleQueueUpdate = useCallback(
    (payload: QueueUpdateEvent) => {
      if (payload.branch_id && payload.branch_id !== branchId) return;
      void fetchMyEntry();
    },
    [branchId, fetchMyEntry]
  );

  useSupabaseRealtime<QueueUpdateEvent>({
    channel: branchId ? `branch:${branchId}` : undefined,
    event: "queue_updated",
    enabled: !!branchId,
    onEvent: handleQueueUpdate,
  });

  return {
    position: entry?.position ?? null,
    estimatedWait: entry?.estimatedWaitMinutes ?? null,
    entry,
    isLoading,
    error,
    refetch: fetchMyEntry,
  };
}