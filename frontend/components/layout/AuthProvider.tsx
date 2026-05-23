"use client";
import { ensureSafeBrowserStorage } from "@/lib/safe-browser-storage";
import { createContext, useContext, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();

  // Ensure localStorage is safe to use on first client render.
  // Kept in useEffect so it never runs during SSR prerendering.
  useEffect(() => {
    ensureSafeBrowserStorage();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);