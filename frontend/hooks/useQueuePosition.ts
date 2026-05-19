"use client";

/**
 * hooks/useQueuePosition.ts
 *
 * Returns the current user's own queue entry for a branch:
 *   { position, estimatedWait, entry }
 *
 * Fixes vs. old version:
 * - Event name: "queue:update"  (was WS_EVENTS.QUEUE_UPDATED = "queue_updated")
 * - API endpoint: GET /queue/me?branch_id=:branchId  (was /queue/branch/:branchId)
 * - Returns { position, estimatedWait, entry } for the current user's entry
 *   (was the entire branch queue array + unrelated helpers)
 * - No joinQueue / markArrived / markNoShow / removeFromQueue — out of scope
 *
 * The backend "queue:update" event payload contains the full queue array;
 * we find the user's own entry by matching against the entry returned by
 * GET /queue/me (or by userId if available).
 */

import { useState, useEffect, useCallback } from "react";
import { useRealtime } from "@/hooks/useRealtime";
import { apiClient } from "@/lib/api-client";

// ── Types ──────────────────────────────────────────────────────────────────────

export type QueueStatus =
  | "waiting"
  | "arrived"
  | "seated"
  | "no_show"
  | "cancelled";

export interface QueueEntry {
  id: string;
  position: number;
  status: QueueStatus;
  estimatedWaitMinutes: number;
  partySize: number;
  arrivedAt?: string | null;
  seatedAt?: string | null;
  createdAt: string;
}

interface QueueUpdateEvent {
  queue: QueueEntry[];
}

interface UseQueuePositionReturn {
  /** The current user's 1-based position in the queue, or null if not found */
  position: number | null;
  /** Estimated wait in minutes, or null */
  estimatedWait: number | null;
  /** The full QueueEntry for the current user, or null */
  entry: QueueEntry | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useQueuePosition(branchId: string): UseQueuePositionReturn {
  const { on, off } = useRealtime({ branchId, role: "host" });

  const [entry, setEntry]             = useState<QueueEntry | null>(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // ── Initial fetch ────────────────────────────────────────────────────────────

  const fetchMyEntry = useCallback(async () => {
    if (!branchId) return;
    try {
      setIsLoading(true);
      // GET /queue/me?branch_id=:branchId — returns the current user's entry
      const data = await apiClient.get<QueueEntry>(
        `/queue/me?branch_id=${branchId}`
      );
      setEntry(data);
      setError(null);
    } catch (err) {
      // 404 means not in queue — treat as null, not an error
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
    fetchMyEntry();
  }, [branchId, fetchMyEntry]);

  // ── Socket subscription ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!branchId) return;

    const handler = (payload: QueueUpdateEvent) => {
      // The backend sends the full branch queue array.
      // Find the current user's entry by matching the entry id we fetched.
      setEntry((prev) => {
        if (!prev) return prev;
        const updated = payload.queue.find((e) => e.id === prev.id);
        return updated ?? prev;
      });
    };

    // Backend emits "queue:update"
    on<QueueUpdateEvent>("queue:update", handler);

    return () => {
      off<QueueUpdateEvent>("queue:update", handler);
    };
  }, [branchId, on, off]);

  return {
    position:      entry?.position       ?? null,
    estimatedWait: entry?.estimatedWaitMinutes ?? null,
    entry,
    isLoading,
    error,
    refetch: fetchMyEntry,
  };
}