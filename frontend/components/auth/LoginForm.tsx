"use client"

import { useState, type ReactNode } from "react"
import { motion, AnimatePresence, type Variants } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm, type UseFormRegister } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@repo/shared"
import { login } from "@/lib/auth-client"
import { getRoleDashboard, isAllowedRedirect } from "@/lib/role-routing"
import { useAuth } from "@/hooks/useAuth"
import { Loader2, Eye, EyeOff, Mail, Lock, CheckCircle2 } from "lucide-react"

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
})

type LoginFormValues = z.infer<typeof loginSchema>

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
} satisfies Variants

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
} satisfies Variants

interface FloatingInputProps {
  id: string
  label: string
  type?: string
  icon: ReactNode
  error?: string
  disabled?: boolean
  registration: ReturnType<UseFormRegister<LoginFormValues>>
  suffix?: ReactNode
  onChange?: () => void
}

function FloatingInput({ id, label, type = "text", icon, error, disabled, registration, suffix, onChange }: FloatingInputProps) {
  const [focused, setFocused] = useState(false)
  const [hasValue, setHasValue] = useState(false)

  return (
    <div className="relative">
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
            ${focused ? "text-[#E8A020]" : error ? "text-red-400" : "text-[#1A3C5E]/50"}
          `}
        >
          {label}
        </label>

        <input
          id={id}
          type={type}
          disabled={disabled}
          className="w-full bg-transparent pt-6 pb-2 pl-11 pr-11 text-sm text-[#1A3C5E] outline-none rounded-xl placeholder-transparent disabled:opacity-50"
          {...registration}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false)
            setHasValue(e.target.value.length > 0)
            registration.onBlur?.(e)
          }}
          onChange={(e) => {
            setHasValue(e.target.value.length > 0)
            registration.onChange?.(e)
            onChange?.()
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-xl">
          <motion.div
            className="h-full bg-[#E8A020]"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: focused ? 1 : 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
          />
        </div>

        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {suffix}
          </div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="mt-1.5 ml-1 text-xs text-red-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const clearAuthError = () => { if (error) setError(null) }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const getLoginErrorMessage = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.statusCode === 401) return "Invalid email or password."
      if (err.statusCode === 403) return "Account is disabled. Please contact your manager."
      if (err.statusCode === 429) return "Too many attempts. Try again in 15 minutes."
      return err.message || "Unable to sign in. Please try again."
    }
    if (err instanceof Error) {
      return err.message === "Failed to fetch"
        ? "Unable to reach the server. Check your connection and try again."
        : err.message
    }
    return "Unable to sign in. Please try again."
  }

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true)
    setError(null)
    try {
      const user = await login({ identifier: data.identifier, password: data.password })
      setUser(user)
      setIsSuccess(true)

      if (user.forcePasswordChange) {
        router.push("/auth/first-login")
        return
      }

      const redirect = searchParams.get("redirect")?.trim()
      const destination =
        redirect && isAllowedRedirect(redirect, user.role)
          ? redirect
          : getRoleDashboard(user.role)

      setTimeout(() => router.push(destination), 600)
    } catch (err) {
      triggerShake()
      setError(getLoginErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.form
        onSubmit={handleSubmit(onSubmit, triggerShake)}
        aria-busy={isLoading}
        animate={shake ? { x: [0, -10, 10, -6, 6, -3, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }
        }
        className="space-y-4"
      >
        <motion.div variants={itemVariants}>
          <FloatingInput
            id="login-identifier"
            label="Email or username"
            type="text"
            icon={<Mail size={17} />}
            error={errors.identifier?.message}
            disabled={isLoading}
            registration={register("identifier")}
            onChange={clearAuthError}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <FloatingInput
            id="login-password"
            label="Password"
            type={showPassword ? "text" : "password"}
            icon={<Lock size={17} />}
            error={errors.password?.message}
            disabled={isLoading}
            registration={register("password")}
            onChange={clearAuthError}
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-[#1A3C5E]/30 hover:text-[#E8A020] transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                <motion.div
                  key={showPassword ? "hide" : "show"}
                  initial={{ opacity: 0, rotate: -15 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </motion.div>
              </button>
            }
          />
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              role="alert"
              aria-live="polite"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="rounded-xl bg-red-50 border border-red-200/80 px-4 py-3"
            >
              <p className="text-sm text-red-600">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={itemVariants}>
          <button
            type="submit"
            disabled={isLoading || isSuccess}
            className="relative w-full h-12 rounded-xl overflow-hidden font-medium text-sm tracking-wide transition-all duration-300 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #1a4a72 100%)" }}
          >
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-[#E8A020]/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700 pointer-events-none" />

            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.span
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center gap-2 text-[#E8A020]"
                >
                  <CheckCircle2 size={18} />
                  Welcome back
                </motion.span>
              ) : isLoading ? (
                <motion.span
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2 text-white/70"
                >
                  <Loader2 size={17} className="animate-spin" />
                  Signing in…
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-white"
                >
                  Sign In
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </motion.div>
      </motion.form>
    </motion.div>
  )
}