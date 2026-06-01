"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { apiClient } from "@/lib/api-client";
import { ensureSafeBrowserStorage } from "@/lib/safe-browser-storage";
import { useBrandingUpdated } from "@/hooks/useBrandingUpdated";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface BrandingContextValue {
  branding: Branding;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Current welcome animation key — consumed by SplashScreen */
  welcomeAnimation: string;
}

interface BrandingPreviewContextValue {
  previewOverride: Partial<Branding> | null;
  setPreviewOverride: (override: Partial<Branding> | null) => void;
  clearPreview: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_BRANDING: Branding = {
  primaryColor: "#1A3C5E",
  secondaryColor: "#E8A020",
  logoUrl: null,
  bannerUrl: null,
  appNameDisplay: "DineLuxe",
  tagline: null,
  fontPreference: "Geist",
  welcomeAnimation: "food_standard",
  receiptFooter: null,
};

const CACHE_KEY = "restaurant_branding";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─── Font loading ─────────────────────────────────────────────────────────────

const FONT_URLS: Record<string, string> = {
  Inter:
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  Geist:
    "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap",
  Poppins:
    "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap",
  Nunito:
    "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap",
  "Playfair Display":
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap",
  "DM Sans":
    "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap",
};

function loadFont(fontName: string): void {
  if (typeof document === "undefined") return;

  // Guard: already injected
  const existing = document.querySelector(`link[data-font="${fontName}"]`);
  if (existing) {
    // Still apply the CSS variable in case it got overridden
    document.documentElement.style.setProperty(
      "--font-primary",
      `'${fontName}', sans-serif`
    );
    document.documentElement.style.fontFamily = `'${fontName}', sans-serif`;
    return;
  }

  const href = FONT_URLS[fontName] ?? FONT_URLS["Inter"];

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.font = fontName;
  // Avoid FOUC: mark as preload-level so browsers can prioritise
  link.setAttribute("crossorigin", "anonymous");
  document.head.appendChild(link);

  document.documentElement.style.setProperty(
    "--font-primary",
    `'${fontName}', sans-serif`
  );
  document.documentElement.style.fontFamily = `'${fontName}', sans-serif`;
}

// ─── CSS application ───────────────────────────────────────────────────────────

function applyToCSS(b: Branding): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--brand-primary", b.primaryColor);
  document.documentElement.style.setProperty(
    "--brand-secondary",
    b.secondaryColor
  );
  loadFont(b.fontPreference);
}

function applyPreviewToCSS(override: Partial<Branding>): void {
  if (typeof document === "undefined") return;
  if (override.primaryColor)
    document.documentElement.style.setProperty(
      "--brand-primary",
      override.primaryColor
    );
  if (override.secondaryColor)
    document.documentElement.style.setProperty(
      "--brand-secondary",
      override.secondaryColor
    );
  if (override.fontPreference) loadFont(override.fontPreference);
}

// ─── LocalStorage helper ───────────────────────────────────────────────────────

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

// ─── Restaurant ID resolver ────────────────────────────────────────────────────

function resolveRestaurantId(): string | null {
  if (typeof window === "undefined") return null;

  // 1. URL query param (?rid=) — used by QR-code customer flows
  const rid = new URLSearchParams(window.location.search).get("rid");
  if (rid) return rid;

  // 2. Auth storage — used by owner / staff
  try {
    const ls = safeLocalStorage();
    const stored = ls?.getItem("userData");
    if (stored) {
      const user = JSON.parse(stored);
      if (user?.restaurantId) return user.restaurantId;
    }
  } catch {
    // ignore
  }

  return null;
}

// ─── Contexts ─────────────────────────────────────────────────────────────────

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_BRANDING,
  loading: false,
  refresh: async () => {},
  welcomeAnimation: DEFAULT_BRANDING.welcomeAnimation,
});

const BrandingPreviewContext = createContext<BrandingPreviewContextValue>({
  previewOverride: null,
  setPreviewOverride: () => {},
  clearPreview: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BrandingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(false);
  const [previewOverride, setPreviewOverrideState] =
    useState<Partial<Branding> | null>(null);

  // Keep a stable ref to the saved branding so clearPreview can restore it
  const savedBrandingRef = useRef<Branding>(DEFAULT_BRANDING);

  const restaurantId = resolveRestaurantId();

  // ── Fetching ───────────────────────────────────────────────────────────────

  const fetchFresh = useCallback(async (rid: string) => {
    try {
      setLoading(true);
      const data = await apiClient.get<Branding>(`/restaurant/${rid}/branding`);
      setBranding(data);
      savedBrandingRef.current = data;
      applyToCSS(data);
      const ls = safeLocalStorage();
      ls?.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {
      /* silently fall back to defaults — never crash the tree */
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(
    async (rid: string) => {
      try {
        const ls = safeLocalStorage();
        const cached = ls?.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setBranding(data);
            savedBrandingRef.current = data;
            applyToCSS(data);
            // Refresh in background so stale cache doesn't linger
            void fetchFresh(rid);
            return;
          }
        }
      } catch {
        // skip cache
      }
      await fetchFresh(rid);
    },
    [fetchFresh]
  );

  useEffect(() => {
    const rid = resolveRestaurantId();
    if (rid) void load(rid);
  }, [load]);

  const refresh = useCallback(async () => {
    const rid = resolveRestaurantId();
    if (rid) {
      const ls = safeLocalStorage();
      ls?.removeItem(CACHE_KEY);
      await fetchFresh(rid);
    }
  }, [fetchFresh]);

  useBrandingUpdated({
    restaurantId: restaurantId ?? undefined,
    onBrandingUpdated: () => {
      void refresh();
    },
  });

  // ── Preview override handling ──────────────────────────────────────────────

  const setPreviewOverride = useCallback(
    (override: Partial<Branding> | null) => {
      setPreviewOverrideState(override);
      if (override) {
        applyPreviewToCSS(override);
      } else {
        // Restore saved branding when clearing preview
        applyToCSS(savedBrandingRef.current);
      }
    },
    []
  );

  const clearPreview = useCallback(() => {
    setPreviewOverrideState(null);
    applyToCSS(savedBrandingRef.current);
  }, []);

  // Effective branding: merge saved + preview override for consumers
  const effectiveBranding: Branding = previewOverride
    ? { ...branding, ...previewOverride }
    : branding;

  return (
    <BrandingContext.Provider
      value={{
        branding: effectiveBranding,
        loading,
        refresh,
        welcomeAnimation: effectiveBranding.welcomeAnimation,
      }}
    >
      <BrandingPreviewContext.Provider
        value={{ previewOverride, setPreviewOverride, clearPreview }}
      >
        {children}
      </BrandingPreviewContext.Provider>
    </BrandingContext.Provider>
  );
}

// ─── Public hooks ─────────────────────────────────────────────────────────────

/** Primary hook — use everywhere except the branding preview page */
export const useBrandingContext = () => useContext(BrandingContext);

/**
 * useBrandingPreview — ONLY for use in app/owner/branding/page.tsx.
 *
 * Lets the branding form apply temporary CSS changes instantly
 * (no DB save required) and revert them when the user navigates away.
 *
 * Usage:
 *   const { setPreviewOverride, clearPreview } = useBrandingPreview()
 *   // When a color picker changes:
 *   setPreviewOverride({ primaryColor: '#FF0000' })
 *   // On unmount or discard:
 *   clearPreview()
 */
export const useBrandingPreview = () => useContext(BrandingPreviewContext);