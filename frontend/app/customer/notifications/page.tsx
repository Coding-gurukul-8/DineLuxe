"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bell,
  ShoppingBag,
  Calendar,
  CreditCard,
  Settings,
  Trophy,
  CheckCheck,
  Trash2,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { getSocket } from "@/lib/socket"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
  | "order_update"
  | "booking_update"
  | "payment"
  | "queue_update"
  | "system_alert"
  | "promotional"

type FilterTab = "all" | "orders" | "bookings" | "promotions" | "system"

interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  is_read: boolean
  created_at: string
  reference_id?: string
  reference_type?: string
}

interface NotificationsResponse {
  data: Notification[]
  count: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

function dateGroup(iso: string): "Today" | "Yesterday" | "Older" {
  const d = new Date(iso)
  const now = new Date()
  if (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  )
    return "Today"
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  )
    return "Yesterday"
  return "Older"
}

function filterMatches(n: Notification, tab: FilterTab): boolean {
  if (tab === "all") return true
  if (tab === "orders") return n.type === "order_update" || n.type === "queue_update"
  if (tab === "bookings") return n.type === "booking_update"
  if (tab === "promotions") return n.type === "promotional"
  if (tab === "system") return n.type === "system_alert"
  return true
}

function navTarget(n: Notification): string | null {
  if (!n.reference_id) return null
  if (n.reference_type === "order" || n.type === "order_update")
    return `/customer/order/${n.reference_id}`
  if (n.reference_type === "booking" || n.type === "booking_update")
    return `/customer/booking`
  if (n.reference_type === "payment" || n.type === "payment")
    return `/customer/payment/success`
  return null
}

// ─── Icon config ──────────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: NotificationType }) {
  const configs: Record<NotificationType, { icon: React.ElementType; bg: string; color: string }> = {
    order_update: { icon: ShoppingBag, bg: "bg-amber-50", color: "text-amber-500" },
    queue_update: { icon: ShoppingBag, bg: "bg-amber-50", color: "text-amber-500" },
    booking_update: { icon: Calendar, bg: "bg-[#1A3C5E]/10", color: "text-[#1A3C5E]" },
    payment: { icon: CreditCard, bg: "bg-green-50", color: "text-green-600" },
    system_alert: { icon: Settings, bg: "bg-gray-100", color: "text-gray-500" },
    promotional: { icon: Trophy, bg: "bg-yellow-50", color: "text-yellow-500" },
  }
  const { icon: Icon, bg, color } = configs[type] ?? configs.system_alert
  return (
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", bg)}>
      <Icon size={18} className={color} />
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-100" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  )
}

// ─── Notification card ────────────────────────────────────────────────────────

function NotifCard({
  notif,
  onRead,
  onDelete,
}: {
  notif: Notification
  onRead: (id: string) => void
  onDelete: (id: string) => void
}) {
  const router = useRouter()

  const handleTap = () => {
    if (!notif.is_read) onRead(notif.id)
    const target = navTarget(notif)
    if (target) router.push(target)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      className={cn(
        "relative flex cursor-pointer gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors hover:bg-gray-50/80",
        notif.is_read ? "border-gray-100" : "border-l-4 border-l-[#1A3C5E] border-gray-100"
      )}
      onClick={handleTap}
    >
      <NotifIcon type={notif.type} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-snug", notif.is_read ? "font-medium text-gray-700" : "font-bold text-gray-950")}>
            {notif.title}
          </p>
          {!notif.is_read && (
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#1A3C5E]" />
          )}
        </div>
        <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{notif.body}</p>
        <p className="mt-1.5 text-xs text-gray-400">{relativeTime(notif.created_at)}</p>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(notif.id)
        }}
        className="absolute right-3 top-3 rounded p-1 text-gray-300 opacity-0 transition hover:text-red-400 group-hover:opacity-100 [.group:hover_&]:opacity-100"
        aria-label="Delete notification"
      >
        <Trash2 size={14} />
      </button>
    </motion.div>
  )
}

// ─── Filter tab bar ───────────────────────────────────────────────────────────

const TABS: { label: string; value: FilterTab }[] = [
  { label: "All", value: "all" },
  { label: "Orders", value: "orders" },
  { label: "Bookings", value: "bookings" },
  { label: "Promotions", value: "promotions" },
  { label: "System", value: "system" },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<FilterTab>("all")
  const [localNotifs, setLocalNotifs] = useState<Notification[]>([])

  // Fetch notifications
  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: () => apiClient.get<NotificationsResponse>("/notifications?limit=50"),
  })

  // Sync to local state (allows optimistic updates + WS prepend)
  useEffect(() => {
    if (data?.data) setLocalNotifs(data.data)
  }, [data?.data])

  // WebSocket — prepend new notifications
  useEffect(() => {
    const socket = getSocket()
    const handler = (notif: Notification) => {
      setLocalNotifs((prev) => [notif, ...prev])
      // Invalidate unread count used by BottomNav
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] })
    }
    socket.on("new_notification", handler)
    return () => {
      socket.off("new_notification", handler)
    }
  }, [qc])

  // Mark single as read
  const markRead = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`, {}),
    onMutate: (id) => {
      setLocalNotifs((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] })
    },
  })

  // Mark all read
  const markAllRead = useMutation({
    mutationFn: () => apiClient.patch("/notifications/read-all", {}),
    onMutate: () => {
      setLocalNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })))
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] })
    },
  })

  // Delete
  const deleteNotif = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/notifications/${id}`),
    onMutate: (id) => {
      setLocalNotifs((prev) => prev.filter((n) => n.id !== id))
    },
  })

  // Filter + group
  const filtered = localNotifs.filter((n) => filterMatches(n, activeTab))
  const grouped = filtered.reduce<Record<"Today" | "Yesterday" | "Older", Notification[]>>(
    (acc, n) => {
      const g = dateGroup(n.created_at)
      acc[g].push(n)
      return acc
    },
    { Today: [], Yesterday: [], Older: [] }
  )

  const hasUnread = localNotifs.some((n) => !n.is_read)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-950">Notifications</h1>
          {hasUnread && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#1A3C5E] transition hover:text-[#15304d] disabled:opacity-50"
            >
              <CheckCheck size={16} />
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="mt-3 flex gap-1 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                activeTab === tab.value
                  ? "bg-[#1A3C5E] text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-lg space-y-6 px-4 py-5">
        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <Bell size={36} className="text-gray-300" />
            </div>
            <p className="mt-4 text-lg font-bold text-gray-800">You're all caught up! 🎉</p>
            <p className="mt-1 max-w-xs text-sm text-gray-500">
              New notifications about your orders and bookings will appear here.
            </p>
          </div>
        )}

        {/* Grouped notification lists */}
        {(["Today", "Yesterday", "Older"] as const).map((group) => {
          const items = grouped[group]
          if (items.length === 0) return null
          return (
            <section key={group}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
                {group}
              </h2>
              <div className="group space-y-2">
                <AnimatePresence>
                  {items.map((notif) => (
                    <NotifCard
                      key={notif.id}
                      notif={notif}
                      onRead={(id) => markRead.mutate(id)}
                      onDelete={(id) => deleteNotif.mutate(id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}