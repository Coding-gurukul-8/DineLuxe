"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { ROLES } from "@/lib/constants"

// Role → destination mapping, matching role-routing.ts conventions
const ROLE_ROUTES: Partial<Record<string, string>> = {
  [ROLES.MANAGER]:  "/staff/manager/dashboard",
  [ROLES.HOST]:     "/staff/host/queue",
  [ROLES.WAITER]:   "/staff/waiter/tables",
  [ROLES.CHEF]:     "/staff/chef/kitchen",
  [ROLES.CASHIER]:  "/staff/cashier/tables",
}

export default function StaffDashboardPage() {
  const router = useRouter()
  const { role, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    const destination = (role && ROLE_ROUTES[role]) ?? "/auth/login"
    router.replace(destination)
  }, [role, loading, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
      <Loader2 size={32} className="text-[#1A3C5E] animate-spin" />
      <p className="text-sm font-medium text-gray-500">
        Redirecting to your dashboard…
      </p>
    </div>
  )
}