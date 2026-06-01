"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HostDashboardPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/staff/host")
  }, [router])

  return null
}

