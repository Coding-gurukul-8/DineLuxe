"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@repo/shared"
import { signup } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordStrengthMeter } from "./PasswordStrengthMeter"
import { Loader2, User, Mail, Lock, ShieldCheck, Eye, EyeOff, Check } from "lucide-react"

const adminSignupSchema = z
  .object({
    firstName:    z.string().min(1, "First name is required"),
    lastName:     z.string().min(1, "Last name is required"),
    email:        z.string().email("Enter a valid email"),
    inviteCode:   z.string().min(1, "Invite code is required"),
    password:     z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type AdminSignupForm = z.infer<typeof adminSignupSchema>

export function AdminSignupForm() {
  const [showPassword, setShowPassword]   = useState(false)
  const [showConfirm,  setShowConfirm]    = useState(false)
  const [isSubmitting, setIsSubmitting]   = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [success, setSuccess]             = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AdminSignupForm>({
    resolver: zodResolver(adminSignupSchema),
    mode: "onChange",
  })

  const password        = watch("password")
  const confirmPassword = watch("confirmPassword")

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.statusCode === 409) return "An account with this email already exists."
      if (err.statusCode === 403) return "Invalid invite code. Please contact your platform administrator."
      return err.message || "Something went wrong. Please try again."
    }
    if (err instanceof Error) return err.message
    return "Something went wrong. Please try again."
  }

  const onSubmit = async (data: AdminSignupForm) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await signup({
        email:     data.email,
        password:  data.password,
        firstName: data.firstName,
        lastName:  data.lastName,
      })
      setSuccess(true)
      if (result.verification_pending) {
        setTimeout(() => {
          router.push(`/auth/verify-otp?email=${encodeURIComponent(data.email)}&portal=admin`)
        }, 1500)
      } else {
        setTimeout(() => router.push("/admin/dashboard"), 1500)
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center py-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <Check size={32} className="text-green-600" />
        </motion.div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Admin Account Created!</h3>
        <p className="text-sm text-gray-500">Redirecting you now…</p>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* First name + Last name */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">First Name</label>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Jane" className="pl-9" disabled={isSubmitting} {...register("firstName")} />
          </div>
          {errors.firstName && (
            <p className="text-xs text-red-500" role="alert">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Last Name</label>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Doe" className="pl-9" disabled={isSubmitting} {...register("lastName")} />
          </div>
          {errors.lastName && (
            <p className="text-xs text-red-500" role="alert">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Email</label>
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input type="email" placeholder="admin@dineluxe.com" className="pl-9" disabled={isSubmitting} {...register("email")} />
        </div>
        {errors.email && (
          <p className="text-xs text-red-500" role="alert">{errors.email.message}</p>
        )}
      </div>

      {/* Invite code */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Admin Invite Code</label>
        <div className="relative">
          <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Enter the invite code you received" className="pl-9" disabled={isSubmitting} {...register("inviteCode")} />
        </div>
        {errors.inviteCode && (
          <p className="text-xs text-red-500" role="alert">{errors.inviteCode.message}</p>
        )}
        <p className="text-xs text-gray-400">
          Admin accounts require an invite code issued by an existing super-admin.
        </p>
      </div>

      {/* Password */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Password</label>
        <div className="relative">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Create a strong password"
            className="pl-9 pr-10"
            disabled={isSubmitting}
            {...register("password")}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-red-500" role="alert">{errors.password.message}</p>
        )}
        {password && <PasswordStrengthMeter password={password} />}
      </div>

      {/* Confirm password */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Confirm Password</label>
        <div className="relative">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            type={showConfirm ? "text" : "password"}
            placeholder="Re-enter your password"
            className="pl-9 pr-10"
            disabled={isSubmitting}
            {...register("confirmPassword")}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-xs text-red-500" role="alert">{errors.confirmPassword.message}</p>
        )}
        {confirmPassword && (
          <p className={`text-xs ${password === confirmPassword ? "text-green-600" : "text-red-500"}`}>
            {password === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
          </p>
        )}
      </div>

      {error && (
        <motion.div
          role="alert"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg"
        >
          {error}
        </motion.div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-11 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium mt-2"
      >
        {isSubmitting ? (
          <><Loader2 className="animate-spin mr-2" size={18} />Creating admin account…</>
        ) : (
          <><ShieldCheck size={18} className="mr-2" />Create Admin Account</>
        )}
      </Button>
    </form>
  )
}