"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { ensureSafeBrowserStorage } from "@/lib/safe-browser-storage";
import { useBrandingUpdated } from "@/hooks/useBrandingUpdated";

interface Branding {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  appNameDisplay: string;
  tagline: string | null;
  fontPreference: string;
  welcomeAnimation: string;
  receiptFooter: string | null;
}

const DEFAULT_BRANDING: Branding = {
  primaryColor: "#1A3C5E", secondaryColor: "#E8A020",
  logoUrl: null, bannerUrl: null,
  appNameDisplay: "DineLuxe", tagline: null,
  fontPreference: "Geist", welcomeAnimation: "food_standard", receiptFooter: null,
};

const CACHE_KEY = "restaurant_branding";
const CACHE_TTL = 60 * 60 * 1000;

interface BrandingContextValue {
  branding: Branding;
  loading: boolean;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING, loading: false, refresh: async () => {},
});

function applyToCSS(b: Branding) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--brand-primary",   b.primaryColor);
  document.documentElement.style.setProperty("--brand-secondary", b.secondaryColor);
}

function safeLocalStorage() {
  try {
    if (typeof window === "undefined") return null;
    ensureSafeBrowserStorage();
    const storage = window.localStorage as any;
    return storage && typeof storage.getItem === "function" ? storage : null;
  } catch {
    return null;
  }
}

/** Resolve restaurantId from URL query param (?rid=) or from auth storage */
function resolveRestaurantId(): string | null {
  if (typeof window === "undefined") return null;

  // 1. URL query param — used by QR-code customer flows
  const rid = new URLSearchParams(window.location.search).get("rid");
  if (rid) return rid;

  // 2. Auth storage — used by owner/staff who are logged in
  try {
    const ls = safeLocalStorage()
    const stored = ls?.getItem("userData")
    if (stored) {
      const user = JSON.parse(stored);
      if (user?.restaurantId) return user.restaurantId;
    }
  } catch {
    // ignore
  }

  return null;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [loading,  setLoading]  = useState(false);
  const restaurantId = resolveRestaurantId();

  const fetchFresh = useCallback(async (restaurantId: string) => {
    try {
      setLoading(true);
      const data = await apiClient.get<Branding>(`/restaurant/${restaurantId}/branding`);
      setBranding(data);
      applyToCSS(data);
      const ls = safeLocalStorage();
      ls?.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {
      /* silently fall back to defaults — never crash the tree */
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(async (restaurantId: string) => {
    try {
      const ls = safeLocalStorage();
      const cached = ls?.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          setBranding(data);
          applyToCSS(data);
          fetchFresh(restaurantId); // background refresh
          return;
        }
      }
    } catch {
      // skip cache
    }
    await fetchFresh(restaurantId);
  }, [fetchFresh]);

  useEffect(() => {
    const rid = resolveRestaurantId();
    if (rid) load(rid);
  }, [load]);

  const refresh = async () => {
    const rid = resolveRestaurantId();
    if (rid) {
      const ls = safeLocalStorage();
      ls?.removeItem(CACHE_KEY);
      await fetchFresh(rid);
    }
  };

  useBrandingUpdated({
    restaurantId: restaurantId ?? undefined,
    onBrandingUpdated: () => {
      void refresh();
    },
  });

  return (
    <BrandingContext.Provider value={{ branding, loading, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export const useBrandingContext = () => useContext(BrandingContext);
