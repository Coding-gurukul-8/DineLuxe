"use client"

import { useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/hooks/useAuth"
import { apiClient } from "@/lib/api-client"
import { NotificationPanel, type Notification } from "@/components/notifications/NotificationPanel"
import { cn } from "@/lib/utils"
import {
  Bell,
  Search,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
} from "lucide-react"

// ── Props ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  onMenuClick?: () => void
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TopBar({ onMenuClick, className }: TopBarProps) {
  const { user, role, signOut } = useAuth()
  const bellRef = useRef<HTMLButtonElement>(null)

  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  // ── Notification badge count ───────────────────────────────────────────────
  // Polls every 60 s so the unread badge stays current without a WebSocket.
  // This query is separate from the one inside NotificationPanel so the badge
  // always reflects the latest count even when the panel is closed.
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => apiClient.get<Notification[]>("/notifications"),
    refetchInterval: 60_000,
    enabled: !!user,
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = async () => {
    await signOut()
    window.location.assign("/auth/login")
  }

  return (
    <header
      className={cn(
        "h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-6",
        className
      )}
    >
      {/* ── Left ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </motion.button>

        {/* Search */}
        <div className="hidden md:flex items-center bg-gray-50 rounded-lg px-3 py-2 w-64">
          <Search size={16} className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* ── Right ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">

        {/* ── Bell + NotificationPanel ─────────────────────────────────── */}
        <div className="relative">
          <motion.button
            ref={bellRef}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              setShowNotifications((v) => !v)
              if (showUserMenu) setShowUserMenu(false)
            }}
            className={cn(
              "relative p-2 rounded-lg transition-colors",
              showNotifications
                ? "bg-brand-primary/10 text-brand-primary"
                : "hover:bg-gray-100 text-gray-600"
            )}
            aria-label="Toggle notifications"
          >
            <Bell size={20} />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* NotificationPanel is positioned relative to this wrapper */}
          <NotificationPanel
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
            anchorRef={bellRef}
          />
        </div>

        {/* ── User menu ─────────────────────────────────────────────────── */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setShowUserMenu((v) => !v)
              if (showNotifications) setShowNotifications(false)
            }}
            className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-brand-primary/10 rounded-full flex items-center justify-center">
              <User size={16} className="text-brand-primary" />
            </div>
            <ChevronDown size={16} className="text-gray-400 hidden sm:block" />
          </motion.button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50"
              >
                {/* User info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.name || user?.email || "Team member"}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {role?.replace("_", " ") || "Signed in"}
                  </p>
                </div>

                {/* Actions */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      window.location.assign("/owner/settings")
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={16} />
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </header>
  )
}

export default TopBar