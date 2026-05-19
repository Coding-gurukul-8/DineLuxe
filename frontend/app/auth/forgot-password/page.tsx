"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@repo/shared"
import { resetPassword } from "@/lib/auth-client"
import { OTPInput } from "@/components/auth/OTPInput"
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Mail, Lock, Utensils, Check, ArrowLeft } from "lucide-react"
import Link from "next/link"

// ── Schema ─────────────────────────────────────────────────────────────────────
// Email is collected here in case the user lands on this page directly (without
// coming through ForgotPasswordForm). OTP + new password complete the reset.
const resetSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type ResetForm = z.infer<typeof resetSchema>

type PageStep = "form" | "success"

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Pre-fill email from query param if the forgot-password page passed it along.
  const emailFromQuery = searchParams.get("email")?.trim() ?? ""

  const [otp, setOtp] = useState("")
  const [otpError, setOtpError] = useState(false)
  const [pageStep, setPageStep] = useState<PageStep>("form")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: emailFromQuery },
  })

  const newPassword = watch("newPassword")
  const confirmPassword = watch("confirmPassword")

  const getResetErrorMessage = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.statusCode === 400) return "Invalid or expired OTP. Please request a new code."
      if (err.statusCode === 404) return "No account found for this email."
      return err.message || "Failed to reset password. Please try again."
    }
    if (err instanceof Error) return err.message
    return "Something went wrong. Please try again."
  }

  const onSubmit = async (data: ResetForm) => {
    if (otp.length !== 6) {
      setOtpError(true)
      setError("Please enter the 6-digit code from your email.")
      return
    }

    setIsLoading(true)
    setError(null)
    setOtpError(false)

    try {
      // POST /auth/reset-password  body: { email, otp, newPassword }
      await resetPassword(data.email, otp, data.newPassword)
      setPageStep("success")

      // Redirect to login after a brief success pause so the user can read
      // the confirmation message.
      setTimeout(() => router.push("/auth/login"), 3000)
    } catch (err) {
      const message = getResetErrorMessage(err)
      setError(message)
      // Shake the OTP boxes if the error is OTP-related.
      if (err instanceof ApiError && err.statusCode === 400) setOtpError(true)
    } finally {
      setIsLoading(false)
    }
  }

  const stepVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
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
          <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter the code we sent to your email and choose a new password
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-md shadow-sm border border-gray-100 p-6">
          <AnimatePresence mode="wait">
            {pageStep === "form" && (
              <motion.div
                key="form"
                variants={stepVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.3 }}
              >
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <div className="relative">
                      <Mail
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={18}
                      />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10"
                        autoComplete="email"
                        disabled={isLoading}
                        {...register("email")}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-xs text-red-500" role="alert">
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* OTP */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">
                      Verification code
                    </label>
                    <OTPInput
                      value={otp}
                      onChange={(v) => {
                        setOtp(v)
                        if (otpError) setOtpError(false)
                        if (error) setError(null)
                      }}
                      error={otpError}
                      disabled={isLoading}
                    />
                  </div>

                  {/* New password */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">New password</label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={18}
                      />
                      <Input
                        type="password"
                        placeholder="Create a strong password"
                        className="pl-10"
                        autoComplete="new-password"
                        disabled={isLoading}
                        {...register("newPassword")}
                      />
                    </div>
                    {newPassword && <PasswordStrengthMeter password={newPassword} />}
                    {errors.newPassword && (
                      <p className="text-xs text-red-500" role="alert">
                        {errors.newPassword.message}
                      </p>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Confirm new password
                    </label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={18}
                      />
                      <Input
                        type="password"
                        placeholder="Re-enter your password"
                        className="pl-10"
                        autoComplete="new-password"
                        disabled={isLoading}
                        {...register("confirmPassword")}
                      />
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500">Passwords do not match</p>
                    )}
                    {confirmPassword && newPassword === confirmPassword && (
                      <p className="text-xs text-green-600">✓ Passwords match</p>
                    )}
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-500" role="alert">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  {/* API error */}
                  {error && (
                    <motion.div
                      role="alert"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg"
                    >
                      {error}
                    </motion.div>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={18} />
                        Resetting…
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                </form>
              </motion.div>
            )}

            {pageStep === "success" && (
              <motion.div
                key="success"
                variants={stepVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.3 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <Check size={40} className="text-green-600" />
                </motion.div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Password reset!</h2>
                <p className="text-sm text-gray-500">
                  Your password has been updated. Redirecting to login…
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer link */}
        {pageStep === "form" && (
          <div className="mt-6 text-center">
            <Link
              href="/auth/forgot-password"
              className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft size={14} className="mr-1" />
              Request a new code
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  )
}