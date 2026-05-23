"use client";
import { ensureSafeBrowserStorage } from "@/lib/safe-browser-storage";
import { createContext, useContext, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { AuthUser } from "@/types/auth";

// Shim localStorage at module-evaluation time so it is ready before any
// child component (including Zustand stores) first renders on the client.
// The typeof window guard makes this a no-op during SSR.
if (typeof window !== "undefined") {
  ensureSafeBrowserStorage();
}

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

  // Belt-and-suspenders: also shim in useEffect in case the module-scope
  // call above ran in a context where the shim wasn't fully applied yet.
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