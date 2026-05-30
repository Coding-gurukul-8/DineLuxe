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

import { Loader2, ChevronRight, UtensilsCrossed } from "lucide-react"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { MenuManagement } from "@/components/owner/MenuManagement"
import { useAuth } from "@/hooks/useAuth"

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OwnerMenuPage() {
  const { branchId, loading } = useAuth()

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