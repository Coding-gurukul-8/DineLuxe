"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CashierDashboardPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/staff/cashier")
  }, [router])

  return null
}

