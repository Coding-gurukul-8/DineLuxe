"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@repo/shared"
import { signup } from "@/lib/auth-client"
import { PasswordStrengthMeter } from "./PasswordStrengthMeter"
import {
  Loader2, User, Mail, Phone, Lock,
  ChevronRight, ChevronLeft, Check, Store, Eye, EyeOff, CheckCircle2,
} from "lucide-react"

const restaurantSignupSchema = z
  .object({
    firstName:       z.string().min(1, "First name is required"),
    lastName:        z.string().min(1, "Last name is required"),
    email:           z.string().email("Enter a valid email"),
    phone:           z.string().min(10, "Phone must be at least 10 digits"),
    password:        z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type RestaurantSignupFormValues = z.infer<typeof restaurantSignupSchema>

function FloatingInput({
  id, label, type = "text", icon, error, disabled, registration, onChange: onChangeProp, suffix,
}: {
  id: string; label: string; type?: string; icon: React.ReactNode
  error?: string; disabled?: boolean; registration: object
  onChange?: () => void; suffix?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  const [hasValue, setHasValue] = useState(false)

  return (
    <div>
      <div className={`relative rounded-xl border transition-all duration-300 bg-white/60 backdrop-blur-sm
        ${error ? "border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]" : ""}
        ${focused && !error ? "border-[#E8A020] shadow-[0_0_0_3px_rgba(232,160,32,0.12)]" : ""}
        ${!focused && !error ? "border-[#1A3C5E]/12 hover:border-[#1A3C5E]/25" : ""}`}>
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none
          ${focused ? "text-[#E8A020]" : "text-[#1A3C5E]/30"}`}>{icon}</div>
        <label htmlFor={id}
          className={`absolute left-11 pointer-events-none transition-all duration-200 ease-out
            ${(focused || hasValue) ? "top-2 text-[10px] tracking-wider" : "top-1/2 -translate-y-1/2 text-sm"}
            ${focused ? "text-[#E8A020]" : error ? "text-red-400" : "text-[#1A3C5E]/50"}`}>
          {label}
        </label>
        <input id={id} type={type} disabled={disabled}
          className="w-full bg-transparent pt-6 pb-2 pl-11 pr-11 text-sm text-[#1A3C5E] outline-none rounded-xl placeholder-transparent disabled:opacity-50"
          {...(registration as object)}
          onFocus={() => setFocused(true)}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
            setFocused(false); setHasValue(e.target.value.length > 0)
            ;(registration as { onBlur?: (e: React.FocusEvent) => void }).onBlur?.(e)
          }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setHasValue(e.target.value.length > 0)
            ;(registration as { onChange?: (e: React.ChangeEvent) => void }).onChange?.(e)
            onChangeProp?.()
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-xl">
          <motion.div className="h-full bg-[#E8A020]" initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: focused ? 1 : 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as any }} />
        </div>
        {suffix && <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-1.5 ml-1 text-xs text-red-500">{error}</motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

const STEPS = [
  { title: "Personal Details",  description: "Tell us about yourself (the account owner)" },
  { title: "Security Setup",    description: "Create a strong password for your account" },
]

export function RestaurantSignupWizard() {
  const [step, setStep]       = useState(0)
  const [direction, setDir]   = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const router = useRouter()

  const { register, handleSubmit, trigger, watch, formState: { errors } } = useForm<RestaurantSignupFormValues>({
    resolver: zodResolver(restaurantSignupSchema),
    mode: "onChange",
  })

  const password = watch("password") ?? ""
  const confirmPassword = watch("confirmPassword") ?? ""

  const handleNext = async () => {
    const step0Fields: (keyof RestaurantSignupFormValues)[] = ["firstName", "lastName", "email", "phone"]
    const valid = await trigger(step === 0 ? step0Fields : ["password", "confirmPassword"])
    if (valid) { setDir(1); setStep((p) => p + 1); setError(null) }
  }

  const handleBack = () => { setDir(-1); setStep((p) => p - 1); setError(null) }

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.statusCode === 409) return "An account with this email already exists."
      return err.message || "An unexpected error occurred. Please try again."
    }
    return "An unexpected error occurred. Please try again."
  }

  const onSubmit = async (data: RestaurantSignupFormValues) => {
    setIsSubmitting(true); setError(null)
    try {
      const result = await signup({
        email: data.email, password: data.password,
        firstName: data.firstName, lastName: data.lastName, phone: data.phone,
      })
      setIsSuccess(true)
      const dest = (result as { verification_pending?: boolean }).verification_pending
        ? `/auth/verify-otp?email=${encodeURIComponent(data.email)}&portal=restaurant`
        : "/owner/dashboard"
      setTimeout(() => router.push(dest), 800)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as any } },
    exit: (dir: number) => ({ x: dir < 0 ? 50 : -50, opacity: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as any } }),
  }

  return (
    <div className="space-y-0">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-[10px] text-[#1A3C5E]/40 tracking-wider uppercase mb-2">
          <span>{STEPS[step].title}</span>
          <span>{step + 1} / {STEPS.length}</span>
        </div>
        <div className="h-1 rounded-full bg-[#1A3C5E]/8 overflow-hidden">
          <motion.div className="h-full rounded-full bg-[#E8A020]"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
        </div>
        <p className="mt-1.5 text-xs text-[#1A3C5E]/35">{STEPS[step].description}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="overflow-hidden min-h-60">
          <AnimatePresence mode="wait" custom={direction}>
            {/* Step 0: Personal */}
            {step === 0 && (
              <motion.div key="personal" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FloatingInput id="rst-firstName" label="First name" icon={<User size={17} />}
                    error={errors.firstName?.message} disabled={isSubmitting} registration={register("firstName")} />
                  <FloatingInput id="rst-lastName" label="Last name" icon={<User size={17} />}
                    error={errors.lastName?.message} disabled={isSubmitting} registration={register("lastName")} />
                </div>
                <FloatingInput id="rst-email" label="Email address" type="email" icon={<Mail size={17} />}
                  error={errors.email?.message} disabled={isSubmitting} registration={register("email")} />
                <FloatingInput id="rst-phone" label="Phone number" type="tel" icon={<Phone size={17} />}
                  error={errors.phone?.message} disabled={isSubmitting} registration={register("phone")} />
              </motion.div>
            )}

            {/* Step 1: Security */}
            {step === 1 && (
              <motion.div key="security" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" className="space-y-4">
                <div className="space-y-1">
                  <FloatingInput id="rst-password" label="Password" type={showPassword ? "text" : "password"}
                    icon={<Lock size={17} />} error={errors.password?.message} disabled={isSubmitting}
                    registration={register("password")}
                    suffix={
                      <button type="button" onClick={() => setShowPassword((v) => !v)}
                        className="text-[#1A3C5E]/30 hover:text-[#E8A020] transition-colors p-1" tabIndex={-1}>
                        <motion.div key={showPassword ? "h" : "s"} initial={{ opacity: 0, rotate: -15 }} animate={{ opacity: 1, rotate: 0 }} transition={{ duration: 0.2 }}>
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </motion.div>
                      </button>
                    }
                  />
                  {password && <PasswordStrengthMeter password={password} className="mt-2" />}
                </div>

                <div className="space-y-1">
                  <FloatingInput id="rst-confirm" label="Confirm password" type={showConfirm ? "text" : "password"}
                    icon={<Lock size={17} />} error={errors.confirmPassword?.message} disabled={isSubmitting}
                    registration={register("confirmPassword")}
                    suffix={
                      <button type="button" onClick={() => setShowConfirm((v) => !v)}
                        className="text-[#1A3C5E]/30 hover:text-[#E8A020] transition-colors p-1" tabIndex={-1}>
                        <motion.div key={showConfirm ? "h" : "s"} initial={{ opacity: 0, rotate: -15 }} animate={{ opacity: 1, rotate: 0 }} transition={{ duration: 0.2 }}>
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

        <AnimatePresence>
          {error && (
            <motion.div role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-4 rounded-xl bg-red-50 border border-red-200/80 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`mt-6 flex gap-3 ${step > 0 ? "justify-between" : "justify-end"}`}>
          {step > 0 && (
            <button type="button" onClick={handleBack} disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 h-12 rounded-xl border border-[#1A3C5E]/12 text-sm text-[#1A3C5E]/60 hover:border-[#1A3C5E]/30 hover:text-[#1A3C5E] transition-all duration-200 disabled:opacity-40">
              <ChevronLeft size={16} />Back
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button type="button" onClick={handleNext}
              className="flex items-center gap-1.5 px-6 h-12 rounded-xl font-medium text-sm tracking-wide text-white ml-auto"
              style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #1a4a72 100%)" }}>
              Continue<ChevronRight size={16} />
            </button>
          ) : (
            <button type="submit" disabled={isSubmitting || isSuccess}
              className="flex items-center justify-center gap-2 px-6 h-12 rounded-xl font-medium text-sm tracking-wide text-white disabled:opacity-50 ml-auto min-w-40"
              style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #1a4a72 100%)" }}>
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.span key="s" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 text-[#E8A020]">
                    <CheckCircle2 size={17} />Done!
                  </motion.span>
                ) : isSubmitting ? (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-white/70">
                    <Loader2 size={17} className="animate-spin" />Creating…
                  </motion.span>
                ) : (
                  <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2">
                    <Store size={16} />Create Account
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
