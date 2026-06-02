"use client"

/**
 * app/staff/manager/staff-duty/page.tsx
 *
 * API CONTRACT FIXES (audit 2026-06-02)
 * ──────────────────────────────────────
 * MISMATCH 1 — GET /staff/branch/:branchId?on_duty=true
 *   The backend GET /staff/branch/:branchId (staff.routes.ts) does NOT accept or
 *   filter by an `on_duty` query param. The service selects all staff for the
 *   branch regardless. The `on_duty` / `duty_start` fields also do NOT exist in
 *   the users table or the service response.
 *   FIX: Remove the `?on_duty=true` query param. Filter client-side by `is_active`
 *   as a proxy for "currently active staff" (the closest available signal).
 *   `duty_start` display is removed because the field doesn't exist.
 *
 * MISMATCH 2 — PATCH /staff/:id/duty  { on_duty: false }
 *   This endpoint does NOT exist in staff.routes.ts. The only status-toggle
 *   endpoint is PATCH /staff/:id/toggle-access (which flips is_active).
 *   FIX: Replace apiClient.patch(`/staff/${staffId}/duty`, ...) with
 *        apiClient.patch(`/staff/${staffId}/toggle-access`, {})
 *   Note: toggle-access flips the current state server-side (no body needed),
 *   so the "mark off duty" action will deactivate the staff member's account.
 *   The button label and confirmation copy are updated to reflect this.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  RefreshCw, UserMinus, AlertCircle,
  Users, ChefHat, UtensilsCrossed, CreditCard,
  ConciergeBell, Loader2, UserCheck,
} from "lucide-react"
import { toast } from "sonner"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

type StaffRole = "waiter" | "chef" | "cashier" | "host" | "manager"

/**
 * FIX 1: Removed `on_duty` and `duty_start` — these fields do not exist in the
 * backend response. Using `is_active` (which does exist) as the activity signal.
 */
interface StaffMember {
  id: string
  /** Combined name from DB `name` column */
  name: string
  role: StaffRole
  is_active: boolean
  email: string
  employee_id?: string
}

// ── Role group config ──────────────────────────────────────────────────────────

const ROLE_GROUPS: {
  role: StaffRole
  label: string
  icon: React.ReactNode
  accent: string
}[] = [
  { role: "manager",  label: "Managers",  icon: <UserCheck size={16} />,      accent: "text-indigo-600 bg-indigo-50 border-indigo-100" },
  { role: "waiter",   label: "Waiters",   icon: <UtensilsCrossed size={16} />, accent: "text-emerald-600 bg-emerald-50 border-emerald-100" },
  { role: "chef",     label: "Chefs",     icon: <ChefHat size={16} />,         accent: "text-orange-600 bg-orange-50 border-orange-100" },
  { role: "host",     label: "Hosts",     icon: <ConciergeBell size={16} />,   accent: "text-teal-600 bg-teal-50 border-teal-100" },
  { role: "cashier",  label: "Cashiers",  icon: <CreditCard size={16} />,      accent: "text-violet-600 bg-violet-50 border-violet-100" },
]

// ── Staff Row ──────────────────────────────────────────────────────────────────

function StaffRow({
  member,
  onDeactivate,
  isUpdating,
}: {
  member: StaffMember
  onDeactivate: () => void
  isUpdating: boolean
}) {
  // Derive initials from combined name
  const parts = member.name.trim().split(/\s+/)
  const initials = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50/60 transition rounded-xl"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-[#1A3C5E]/10 flex items-center justify-center text-[#1A3C5E] font-bold text-sm shrink-0">
        {initials.toUpperCase()}
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {member.name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{member.email}</p>
      </div>

      {/* Deactivate — calls PATCH /staff/:id/toggle-access */}
      <button
        onClick={onDeactivate}
        disabled={isUpdating}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-600 border border-red-100 text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50 shrink-0"
        title="Deactivate this staff member's account"
      >
        {isUpdating ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <UserMinus size={12} />
        )}
        Deactivate
      </button>
    </motion.div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ManagerStaffDutyPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()

  /**
   * FIX 1: Removed `?on_duty=true` — not a recognised backend query param.
   * We fetch all branch staff and filter to is_active === true client-side.
   * Correct endpoint: GET /staff/branch/:branchId  ✓
   */
  const { data: allStaff = [], isLoading, isError, refetch, isFetching } = useQuery<StaffMember[]>({
    queryKey: ["staff", "branch", branchId],
    queryFn: () =>
      apiClient.get<StaffMember[]>(`/staff/branch/${branchId}`),
    enabled: !!branchId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  // Only show active staff on this "on-duty" view
  const staff = allStaff.filter((s) => s.is_active)

  /**
   * FIX 2: PATCH /staff/:id/duty does NOT exist.
   * Correct endpoint: PATCH /staff/:id/toggle-access  ✓
   * The backend toggles is_active server-side; no body is required.
   */
  const { mutate: deactivate, variables: deactivatingId } = useMutation({
    mutationFn: (staffId: string) =>
      apiClient.patch(`/staff/${staffId}/toggle-access`, {}),
    onSuccess: (_, staffId) => {
      qc.invalidateQueries({ queryKey: ["staff", "branch", branchId] })
      const member = allStaff.find((s) => s.id === staffId)
      const firstName = member?.name.split(" ")[0] ?? "Staff"
      toast.success(`${firstName} deactivated`)
    },
    onError: () => toast.error("Failed to update staff status"),
  })

  // Group active staff by role
  const grouped = ROLE_GROUPS.map(({ role, label, icon, accent }) => ({
    role,
    label,
    icon,
    accent,
    members: staff.filter((s) => s.role === role),
  })).filter((g) => g.members.length > 0)

  const totalActive = staff.length

  return (
    <PageWrapper
      title="Active Staff"
      subtitle={`${totalActive} staff member${totalActive !== 1 ? "s" : ""} currently active`}
      action={
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
        </button>
      }
    >
      {/* Role summary chips */}
      {!isLoading && staff.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ROLE_GROUPS.map(({ role, label, icon, accent }) => {
            const count = staff.filter((s) => s.role === role).length
            if (!count) return null
            return (
              <div
                key={role}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold",
                  accent
                )}
              >
                {icon}
                {count} {label}
              </div>
            )
          })}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 gap-3 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm">Failed to load staff data</p>
          <button onClick={() => refetch()} className="text-sm text-[#1A3C5E] hover:underline">Retry</button>
        </div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-gray-400 gap-3">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Users size={28} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium">No active staff members</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ role, label, icon, accent, members }) => (
            <motion.div
              key={role}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Group header */}
              <div className={cn(
                "flex items-center gap-2.5 px-4 py-3 border-b border-gray-50",
                accent.split(" ")[1],
              )}>
                <div className={cn("shrink-0", accent.split(" ")[0])}>{icon}</div>
                <h3 className={cn("text-sm font-bold", accent.split(" ")[0])}>
                  {label}
                </h3>
                <span className={cn(
                  "ml-auto text-xs font-bold px-2 py-0.5 rounded-full",
                  accent
                )}>
                  {members.length}
                </span>
              </div>

              {/* Staff rows */}
              <div className="divide-y divide-gray-50 px-1 py-1">
                <AnimatePresence>
                  {members.map((member) => (
                    <StaffRow
                      key={member.id}
                      member={member}
                      onDeactivate={() => deactivate(member.id)}
                      isUpdating={deactivatingId === member.id}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </PageWrapper>
  )
}