"use client";

import { useMemo } from "react";
import { Smartphone, MonitorSmartphone } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandingPreviewPanelProps {
  /** Hex string, e.g. "#1A3C5E" */
  primaryColor: string;
  /** Hex string, e.g. "#E8A020" */
  secondaryColor: string;
  /** Font name from FONT_URLS — used for style attribute */
  font: string;
  /** Display name shown in the app header */
  appName: string;
  /** Short tagline shown under the app name */
  tagline?: string;
  /** URL of the restaurant logo */
  logoUrl?: string | null;
  /** Which mock screen to render */
  screen?: PreviewScreen;
  /** Called when the user clicks a screen tab inside the panel */
  onScreenChange?: (screen: PreviewScreen) => void;
}

export type PreviewScreen = "Splash" | "Home" | "Menu";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Approximate relative luminance; returns true when text should be dark */
function needsDarkText(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Perceived luminance (ITU-R BT.709)
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.55;
}

// ─── Sub-screens ──────────────────────────────────────────────────────────────

function LogoMark({
  logoUrl,
  appName,
  size = "md",
  textColor,
}: {
  logoUrl?: string | null;
  appName: string;
  size?: "sm" | "md" | "lg";
  textColor: string;
}) {
  const dims = { sm: "h-8 w-8", md: "h-11 w-11", lg: "h-14 w-14" }[size];
  const textSz = { sm: "text-[10px]", md: "text-xs", lg: "text-base" }[size];

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={appName}
        className={cn(dims, "rounded-lg object-cover")}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <span
      className={cn(
        dims,
        textSz,
        "flex items-center justify-center rounded-lg font-bold"
      )}
      style={{ background: "rgba(255,255,255,0.2)", color: textColor }}
    >
      {appName.slice(0, 2).toUpperCase()}
    </span>
  );
}

function SplashScreen({
  primaryColor,
  secondaryColor,
  appName,
  tagline,
  logoUrl,
  font,
}: Omit<BrandingPreviewPanelProps, "screen" | "onScreenChange">) {
  const darkText = needsDarkText(primaryColor);
  const textColor = darkText ? "#111111" : "#ffffff";
  const subColor = darkText ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)";

  return (
    <div
      className="flex h-full flex-col items-center justify-center px-6 text-center"
      style={{ background: primaryColor, fontFamily: `'${font}', sans-serif` }}
    >
      {/* Logo */}
      <LogoMark logoUrl={logoUrl} appName={appName} size="lg" textColor={textColor} />

      {/* App name */}
      <p
        className="mt-4 text-xl font-bold leading-tight"
        style={{ color: textColor }}
      >
        {appName}
      </p>

      {/* Tagline */}
      {tagline && (
        <p className="mt-1 text-[11px]" style={{ color: subColor }}>
          {tagline}
        </p>
      )}

      {/* Pagination dots */}
      <div className="mt-8 flex items-center gap-1.5">
        <span
          className="h-2 w-6 rounded-full"
          style={{ background: secondaryColor }}
        />
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: "rgba(255,255,255,0.35)" }}
        />
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: "rgba(255,255,255,0.35)" }}
        />
      </div>
    </div>
  );
}

function HomeScreen({
  primaryColor,
  secondaryColor,
  appName,
  tagline,
  logoUrl,
  font,
}: Omit<BrandingPreviewPanelProps, "screen" | "onScreenChange">) {
  const darkText = needsDarkText(primaryColor);
  const textColor = darkText ? "#111111" : "#ffffff";
  const subColor = darkText ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.75)";

  return (
    <div
      className="flex h-full flex-col bg-gray-50"
      style={{ fontFamily: `'${font}', sans-serif` }}
    >
      {/* App header */}
      <div
        className="px-4 pb-4 pt-7"
        style={{ background: primaryColor }}
      >
        <div className="flex items-center gap-2.5">
          <LogoMark logoUrl={logoUrl} appName={appName} size="md" textColor={textColor} />
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: textColor }}>
              {appName}
            </p>
            {tagline && (
              <p className="text-[10px] leading-tight" style={{ color: subColor }}>
                {tagline}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 p-3">
        {/* Hero card */}
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
            Today's special
          </p>
          <p className="mt-1 text-sm font-bold text-gray-900">
            Chef's tasting menu
          </p>
          <p className="mt-0.5 text-[10px] text-gray-500">
            6 courses · 2 hrs · ₹2,499
          </p>
          <div
            className="mt-2.5 flex h-8 items-center justify-center rounded-lg text-[11px] font-bold"
            style={{ background: secondaryColor, color: needsDarkText(secondaryColor) ? "#111" : "#fff" }}
          >
            Reserve Table
          </div>
        </div>

        {/* Quick links */}
        {["Live menu", "Order tracking", "Queue status"].map((item) => (
          <div
            key={item}
            className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm"
          >
            <span className="text-[11px] font-semibold text-gray-800">{item}</span>
            <span className="text-[10px] text-gray-400">›</span>
          </div>
        ))}
      </div>

      {/* Bottom nav stub */}
      <div className="flex h-10 items-stretch border-t border-gray-200 bg-white">
        {["⊞", "📅", "⊕", "🛒", "👤"].map((icon, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-1 items-center justify-center text-[13px]",
              i === 0 ? "opacity-100" : "opacity-30"
            )}
            style={i === 0 ? { color: secondaryColor } : {}}
          >
            {icon}
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuScreen({
  primaryColor,
  secondaryColor,
  appName,
  font,
}: Omit<BrandingPreviewPanelProps, "screen" | "onScreenChange">) {
  const darkText = needsDarkText(primaryColor);
  const textColor = darkText ? "#111111" : "#ffffff";

  const items = [
    { name: "Butter Chicken", price: "₹380", tag: "Popular" },
    { name: "Paneer Tikka", price: "₹280" },
    { name: "Dal Makhani", price: "₹220" },
  ];

  return (
    <div
      className="flex h-full flex-col bg-gray-50"
      style={{ fontFamily: `'${font}', sans-serif` }}
    >
      {/* Compact header */}
      <div className="px-4 pb-3 pt-6" style={{ background: primaryColor }}>
        <p className="text-sm font-bold" style={{ color: textColor }}>
          {appName} Menu
        </p>
        {/* Category pills */}
        <div className="mt-2 flex gap-1.5 overflow-hidden">
          {["All", "Starters", "Mains", "Drinks"].map((cat, i) => (
            <span
              key={cat}
              className="shrink-0 rounded-full px-2.5 py-0.5 text-[9px] font-bold"
              style={
                i === 0
                  ? { background: secondaryColor, color: needsDarkText(secondaryColor) ? "#111" : "#fff" }
                  : { background: "rgba(255,255,255,0.2)", color: textColor }
              }
            >
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 space-y-2 p-3">
        {items.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between rounded-xl bg-white px-3 py-2.5 shadow-sm"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-bold text-gray-900">{item.name}</p>
                {item.tag && (
                  <span
                    className="rounded px-1 py-0.5 text-[8px] font-bold"
                    style={{ background: secondaryColor + "22", color: secondaryColor }}
                  >
                    {item.tag}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-500">{item.price}</p>
            </div>
            <div
              className="flex h-6 w-6 items-center justify-center rounded-lg text-sm font-bold"
              style={{ background: primaryColor, color: textColor }}
            >
              +
            </div>
          </div>
        ))}
      </div>

      {/* Cart bar */}
      <div
        className="mx-3 mb-3 flex h-9 items-center justify-center rounded-xl text-[11px] font-bold"
        style={{ background: primaryColor, color: textColor }}
      >
        View Cart (2 items · ₹660)
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const SCREEN_TABS: { label: string; value: PreviewScreen }[] = [
  { label: "Splash", value: "Splash" },
  { label: "Home", value: "Home" },
  { label: "Menu", value: "Menu" },
];

export function BrandingPreviewPanel({
  primaryColor,
  secondaryColor,
  font,
  appName,
  tagline,
  logoUrl,
  screen = "Splash",
  onScreenChange,
}: BrandingPreviewPanelProps) {
  const screenProps = {
    primaryColor,
    secondaryColor,
    font,
    appName,
    tagline,
    logoUrl,
  };

  return (
    <aside className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MonitorSmartphone size={20} className="text-[#1A3C5E]" />
          <div>
            <h2 className="text-base font-semibold text-gray-950">Live Preview</h2>
            <p className="text-xs text-gray-500">Updates as you type</p>
          </div>
        </div>
        <Smartphone size={18} className="text-gray-400" />
      </div>

      {/* Screen tab switcher */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {SCREEN_TABS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => onScreenChange?.(value)}
            className={cn(
              "min-h-10 rounded-lg text-sm font-semibold transition",
              screen === value
                ? "bg-[#1A3C5E] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Phone frame */}
      <div className="mt-6 flex justify-center">
        {/* Outer bezel */}
        <div
          className="relative w-[220px] rounded-[36px] bg-gray-950 p-[10px] shadow-2xl"
          style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.08)" }}
        >
          {/* Notch */}
          <div className="absolute left-1/2 top-[10px] z-10 h-5 w-16 -translate-x-1/2 rounded-b-xl bg-gray-950" />

          {/* Screen */}
          <div className="h-[420px] overflow-hidden rounded-[28px] bg-white">
            {screen === "Splash" && <SplashScreen {...screenProps} />}
            {screen === "Home" && <HomeScreen {...screenProps} />}
            {screen === "Menu" && <MenuScreen {...screenProps} />}
          </div>

          {/* Home indicator */}
          <div className="mt-2 flex justify-center">
            <div className="h-1 w-16 rounded-full bg-gray-700" />
          </div>
        </div>
      </div>

      {/* Color swatches legend */}
      <div className="mt-5 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full ring-1 ring-gray-200"
            style={{ background: primaryColor }}
          />
          <span className="text-xs text-gray-500">Primary</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full ring-1 ring-gray-200"
            style={{ background: secondaryColor }}
          />
          <span className="text-xs text-gray-500">Secondary</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className="rounded px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: primaryColor + "15", color: primaryColor }}
          >
            {font}
          </span>
        </div>
      </div>
    </aside>
  );
}