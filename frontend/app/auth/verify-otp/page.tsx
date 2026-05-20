"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { ApiError } from "@repo/shared"
import { OTPInput } from "@/components/auth/OTPInput"
import { Button } from "@/components/ui/button"
import { Loader2, Utensils, RefreshCw, ArrowRight } from "lucide-react"
import { resendSignupOtp, verifyOtp } from "@/lib/auth-client"
import { getPendingSignup } from "@/lib/auth-storage"
import { getRoleDashboard } from "@/lib/role-routing"
import { useAuth } from "@/hooks/useAuth"
import type { Role } from "@/lib/constants"

// Maps the ?portal= query param to the fallback (unverified) dashboard path.
// When a user skips OTP, we send them somewhere useful immediately —
// they can verify their email later from their profile settings.
function getSkipDestination(portal: string | null): string {
  switch (portal) {
    case "restaurant": return "/owner/dashboard"
    case "admin":      return "/admin/dashboard"
    default:           return "/customer/home"
  }
}

export default function VerifyOTPPage() {
  const [otp, setOtp]           = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [countdown, setCountdown] = useState(60)
  const router      = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useAuth()

  // Resolve email: prefer ?email= param, fall back to localStorage pending-signup.
  const email = useMemo(() => {
    const fromQuery = searchParams.get("email")?.trim()
    if (fromQuery) return fromQuery
    return getPendingSignup()?.email ?? ""
  }, [searchParams])

  // The portal the user signed up through (customer | restaurant | admin).
  // Used to determine where "Verify later" should send them.
  const portal = searchParams.get("portal")

  // 60-second resend countdown.
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

  // Called when the user enters all 6 digits (auto) or clicks Verify (manual).
  const handleVerify = async (value: string) => {
    if (value.length !== 6) return
    setIsLoading(true)
    setError(null)
    try {
      if (!email) throw new Error("Missing email address. Please sign up again.")
      const user = await verifyOtp(email, value)
      setUser(user)
      router.push(getRoleDashboard(user.role as Role))
    } catch (err) {
      setError(getVerifyErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

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

  // "Verify later" — navigates to the correct portal dashboard without OTP.
  // The user's account is active; they just haven't verified their email yet.
  const handleSkip = () => {
    router.push(getSkipDestination(portal))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header */}
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
            {/* OTP input — fires handleVerify automatically on 6 digits */}
            <OTPInput
              value={otp}
              onChange={setOtp}
              onComplete={handleVerify}
              error={!!error}
              disabled={isLoading}
            />

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

            {/* Verify button */}
            <Button
              onClick={() => handleVerify(otp)}
              disabled={otp.length !== 6 || isLoading}
              className="w-full h-11 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium"
            >
              {isLoading ? (
                <><Loader2 className="animate-spin mr-2" size={18} />Verifying…</>
              ) : (
                "Verify Email"
              )}
            </Button>

            {/* Resend */}
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

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-xs text-gray-400 uppercase bg-white px-2 w-fit mx-auto">
                or
              </div>
            </div>

            {/* Skip / Verify later */}
            <div className="text-center space-y-1">
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkip}
                className="w-full text-gray-500 hover:text-gray-700"
              >
                <ArrowRight size={16} className="mr-2" />
                Skip for now — verify later
              </Button>
              <p className="text-xs text-gray-400">
                You can verify your email anytime from your profile settings.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}