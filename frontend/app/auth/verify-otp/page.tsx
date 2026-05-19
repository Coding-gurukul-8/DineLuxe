"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { ApiError } from "@repo/shared"
import { OTPInput } from "@/components/auth/OTPInput"
import { Button } from "@/components/ui/button"
import { Loader2, Utensils, RefreshCw } from "lucide-react"
import { resendSignupOtp, verifyOtp } from "@/lib/auth-client"
import { getPendingSignup } from "@/lib/auth-storage"
import { getRoleDashboard } from "@/lib/role-routing"
import { useAuth } from "@/hooks/useAuth"

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(60)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useAuth()

  // Resolve email: prefer ?email= query param (set by SignupWizard redirect),
  // fall back to the pending-signup entry in localStorage (set by auth-client).
  const email = useMemo(() => {
    const fromQuery = searchParams.get("email")?.trim()
    if (fromQuery) return fromQuery
    return getPendingSignup()?.email ?? ""
  }, [searchParams])

  // Countdown timer for the resend throttle.
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const getVerifyErrorMessage = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.statusCode === 400) return "Invalid or expired OTP. Please try again."
      if (err.statusCode === 404) return "Account not found. Please sign up again."
      return err.message || "Verification failed. Please try again."
    }
    if (err instanceof Error) return err.message
    return "Something went wrong. Please try again."
  }

  // Called when the user clicks "Verify" or OTPInput fires onComplete.
  // verifyOtp() calls POST /auth/verify-otp, stores new tokens, then fetches
  // /users/me to return the fully hydrated AuthUser.
  const handleVerify = async (value: string) => {
    if (value.length !== 6) return
    setIsLoading(true)
    setError(null)

    try {
      if (!email) {
        throw new Error("Missing email address. Please sign up again.")
      }

      const user = await verifyOtp(email, value)

      // Hydrate global auth state so the rest of the app sees the user
      // immediately without a /users/me refetch.
      setUser(user)

      // Route to the correct dashboard for the verified user's role:
      //   customer         → /customer/home
      //   owner            → /owner/dashboard
      //   delivery_partner → /delivery
      //   (and so on — getRoleDashboard covers all roles)
      router.push(getRoleDashboard(user.role))
    } catch (err) {
      setError(getVerifyErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  // Resend calls POST /auth/send-otp — throttled by the 60-second countdown.
  const handleResend = async () => {
    if (countdown > 0 || isLoading) return
    setIsLoading(true)
    setError(null)

    try {
      await resendSignupOtp(email)
      setCountdown(60)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to resend code."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo / header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-16 h-16 bg-brand-primary rounded-md flex items-center justify-center mx-auto mb-4"
          >
            <Utensils size={32} className="text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
          <p className="text-sm text-gray-500 mt-1">
            {email ? (
              <>
                Enter the 6-digit code sent to{" "}
                <span className="font-medium text-gray-700">{email}</span>
              </>
            ) : (
              "Enter the 6-digit code sent to your email"
            )}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-md shadow-sm border border-gray-100 p-6">
          <div className="space-y-6">
            {/* OTP boxes — onComplete fires handleVerify as soon as 6 digits are entered */}
            <OTPInput
              value={otp}
              onChange={setOtp}
              onComplete={handleVerify}
              error={!!error}
              disabled={isLoading}
            />

            {/* Error message */}
            {error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-red-500 text-center"
              >
                {error}
              </motion.p>
            )}

            {/* Manual verify button (fallback for onComplete) */}
            <Button
              onClick={() => handleVerify(otp)}
              disabled={otp.length !== 6 || isLoading}
              className="w-full h-11 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  Verifying…
                </>
              ) : (
                "Verify"
              )}
            </Button>

            {/* Resend link */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || isLoading}
                className="text-sm text-brand-primary hover:text-brand-primary/80 disabled:text-gray-400 transition-colors"
              >
                {countdown > 0 ? (
                  `Resend in ${countdown}s`
                ) : (
                  <span className="flex items-center justify-center gap-1">
                    <RefreshCw size={14} />
                    Resend code
                  </span>
                )}
              </button>
            </div>

            {/* Skip — only relevant if the backend allows deferred verification */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/customer/home")}
              className="w-full text-gray-500"
            >
              Verify later
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}