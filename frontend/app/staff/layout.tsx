"use client"

import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { RouteGuard } from "@/components/layout/RouteGuard"
import { ROLES } from "@/lib/constants"

// All staff roles are allowed at the /staff segment level.
// Sub-layouts (e.g. /staff/chef) narrow this further via their own RouteGuard.
const STAFF_ROLES = [
  ROLES.MANAGER,
  ROLES.HOST,
  ROLES.WAITER,
  ROLES.CHEF,
  ROLES.CASHIER,
  ROLES.OWNER, // owners can access staff views
] as const

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRoles={[...STAFF_ROLES]}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className="lg:ml-64">
          <TopBar />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </RouteGuard>
  )
}