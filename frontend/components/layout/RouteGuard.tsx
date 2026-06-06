"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { getRoleDashboard } from "@/lib/role-routing"
import { Loader2 } from "lucide-react"
import type { Role } from "@/lib/constants"

interface RouteGuardProps {
  /** One or more roles that are allowed to view this section. */
  allowedRoles: Role[]
  children: React.ReactNode
}

/**
 * Client-side auth guard for role-based layout segments.
 *
 * Middleware handles the server-side redirect on first navigation; this
 * component handles:
 *   • Client-side navigations (router.push) that bypass middleware
 *   • Token refresh races where the middleware saw a valid token but
 *     useAuth() finds it expired by the time React hydrates
 *   • The loading skeleton so children never flash before auth is confirmed
 *
 * Usage:
 *   <RouteGuard allowedRoles={[ROLES.OWNER]}>
 *     <OwnerShell>{children}</OwnerShell>
 *   </RouteGuard>
 */
export function RouteGuard({ allowedRoles, children }: RouteGuardProps) {
  const { isAuthenticated, role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!isAuthenticated) {
      // Preserve current path so LoginForm can redirect back after sign-in.
      const redirect = encodeURIComponent(window.location.pathname)
      router.replace(`/auth/login?redirect=${redirect}`)
      return
    }

    if (role && !allowedRoles.includes(role as Role)) {
      // User is authenticated but landed on the wrong section.
      // Send them to their own dashboard instead of showing a blank/403 page.
      router.replace(getRoleDashboard(role as Role))
    }
  }, [loading, isAuthenticated, role, allowedRoles, router])

  // ── Loading state ───────────────────────────────────────────────────────────
  // Show a centered spinner while useAuth() resolves the /users/me call.
  // This prevents a flash of protected content before auth is confirmed.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" aria-label="Loading…" />
      </div>
    )
  }

  // ── Not authenticated or wrong role ────────────────────────────────────────
  // Return null while the router.replace() in the effect fires.
  // This prevents a momentary render of protected UI during the redirect.
  if (!isAuthenticated || (role && !allowedRoles.includes(role as Role))) {
    return null
  }

  return <>{children}</>
}