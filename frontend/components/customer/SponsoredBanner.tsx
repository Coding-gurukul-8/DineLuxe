"use client";

/**
 * components/customer/SponsoredBanner.tsx
 *
 * Auto-rotating sponsored banner carousel.
 * Tracks impressions (IntersectionObserver, fires once per card enter) and
 * clicks (fire-and-forget) against the public /sponsorships endpoints.
 *
 * Design spec (Section 9.2 / 19.1):
 *  ┌─────────────────────────────────────────────────┐  height: 180px
 *  │ [logo]  Restaurant Name          [Sponsored]    │
 *  │         Headline text                           │
 *  │                            [ CTA button ]       │
 *  └─────────────────────────────────────────────────┘
 *        ● ○ ○   ← dot indicators (only when > 1 banner)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { SponsoredPlacement } from "@/types/api";

// ── Config ────────────────────────────────────────────────────────────────────

const ROTATE_MS = 4_000;

// Strip trailing slashes; fall back to relative /api/v1 for same-host deploys
const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ?? "") || "/api/v1";

// ── Fire-and-forget helper ────────────────────────────────────────────────────

function firePost(path: string): void {
  fetch(`${API_BASE}${path}`, { method: "POST" }).catch(() => {
    // Swallow — tracking failures must never affect the user experience
  });
}

// ── BannerCard ────────────────────────────────────────────────────────────────

interface BannerCardProps {
  banner: SponsoredPlacement;
  onVisible: (id: string) => void;
  onTap:     (id: string, restaurantId: string) => void;
}

function BannerCard({ banner, onVisible, onTap }: BannerCardProps) {
  const cardRef          = useRef<HTMLDivElement>(null);
  const impressionFired  = useRef(false);

  // Fire impression exactly once per lifecycle when ≥50% of the card is visible
  useEffect(() => {
    const el = cardRef.current;
    if (!el || impressionFired.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionFired.current) {
          impressionFired.current = true;
          onVisible(banner.id);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [banner.id, onVisible]);

  const primaryColor = banner.primary_color ?? "#E8A020";

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-label={`Sponsored by ${banner.restaurant_name ?? "Restaurant"}`}
      className="relative w-full overflow-hidden rounded-2xl cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={{ height: 180 }}
      onClick={() => onTap(banner.id, banner.restaurant_id)}
      onKeyDown={(e) => e.key === "Enter" && onTap(banner.id, banner.restaurant_id)}
    >
      {/* ── Background image or gradient fallback ── */}
      {banner.banner_url ? (
        <img
          src={banner.banner_url}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}cc 0%, #1A3C5E 100%)`,
          }}
        />
      )}

      {/* ── Dark overlay for text legibility ── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

      {/* ── "Sponsored" pill — top right ── */}
      <div className="absolute top-3 right-3 z-10">
        <span className="text-[10px] font-semibold text-white/90 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full tracking-wide">
          Sponsored
        </span>
      </div>

      {/* ── Restaurant logo — top left ── */}
      {banner.logo_url && (
        <div className="absolute top-3 left-3 z-10">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-white/20 backdrop-blur-sm border border-white/30">
            <img
              src={banner.logo_url}
              alt={banner.restaurant_name ?? ""}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
        </div>
      )}

      {/* ── Text + CTA row — bottom ── */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-end justify-between gap-2 p-3">
        {/* Restaurant name + headline */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base leading-tight truncate drop-shadow-sm">
            {banner.restaurant_name ?? ""}
          </p>
          {banner.headline && (
            <p className="text-white/80 text-xs mt-0.5 leading-snug line-clamp-2 drop-shadow-sm">
              {banner.headline}
            </p>
          )}
        </div>

        {/* CTA button — uses restaurant primary colour */}
        <button
          className="shrink-0 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg
                     transition-transform active:scale-95 whitespace-nowrap"
          style={{ backgroundColor: primaryColor }}
          // Tab index -1: the parent div already handles keyboard; this avoids
          // double-focus for keyboard users.
          tabIndex={-1}
          aria-hidden
          onClick={(e) => {
            e.stopPropagation();
            onTap(banner.id, banner.restaurant_id);
          }}
        >
          {banner.cta_text || "View Menu"}
        </button>
      </div>
    </div>
  );
}

// ── SponsoredBannerCarousel ────────────────────────────────────────────────────

export interface SponsoredBannerCarouselProps {
  banners: SponsoredPlacement[];
}

export function SponsoredBannerCarousel({ banners }: SponsoredBannerCarouselProps) {
  const router      = useRouter();
  const [idx, setIdx] = useState(0);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auto-rotation ──────────────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (banners.length <= 1) return;
    timerRef.current = setInterval(
      () => setIdx((prev) => (prev + 1) % banners.length),
      ROTATE_MS,
    );
  }, [banners.length]);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  // ── Impression handler ─────────────────────────────────────────────────────
  const handleVisible = useCallback((id: string) => {
    firePost(`/sponsorships/${id}/impression`);
  }, []);

  // ── Click handler ──────────────────────────────────────────────────────────
  const handleTap = useCallback((id: string, restaurantId: string) => {
    firePost(`/sponsorships/${id}/click`);
    router.push(`/customer/restaurant/${restaurantId}`);
  }, [router]);

  // ── Dot click ─────────────────────────────────────────────────────────────
  const handleDotClick = (i: number) => {
    setIdx(i);
    resetTimer();
  };

  if (!banners.length) return null;

  return (
    <div className="space-y-2.5">
      {/* ── Carousel ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={banners[idx].id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <BannerCard
              banner={banners[idx]}
              onVisible={handleVisible}
              onTap={handleTap}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Dot indicators (hidden when only one banner) ───────────────────── */}
      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Banner navigation">
          {banners.map((b, i) => (
            <button
              key={b.id}
              role="tab"
              aria-selected={i === idx}
              aria-label={`Banner ${i + 1} of ${banners.length}`}
              onClick={() => handleDotClick(i)}
              className="transition-all duration-300 focus-visible:outline-none"
            >
              <span
                className={[
                  "block rounded-full transition-all duration-300",
                  i === idx
                    ? "w-5 h-1.5 bg-[#E8A020]"   // active — pill shape
                    : "w-1.5 h-1.5 bg-gray-300",  // inactive — small dot
                ].join(" ")}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}