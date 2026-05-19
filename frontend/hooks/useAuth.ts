"use client";

import { useState, useEffect } from "react";
import { ROLES } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import type { AuthUser } from "@/types/auth";
import type { AuthProfile } from "@/types/auth";
import { apiClient } from "@/lib/api-client";
import { clearAuthTokens, getAccessToken } from "@/lib/auth-storage";
import { logout as authLogout, mapProfileToAuthUser } from "@/lib/auth-client";

export function useAuth() {
  const [role, setRole] = useState<Role | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auth hydration flow:
    //   1. Bail early (unauthenticated) if no token in localStorage — avoids
    //      an unnecessary network call on every page load for logged-out users.
    //   2. Call GET /users/me to validate the token and fetch current profile.
    //   3. On success → hydrate state from the server response.
    //   4. On failure → clear stale tokens and set unauthenticated state.
    //
    // We deliberately do NOT read user data from localStorage before the API
    // responds: doing so caused a flash of "authenticated" UI when the token
    // was expired, because the 401 → clear cycle happened after first render.

    const accessToken = getAccessToken();
    if (!accessToken) {
      setLoading(false);
      return;
    }

    apiClient
      .get<AuthProfile>("/users/me")
      .then((profile) => {
        setUserData(mapProfileToAuthUser(profile));
      })
      .catch(() => {
        // Token is expired or invalid; api-client will have already attempted
        // a refresh via /auth/refresh and redirected on failure if needed.
        // Clearing here handles any residual local state.
        clearAuthTokens();
        setUserData(null);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Internal setter ─────────────────────────────────────────────────────────
  // Centralises all state updates so role, isAuthenticated, and the optional
  // localStorage cache are always kept in sync with the user object.
  const setUserData = (userData: AuthUser | null) => {
    setUser(userData);
    if (userData) {
      setRole(userData.role);
      setIsAuthenticated(true);
      // Mirror to localStorage so other tabs / SSR middleware can read role
      // without making an API call (NOT used to hydrate auth state on mount —
      // see the useEffect comment above).
      localStorage.setItem("userData", JSON.stringify(userData));
      localStorage.setItem("userRole", userData.role);
    } else {
      setRole(null);
      setIsAuthenticated(false);
      localStorage.removeItem("userData");
      localStorage.removeItem("userRole");
    }
  };

  // ── logout ──────────────────────────────────────────────────────────────────
  // 1. Calls POST /auth/logout (authenticated) so the backend can revoke the
  //    refresh token from Redis / the token store.
  // 2. Clears all local tokens and cache via auth-client's finally block.
  // 3. Clears React state.
  // 4. Hard-navigates to /auth/login via window.location.href to fully reset
  //    React state and break any ongoing render cycles (same pattern used in
  //    api-client.ts for automatic 401 redirects).
  const logout = async () => {
    // Clear React state first so the UI responds immediately.
    setUser(null);
    setRole(null);
    setIsAuthenticated(false);
    localStorage.removeItem("userData");
    localStorage.removeItem("userRole");

    // authLogout() fires POST /auth/logout and calls clearAuthTokens() in its
    // finally block — errors are silently swallowed so the client always logs
    // out even if the backend is unreachable.
    await authLogout();

    // Hard navigation — not router.push() — so the full page reloads and
    // any in-memory state from other hooks/providers is completely reset.
    window.location.href = "/auth/login";
  };

  // ── Derived values ──────────────────────────────────────────────────────────
  const restaurantId = user?.restaurantId ?? null;
  const branchId = user?.branchId ?? null;

  return {
    // Core auth state
    user,
    role,
    isAuthenticated,
    loading,

    // Actions
    logout,
    /** Hydrate auth state externally (e.g. after OTP verify or login). */
    setUser: setUserData,

    // Convenience aliases
    signOut: logout,
    restaurantId,
    branchId,

    // Kept for backward-compatibility with components that read role directly.
    setRole,

    // Null placeholder — Supabase session not used in this auth model.
    session: null,
  };
}