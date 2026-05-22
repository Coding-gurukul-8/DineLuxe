"use client";
import { ensureSafeBrowserStorage } from "@/lib/safe-browser-storage";
import { createContext, useContext } from "react";
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
  ensureSafeBrowserStorage();
  const { user, loading, signOut } = useAuth();

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
