"use client"

/**
 * app/owner/menu/page.tsx
 *
 * Menu Management landing page for the owner dashboard.
 *
 * NOTE — MenuManagement accepts NO props:
 *   export function MenuManagement()   ← no branchId prop
 * It resolves branchId internally via useAuth(), and if branchId is null
 * (owner with no assigned branch) it renders its own BranchSelector to let
 * the owner pick one. The page therefore renders the component without props
 * and relies on its internal state for branch resolution.
 *
 * If a branchId prop is added to MenuManagement in the future, pass
 * activeBranchId (from useAuth) here:
 *   <MenuManagement branchId={activeBranchId ?? undefined} />
 */

import { useState } from "react"
import { Loader2, ChevronRight, UtensilsCrossed, Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { MenuManagement } from "@/components/owner/MenuManagement"
import SmartPricingWidget from "@/components/ai/SmartPricingWidget"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

// ── Breadcrumb ─────────────────────────────────────────────────────────────────

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-gray-400" aria-label="Breadcrumb">
      <UtensilsCrossed size={12} className="text-gray-300" />
      <span className="font-medium text-gray-500">Menu</span>
      <ChevronRight size={12} />
      <span className="text-gray-400">All Items</span>
    </nav>
  )
}

// ── Collapsible AI Suggestions Panel ───────────────────────────────────────────

function SmartSuggestionsPanel({
  branchId,
  restaurantId,
}: {
  branchId: string
  restaurantId: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-[#1A3C5E]/15 bg-linear-to-r from-[#1A3C5E]/3 to-[#E8A020]/3 overflow-hidden">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between px-5 py-3.5 transition-colors",
          isOpen
            ? "bg-[#1A3C5E]/5 border-b border-[#1A3C5E]/10"
            : "hover:bg-[#1A3C5E]/5"
        )}
        aria-expanded={isOpen}
        aria-controls="smart-suggestions-panel"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#1A3C5E]/10 flex items-center justify-center">
            <Sparkles size={14} className="text-[#1A3C5E]" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-gray-800">AI Suggestions</span>
            <span className="ml-2 text-xs font-medium text-[#E8A020]">✨ Smart Pricing</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-xs hidden sm:block">
            {isOpen ? "Hide suggestions" : "View AI-powered insights"}
          </span>
          {isOpen ? (
            <ChevronUp size={16} className="text-[#1A3C5E]" />
          ) : (
            <ChevronDown size={16} />
          )}
        </div>
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div
          id="smart-suggestions-panel"
          className="p-4"
        >
          <SmartPricingWidget branchId={branchId} restaurantId={restaurantId} />
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OwnerMenuPage() {
  const { branchId, restaurantId, loading } = useAuth()

  // Show a brief spinner while auth hydrates — avoids a flash where
  // MenuManagement renders its BranchSelector before branchId arrives.
  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 size={28} className="text-[#1A3C5E] animate-spin" />
      </div>
    )
  }

  return (
    <PageWrapper
      title="Menu Management"
      subtitle={
        branchId
          ? "Manage categories and items for this branch"
          : "Select a branch to manage its menu"
      }
    >
      <Breadcrumb />

      {/* ── AI Smart Suggestions — collapsible panel ─────────────────── */}
      {branchId && restaurantId && (
        <SmartSuggestionsPanel branchId={branchId} restaurantId={restaurantId} />
      )}

      {/*
        MenuManagement handles its own branch resolution:
        - If useAuth() returns a branchId  → shows that branch's menu
        - If useAuth() returns null        → shows BranchSelector inline
        No branchId prop is needed or accepted by the component.
      */}
      <MenuManagement />
    </PageWrapper>
  )
}