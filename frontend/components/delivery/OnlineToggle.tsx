"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"

export default function OnlineToggle({
  partnerId,
  initialStatus,
  className,
}: {
  partnerId: string
  initialStatus: boolean
  className?: string
}) {
  const [isOnline, setIsOnline] = useState(initialStatus)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setIsOnline(initialStatus)
  }, [initialStatus])

  const save = async (next: boolean) => {
    const previous = isOnline
    setIsSaving(true)
    setIsOnline(next)

    try {
      await apiClient.patch(`/delivery/partner/online`, {
        is_online: next,
        partner_id: partnerId,
      })
      toast.success(next ? "You are now online" : "You are now offline")
    } catch {
      setIsOnline(previous)
      toast.error("Failed to update delivery status")
    } finally {
      setIsSaving(false)
    }
  }

  const toggle = () => {
    if (isSaving) return

    if (isOnline) {
      setConfirmOpen(true)
      return
    }

    void save(true)
  }

  const goOffline = async () => {
    setConfirmOpen(false)
    await save(false)
  }

  return (
    <>
      <div
        className={
          className ??
          "inline-flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
        }
      >
        <button type="button" aria-label="Toggle delivery partner online status" onClick={toggle} disabled={isSaving} className="flex items-center gap-3">
          <div
            className={
              "relative flex h-10 w-20 items-center rounded-full px-1 transition-colors duration-200 " +
              (isOnline ? "bg-green-600" : "bg-gray-200")
            }
          >
            <motion.div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow"
              animate={{ x: isOnline ? 36 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            />

            {isOnline && (
              <span className="absolute right-2 top-1.5 inline-flex h-2.5 w-2.5 rounded-full bg-green-300">
                <span className="absolute inset-0 animate-ping rounded-full bg-green-300 opacity-60" />
              </span>
            )}
          </div>

          <div className="text-left">
            <p className="text-[11px] font-extrabold tracking-wider text-gray-500">STATUS</p>
            <p className="text-sm font-black text-gray-900">{isOnline ? "ONLINE" : "OFFLINE"}</p>
          </div>
        </button>
      </div>

      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setConfirmOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-gray-900">Go offline?</p>
              <p className="mt-2 text-xs text-gray-500">
                You won&apos;t receive new deliveries while offline.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-10" onClick={() => setConfirmOpen(false)} type="button">
                  Stay Online
                </Button>
                <Button className="h-10 bg-red-600 hover:bg-red-700" onClick={goOffline} type="button">
                  Go Offline
                </Button>
              </div>

              {isSaving && <p className="mt-3 text-xs text-gray-400">Updating…</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

