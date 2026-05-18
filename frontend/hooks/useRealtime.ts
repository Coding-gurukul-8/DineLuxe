"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// WebSocket connects directly to the backend — NOT through the Next.js proxy.
// Next.js rewrites only handle HTTP; WS upgrades are not forwarded by the
// built-in proxy, so we must point at the backend origin directly.
const SOCKET_URL =
  process.env.NEXT_PUBLIC_BACKEND_WS_URL || "http://localhost:4000";

let sharedSocket: Socket | null = null;
let refCount = 0;

function getSharedSocket(): Socket {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io(SOCKET_URL, {
      transports: ["polling", "websocket"],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return sharedSocket;
}

export function useRealtime() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const socket = getSharedSocket();
    socketRef.current = socket;
    refCount++;

    // Sync initial state
    setIsConnected(socket.connected);

    const onConnect = () => {
      setIsConnected(true);
      setError(null);
    };
    const onDisconnect = () => setIsConnected(false);
    const onError = (err: Error) => setError(err);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);

      refCount--;
      // Only disconnect when no hook instance is using the socket
      if (refCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        refCount = 0;
      }
    };
  }, []);

  /**
   * Subscribe to a server event. Returns an unsubscribe function.
   * Safe to call before the socket is connected — Socket.io buffers listeners.
   */
  const on = useCallback(<T,>(event: string, callback: (payload: T) => void) => {
    const socket = socketRef.current ?? getSharedSocket();
    socket.on(event, callback);
    return () => socket.off(event, callback);
  }, []);

  /**
   * Join a server-side room so the backend can fan-out events to this client.
   * The backend must handle the "join_room" event and call socket.join(room).
   */
  const joinRoom = useCallback((room: string) => {
    const socket = socketRef.current ?? getSharedSocket();
    socket.emit("join_room", room);
  }, []);

  /**
   * Leave a server-side room.
   */
  const leaveRoom = useCallback((room: string) => {
    const socket = socketRef.current ?? getSharedSocket();
    socket.emit("leave_room", room);
  }, []);

  /**
   * Emit an event to the server.
   */
  const emit = useCallback(<T,>(event: string, payload: T) => {
    const socket = socketRef.current ?? getSharedSocket();
    socket.emit(event, payload);
  }, []);

  return { isConnected, error, on, joinRoom, leaveRoom, emit };
}
