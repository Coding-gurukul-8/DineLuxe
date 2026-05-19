"use client"

import { BottomNav } from "@/components/layout/BottomNav"
import { RouteGuard } from "@/components/layout/RouteGuard"
import { ROLES } from "@/lib/constants"

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRoles={[ROLES.CUSTOMER]}>
      <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
        <main className="max-w-lg mx-auto">{children}</main>
        <BottomNav />
      </div>
    </RouteGuard>
  )
}