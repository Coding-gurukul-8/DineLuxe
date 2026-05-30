/**
 * lib/stations.ts
 *
 * STATION FEATURE — shared station classification logic.
 *
 * Both app/staff/chef/kitchen/page.tsx and app/staff/chef/page.tsx import
 * from here so the keyword lists and StationId type stay in one place.
 *
 * Future enhancement: station tags could be stored at DB level on menu_items
 * (e.g. a `kitchen_station` column), making this purely a display helper.
 */

// ─── Station ID type ──────────────────────────────────────────────────────────

export type StationId = "all" | "grill" | "fryer" | "cold" | "prep" | "desserts"

// ─── Keyword maps ─────────────────────────────────────────────────────────────
// Simple lowercase keyword arrays. getStationForItem() checks them in priority
// order; first match wins. "prep" is the catch-all default.

export const GRILL_KEYWORDS: string[] = [
  "grill", "grills", "tandoor", "bbq", "kebab", "tikka",
  "seekh", "sizzler", "tandoori", "charcoal",
]

export const FRYER_KEYWORDS: string[] = [
  "fried", "fries", "crispy", "tempura", "pakora",
  "bhajji", "finger", "nugget", "wings", "popcorn",
]

export const COLD_KEYWORDS: string[] = [
  "salad", "ice cream", "cold", "shake", "smoothie",
  "lassi", "raita", "mousse", "parfait", "gelato",
]

export const PREP_KEYWORDS: string[] = [
  "pasta", "curry", "biryani", "rice", "bread", "naan",
  "roti", "dal", "sabzi", "pulao", "gravy", "soup", "stew",
]

export const DESSERT_KEYWORDS: string[] = [
  "dessert", "cake", "brownie", "halwa", "kheer", "gulab",
  "rasgulla", "ladoo", "barfi", "mithai", "pudding",
  "custard", "tart", "pie",
]

// ─── Station config ───────────────────────────────────────────────────────────

export interface Station {
  id: StationId
  label: string
  emoji: string
  /** Tailwind bg class for the active tab button */
  color: string
  /** Tailwind text class for badges / station chip text */
  textColor: string
  /** Tailwind border class used for highlighting */
  borderColor: string
  /** Tailwind bg class used for item-level highlight in filtered view */
  highlightBg: string
  keywords: string[]
}

export const STATIONS: Station[] = [
  {
    id: "all",
    label: "All",
    emoji: "🍽️",
    color: "bg-[#1a2744]",
    textColor: "text-white",
    borderColor: "border-[#1a2744]",
    highlightBg: "bg-gray-700/60",
    keywords: [],
  },
  {
    id: "grill",
    label: "Grill",
    emoji: "🔥",
    color: "bg-orange-600",
    textColor: "text-orange-300",
    borderColor: "border-orange-500",
    highlightBg: "bg-orange-900/40",
    keywords: GRILL_KEYWORDS,
  },
  {
    id: "fryer",
    label: "Fryer",
    emoji: "🍟",
    color: "bg-yellow-600",
    textColor: "text-yellow-300",
    borderColor: "border-yellow-500",
    highlightBg: "bg-yellow-900/40",
    keywords: FRYER_KEYWORDS,
  },
  {
    id: "cold",
    label: "Cold Station",
    emoji: "❄️",
    color: "bg-cyan-700",
    textColor: "text-cyan-300",
    borderColor: "border-cyan-500",
    highlightBg: "bg-cyan-900/40",
    keywords: COLD_KEYWORDS,
  },
  {
    id: "prep",
    label: "Prep",
    emoji: "🥗",
    color: "bg-green-700",
    textColor: "text-green-300",
    borderColor: "border-green-500",
    highlightBg: "bg-green-900/40",
    keywords: PREP_KEYWORDS,
  },
  {
    id: "desserts",
    label: "Desserts",
    emoji: "🍰",
    color: "bg-pink-700",
    textColor: "text-pink-300",
    borderColor: "border-pink-500",
    highlightBg: "bg-pink-900/40",
    keywords: DESSERT_KEYWORDS,
  },
]

// ─── Core helper ──────────────────────────────────────────────────────────────

/**
 * Classify a menu item to a kitchen station using keyword matching.
 *
 * @param itemName     - The item's display name (e.g. "Chicken Tikka")
 * @param categoryName - Optional category name (e.g. "Starters")
 * @returns            StationId — the station responsible for this item
 *
 * Priority order (first match wins):
 *   desserts → grill → fryer → cold → prep → prep (default)
 *
 * @example
 *   getStationForItem("Chicken Tikka Masala", "Main Course") // → "grill"
 *   getStationForItem("Veg Biryani", "Rice Dishes")         // → "prep"
 *   getStationForItem("Gulab Jamun", "Desserts")            // → "desserts"
 */
export function getStationForItem(
  itemName: string,
  categoryName?: string
): StationId {
  const haystack = `${itemName} ${categoryName ?? ""}`.toLowerCase()

  // Desserts checked first — they can appear in COLD_KEYWORDS too (ice cream)
  if (DESSERT_KEYWORDS.some((kw) => haystack.includes(kw))) return "desserts"
  if (GRILL_KEYWORDS.some((kw) => haystack.includes(kw)))   return "grill"
  if (FRYER_KEYWORDS.some((kw) => haystack.includes(kw)))   return "fryer"
  if (COLD_KEYWORDS.some((kw) => haystack.includes(kw)))    return "cold"
  if (PREP_KEYWORDS.some((kw) => haystack.includes(kw)))    return "prep"

  // Default — most Indian main dishes fall into prep/curry category
  return "prep"
}

// ─── Convenience lookup ───────────────────────────────────────────────────────

/** Returns the Station config object for a given StationId. */
export function getStationConfig(id: StationId): Station {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[0]
}