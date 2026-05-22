"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { ApiError } from "@repo/shared"
import { OTPInput } from "@/components/auth/OTPInput"
import { Loader2, Utensils, RefreshCw, ArrowRight, CheckCircle2 } from "lucide-react"
import { resendSignupOtp, verifyOtp } from "@/lib/auth-client"
import { getPendingSignup } from "@/lib/auth-storage"
import { getRoleDashboard } from "@/lib/role-routing"
import { useAuth } from "@/hooks/useAuth"
import type { Role } from "@/lib/constants"
import Link from "next/link"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any } },
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as any } },
}

const COUNTDOWN_DURATION = 60
const RING_CIRCUMFERENCE = 2 * Math.PI * 26 // r=26

function getSkipDestination(portal: string | null): string {
  switch (portal) {
    case "restaurant": return "/owner/dashboard"
    case "admin": return "/admin/dashboard"
    default: return "/customer/home"
  }
}

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_DURATION)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useAuth()

  const email = useMemo(() => {
    const fromQuery = searchParams.get("email")?.trim()
    if (fromQuery) return fromQuery
    return getPendingSignup()?.email ?? ""
  }, [searchParams])

  const portal = searchParams.get("portal")

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  // SVG ring progress: strokeDashoffset goes from 0 (full) to circumference (empty)
  const ringOffset = RING_CIRCUMFERENCE * (1 - countdown / COUNTDOWN_DURATION)

  const getVerifyErrorMessage = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.statusCode === 400) return "Invalid or expired OTP. Please try again."
      if (err.statusCode === 404) return "Account not found. Please sign up again."
      return err.message || "Verification failed. Please try again."
    }
    if (err instanceof Error) return err.message
    return "Something went wrong. Please try again."
  }

  const handleVerify = async (value: string) => {
    if (value.length !== 6) return
    setIsLoading(true)
    setError(null)
    try {
      if (!email) throw new Error("Missing email address. Please sign up again.")
      const user = await verifyOtp(email, value)
      setUser(user)
      setIsSuccess(true)
      setTimeout(() => router.push(getRoleDashboard(user.role as Role)), 800)
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
      setCountdown(COUNTDOWN_DURATION)
      setOtp("")
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

  const handleSkip = () => router.push(getSkipDestination(portal))

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md"
      >
        {/* Brand mark */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <Link href="/auth/login" className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="w-9 h-9 rounded-lg bg-[#1A3C5E] flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <Utensils size={18} className="text-[#E8A020]" />
            </div>
            <span className="font-['Playfair_Display',Georgia,serif] text-xl text-[#1A3C5E] tracking-wide">
              DineLuxe
            </span>
          </Link>
          <h1 className="font-['Playfair_Display',Georgia,serif] text-3xl text-[#1A3C5E] mb-1.5">
            Verify your email
          </h1>
          <p className="text-sm text-[#1A3C5E]/45 tracking-wide">
            {email ? (
              <>Code sent to <span className="text-[#1A3C5E]/70 font-medium">{email}</span></>
            ) : (
              "Enter the 6-digit code sent to your email"
            )}
          </p>
        </motion.div>

        {/* Glassmorphism card */}
        <motion.div
          variants={cardVariants}
          className="rounded-3xl border border-white/70 p-8"
          style={{
            background: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(26,60,94,0.08), 0 2px 8px rgba(26,60,94,0.04), inset 0 1px 0 rgba(255,255,255,0.8)",
          }}
        >
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as any }}
                className="text-center py-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                  className="w-16 h-16 rounded-full bg-[#E8A020]/15 flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle2 size={32} className="text-[#E8A020]" />
                </motion.div>
                <h2 className="font-['Playfair_Display',Georgia,serif] text-2xl text-[#1A3C5E] mb-1">
                  Verified!
                </h2>
                <p className="text-sm text-[#1A3C5E]/50">Redirecting to your dashboard…</p>
              </motion.div>
            ) : (
              <motion.div key="form" className="space-y-6">
                {/* Countdown ring + OTP boxes */}
                <div className="flex flex-col items-center gap-6">
                  {/* SVG countdown ring */}
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
                      {/* Track */}
                      <circle
                        cx="32" cy="32" r="26"
                        fill="none"
                        stroke="rgba(26,60,94,0.08)"
                        strokeWidth="3"
                      />
                      {/* Progress */}
                      <circle
                        cx="32" cy="32" r="26"
                        fill="none"
                        stroke="#E8A020"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={ringOffset}
                        style={{ transition: "stroke-dashoffset 1s linear" }}
                      />
                    </svg>
                    <span className="absolute text-sm font-bold text-[#1A3C5E] tabular-nums">
                      {countdown}
                    </span>
                  </div>

                  {/* OTP Input boxes */}
                  <OTPInput
                    value={otp}
                    onChange={(v) => { setOtp(v); if (error) setError(null) }}
                    onComplete={handleVerify}
                    error={!!error}
                    disabled={isLoading}
                  />
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      role="alert"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-xl bg-red-50 border border-red-200/80 px-4 py-3 text-center"
                    >
                      <p className="text-sm text-red-600">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Verify button */}
                <button
                  onClick={() => handleVerify(otp)}
                  disabled={otp.length !== 6 || isLoading}
                  className="relative w-full h-12 rounded-xl font-medium text-sm tracking-wide transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #1a4a72 100%)" }}
                >
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2 text-white/70"
                      >
                        <Loader2 size={17} className="animate-spin" />
                        Verifying…
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-white"
                      >
                        Verify Email
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                {/* Resend */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={countdown > 0 || isLoading}
                    className="inline-flex items-center gap-1.5 text-sm transition-colors duration-200 disabled:text-[#1A3C5E]/30 text-[#E8A020] hover:text-[#E8A020]/80"
                  >
                    {countdown > 0 ? (
                      <span className="text-[#1A3C5E]/35 tabular-nums">Resend in {countdown}s</span>
                    ) : (
                      <>
                        <RefreshCw size={13} />
                        Resend code
                      </>
                    )}
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[#1A3C5E]/8" />
                  <span className="text-xs text-[#1A3C5E]/30 tracking-wider uppercase">or</span>
                  <div className="flex-1 h-px bg-[#1A3C5E]/8" />
                </div>

                {/* Skip */}
                <div className="text-center space-y-1">
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="inline-flex items-center gap-1.5 text-sm text-[#1A3C5E]/40 hover:text-[#1A3C5E]/70 transition-colors"
                  >
                    <ArrowRight size={14} />
                    Skip for now — verify later
                  </button>
                  <p className="text-xs text-[#1A3C5E]/30">
                    You can verify your email anytime from your profile settings.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  )
}
