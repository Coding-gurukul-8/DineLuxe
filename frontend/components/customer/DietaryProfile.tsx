"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, AlertTriangle, Loader2, Pencil, Salad } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"

// ─── Data definitions ─────────────────────────────────────────────────────────

interface PreferenceOption {
  key: string
  label: string
  emoji: string
}

interface AllergenOption {
  key: string
  label: string
  emoji: string
  /** Short label used on compact badges, e.g. "Nut-free" */
  freeLabel: string
}

const PREFERENCES: PreferenceOption[] = [
  { key: "vegan",        label: "Vegan",        emoji: "🌱" },
  { key: "vegetarian",   label: "Vegetarian",   emoji: "🥗" },
  { key: "halal",        label: "Halal",        emoji: "🕌" },
  { key: "jain",         label: "Jain",         emoji: "🙏" },
  { key: "gluten_free",  label: "Gluten-Free",  emoji: "🌾" },
  { key: "keto",         label: "Keto",         emoji: "🥑" },
  { key: "high_protein", label: "High-Protein", emoji: "💪" },
]

const ALLERGENS: AllergenOption[] = [
  { key: "nuts",      label: "Nuts",      emoji: "🥜", freeLabel: "Nut-free"      },
  { key: "dairy",     label: "Dairy",     emoji: "🥛", freeLabel: "Dairy-free"    },
  { key: "gluten",    label: "Gluten",    emoji: "🌾", freeLabel: "Gluten-free"   },
  { key: "eggs",      label: "Eggs",      emoji: "🥚", freeLabel: "Egg-free"      },
  { key: "soy",       label: "Soy",       emoji: "🫘", freeLabel: "Soy-free"      },
  { key: "shellfish", label: "Shellfish", emoji: "🦐", freeLabel: "Shellfish-free" },
  { key: "fish",      label: "Fish",      emoji: "🐟", freeLabel: "Fish-free"     },
]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DietaryProfileProps {
  initialPreferences?: string[]
  initialAllergies?: string[]
  onSave?: (preferences: string[], allergies: string[]) => Promise<void>
  /** Compact read-only badge strip with an Edit button */
  compact?: boolean
}

// ─── Pill button ──────────────────────────────────────────────────────────────

function PreferencePill({
  emoji,
  label,
  selected,
  onClick,
  disabled,
}: {
  emoji: string
  label: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium",
        "border transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A3C5E]/30",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        selected
          ? "bg-[#1A3C5E] border-[#1A3C5E] text-white shadow-sm"
          : "bg-white border-[#1A3C5E]/25 text-[#1A3C5E] hover:border-[#1A3C5E]/50 hover:bg-[#1A3C5E]/4"
      )}
    >
      <span className="text-base leading-none">{emoji}</span>
      <span>{label}</span>
      <AnimatePresence>
        {selected && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Check size={12} strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

function AllergenPill({
  emoji,
  label,
  selected,
  onClick,
  disabled,
}: {
  emoji: string
  label: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium",
        "border transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        selected
          ? "bg-red-100 border-red-300 text-red-700 shadow-sm"
          : "bg-white border-red-200/70 text-red-500/80 hover:border-red-300 hover:bg-red-50/60"
      )}
    >
      <span className="text-base leading-none">{emoji}</span>
      <span>{label}</span>
      <AnimatePresence>
        {selected && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <AlertTriangle size={11} strokeWidth={2.5} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

// ─── Compact view ─────────────────────────────────────────────────────────────

function CompactView({
  preferences,
  allergies,
  onEditClick,
}: {
  preferences: string[]
  allergies: string[]
  onEditClick?: () => void
}) {
  const prefLabels = PREFERENCES.filter((p) => preferences.includes(p.key))
  const allergenLabels = ALLERGENS.filter((a) => allergies.includes(a.key))
  const hasAny = prefLabels.length > 0 || allergenLabels.length > 0

  return (
    <div className="flex items-start gap-3 flex-wrap">
      <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
        {prefLabels.map((p) => (
          <span
            key={p.key}
            className="inline-flex items-center gap-1 bg-[#1A3C5E]/8 text-[#1A3C5E] text-xs font-medium px-2.5 py-1 rounded-full"
          >
            {p.emoji} {p.label}
          </span>
        ))}
        {allergenLabels.map((a) => (
          <span
            key={a.key}
            className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-xs font-medium px-2.5 py-1 rounded-full border border-red-100"
          >
            {a.emoji} {a.freeLabel}
          </span>
        ))}
        {!hasAny && (
          <span className="text-xs text-gray-400 py-1">No dietary preferences set</span>
        )}
      </div>
      {onEditClick && (
        <button
          type="button"
          onClick={onEditClick}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[#1A3C5E] hover:text-[#1A3C5E]/70 transition-colors"
        >
          <Pencil size={11} />
          Edit
        </button>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DietaryProfile({
  initialPreferences = [],
  initialAllergies = [],
  onSave,
  compact = false,
}: DietaryProfileProps) {
  const [preferences, setPreferences] = useState<string[]>(initialPreferences)
  const [allergies, setAllergies]     = useState<string[]>(initialAllergies)
  const [saving, setSaving]           = useState(false)
  const [savedFlash, setSavedFlash]   = useState(false)
  const [expandedFromCompact, setExpandedFromCompact] = useState(false)

  // Toggle helpers
  const togglePref = useCallback((key: string) => {
    setPreferences((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }, [])

  const toggleAllergen = useCallback((key: string) => {
    setAllergies((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }, [])

  // Save handler
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      if (onSave) {
        await onSave(preferences, allergies)
      } else {
        await apiClient.patch("/customer-preferences/dietary", {
          preferences,
          allergies,
        })
      }
      setSavedFlash(true)
      toast.success("Dietary preferences saved!")
      setTimeout(() => setSavedFlash(false), 2000)
      if (expandedFromCompact) setExpandedFromCompact(false)
    } catch {
      toast.error("Could not save preferences. Please try again.")
    } finally {
      setSaving(false)
    }
  }, [preferences, allergies, onSave, expandedFromCompact])

  // ── Compact mode ──────────────────────────────────────────────────────────

  if (compact && !expandedFromCompact) {
    return (
      <CompactView
        preferences={preferences}
        allergies={allergies}
        onEditClick={() => setExpandedFromCompact(true)}
      />
    )
  }

  // ── Full editor ───────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Back to compact strip (only when expanded from compact mode) */}
      {compact && expandedFromCompact && (
        <button
          type="button"
          onClick={() => setExpandedFromCompact(false)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
        >
          ← Collapse
        </button>
      )}

      {/* Section 1 — Dietary Preferences */}
      <Section
        title="My Dietary Preferences"
        subtitle="We'll filter restaurant menus to show compatible items"
      >
        <div className="flex flex-wrap gap-2">
          {PREFERENCES.map((pref) => (
            <PreferencePill
              key={pref.key}
              emoji={pref.emoji}
              label={pref.label}
              selected={preferences.includes(pref.key)}
              onClick={() => togglePref(pref.key)}
              disabled={saving}
            />
          ))}
        </div>
      </Section>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Section 2 — Food Allergies */}
      <Section
        title="Allergen Warnings"
        subtitle="We'll warn you before ordering items containing these"
      >
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((allergen) => (
            <AllergenPill
              key={allergen.key}
              emoji={allergen.emoji}
              label={allergen.label}
              selected={allergies.includes(allergen.key)}
              onClick={() => toggleAllergen(allergen.key)}
              disabled={saving}
            />
          ))}
        </div>

        {/* Warning note */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 mt-1">
          <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Always verify allergen information with restaurant staff.</strong>{" "}
            Our warnings are based on menu data provided by restaurants.
          </p>
        </div>
      </Section>

      {/* Save button */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        disabled={saving || savedFlash}
        className={cn(
          "w-full h-12 rounded-2xl font-bold text-white text-sm shadow-md transition-all",
          "flex items-center justify-center gap-2",
          "disabled:opacity-70 disabled:cursor-not-allowed",
          savedFlash
            ? "bg-emerald-500"
            : "bg-[#1A3C5E] hover:bg-[#15304d]"
        )}
      >
        <AnimatePresence mode="wait">
          {saving ? (
            <motion.span
              key="saving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Loader2 size={15} className="animate-spin" />
              Saving…
            </motion.span>
          ) : savedFlash ? (
            <motion.span
              key="saved"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Check size={15} strokeWidth={3} />
              Saved!
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Salad size={15} />
              Save Preferences
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  )
}

export default DietaryProfile