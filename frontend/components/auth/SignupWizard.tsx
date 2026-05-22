"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@repo/shared"
import { signup } from "@/lib/auth-client"
import { PasswordStrengthMeter } from "./PasswordStrengthMeter"
import {
  Loader2, User, Mail, Phone, Lock, ChevronRight, ChevronLeft, Check,
  Eye, EyeOff, CheckCircle2, XCircle,
} from "lucide-react"

// ── Schema ────────────────────────────────────────────────────────────────────
const signupSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Enter a valid email"),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type SignupFormValues = z.infer<typeof signupSchema>

// ── Animation variants ─────────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any } },
}

// ── Floating input ─────────────────────────────────────────────────────────────
function FloatingInput({
  id, label, type = "text", icon, error, disabled, suffix,
  registration, onChange: onChangeProp,
}: {
  id: string; label: string; type?: string; icon: React.ReactNode
  error?: string; disabled?: boolean; suffix?: React.ReactNode
  registration: object; onChange?: () => void
}) {
  const [focused, setFocused] = useState(false)
  const [hasValue, setHasValue] = useState(false)

  return (
    <div>
      <div className={`relative rounded-xl border transition-all duration-300 bg-white/60 backdrop-blur-sm
        ${error ? "border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]" : ""}
        ${focused && !error ? "border-[#E8A020] shadow-[0_0_0_3px_rgba(232,160,32,0.12)]" : ""}
        ${!focused && !error ? "border-[#1A3C5E]/12 hover:border-[#1A3C5E]/25" : ""}`}
      >
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none
          ${focused ? "text-[#E8A020]" : "text-[#1A3C5E]/30"}`}>
          {icon}
        </div>
        <label htmlFor={id}
          className={`absolute left-11 pointer-events-none transition-all duration-200 ease-out
            ${(focused || hasValue) ? "top-2 text-[10px] tracking-wider" : "top-1/2 -translate-y-1/2 text-sm"}
            ${focused ? "text-[#E8A020]" : error ? "text-red-400" : "text-[#1A3C5E]/50"}`}>
          {label}
        </label>
        <input
          id={id} type={type} disabled={disabled}
          className="w-full bg-transparent pt-6 pb-2 pl-11 pr-11 text-sm text-[#1A3C5E] outline-none rounded-xl placeholder-transparent disabled:opacity-50"
          {...(registration as object)}
          onFocus={() => setFocused(true)}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
            setFocused(false)
            setHasValue(e.target.value.length > 0)
            ;(registration as { onBlur?: (e: React.FocusEvent) => void }).onBlur?.(e)
          }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setHasValue(e.target.value.length > 0)
            ;(registration as { onChange?: (e: React.ChangeEvent) => void }).onChange?.(e)
            onChangeProp?.()
          }}
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
          <motion.p role="alert"
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-1.5 ml-1 text-xs text-red-500"
          >{error}</motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Step definitions ──────────────────────────────────────────────────────────
const STEP_CONFIG = [
  { title: "Your Profile",      description: "Let's start with your name" },
  { title: "Contact Details",   description: "How can we reach you?" },
  { title: "Secure your account", description: "Create a strong password" },
]

type StepKey = "profile" | "contact" | "password"
const STEPS: StepKey[] = ["profile", "contact", "password"]

// ── Main component ────────────────────────────────────────────────────────────
export function SignupWizard() {
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
  const router = useRouter()

  const {
    register, handleSubmit, watch, trigger,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
  })

  const email = watch("email") ?? ""
  const password = watch("password") ?? ""
  const confirmPassword = watch("confirmPassword") ?? ""

  // Debounced email availability check
  useEffect(() => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus("idle")
      return
    }
    setEmailStatus("checking")
    const t = setTimeout(async () => {
      try {
        // Replace with actual endpoint check if available
        await new Promise((r) => setTimeout(r, 600))
        // Simulated: emails containing "taken" are unavailable
        setEmailStatus(email.includes("taken") ? "taken" : "available")
      } catch {
        setEmailStatus("idle")
      }
    }, 600)
    return () => clearTimeout(t)
  }, [email])

  const goNext = async () => {
    const fieldsPerStep: (keyof SignupFormValues)[][] = [
      ["firstName", "lastName"],
      ["email", "phone"],
      ["password", "confirmPassword"],
    ]
    const valid = await trigger(fieldsPerStep[stepIndex])
    if (!valid) return
    if (stepIndex === 1 && emailStatus === "taken") return
    setDirection(1)
    setStepIndex((i) => i + 1)
  }

  const goBack = () => {
    setDirection(-1)
    setStepIndex((i) => i - 1)
  }

  const onSubmit = async (data: SignupFormValues) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await signup({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
      })
      setIsSuccess(true)
      setTimeout(() => router.push(`/auth/verify-otp?email=${encodeURIComponent(data.email)}&portal=customer`), 800)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.statusCode === 409
          ? "An account with this email already exists."
          : err.message || "An unexpected error occurred. Please try again.")
      } else {
        setError("An unexpected error occurred. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as any } },
    exit: (dir: number) => ({ x: dir < 0 ? 50 : -50, opacity: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as any } }),
  }

  const progressPct = ((stepIndex) / (STEPS.length - 1)) * 100

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-0">
      {/* Progress bar */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="flex justify-between text-[10px] text-[#1A3C5E]/40 tracking-wider uppercase mb-2">
          <span>{STEP_CONFIG[stepIndex].title}</span>
          <span>{stepIndex + 1} / {STEPS.length}</span>
        </div>
        <div className="h-1 rounded-full bg-[#1A3C5E]/8 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#E8A020]"
            animate={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <p className="mt-1.5 text-xs text-[#1A3C5E]/35">{STEP_CONFIG[stepIndex].description}</p>
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="overflow-hidden min-h-65">
          <AnimatePresence mode="wait" custom={direction}>
            {/* ── Step 0: Profile ── */}
            {stepIndex === 0 && (
              <motion.div key="profile" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" className="space-y-4">
                <FloatingInput id="firstName" label="First name" icon={<User size={17} />}
                  error={errors.firstName?.message} disabled={isSubmitting}
                  registration={register("firstName")} />
                <FloatingInput id="lastName" label="Last name" icon={<User size={17} />}
                  error={errors.lastName?.message} disabled={isSubmitting}
                  registration={register("lastName")} />
              </motion.div>
            )}

            {/* ── Step 1: Contact ── */}
            {stepIndex === 1 && (
              <motion.div key="contact" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" className="space-y-4">
                <FloatingInput
                  id="email" label="Email address" type="email" icon={<Mail size={17} />}
                  error={errors.email?.message || (emailStatus === "taken" ? "This email is already taken" : undefined)}
                  disabled={isSubmitting}
                  registration={register("email")}
                  suffix={
                    emailStatus === "checking" ? <Loader2 size={15} className="animate-spin text-[#1A3C5E]/30" /> :
                    emailStatus === "available" ? <CheckCircle2 size={15} className="text-emerald-500" /> :
                    emailStatus === "taken" ? <XCircle size={15} className="text-red-500" /> : null
                  }
                />
                <FloatingInput id="phone" label="Phone number" type="tel" icon={<Phone size={17} />}
                  error={errors.phone?.message} disabled={isSubmitting}
                  registration={register("phone")} />
              </motion.div>
            )}

            {/* ── Step 2: Password ── */}
            {stepIndex === 2 && (
              <motion.div key="password" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" className="space-y-4">
                <div>
                  <FloatingInput id="password" label="Password" type={showPassword ? "text" : "password"}
                    icon={<Lock size={17} />} error={errors.password?.message} disabled={isSubmitting}
                    registration={register("password")}
                    suffix={
                      <button type="button" onClick={() => setShowPassword((v) => !v)}
                        className="text-[#1A3C5E]/30 hover:text-[#E8A020] transition-colors p-1" tabIndex={-1}>
                        <motion.div key={showPassword ? "hide" : "show"} initial={{ opacity: 0, rotate: -15 }} animate={{ opacity: 1, rotate: 0 }} transition={{ duration: 0.2 }}>
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </motion.div>
                      </button>
                    }
                  />
                  {password && <PasswordStrengthMeter password={password} className="mt-3" />}
                </div>

                <div>
                  <FloatingInput id="confirmPassword" label="Confirm password" type={showConfirm ? "text" : "password"}
                    icon={<Lock size={17} />} error={errors.confirmPassword?.message} disabled={isSubmitting}
                    registration={register("confirmPassword")}
                    suffix={
                      <button type="button" onClick={() => setShowConfirm((v) => !v)}
                        className="text-[#1A3C5E]/30 hover:text-[#E8A020] transition-colors p-1" tabIndex={-1}>
                        <motion.div key={showConfirm ? "hide" : "show"} initial={{ opacity: 0, rotate: -15 }} animate={{ opacity: 1, rotate: 0 }} transition={{ duration: 0.2 }}>
                          {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                        </motion.div>
                      </button>
                    }
                  />
                  <AnimatePresence>
                    {confirmPassword && password === confirmPassword && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="mt-1.5 ml-1 text-xs text-emerald-600 flex items-center gap-1">
                        <Check size={11} />Passwords match
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-4 rounded-xl bg-red-50 border border-red-200/80 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className={`mt-6 flex gap-3 ${stepIndex > 0 ? "justify-between" : "justify-end"}`}>
          {stepIndex > 0 && (
            <button type="button" onClick={goBack} disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 h-12 rounded-xl border border-[#1A3C5E]/12 text-sm text-[#1A3C5E]/60 hover:border-[#1A3C5E]/30 hover:text-[#1A3C5E] transition-all duration-200 disabled:opacity-40">
              <ChevronLeft size={16} />Back
            </button>
          )}

          {stepIndex < STEPS.length - 1 ? (
            <button type="button" onClick={goNext}
              className="flex items-center gap-1.5 px-6 h-12 rounded-xl font-medium text-sm tracking-wide text-white transition-all duration-200 ml-auto"
              style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #1a4a72 100%)" }}>
              Continue<ChevronRight size={16} />
            </button>
          ) : (
            <button type="submit" disabled={isSubmitting || isSuccess}
              className="flex items-center justify-center gap-2 px-6 h-12 rounded-xl font-medium text-sm tracking-wide text-white transition-all duration-200 disabled:opacity-50 ml-auto min-w-35"
              style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #1a4a72 100%)" }}>
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.span key="s" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 text-[#E8A020]">
                    <CheckCircle2 size={17} />Done
                  </motion.span>
                ) : isSubmitting ? (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-white/70">
                    <Loader2 size={17} className="animate-spin" />Creating…
                  </motion.span>
                ) : (
                  <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2">
                    <Check size={16} />Create Account
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )}
        </div>
      </form>
    </motion.div>
  )
}
