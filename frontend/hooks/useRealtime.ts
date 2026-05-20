"use client";

/**
 * hooks/useRealtime.ts
 *
 * Core real-time hook. Accepts either a room name or a branch+role so it can
 * join the correct server-side room automatically on mount.
 *
 * Fixes vs. old version:
 * - Socket creation/management moved to lib/socket.ts (singleton)
 * - Accepts { branchId, role } or { room } and auto-joins the right room
 * - URL derived from NEXT_PUBLIC_API_URL (not NEXT_PUBLIC_BACKEND_WS_URL)
 * - autoConnect: false — socket connects explicitly via getSocket()
 * - Returns { on, off } as specified; isConnected available as bonus
 * - Ref-count via incrementRoomCount / decrementRoomCount in socket.ts
 */

import { useEffect, useCallback, useState } from "react";
import {
  getSocket,
  incrementRoomCount,
  decrementRoomCount,
} from "@/lib/socket";

export type RealtimeRole = "host" | "kitchen" | "manager" | "waiter";

type UseRealtimeOptions =
  | { branchId: string; role: RealtimeRole }
  | { room: string };

interface UseRealtimeReturn {
  /** Subscribe to a socket event. Returns an unsubscribe function. */
  on: <T>(event: string, handler: (payload: T) => void) => () => void;
  /** Unsubscribe a previously registered handler. */
  off: <T>(event: string, handler: (payload: T) => void) => void;
  /** Whether the socket is currently connected. */
  isConnected: boolean;
}

export function useRealtime(options: UseRealtimeOptions): UseRealtimeReturn {
  const [isConnected, setIsConnected] = useState(false);
  const room = "room" in options
    ? options.room
    : options.branchId
      ? `branch:${options.branchId}:${options.role}`
      : "";

  useEffect(() => {
    if (!room) return;

    const socket = getSocket();
    incrementRoomCount();

    // Sync connection state
    setIsConnected(socket.connected);

    const onConnect = () => {
      setIsConnected(true);
      // Re-join room after reconnect (socket.io doesn't persist rooms across
      // disconnects on the server side by default)
      socket.emit("join_room", room);
    };
    const onDisconnect = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    // Join room immediately if already connected, otherwise wait for connect
    if (socket.connected) {
      socket.emit("join_room", room);
    }

    return () => {
      socket.emit("leave_room", room);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      decrementRoomCount();
    };
  }, [room]);

  const on = useCallback(
    <T,>(event: string, handler: (payload: T) => void) => {
      const socket = getSocket();
      socket.on(event, handler as (...args: unknown[]) => void);
      return () =>
        socket.off(event, handler as (...args: unknown[]) => void);
    },
    []
  );

  const off = useCallback(
    <T,>(event: string, handler: (payload: T) => void) => {
      const socket = getSocket();
      socket.off(event, handler as (...args: unknown[]) => void);
    },
    []
  );

  return { on, off, isConnected };
}