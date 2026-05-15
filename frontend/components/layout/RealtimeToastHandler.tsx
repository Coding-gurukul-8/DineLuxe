"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api-client"
import { useAuth } from "@/hooks/useAuth"

interface NotificationItem {
  id: string
  title: string
  body: string
  created_at: string
  is_read: boolean
  type?: string
}

export function RealtimeToastHandler() {
  const { user } = useAuth()
  const shownIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return

    let active = true

    const pollNotifications = async () => {
      try {
        const result = await apiClient.get<{ data: NotificationItem[]; count: number }>("/notifications")
        if (!active) return
        const items = result.data ?? []
        items
          .filter((item) => !item.is_read && !shownIds.current.has(item.id))
          .forEach((item) => {
            shownIds.current.add(item.id)
            toast.info(item.title, { description: item.body })
          })
      } catch {
        // Ignore notification errors
      }
    }

    pollNotifications()
    const interval = setInterval(pollNotifications, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [user])

  return null
}