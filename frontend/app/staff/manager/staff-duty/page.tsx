"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  RefreshCw, Clock, UserMinus, AlertCircle,
  Users, ChefHat, UtensilsCrossed, CreditCard,
  ConciergeBell, Loader2, UserCheck,
} from "lucide-react"
import { toast } from "sonner"
import { PageWrapper } from "@/components/layout/PageWrapper"
import { RoleBadge } from "@/components/shared/RoleBadge"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"
import { formatDate, cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

type StaffRole = "waiter" | "chef" | "cashier" | "host" | "manager" | "delivery"

interface StaffMember {
  id: string
  first_name: string
  last_name: string
  role: StaffRole
  on_duty: boolean
  duty_start?: string
  email: string
}

// ── Role group config ──────────────────────────────────────────────────────────

const ROLE_GROUPS: {
  role: StaffRole | "manager"
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function elapsedSince(iso?: string): string {
  if (!iso) return "—"
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ── Staff Row ──────────────────────────────────────────────────────────────────

function StaffRow({
  member,
  onMarkOff,
  isMarking,
}: {
  member: StaffMember
  onMarkOff: () => void
  isMarking: boolean
}) {
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
        {member.first_name[0]}{member.last_name[0]}
      </div>

      {/* Name + role */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {member.first_name} {member.last_name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{member.email}</p>
      </div>

      {/* Duty time */}
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 shrink-0">
        <Clock size={11} />
        {elapsedSince(member.duty_start)} on duty
      </div>

      {/* Mark off duty */}
      <button
        onClick={onMarkOff}
        disabled={isMarking}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-600 border border-red-100 text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50 shrink-0"
      >
        {isMarking ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <UserMinus size={12} />
        )}
        Off Duty
      </button>
    </motion.div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ManagerStaffDutyPage() {
  const { branchId } = useAuth()
  const qc = useQueryClient()

  const { data: staff = [], isLoading, isError, refetch, isFetching } = useQuery<StaffMember[]>({
    queryKey: ["staff", "duty", branchId],
    queryFn: () =>
      apiClient.get<StaffMember[]>(`/staff/branch/${branchId}?on_duty=true`),
    enabled: !!branchId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const { mutate: markOff, variables: markingId } = useMutation({
    mutationFn: (staffId: string) =>
      apiClient.patch(`/staff/${staffId}/duty`, { on_duty: false }),
    onSuccess: (_, staffId) => {
      qc.invalidateQueries({ queryKey: ["staff", "duty", branchId] })
      const member = staff.find((s) => s.id === staffId)
      toast.success(`${member?.first_name ?? "Staff"} marked off duty`)
    },
    onError: () => toast.error("Failed to update duty status"),
  })

  // Group by role
  const grouped = ROLE_GROUPS.map(({ role, label, icon, accent }) => ({
    role,
    label,
    icon,
    accent,
    members: staff.filter((s) => s.role === (role as StaffRole)),
  })).filter((g) => g.members.length > 0)

  const totalOnDuty = staff.length

  return (
    <PageWrapper
      title="Staff on Duty"
      subtitle={`${totalOnDuty} staff member${totalOnDuty !== 1 ? "s" : ""} currently on shift`}
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
          <p className="text-sm font-medium">No staff currently on duty</p>
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
                accent.split(" ")[1], // bg class
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
                      onMarkOff={() => markOff(member.id)}
                      isMarking={markingId === member.id}
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