"use client"

import type { ReactNode } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import TopBar from "@/components/layout/TopBar"
import { RouteGuard } from "@/components/layout/RouteGuard"
import { ROLES } from "@/lib/constants"

export default function ChefLayout({ children }: { children: ReactNode }) {
  return (
    <RouteGuard allowedRoles={[ROLES.CHEF, ROLES.MANAGER, ROLES.OWNER]}>
      <div className="min-h-screen bg-surface">
        <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
          <Sidebar />
          <div className="flex flex-col">
            <TopBar />
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </div>
    </RouteGuard>
  )
}