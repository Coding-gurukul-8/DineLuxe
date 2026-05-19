"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  Bell,
  BellOff,
  CheckCheck,
  Info,
  ShoppingBag,
  AlertTriangle,
  Star,
  Truck,
  X,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { timeAgo } from "@/lib/utils"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
}

// ── Icon resolver ─────────────────────────────────────────────────────────────

function NotificationIcon({ type }: { type: string }) {
  const t = type?.toLowerCase() ?? ""

  const config = (() => {
    if (t.includes("order"))
      return { Icon: ShoppingBag, bg: "bg-blue-50", color: "text-blue-500" }
    if (t.includes("review") || t.includes("rating"))
      return { Icon: Star, bg: "bg-amber-50", color: "text-amber-500" }
    if (t.includes("delivery"))
      return { Icon: Truck, bg: "bg-green-50", color: "text-green-500" }
    if (t.includes("alert") || t.includes("warning") || t.includes("low_stock") || t.includes("inventory"))
      return { Icon: AlertTriangle, bg: "bg-red-50", color: "text-red-500" }
    return { Icon: Info, bg: "bg-gray-100", color: "text-gray-500" }
  })()

  return (
    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", config.bg)}>
      <config.Icon size={16} className={config.color} />
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface NotificationPanelProps {
  isOpen: boolean
  onClose: () => void
  /** Anchor ref so the panel can be positioned relative to the bell button */
  anchorRef?: React.RefObject<HTMLButtonElement | null>
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => apiClient.get<Notification[]>("/notifications"),
    refetchInterval: 60_000,
    enabled: isOpen,   // only poll while open; TopBar drives the badge count separately
  })

  // ── Mark one read ─────────────────────────────────────────────────────────

  const markOneMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/notifications/${id}/read`, {}),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["notifications"] })
      const prev = qc.getQueryData<Notification[]>(["notifications"])
      qc.setQueryData<Notification[]>(["notifications"], (old = []) =>
        old.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev)
      toast.error("Could not mark notification as read")
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  })

  // ── Mark all read ─────────────────────────────────────────────────────────

  const markAllMutation = useMutation({
    mutationFn: () => apiClient.patch("/notifications/read-all", {}),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["notifications"] })
      const prev = qc.getQueryData<Notification[]>(["notifications"])
      qc.setQueryData<Notification[]>(["notifications"], (old = []) =>
        old.map((n) => ({ ...n, is_read: true }))
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notifications"], ctx.prev)
      toast.error("Could not mark all as read")
    },
    onSuccess: () => toast.success("All notifications marked as read"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const hasUnread = unreadCount > 0

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — closes panel on outside click */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className={cn(
              "absolute right-0 top-full mt-2 z-50",
              "w-[340px] max-h-[480px] flex flex-col",
              "bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-brand-primary" />
                <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                {hasUnread && (
                  <span className="px-2 py-0.5 rounded-full bg-brand-primary text-white text-[10px] font-bold leading-none">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {hasUnread && (
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    onClick={() => markAllMutation.mutate()}
                    disabled={markAllMutation.isPending}
                    className="flex items-center gap-1 text-xs text-brand-primary font-medium hover:underline px-2 py-1 rounded-lg hover:bg-brand-primary/5 transition-colors disabled:opacity-50"
                    title="Mark all as read"
                  >
                    <CheckCheck size={13} />
                    Mark all read
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                >
                  <X size={15} />
                </motion.button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 overscroll-contain">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                        <div className="h-2.5 bg-gray-100 rounded animate-pulse w-full" />
                        <div className="h-2 bg-gray-100 rounded animate-pulse w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center px-4">
                  <BellOff size={32} className="text-gray-200 mb-3" />
                  <p className="text-sm font-medium text-gray-500">You're all caught up</p>
                  <p className="text-xs text-gray-400 mt-1">No notifications yet</p>
                </div>
              ) : (
                <div>
                  {notifications.map((notification, idx) => (
                    <motion.button
                      key={notification.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => {
                        if (!notification.is_read) {
                          markOneMutation.mutate(notification.id)
                        }
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 flex items-start gap-3 border-b border-gray-50 transition-colors",
                        notification.is_read
                          ? "hover:bg-gray-50/60"
                          : "bg-blue-50/30 hover:bg-blue-50/60"
                      )}
                    >
                      <NotificationIcon type={notification.type} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-sm leading-snug line-clamp-1",
                              notification.is_read
                                ? "text-gray-700 font-normal"
                                : "text-gray-900 font-semibold"
                            )}
                          >
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span className="w-2 h-2 rounded-full bg-brand-primary shrink-0 mt-1" />
                          )}
                        </div>
                        {notification.body && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                            {notification.body}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1.5">
                          {timeAgo(notification.created_at)}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer — only shown when there are notifications */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 shrink-0">
                <p className="text-[11px] text-gray-400 text-center">
                  {unreadCount === 0
                    ? "All caught up!"
                    : `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default NotificationPanel