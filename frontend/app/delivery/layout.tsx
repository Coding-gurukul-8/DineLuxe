"use client"

import { RouteGuard } from "@/components/layout/RouteGuard"
import { ROLES } from "@/lib/constants"

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRoles={[ROLES.DELIVERY_PARTNER]}>
      <div className="min-h-screen bg-gray-50">{children}</div>
    </RouteGuard>
  )
}