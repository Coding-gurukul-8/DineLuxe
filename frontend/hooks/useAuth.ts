"use client";

import { useState, useEffect } from "react";
import { ROLES } from "@/lib/constants";
import type { Role } from "@/lib/constants";
import type { AuthUser } from "@/types/auth";
import type { AuthProfile } from "@/types/auth";
import { apiClient } from "@/lib/api-client";
import { clearAuthTokens, getAccessToken } from "@/lib/auth-storage";
import { mapProfileToAuthUser } from "@/lib/auth-client";

export function useAuth() {
  const [role, setRole] = useState<Role | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ISSUE 4 FIX: Do NOT hydrate auth state from localStorage before the API
    // confirms the token is still valid. Setting role/user/isAuthenticated here
    // caused a flash of "authenticated" UI on mount when the token was actually
    // expired — the /users/me call would then 401 and clear state, but the flash
    // had already rendered protected content/redirects.
    //
    // Correct flow:
    //   1. Check token exists in localStorage (gating call — no state set yet)
    //   2. Call /users/me with that token
    //   3. On success → hydrate state from the API response
    //   4. On failure → clear tokens and set unauthenticated state

    const accessToken = getAccessToken();
    if (!accessToken) {
      setLoading(false);
      return;
    }

    apiClient
      .get<AuthProfile>("/users/me")
      .then((profile) => {
        // Only set state after the API confirms the token is valid
        setUserData(mapProfileToAuthUser(profile));
      })
      .catch(() => {
        // Token is expired or invalid — clear everything
        clearAuthTokens();
        setUserData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const setUserData = (userData: AuthUser | null) => {
    setUser(userData);
    if (userData) {
      setRole(userData.role);
      setIsAuthenticated(true);
      localStorage.setItem("userData", JSON.stringify(userData));
      localStorage.setItem("userRole", userData.role);
    } else {
      setRole(null);
      setIsAuthenticated(false);
      localStorage.removeItem("userData");
      localStorage.removeItem("userRole");
    }
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    setIsAuthenticated(false);
    localStorage.removeItem("userData");
    localStorage.removeItem("userRole");
    clearAuthTokens();
  };

  const signOut = logout;

  const restaurantId = user?.restaurantId ?? null;
  const branchId = user?.branchId ?? null;
  const session = null;

  return {
    role,
    user,
    isAuthenticated,
    setRole,
    setUser: setUserData,
    logout,
    signOut,
    restaurantId,
    branchId,
    session,
    loading,
  };
}
