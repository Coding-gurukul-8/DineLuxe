"use client"

import dynamic from "next/dynamic"
import { BottomNav } from "@/components/layout/BottomNav"
import { RouteGuard } from "@/components/layout/RouteGuard"
import { ROLES } from "@/lib/constants"
import { useFCMToken } from "@/hooks/useFCMToken"

// ChatbotWidget uses browser-only APIs (fixed positioning, animations, focus).
// Load it dynamically with SSR disabled so it never runs on the server.
const ChatbotWidget = dynamic(
  () => import("@/components/ai/ChatbotWidget").then((mod) => mod.ChatbotWidget),
  { ssr: false }
)

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  // Register FCM token so customers receive push notifications on mobile (iOS + Android).
  // Falls back to Web Push on desktop. No-op when Firebase env vars are absent.
  useFCMToken()

  return (
    <RouteGuard allowedRoles={[ROLES.CUSTOMER]}>
      <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
        <main className="max-w-lg mx-auto">{children}</main>
        <BottomNav />

        {/*
          ChatbotWidget — floats in the bottom-right corner on all customer pages.
          restaurantId is undefined here (platform-level support); individual
          restaurant pages can render their own widget with a restaurantId if needed.
        */}
        <ChatbotWidget restaurantId={undefined} />
      </div>
    </RouteGuard>
  )
}
