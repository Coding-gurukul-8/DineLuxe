"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function WaiterDashboardPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/staff/waiter")
  }, [router])

  return null
}

