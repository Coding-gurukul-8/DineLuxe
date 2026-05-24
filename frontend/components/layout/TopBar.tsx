"use client"

import { useRef, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/hooks/useAuth"
import { apiClient } from "@/lib/api-client"
import { NotificationPanel, type Notification } from "@/components/notifications/NotificationPanel"
import { cn } from "@/lib/utils"
import { Bell, Search, Settings, LogOut, ChevronDown, Menu, Sun, Moon } from "lucide-react"

interface TopBarProps {
  onMenuClick?: () => void
  className?: string
}

function useDarkMode() {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const ls = window.localStorage
      const saved = typeof ls?.getItem === "function" ? ls.getItem("dineluxe-theme") : null
      const isDark = saved === "dark"
      setDark(isDark)
      document.documentElement.classList.toggle("dark", isDark)
    } catch {}
    setMounted(true)
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    try {
      const ls = window.localStorage
      if (typeof ls?.setItem === "function") ls.setItem("dineluxe-theme", next ? "dark" : "light")
    } catch {}
  }

  return { dark, toggle, mounted }
}

export function TopBar({ onMenuClick, className }: TopBarProps) {
  const { user, role, signOut } = useAuth()
  const bellRef = useRef<HTMLButtonElement>(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { dark, toggle: toggleDark, mounted: darkMounted } = useDarkMode()

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => apiClient.get<Notification[]>("/notifications"),
    refetchInterval: 60_000,
    enabled: !!user,
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleLogout = async () => {
    setShowUserMenu(false)
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
    <header className={cn(
      "h-16 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-100/80 dark:border-gray-800/80 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30",
      className
    )}>
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-500"
        >
          <Menu size={20} />
        </motion.button>

        <div className="hidden md:flex items-center bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl px-3 py-2 w-56 gap-2 transition-colors">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400 text-gray-700 dark:text-gray-200"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">

        {/* Dark mode toggle */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggleDark}
          aria-label="Toggle dark mode"
          className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-300 transition-colors"
        >
          {darkMounted
            ? dark ? <Sun size={18} className="text-[#E8A020]" /> : <Moon size={18} />
            : <Moon size={18} />
          }
        </motion.button>

        {/* Notifications */}
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
                ? "bg-[#1A3C5E]/8 text-[#1A3C5E] dark:bg-[#1A3C5E]/30 dark:text-blue-300"
                : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-300"
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

        {/* User menu */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setShowUserMenu((v) => !v)
              if (showNotifications) setShowNotifications(false)
            }}
            className={cn(
              "flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl transition-colors",
              showUserMenu ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            <div className="w-7 h-7 rounded-lg bg-[#1A3C5E] flex items-center justify-center shrink-0">
              <span className="text-white text-[10px] font-bold font-mono">{initials}</span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-medium text-gray-800 dark:text-gray-100 leading-tight truncate max-w-25">
                {user?.name || "Account"}
              </p>
              <p className="text-[10px] text-gray-400 capitalize leading-tight">
                {role?.replace(/_/g, " ")}
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
                className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-800">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {user?.name || user?.email || "Team member"}
                  </p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">
                    {role?.replace(/_/g, " ") || "Signed in"}
                  </p>
                </div>
                <div className="py-1.5">
                  <button
                    onClick={() => { setShowUserMenu(false); window.location.assign("/owner/settings") }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Settings size={15} className="text-gray-400" />
                    Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <LogOut size={15} />
                    Sign out
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
