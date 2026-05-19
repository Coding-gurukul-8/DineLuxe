"use client"

import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { RouteGuard } from "@/components/layout/RouteGuard"
import { ROLES } from "@/lib/constants"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRoles={[ROLES.SUPER_ADMIN]}>
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