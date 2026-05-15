"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"
import { timeAgo } from "@/lib/utils"
import {
  Bell,
  Search,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
} from "lucide-react"

interface TopBarProps {
  onMenuClick?: () => void
  className?: string
}

interface NotificationItem {
  id: string
  title: string
  body: string
  created_at: string
  is_read: boolean
}

export function TopBar({ onMenuClick, className }: TopBarProps) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { user, role, signOut } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)

  const handleLogout = async () => {
    await signOut()
    window.location.assign("/auth/login")
  }

  useEffect(() => {
    if (!user) return

    const loadNotifications = async () => {
      try {
        setLoadingNotifications(true)
        const result = await apiClient.get<{ data: NotificationItem[]; count: number }>("/notifications")
        setNotifications(result.data ?? [])
      } catch {
        // Ignore notification errors for now
      } finally {
        setLoadingNotifications(false)
      }
    }

    loadNotifications()
  }, [user])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <header className={cn(
      "h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-6",
      className
    )}>
      {/* Left side */}
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

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell size={20} className="text-gray-600" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
              >
                {unreadCount}
              </motion.span>
            )}
          </motion.button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  <button
                    onClick={async () => {
                      try {
                        await apiClient.patch("/notifications/read-all", {})
                        setNotifications((items) => items.map((item) => ({ ...item, is_read: true })))
                        toast.success("Notifications marked as read")
                      } catch {
                        toast.error("Could not update notifications")
                      }
                    }}
                    className="text-xs text-brand-primary hover:underline"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {!loadingNotifications && notifications.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">
                      No notifications yet
                    </div>
                  )}
                  {notifications.map((notification) => (
                    <motion.button
                      key={notification.id}
                      whileHover={{ backgroundColor: "#F9FAFB" }}
                      onClick={async () => {
                        try {
                          await apiClient.patch(`/notifications/${notification.id}/read`, {})
                          setNotifications((items) =>
                            items.map((item) => item.id === notification.id ? { ...item, is_read: true } : item)
                          )
                          toast.info(notification.title)
                        } catch {
                          toast.error("Could not update notification")
                        }
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-gray-50 cursor-pointer",
                        !notification.is_read && "bg-blue-50/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0",
                          notification.is_read ? "bg-gray-300" : "bg-brand-primary"
                        )} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{notification.body}</p>
                          <p className="text-xs text-gray-400 mt-1">{timeAgo(notification.created_at)}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User menu */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowUserMenu(!showUserMenu)}
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
                transition={{ duration: 0.2 }}
                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.name || user?.email || "Team member"}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {role?.replace("_", " ") || "Signed in"}
                  </p>
                </div>
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
