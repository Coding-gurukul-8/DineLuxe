"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@repo/shared"
import { changePassword } from "@/lib/auth-client"
import { getRoleDashboard } from "@/lib/role-routing"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter"
import { Check, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  })

type ChangePasswordForm = z.infer<typeof changePasswordSchema>

export function FirstLoginForm() {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const { user, loading, setUser } = useAuth()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  })

  const newPassword = watch("newPassword")
  const dashboardUrl = getRoleDashboard(user?.role)

  useEffect(() => {
    return () => {
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/auth/login")
      return
    }
    if (!user.forcePasswordChange && !isSuccess) {
      router.replace(dashboardUrl)
    }
  }, [loading, user, router, dashboardUrl, isSuccess])

  const clearAuthError = () => {
    if (error) setError(null)
  }

  const handleInvalid = () => {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  const getErrorMessage = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.statusCode === 401) return "Current password is incorrect"
      if (err.statusCode === 422) return "New password must be different from the current password"
      return err.message || "Unable to update your password. Please try again."
    }
    if (err instanceof Error) return err.message
    return "Unable to update your password. Please try again."
  }

  const onSubmit = async (data: ChangePasswordForm) => {
    setIsLoading(true)
    setError(null)

    try {
      await changePassword(data.currentPassword, data.newPassword)
      if (user) {
        setUser({ ...user, forcePasswordChange: false })
      }
      setIsSuccess(true)
      redirectTimer.current = setTimeout(() => {
        router.push(dashboardUrl)
      }, 1400)
    } catch (err) {
      setShake(true)
      setTimeout(() => setShake(false), 400)
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-sm">
        <div className="h-5 w-40 rounded-full bg-gray-100 skeleton" />
        <div className="mt-4 h-10 w-full rounded-xl bg-gray-100 skeleton" />
        <div className="mt-3 h-10 w-full rounded-xl bg-gray-100 skeleton" />
        <div className="mt-3 h-10 w-full rounded-xl bg-gray-100 skeleton" />
        <div className="mt-6 h-11 w-full rounded-xl bg-gray-100 skeleton" />
      </div>
    )
  }

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-white/60 bg-white/90 p-8 text-center shadow-sm"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Check className="text-emerald-600" size={32} />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Password updated</h2>
        <p className="mt-2 text-sm text-gray-500">
          You are all set. Redirecting you to your dashboard now.
        </p>
        <Button
          type="button"
          onClick={() => router.push(dashboardUrl)}
          className="mt-6 w-full h-11 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium"
        >
          Continue to dashboard
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.form
      onSubmit={handleSubmit(onSubmit, handleInvalid)}
      className={shake ? "animate-shake rounded-2xl border border-white/70 bg-white/90 p-6 shadow-sm" : "rounded-2xl border border-white/70 bg-white/90 p-6 shadow-sm"}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      aria-busy={isLoading}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10">
          <ShieldCheck className="text-brand-primary" size={20} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Set a new password</h2>
          <p className="text-sm text-gray-500">Your first login needs a secure reset.</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <label htmlFor="current-password" className="text-sm font-medium text-gray-700">Current password</label>
          <div className="relative">
            <Input
              id="current-password"
              type={showCurrent ? "text" : "password"}
              placeholder="Enter your current password"
              className="pr-10"
              autoComplete="current-password"
              aria-invalid={!!errors.currentPassword}
              aria-describedby={errors.currentPassword ? "current-password-error" : undefined}
              disabled={isLoading}
              {...register("currentPassword", { onChange: clearAuthError })}
            />
            <button
              type="button"
              onClick={() => setShowCurrent((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showCurrent ? "Hide current password" : "Show current password"}
              disabled={isLoading}
            >
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.currentPassword && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500"
              id="current-password-error"
              role="alert"
            >
              {errors.currentPassword.message}
            </motion.p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="new-password" className="text-sm font-medium text-gray-700">New password</label>
          <div className="relative">
            <Input
              id="new-password"
              type={showNew ? "text" : "password"}
              placeholder="Create a strong password"
              className="pr-10"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              aria-describedby={errors.newPassword ? "new-password-error" : undefined}
              disabled={isLoading}
              {...register("newPassword", { onChange: clearAuthError })}
            />
            <button
              type="button"
              onClick={() => setShowNew((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showNew ? "Hide new password" : "Show new password"}
              disabled={isLoading}
            >
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.newPassword && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500"
              id="new-password-error"
              role="alert"
            >
              {errors.newPassword.message}
            </motion.p>
          )}
          {newPassword && (
            <PasswordStrengthMeter password={newPassword} className="pt-1" />
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">Confirm new password</label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              placeholder="Re-enter your new password"
              className="pr-10"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
              disabled={isLoading}
              {...register("confirmPassword", { onChange: clearAuthError })}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              disabled={isLoading}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500"
              id="confirm-password-error"
              role="alert"
            >
              {errors.confirmPassword.message}
            </motion.p>
          )}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg"
            role="alert"
            aria-live="polite"
          >
            {error}
          </motion.div>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Updating...
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </div>
    </motion.form>
  )
}
