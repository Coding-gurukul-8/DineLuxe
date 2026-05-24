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
  Loader2, User, Mail, Lock, ShieldCheck,
  Eye, EyeOff, CheckCircle2, Check,
} from "lucide-react"

const adminSignupSchema = z
  .object({
    firstName:       z.string().min(1, "First name is required"),
    lastName:        z.string().min(1, "Last name is required"),
    email:           z.string().email("Enter a valid email"),
    password:        z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type AdminSignupFormValues = z.infer<typeof adminSignupSchema>

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any } },
}

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

export function AdminSignupForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const { register, handleSubmit, watch, formState: { errors } } = useForm<AdminSignupFormValues>({
    resolver: zodResolver(adminSignupSchema),
    mode: "onChange",
  })

  const password = watch("password") ?? ""
  const confirmPassword = watch("confirmPassword") ?? ""

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.statusCode === 409) return "An account with this email already exists."
      return err.message || "An unexpected error occurred. Please try again."
    }
    return "An unexpected error occurred. Please try again."
  }

  const onSubmit = async (data: AdminSignupFormValues) => {
    setIsSubmitting(true); setError(null)
    try {
      await signup({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
      })
      setIsSuccess(true)
      setTimeout(() => router.push(`/auth/verify-otp?email=${encodeURIComponent(data.email)}&portal=admin`), 800)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Progress bar */}
        <motion.div variants={itemVariants} className="mb-2">
          <div className="h-1 rounded-full bg-[#1A3C5E]/8 overflow-hidden">
            <div className="h-full w-full rounded-full bg-[#E8A020]/50" />
          </div>
          <p className="mt-1.5 text-[10px] text-[#1A3C5E]/35 tracking-wider uppercase">Admin Registration</p>
        </motion.div>

        {/* Admin badge */}
        <motion.div variants={itemVariants}
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#1A3C5E]/4 border border-[#1A3C5E]/8">
          <ShieldCheck size={16} className="text-[#E8A020] shrink-0" />
          <p className="text-xs text-[#1A3C5E]/60">
            Platform admin account — grants full system access.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
          <FloatingInput id="adm-firstName" label="First name" icon={<User size={17} />}
            error={errors.firstName?.message} disabled={isSubmitting} registration={register("firstName")} />
          <FloatingInput id="adm-lastName" label="Last name" icon={<User size={17} />}
            error={errors.lastName?.message} disabled={isSubmitting} registration={register("lastName")} />
        </motion.div>

        <motion.div variants={itemVariants}>
          <FloatingInput id="adm-email" label="Email address" type="email" icon={<Mail size={17} />}
            error={errors.email?.message} disabled={isSubmitting} registration={register("email")} />
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-1">
          <FloatingInput id="adm-password" label="Password" type={showPassword ? "text" : "password"}
            icon={<Lock size={17} />} error={errors.password?.message} disabled={isSubmitting}
            registration={register("password")}
            suffix={
              <button type="button" onClick={() => setShowPassword((v) => !v)}
                className="text-[#1A3C5E]/30 hover:text-[#E8A020] transition-colors p-1" tabIndex={-1}>
                <motion.div key={showPassword ? "h" : "s"} initial={{ opacity: 0, rotate: -15 }}
                  animate={{ opacity: 1, rotate: 0 }} transition={{ duration: 0.2 }}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </motion.div>
              </button>
            }
          />
          {password && <PasswordStrengthMeter password={password} className="mt-2" />}
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-1">
          <FloatingInput id="adm-confirm" label="Confirm password" type={showConfirm ? "text" : "password"}
            icon={<Lock size={17} />} error={errors.confirmPassword?.message} disabled={isSubmitting}
            registration={register("confirmPassword")}
            suffix={
              <button type="button" onClick={() => setShowConfirm((v) => !v)}
                className="text-[#1A3C5E]/30 hover:text-[#E8A020] transition-colors p-1" tabIndex={-1}>
                <motion.div key={showConfirm ? "h" : "s"} initial={{ opacity: 0, rotate: -15 }}
                  animate={{ opacity: 1, rotate: 0 }} transition={{ duration: 0.2 }}>
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
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl bg-red-50 border border-red-200/80 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={itemVariants}>
          <button type="submit" disabled={isSubmitting || isSuccess}
            className="w-full h-12 rounded-xl font-medium text-sm tracking-wide text-white transition-all duration-300 disabled:opacity-50 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #1a4a72 100%)" }}>
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.span key="s" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center gap-2 text-[#E8A020]">
                  <CheckCircle2 size={17} />Account Created
                </motion.span>
              ) : isSubmitting ? (
                <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2 text-white/70">
                  <Loader2 size={17} className="animate-spin" />Creating…
                </motion.span>
              ) : (
                <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Create Admin Account
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </motion.div>
      </form>
    </motion.div>
  )
}
