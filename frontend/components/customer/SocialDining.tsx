"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  Users,
  Link2,
  Check,
  Copy,
  Clock,
  ChevronRight,
  Loader2,
  Crown,
  UserPlus,
  Utensils,
  PartyPopper,
  QrCode,
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupMember {
  id: string
  name: string
  is_organizer: boolean
  pre_order_status: "ordered" | "pending"
  joined_at: string
}

interface SocialDiningGroup {
  id: string
  booking_id: string
  invite_code: string
  members: GroupMember[]
  max_members: number
  created_at: string
}

interface SocialDiningProps {
  bookingId: string
  isOrganizer: boolean
  inviteCode?: string        // pre-fills the join input if arriving via share link
}

type Mode = "idle" | "create" | "join" | "group_view"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildShareUrl(code: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://dineluxe.app"
  return `${base}/join/${code}`
}

function formatCode(raw: string): string {
  // Ensure display as "DINE-XXXXXX"
  const clean = raw.toUpperCase().replace(/^DINE-/, "")
  return `DINE-${clean}`
}

// ─── Member Avatar ────────────────────────────────────────────────────────────

function MemberChip({ member }: { member: GroupMember }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm"
    >
      <div className="relative">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
            member.is_organizer
              ? "bg-[#1A3C5E] text-white"
              : "bg-gray-100 text-gray-600"
          )}
        >
          {member.name.charAt(0).toUpperCase()}
        </div>
        {member.is_organizer && (
          <Crown
            size={9}
            className="absolute -top-1 -right-1 text-[#E8A020] fill-[#E8A020]"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate">
          {member.name}
          {member.is_organizer && (
            <span className="ml-1.5 text-[10px] text-gray-400 font-normal">Organizer</span>
          )}
        </p>
      </div>
      <div
        className={cn(
          "shrink-0 flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5",
          member.pre_order_status === "ordered"
            ? "bg-emerald-50 text-emerald-600"
            : "bg-amber-50 text-amber-600"
        )}
      >
        {member.pre_order_status === "ordered" ? (
          <>
            <Check size={9} /> Ordered
          </>
        ) : (
          <>
            <Clock size={9} /> Pending
          </>
        )}
      </div>
    </motion.div>
  )
}

// ─── Invite Code Display ──────────────────────────────────────────────────────

function InviteCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const shareUrl = buildShareUrl(code.replace(/^DINE-/, ""))

  const copyCode = async () => {
    await navigator.clipboard.writeText(formatCode(code))
    setCopied(true)
    toast.success("Code copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(`Join my table: ${shareUrl}`)
    setCopiedLink(true)
    toast.success("Link copied to clipboard!")
    setTimeout(() => setCopiedLink(false), 2500)
  }

  return (
    <div className="bg-[#1A3C5E]/4 border border-[#1A3C5E]/10 rounded-2xl p-4 text-center space-y-3">
      <p className="text-xs text-gray-500 font-medium">Your invite code</p>
      <div className="flex items-center justify-center gap-2">
        <span className="font-mono text-2xl font-black tracking-widest text-[#1A3C5E] select-all">
          {formatCode(code)}
        </span>
        <button
          onClick={copyCode}
          className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30 transition-all shadow-sm"
          aria-label="Copy code"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        </button>
      </div>
      <button
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1A3C5E] hover:text-[#1A3C5E]/70 transition-colors"
      >
        {copiedLink ? (
          <>
            <Check size={12} className="text-emerald-500" />
            <span className="text-emerald-600">Link copied!</span>
          </>
        ) : (
          <>
            <Link2 size={12} />
            Copy invite link
          </>
        )}
      </button>
    </div>
  )
}

// ─── Group View ───────────────────────────────────────────────────────────────

function GroupView({
  group,
  bookingId,
  isOrganizer,
}: {
  group: SocialDiningGroup
  bookingId: string
  isOrganizer: boolean
}) {
  const emptySlots = Math.max(0, group.max_members - group.members.length)

  return (
    <div className="space-y-5">
      {/* Invite code — always visible for organizer, also shown to members */}
      <InviteCodeBlock code={group.invite_code} />

      {/* Members */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
          Your Group · {group.members.length}/{group.max_members} joined
        </p>
        <div className="space-y-2">
          {group.members.map((m) => (
            <MemberChip key={m.id} member={m} />
          ))}

          {/* Empty slots */}
          {emptySlots > 0 && (
            <div className="flex items-center gap-2.5 border border-dashed border-gray-200 rounded-xl px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center">
                <UserPlus size={13} className="text-gray-300" />
              </div>
              <p className="text-xs text-gray-400">
                {emptySlots} spot{emptySlots !== 1 ? "s" : ""} remaining
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pre-order section */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Utensils size={14} className="text-[#E8A020]" />
          <p className="text-sm font-bold text-gray-800">Pre-order Together</p>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Your food will be ready the moment you arrive.
        </p>
        <Button
          size="sm"
          onClick={() => {
            // Opens menu sheet / navigates to menu — handled by parent page
            toast.info("Opening menu…")
          }}
          className="w-full h-9 text-xs rounded-xl bg-[#1A3C5E] text-white hover:bg-[#15304d]"
        >
          <Utensils size={13} />
          Add My Pre-order
          <ChevronRight size={12} />
        </Button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SocialDining({ bookingId, isOrganizer, inviteCode }: SocialDiningProps) {
  const [mode, setMode] = useState<Mode>("idle")
  const [group, setGroup] = useState<SocialDiningGroup | null>(null)
  const [joinCode, setJoinCode] = useState(inviteCode ?? "")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch existing group ──────────────────────────────────────────────────
  const {
    data: existingGroup,
    isLoading: checkingGroup,
    isError: groupLookupFailed,
  } = useQuery<SocialDiningGroup>({
    queryKey: ["social-dining", bookingId],
    queryFn: () =>
      apiClient.get<SocialDiningGroup>(`/social-dining/booking/${bookingId}`),
    enabled: !!bookingId,
    retry: false,
  })

  useEffect(() => {
    if (!existingGroup) return
    setGroup(existingGroup)
    setMode("group_view")
  }, [existingGroup])

  useEffect(() => {
    if (checkingGroup || !groupLookupFailed) return
    // No group yet — show create/join prompt
    setMode(isOrganizer ? "idle" : inviteCode ? "join" : "idle")
  }, [checkingGroup, groupLookupFailed, isOrganizer, inviteCode])

  // ── Poll for member updates every 10s when group is active ────────────────
  const refreshGroup = useCallback(() => {
    if (!group?.id) return
    apiClient
      .get<SocialDiningGroup>(`/social-dining/booking/${bookingId}`)
      .then(setGroup)
      .catch(() => {})
  }, [group?.id, bookingId])

  useEffect(() => {
    if (mode !== "group_view") {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }
    pollRef.current = setInterval(refreshGroup, 10_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [mode, refreshGroup])

  // ── Create group ──────────────────────────────────────────────────────────
  const createGroup = useMutation({
    mutationFn: () =>
      apiClient.post<SocialDiningGroup>("/social-dining", {
        booking_id: bookingId,
      }),
    onSuccess: (data) => {
      setGroup(data)
      setMode("group_view")
      toast.success("Group created! Share the code with your friends.")
    },
    onError: () => toast.error("Couldn't create group. Please try again."),
  })

  // ── Join group ────────────────────────────────────────────────────────────
  const joinGroup = useMutation({
    mutationFn: () => {
      const clean = joinCode.replace(/^DINE-/i, "").trim()
      return apiClient.post<SocialDiningGroup>(`/social-dining/join/${clean}`, {
        booking_id: bookingId,
      })
    },
    onSuccess: (data) => {
      setGroup(data)
      setMode("group_view")
      toast.success("You've joined the group!")
    },
    onError: () => toast.error("Invalid code or group is full."),
  })

  // ── Loading ───────────────────────────────────────────────────────────────
  if (checkingGroup) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center justify-center gap-2 text-gray-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Checking for group…</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Top accent */}
      <div className="h-0.5 bg-linear-to-r from-[#1A3C5E]/20 via-[#E8A020]/60 to-[#1A3C5E]/20" />

      {/* Header */}
      <div className="px-5 pt-4 pb-4 border-b border-gray-50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#1A3C5E]/8 flex items-center justify-center">
            <Users size={17} className="text-[#1A3C5E]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Social Dining</h3>
            <p className="text-xs text-gray-400 mt-0.5">Invite friends & pre-order together</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5">
        <AnimatePresence mode="wait" initial={false}>

          {/* ── Group view ── */}
          {mode === "group_view" && group && (
            <motion.div
              key="group_view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <GroupView
                group={group}
                bookingId={bookingId}
                isOrganizer={isOrganizer}
              />
            </motion.div>
          )}

          {/* ── Idle / Create prompt (organizer) ── */}
          {mode === "idle" && isOrganizer && (
            <motion.div
              key="create_prompt"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="text-center space-y-4 py-2"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#1A3C5E]/6 flex items-center justify-center mx-auto">
                <PartyPopper size={28} className="text-[#1A3C5E]" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900 mb-1.5">
                  Invite Friends to Your Table
                </h4>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                  Let friends join your booking and pre-order together. Food will be ready when you arrive!
                </p>
              </div>

              <Button
                onClick={() => createGroup.mutate()}
                disabled={createGroup.isPending}
                className="w-full h-11 rounded-xl bg-[#1A3C5E] text-white hover:bg-[#15304d] text-sm font-semibold"
              >
                {createGroup.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <>
                    <Users size={15} />
                    Create Group
                  </>
                )}
              </Button>

              {/* Also allow joining another group */}
              <button
                onClick={() => setMode("join")}
                className="text-xs text-gray-400 hover:text-[#1A3C5E] transition-colors"
              >
                Have an invite code? Join instead
              </button>
            </motion.div>
          )}

          {/* ── Idle (non-organizer with no invite code) ── */}
          {mode === "idle" && !isOrganizer && !inviteCode && (
            <motion.div
              key="join_prompt"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="text-center space-y-4 py-2"
            >
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto border border-dashed border-gray-200">
                <QrCode size={24} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-500">
                Have an invite code from your organizer?
              </p>
              <Button
                onClick={() => setMode("join")}
                variant="outline"
                className="w-full h-10 rounded-xl text-sm border-[#1A3C5E]/20 text-[#1A3C5E] hover:border-[#1A3C5E]/40"
              >
                Join a Group
              </Button>
            </motion.div>
          )}

          {/* ── Join view ── */}
          {mode === "join" && (
            <motion.div
              key="join_view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#1A3C5E]/6 flex items-center justify-center mx-auto mb-3">
                  <UserPlus size={20} className="text-[#1A3C5E]" />
                </div>
                <h4 className="text-sm font-bold text-gray-900">Join a Dining Group</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Enter the invite code shared by your friend
                </p>
              </div>

              <div className="space-y-2">
                <Input
                  placeholder="e.g. DINE-ABC123"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && joinCode.trim()) joinGroup.mutate()
                  }}
                  className="text-center font-mono text-base font-bold tracking-widest h-12 rounded-xl"
                  autoFocus
                />
                <Button
                  onClick={() => joinGroup.mutate()}
                  disabled={!joinCode.trim() || joinGroup.isPending}
                  className="w-full h-11 rounded-xl bg-[#1A3C5E] text-white hover:bg-[#15304d] text-sm font-semibold disabled:opacity-50"
                >
                  {joinGroup.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <>
                      <UserPlus size={15} />
                      Join Group
                    </>
                  )}
                </Button>
              </div>

              {isOrganizer && (
                <button
                  onClick={() => setMode("idle")}
                  className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
                >
                  ← Back
                </button>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

export default SocialDining