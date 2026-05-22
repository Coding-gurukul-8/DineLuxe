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
  Settings,
  LogOut,
  ChevronDown,
  Menu,
} from "lucide-react"

interface TopBarProps {
  onMenuClick?: () => void
  className?: string
}

export function TopBar({ onMenuClick, className }: TopBarProps) {
  const { user, role, signOut } = useAuth()
  const bellRef = useRef<HTMLButtonElement>(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => apiClient.get<Notification[]>("/notifications"),
    refetchInterval: 60_000,
    enabled: !!user,
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleLogout = async () => {
    await signOut()
    window.location.assign("/auth/login")
  }

  const initials = (user?.name || user?.email || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header
      className={cn(
        "h-16 bg-white/95 backdrop-blur-sm border-b border-gray-100/80 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
        >
          <Menu size={20} />
        </motion.button>

        <div className="hidden md:flex items-center bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2 w-56 gap-2 transition-colors">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400 text-gray-700"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="relative">
          <motion.button
            ref={bellRef}
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              setShowNotifications((v) => !v)
              if (showUserMenu) setShowUserMenu(false)
            }}
            className={cn(
              "relative p-2.5 rounded-xl transition-colors",
              showNotifications
                ? "bg-[#1A3C5E]/8 text-[#1A3C5E]"
                : "hover:bg-gray-100 text-gray-500"
            )}
            aria-label="Toggle notifications"
          >
            <Bell size={19} />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="absolute top-1.5 right-1.5 min-w-4 h-4 bg-[#E8A020] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-sm"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          <NotificationPanel
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
            anchorRef={bellRef}
          />
        </div>

        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setShowUserMenu((v) => !v)
              if (showNotifications) setShowNotifications(false)
            }}
            className={cn(
              "flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl transition-colors",
              showUserMenu ? "bg-gray-100" : "hover:bg-gray-50"
            )}
          >
            <div className="w-7 h-7 rounded-lg bg-[#1A3C5E] flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-bold font-mono">{initials}</span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-gray-800 leading-tight truncate max-w-25">
                {user?.name || "Account"}
              </p>
              <p className="text-[10px] text-gray-400 capitalize leading-tight">
                {role?.replace("_", " ")}
              </p>
            </div>
            <ChevronDown
              size={13}
              className={cn(
                "text-gray-400 transition-transform hidden sm:block",
                showUserMenu && "rotate-180"
              )}
            />
          </motion.button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-gray-50">
                  <p className="text-sm font-semibold text-gray-900">
                    {user?.name || user?.email || "Team member"}
                  </p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">
                    {role?.replace("_", " ") || "Signed in"}
                  </p>
                </div>
                <div className="py-1.5">
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      window.location.assign("/owner/settings")
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={15} className="text-gray-400" />
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} />
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