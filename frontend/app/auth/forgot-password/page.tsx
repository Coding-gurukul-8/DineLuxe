"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@repo/shared"
import { forgotPassword, resetPassword } from "@/lib/auth-client"
import { OTPInput } from "@/components/auth/OTPInput"
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter"
import { Loader2, Mail, Lock, ArrowLeft, CheckCircle2, RefreshCw, Utensils } from "lucide-react"
import Link from "next/link"

// ── Schemas ──────────────────────────────────────────────────────────────────
const emailSchema = z.object({ email: z.string().email("Enter a valid email") })
const resetSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type EmailForm = z.infer<typeof emailSchema>
type ResetForm = z.infer<typeof resetSchema>
type Step = "email" | "otp" | "reset" | "success"

// ── Animation variants ────────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any } },
}
const cardVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as any } },
}

const STEPS: Step[] = ["email", "otp", "reset"]
const STEP_LABELS = ["Email", "Verify", "Reset"]
const COUNTDOWN_DURATION = 60

// ── Floating input (same pattern as LoginForm, standalone here) ───────────────
function FloatingInput({
  id, label, type = "text", icon, error, disabled, value, onChange, onBlur,
  name, suffix,
}: {
  id: string; label: string; type?: string; icon: React.ReactNode
  error?: string; disabled?: boolean; value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  name?: string; suffix?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  const hasValue = (value ?? "").length > 0

  return (
    <div>
      <div
        className={`relative rounded-xl border transition-all duration-300 bg-white/60 backdrop-blur-sm
          ${error ? "border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]" : ""}
          ${focused && !error ? "border-[#E8A020] shadow-[0_0_0_3px_rgba(232,160,32,0.12)]" : ""}
          ${!focused && !error ? "border-[#1A3C5E]/12 hover:border-[#1A3C5E]/25" : ""}
        `}
      >
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none
          ${focused ? "text-[#E8A020]" : "text-[#1A3C5E]/30"}`}>
          {icon}
        </div>
        <label
          htmlFor={id}
          className={`absolute left-11 pointer-events-none transition-all duration-200 ease-out
            ${(focused || hasValue) ? "top-2 text-[10px] tracking-wider" : "top-1/2 -translate-y-1/2 text-sm"}
            ${focused ? "text-[#E8A020]" : error ? "text-red-400" : "text-[#1A3C5E]/50"}`}
        >
          {label}
        </label>
        <input
          id={id} name={name} type={type} value={value} disabled={disabled}
          className="w-full bg-transparent pt-6 pb-2 pl-11 pr-11 text-sm text-[#1A3C5E] outline-none rounded-xl placeholder-transparent disabled:opacity-50"
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-xl">
          <motion.div
            className="h-full bg-[#E8A020]"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: focused ? 1 : 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as any }}
          />
        </div>
        {suffix && <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-1.5 ml-1 text-xs text-red-500"
          >{error}</motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email")
  const [direction, setDirection] = useState(1) // 1=forward, -1=back
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [otpError, setOtpError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const router = useRouter()

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) })
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) })
  const newPassword = resetForm.watch("password") ?? ""
  const confirmPassword = resetForm.watch("confirmPassword") ?? ""

  useEffect(() => {
    if (countdown <= 0) return
    const t = setInterval(() => setCountdown((p) => (p <= 1 ? 0 : p - 1)), 1000)
    return () => clearInterval(t)
  }, [countdown])

  const startCountdown = () => setCountdown(COUNTDOWN_DURATION)

  const goTo = (next: Step, dir: number) => {
    setDirection(dir)
    setStep(next)
    setError(null)
  }

  const handleSendOTP = async (data: EmailForm) => {
    setIsLoading(true); setError(null)
    try {
      await forgotPassword(data.email)
      setEmail(data.email)
      goTo("otp", 1)
      startCountdown()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send OTP. Please try again.")
    } finally { setIsLoading(false) }
  }

  const handleVerifyOTP = (value: string) => {
    setOtp(value)
    if (value.length === 6) { setOtpError(false); goTo("reset", 1) }
  }

  const handleResendOTP = async () => {
    if (countdown > 0) return
    setIsLoading(true); setError(null)
    try {
      await forgotPassword(email)
      startCountdown()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to resend OTP.")
    } finally { setIsLoading(false) }
  }

  const handleResetPassword = async (data: ResetForm) => {
    setIsLoading(true); setError(null)
    try {
      await resetPassword(email, otp, data.password)
      goTo("success", 1)
      setTimeout(() => router.push("/auth/login"), 3000)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to reset password."
      setError(msg)
      if (err instanceof ApiError && err.statusCode === 400) setOtpError(true)
    } finally { setIsLoading(false) }
  }

  const activeStepIndex = STEPS.indexOf(step as "email" | "otp" | "reset")

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as any } },
    exit: (dir: number) => ({ x: dir < 0 ? 60 : -60, opacity: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as any } }),
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md"
      >
        {/* Brand */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <Link href="/auth/login" className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="w-9 h-9 rounded-lg bg-[#1A3C5E] flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <Utensils size={18} className="text-[#E8A020]" />
            </div>
            <span className="font-['Playfair_Display',Georgia,serif] text-xl text-[#1A3C5E] tracking-wide">DineLuxe</span>
          </Link>
          <h1 className="font-['Playfair_Display',Georgia,serif] text-3xl text-[#1A3C5E] mb-1.5">
            {step === "success" ? "Password reset" : "Reset password"}
          </h1>
          <p className="text-sm text-[#1A3C5E]/45 tracking-wide">
            {step === "email" && "Enter your email to receive a verification code"}
            {step === "otp" && `Code sent to ${email}`}
            {step === "reset" && "Create a new secure password"}
            {step === "success" && "Your password has been updated"}
          </p>
        </motion.div>

        {/* Glassmorphism card */}
        <motion.div
          variants={cardVariants}
          className="rounded-3xl border border-white/70 overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(26,60,94,0.08), 0 2px 8px rgba(26,60,94,0.04), inset 0 1px 0 rgba(255,255,255,0.8)",
          }}
        >
          {/* Progress dots */}
          {step !== "success" && (
            <div className="flex items-center justify-center gap-2 pt-6 px-8">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1">
                    <motion.div
                      animate={{
                        backgroundColor: i <= activeStepIndex ? "#E8A020" : "rgba(26,60,94,0.1)",
                        scale: i === activeStepIndex ? 1.15 : 1,
                      }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="w-2.5 h-2.5 rounded-full"
                    />
                    <span className={`text-[10px] tracking-wider transition-colors duration-300
                      ${i === activeStepIndex ? "text-[#E8A020]" : i < activeStepIndex ? "text-[#1A3C5E]/50" : "text-[#1A3C5E]/20"}`}>
                      {STEP_LABELS[i]}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <motion.div
                      animate={{ backgroundColor: i < activeStepIndex ? "#E8A020" : "rgba(26,60,94,0.1)" }}
                      transition={{ duration: 0.4 }}
                      className="w-12 h-px mb-3"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step content */}
          <div className="p-8 overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              {/* ── Step 1: Email ── */}
              {step === "email" && (
                <motion.div
                  key="email"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-5"
                >
                  <form onSubmit={emailForm.handleSubmit(handleSendOTP)} className="space-y-5">
                    <FloatingInput
                      id="fp-email" label="Email address" type="email"
                      icon={<Mail size={17} />}
                      error={emailForm.formState.errors.email?.message}
                      disabled={isLoading}
                      value={emailForm.watch("email") ?? ""}
                      {...emailForm.register("email")}
                    />

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="rounded-xl bg-red-50 border border-red-200/80 px-4 py-3"
                        >
                          <p className="text-sm text-red-600">{error}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit" disabled={isLoading}
                      className="w-full h-12 rounded-xl font-medium text-sm tracking-wide text-white transition-opacity disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #1a4a72 100%)" }}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2 text-white/70">
                          <Loader2 size={17} className="animate-spin" />Sending…
                        </span>
                      ) : "Send Verification Code"}
                    </button>

                    <div className="text-center">
                      <Link href="/auth/login"
                        className="inline-flex items-center gap-1.5 text-sm text-[#1A3C5E]/40 hover:text-[#1A3C5E]/70 transition-colors">
                        <ArrowLeft size={14} />Back to sign in
                      </Link>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* ── Step 2: OTP ── */}
              {step === "otp" && (
                <motion.div
                  key="otp"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-6"
                >
                  <div className="text-center">
                    <p className="text-xs text-[#1A3C5E]/40 tracking-wide mb-5">
                      Enter the 6-digit code
                    </p>
                    <OTPInput
                      value={otp}
                      onChange={(v) => { setOtp(v); setOtpError(false); setError(null) }}
                      onComplete={handleVerifyOTP}
                      error={otpError}
                      disabled={isLoading}
                    />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="rounded-xl bg-red-50 border border-red-200/80 px-4 py-3 text-center"
                      >
                        <p className="text-sm text-red-600">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="text-center space-y-3">
                    <button
                      type="button" onClick={handleResendOTP}
                      disabled={countdown > 0 || isLoading}
                      className="inline-flex items-center gap-1.5 text-sm transition-colors"
                    >
                      {countdown > 0 ? (
                        <span className="text-[#1A3C5E]/35 tabular-nums">Resend in {countdown}s</span>
                      ) : (
                        <span className="text-[#E8A020] hover:text-[#E8A020]/80 flex items-center gap-1.5">
                          <RefreshCw size={13} />Resend code
                        </span>
                      )}
                    </button>

                    <div>
                      <button
                        type="button"
                        onClick={() => goTo("email", -1)}
                        className="inline-flex items-center gap-1.5 text-sm text-[#1A3C5E]/40 hover:text-[#1A3C5E]/70 transition-colors"
                      >
                        <ArrowLeft size={14} />Change email
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 3: Reset password ── */}
              {step === "reset" && (
                <motion.div
                  key="reset"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-5"
                >
                  <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="space-y-5">
                    <div className="space-y-1">
                      <FloatingInput
                        id="fp-password" label="New password" type="password"
                        icon={<Lock size={17} />}
                        error={resetForm.formState.errors.password?.message}
                        disabled={isLoading}
                        value={newPassword}
                        {...resetForm.register("password")}
                      />
                      {newPassword && <PasswordStrengthMeter password={newPassword} className="mt-2" />}
                    </div>

                    <div className="space-y-1">
                      <FloatingInput
                        id="fp-confirm" label="Confirm new password" type="password"
                        icon={<Lock size={17} />}
                        error={resetForm.formState.errors.confirmPassword?.message}
                        disabled={isLoading}
                        value={confirmPassword}
                        {...resetForm.register("confirmPassword")}
                      />
                      <AnimatePresence>
                        {confirmPassword && newPassword === confirmPassword && (
                          <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="text-xs text-emerald-600 ml-1 mt-1"
                          >✓ Passwords match</motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="rounded-xl bg-red-50 border border-red-200/80 px-4 py-3"
                        >
                          <p className="text-sm text-red-600">{error}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit" disabled={isLoading}
                      className="w-full h-12 rounded-xl font-medium text-sm tracking-wide text-white transition-opacity disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #1a4a72 100%)" }}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2 text-white/70">
                          <Loader2 size={17} className="animate-spin" />Resetting…
                        </span>
                      ) : "Reset Password"}
                    </button>
                  </form>
                </motion.div>
              )}

              {/* ── Success ── */}
              {step === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="text-center py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-[#E8A020]/15 flex items-center justify-center mx-auto mb-5"
                  >
                    <CheckCircle2 size={32} className="text-[#E8A020]" />
                  </motion.div>
                  <p className="text-sm text-[#1A3C5E]/50">Redirecting to sign in…</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
