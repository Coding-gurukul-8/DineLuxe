"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { apiClient } from "@/lib/api-client"
import {
  LayoutDashboard, Utensils, Users, Calendar, Settings,
  BarChart3, Store, ChefHat, ClipboardList, CreditCard,
  QrCode, Shield, ChevronLeft, ChevronRight, LogOut,
  Heart, Package, Palette, Sun, Moon,
  LayoutGrid, Settings2, MessageSquare,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: string[]
  section: string
}

interface BrandingData {
  app_name: string
  logo_url?: string | null
  primary_color?: string | null
}

// ── Nav config ─────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  // ── Super Admin ──────────────────────────────────────────────────────────────
  { label: "Dashboard",       href: "/admin/dashboard",       icon: <LayoutDashboard size={18} />, roles: ["super_admin"], section: "Platform" },
  { label: "Restaurants",     href: "/admin/restaurants",     icon: <Store size={18} />,           roles: ["super_admin"], section: "Platform" },
  { label: "Customers",       href: "/admin/customers",       icon: <Users size={18} />,           roles: ["super_admin"], section: "Platform" },
  // ── ADDED: Staff Reviews ──────────────────────────────────────────────────────
  { label: "Staff Reviews",   href: "/admin/staff-reviews",   icon: <MessageSquare size={18} />,   roles: ["super_admin"], section: "Platform" },
  { label: "Reports",         href: "/admin/reports",         icon: <BarChart3 size={18} />,       roles: ["super_admin"], section: "Analytics" },
  { label: "Platform Health", href: "/admin/platform-health", icon: <Shield size={18} />,         roles: ["super_admin"], section: "Analytics" },
  { label: "Settings",        href: "/admin/settings",        icon: <Settings size={18} />,        roles: ["super_admin"], section: "System" },

  // ── Owner ────────────────────────────────────────────────────────────────────
  { label: "Dashboard",    href: "/owner/dashboard",  icon: <LayoutDashboard size={18} />, roles: ["owner"],            section: "Overview" },
  { label: "Branches",     href: "/owner/branches",   icon: <Store size={18} />,           roles: ["owner"],            section: "Operations" },
  { label: "Menu",         href: "/owner/menu",        icon: <Utensils size={18} />,        roles: ["owner"],            section: "Operations" },
  { label: "Inventory",    href: "/owner/inventory",   icon: <Package size={18} />,         roles: ["owner"],            section: "Operations" },
  { label: "Bookings",     href: "/owner/bookings",    icon: <Calendar size={18} />,        roles: ["owner"],            section: "Operations" },
  // ── ADDED: Floor Layout (visible to owner + manager) ──────────────────────────
  { label: "Floor Layout", href: "/owner/floor",       icon: <LayoutGrid size={18} />,      roles: ["owner", "manager"], section: "Operations" },
  { label: "Customers",    href: "/owner/customers",   icon: <Heart size={18} />,           roles: ["owner"],            section: "Insights" },
  { label: "Reports",      href: "/owner/reports",     icon: <BarChart3 size={18} />,       roles: ["owner"],            section: "Insights" },
  { label: "Branding",     href: "/owner/branding",    icon: <Palette size={18} />,         roles: ["owner"],            section: "Settings" },
  // ── ADDED: AI Settings (owner-only) ───────────────────────────────────────────
  { label: "AI Settings",  href: "/owner/settings",    icon: <Settings2 size={18} />,       roles: ["owner"],            section: "Settings" },

  // ── Manager ──────────────────────────────────────────────────────────────────
  { label: "Dashboard",  href: "/staff/manager/dashboard", icon: <LayoutDashboard size={18} />, roles: ["manager"], section: "Overview" },
  { label: "Floor Map",  href: "/staff/host/floor",        icon: <QrCode size={18} />,          roles: ["manager"], section: "Operations" },
  { label: "Queue",      href: "/staff/host/queue",        icon: <ClipboardList size={18} />,   roles: ["manager"], section: "Operations" },
  { label: "Orders",     href: "/staff/waiter",            icon: <Utensils size={18} />,        roles: ["manager"], section: "Operations" },
  { label: "Kitchen",    href: "/staff/chef/kitchen",      icon: <ChefHat size={18} />,         roles: ["manager"], section: "Operations" },
  { label: "POS",        href: "/staff/cashier",           icon: <CreditCard size={18} />,      roles: ["manager"], section: "Operations" },
  { label: "Reports",    href: "/staff/manager",           icon: <BarChart3 size={18} />,       roles: ["manager"], section: "Analytics" },

  // ── Host ─────────────────────────────────────────────────────────────────────
  { label: "Dashboard",  href: "/staff/host",        icon: <LayoutDashboard size={18} />, roles: ["host"], section: "Overview" },
  { label: "Floor Map",  href: "/staff/host/floor",  icon: <QrCode size={18} />,          roles: ["host"], section: "Operations" },
  { label: "Queue",      href: "/staff/host/queue",  icon: <ClipboardList size={18} />,   roles: ["host"], section: "Operations" },

  // ── Waiter ───────────────────────────────────────────────────────────────────
  { label: "Orders",     href: "/staff/waiter",      icon: <Utensils size={18} />,        roles: ["waiter"], section: "Overview" },

  // ── Chef ─────────────────────────────────────────────────────────────────────
  { label: "Kitchen",    href: "/staff/chef/kitchen", icon: <ChefHat size={18} />,        roles: ["chef"], section: "Overview" },

  // ── Cashier ──────────────────────────────────────────────────────────────────
  { label: "POS",        href: "/staff/cashier",     icon: <CreditCard size={18} />,      roles: ["cashier"], section: "Overview" },
]

// ── Dark-mode hook ────────────────────────────────────────────────────────────

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

// ── BrandLogo ─────────────────────────────────────────────────────────────────
// Renders the logo area: image if available, initial-letter box otherwise.

function BrandLogo({
  branding,
  isLoading,
  fallbackName,
}: {
  branding?: BrandingData | null
  isLoading: boolean
  fallbackName?: string
}) {
  const [imgError, setImgError] = useState(false)

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse shrink-0" />
    )
  }

  const showImg = branding?.logo_url && !imgError

  if (showImg) {
    return (
      <img
        src={branding!.logo_url!}
        className="w-8 h-8 rounded-lg object-cover shrink-0"
        alt="logo"
        onError={() => setImgError(true)}
      />
    )
  }

  // Fall back to styled initial-letter box
  const displayName = branding?.app_name || fallbackName || "Restaurant"
  const initial = displayName.trim()[0]?.toUpperCase() ?? "R"

  return (
    <div className="w-8 h-8 bg-[#1A3C5E] rounded-lg flex items-center justify-center shrink-0">
      <span className="text-[#E8A020] font-bold text-sm">{initial}</span>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, role, signOut } = useAuth()
  const { dark, toggle: toggleDark, mounted: darkMounted } = useDarkMode()

  const restaurantId = user?.restaurantId

  // Fetch restaurant branding — only when restaurantId is available
  const { data: branding, isLoading: brandingLoading } = useQuery<BrandingData>({
    queryKey: ["branding", restaurantId],
    queryFn: () =>
      apiClient.get<BrandingData>(`/restaurants/${restaurantId}/branding`),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000, // 5 min — branding rarely changes
    retry: false,             // don't spam on 404 / permission errors
  })

  const filteredItems = role
    ? NAV_ITEMS.filter((item) => item.roles.includes(role))
    : []

  const sections: Record<string, NavItem[]> = {}
  for (const item of filteredItems) {
    if (!sections[item.section]) sections[item.section] = []
    sections[item.section].push(item)
  }

  const handleLogout = async () => {
    await signOut()
    window.location.assign("/auth/login")
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/")

  const initials = (user?.name || user?.email || "?")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const displayAppName = branding?.app_name ?? "Restaurant"

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 z-40 flex flex-col overflow-hidden"
    >
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div className={cn(
        "h-16 flex items-center border-b border-gray-100 dark:border-gray-800 shrink-0",
        collapsed ? "justify-center px-2" : "px-4 gap-3"
      )}>
        <BrandLogo
          branding={branding}
          isLoading={!!restaurantId && brandingLoading}
          fallbackName={user?.name}
        />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="font-semibold text-gray-900 dark:text-white truncate"
            >
              {brandingLoading && restaurantId ? (
                <span className="inline-block w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ) : (
                displayAppName
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto overflow-x-hidden space-y-0.5 scrollbar-thin">
        {collapsed
          ? filteredItems.map((item) => (
              <NavButton
                key={item.href}
                item={item}
                active={isActive(item.href)}
                collapsed
                onClick={() => router.push(item.href)}
              />
            ))
          : Object.entries(sections).map(([section, items]) => (
              <div key={section} className="mb-1">
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 select-none">
                  {section}
                </p>
                {items.map((item) => (
                  <NavButton
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    collapsed={false}
                    onClick={() => router.push(item.href)}
                  />
                ))}
              </div>
            ))
        }
      </nav>

      {/* ── Bottom ────────────────────────────────────────────────────── */}
      <div className={cn(
        "border-t border-gray-100 dark:border-gray-800 py-3 px-2 space-y-1 shrink-0",
      )}>
        {/* User info */}
        {!collapsed && (
          <div className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#1A3C5E] flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-bold">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                  {user?.name || user?.email || "Team member"}
                </p>
                <p className="text-[10px] text-gray-400 capitalize leading-tight">
                  {role?.replace(/_/g, " ")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Dark mode toggle */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={toggleDark}
          title={collapsed ? (dark ? "Light mode" : "Dark mode") : undefined}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
            "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800",
            collapsed && "justify-center"
          )}
        >
          {darkMounted
            ? dark
              ? <Sun size={18} className="text-[#E8A020]" />
              : <Moon size={18} />
            : <Moon size={18} />
          }
          {!collapsed && (
            <span>{dark ? "Light mode" : "Dark mode"}</span>
          )}
        </motion.button>

        {/* Logout */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
            "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40",
            collapsed && "justify-center"
          )}
        >
          <LogOut size={18} />
          {!collapsed && <span>Sign out</span>}
        </motion.button>

        {/* Collapse toggle */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
            "text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </motion.button>
      </div>
    </motion.aside>
  )
}

// ── NavButton ─────────────────────────────────────────────────────────────────

function NavButton({
  item, active, collapsed, onClick,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
        active
          ? "bg-[#1A3C5E] text-white shadow-sm"
          : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white",
        collapsed && "justify-center"
      )}
    >
      <span className={cn("shrink-0", active ? "text-white" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600")}>
        {item.icon}
      </span>
      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}
      {active && !collapsed && (
        <motion.div
          layoutId="sidebar-indicator"
          className="ml-auto w-1.5 h-1.5 rounded-full bg-[#E8A020]"
        />
      )}
    </motion.button>
  )
}

export default Sidebar