/**
 * lib/socket.ts
 *
 * Singleton Socket.io client for DineLuxe.
 *
 * Design decisions:
 * - autoConnect: false  → we connect explicitly via getSocket() so the
 *   socket isn't opened on module import (avoids SSR issues in Next.js).
 * - URL is derived from NEXT_PUBLIC_API_URL by stripping the "/api/v1"
 *   suffix, so we always point at the raw Express/Socket.io origin.
 * - A ref-count guards disconnectSocket() so sibling hooks don't tear
 *   down a socket that other hooks are still using.
 */

import { io, Socket } from "socket.io-client";

// ── Derive socket origin ───────────────────────────────────────────────────────

function resolveSocketUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  // Strip trailing /api/v1 (with or without trailing slash)
  return apiUrl.replace(/\/api\/v1\/?$/, "");
}

const SOCKET_URL = resolveSocketUrl();

// ── Singleton state ────────────────────────────────────────────────────────────

let socket: Socket | null = null;
let activeRooms = 0; // counts hooks that have joined a room

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the singleton Socket instance, creating and connecting it if needed.
 * Safe to call multiple times — always returns the same instance.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["polling", "websocket"],
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });
  }

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

/**
 * Increment the room ref-count. Called by useRealtime on mount.
 */
export function incrementRoomCount(): void {
  activeRooms++;
}

/**
 * Decrement the room ref-count and disconnect if no rooms remain.
 * Called by useRealtime on unmount.
 */
export function decrementRoomCount(): void {
  activeRooms = Math.max(0, activeRooms - 1);
  if (activeRooms === 0) {
    disconnectSocket();
  }
}

/**
 * Forcefully disconnect and destroy the singleton.
 * Prefer decrementRoomCount() in most cases.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  activeRooms = 0;
}