"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CustomerRootPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/customer/home")
  }, [router])
  return null
}
