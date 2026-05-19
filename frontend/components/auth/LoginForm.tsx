"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@repo/shared"
import { login } from "@/lib/auth-client"
import { getRoleDashboard, isAllowedRedirect } from "@/lib/role-routing"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Eye, EyeOff, Mail, Lock } from "lucide-react"

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
})

type LoginForm = z.infer<typeof loginSchema>

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const clearAuthError = () => {
    if (error) setError(null)
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  // Maps ApiError status codes and network errors to human-readable messages.
  // ApiError.message is used as the fallback so backend-provided messages
  // (e.g. "Account suspended until 2026-06-01") surface without extra mapping.
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

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setError(null)

    try {
      // login() calls POST /auth/login, stores tokens via setAuthTokens,
      // then calls GET /users/me to return the hydrated AuthUser.
      const user = await login({ identifier: data.identifier, password: data.password })

      // Hydrate the global auth state immediately so downstream hooks/layouts
      // see the user without waiting for a /users/me refetch on the next render.
      setUser(user)

      // Staff who must change their password on first login are sent to a
      // dedicated page before they can access their dashboard.
      if (user.forcePasswordChange) {
        router.push("/auth/first-login")
        return
      }

      // Role-based dashboard routing:
      //   super_admin      → /admin/dashboard
      //   owner            → /owner/dashboard
      //   manager          → /staff/manager/dashboard
      //   host             → /staff/host
      //   waiter           → /staff/waiter
      //   chef             → /staff/chef/kitchen
      //   cashier          → /staff/cashier
      //   customer         → /customer/home
      //   delivery_partner → /delivery
      //
      // If the URL contains a ?redirect= param and that path is permitted for
      // the user's role, we honour it (e.g. deep-link after session expiry).
      const redirect = searchParams.get("redirect")?.trim()
      const destination =
        redirect && isAllowedRedirect(redirect, user.role)
          ? redirect
          : getRoleDashboard(user.role)

      router.push(destination)
    } catch (err) {
      triggerShake()
      setError(getLoginErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit(onSubmit, triggerShake)}
      className={shake ? "animate-shake" : ""}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      aria-busy={isLoading}
    >
      <div className="space-y-4">
        {/* ── Email / username ── */}
        <div className="space-y-2">
          <label htmlFor="login-identifier" className="text-sm font-medium text-gray-700">
            Email or username
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              id="login-identifier"
              type="text"
              placeholder="you@example.com"
              className="pl-10"
              autoComplete="username"
              aria-invalid={!!errors.identifier}
              aria-describedby={errors.identifier ? "login-identifier-error" : undefined}
              disabled={isLoading}
              {...register("identifier", { onChange: clearAuthError })}
            />
          </div>
          {errors.identifier && (
            <motion.p
              id="login-identifier-error"
              role="alert"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500"
            >
              {errors.identifier.message}
            </motion.p>
          )}
        </div>

        {/* ── Password ── */}
        <div className="space-y-2">
          <label htmlFor="login-password" className="text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              className="pl-10 pr-10"
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              disabled={isLoading}
              {...register("password", { onChange: clearAuthError })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
              disabled={isLoading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <motion.p
              id="login-password-error"
              role="alert"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500"
            >
              {errors.password.message}
            </motion.p>
          )}
        </div>

        {/* ── Server / API error banner ── */}
        {error && (
          <motion.div
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg"
          >
            {error}
          </motion.div>
        )}

        {/* ── Submit ── */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Signing in…
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </div>
    </motion.form>
  )
}