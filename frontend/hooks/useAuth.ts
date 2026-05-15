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
    const storedRole = localStorage.getItem("userRole") as Role | null;
    const storedUser = localStorage.getItem("userData");
    
    if (storedRole && Object.values(ROLES).includes(storedRole as Role)) {
      setRole(storedRole);
      setIsAuthenticated(true);
    }
    
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // Invalid user data
      }
    }
    
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
