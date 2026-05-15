"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { login } from "@/lib/auth-client"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Eye, EyeOff, Mail, Lock } from "lucide-react"

const loginSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
})

type LoginForm = z.infer<typeof loginSchema>
type AppRole = "super_admin" | "owner" | "manager" | "host" | "waiter" | "chef" | "cashier" | "customer" | "delivery_partner"

const roleDashboards: Record<AppRole, string> = {
  super_admin: "/admin/dashboard",
  owner: "/owner/dashboard",
  manager: "/staff/manager/dashboard",
  host: "/staff/host",
  waiter: "/staff/waiter",
  chef: "/staff/chef/kitchen",
  cashier: "/staff/cashier",
  customer: "/customer/home",
  delivery_partner: "/delivery",
}

function isAllowedRedirect(path: string, role: AppRole) {
  if (!path.startsWith("/")) return false
  if (path.startsWith("/admin")) return role === "super_admin"
  if (path.startsWith("/owner")) return role === "owner"
  if (path.startsWith("/staff/manager")) return role === "manager" || role === "owner"
  if (path.startsWith("/staff/host")) return ["host", "manager", "owner"].includes(role)
  if (path.startsWith("/staff/waiter")) return ["waiter", "manager", "owner"].includes(role)
  if (path.startsWith("/staff/chef")) return ["chef", "manager", "owner"].includes(role)
  if (path.startsWith("/staff/cashier")) return ["cashier", "manager", "owner"].includes(role)
  if (path.startsWith("/staff")) return ["manager", "host", "waiter", "chef", "cashier", "owner"].includes(role)
  if (path.startsWith("/customer")) return role === "customer"
  if (path.startsWith("/delivery")) return role === "delivery_partner"
  return true
}

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useAuth()

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setError(null)

    try {
      const user = await login({ identifier: data.identifier, password: data.password })
      setUser(user)
      const redirect = searchParams.get("redirect")
      const role = user.role as AppRole
      router.push(redirect && isAllowedRedirect(redirect, role) ? redirect : roleDashboards[role])
    } catch (err) {
      setShake(true)
      setTimeout(() => setShake(false), 400)
      const message = err instanceof Error ? err.message : "Invalid credentials"
      setError(message === "Failed to fetch" ? "Unable to reach the auth service. Check backend connectivity." : message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit(onSubmit)}
      className={shake ? "animate-shake" : ""}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="space-y-4">
        {/* Email field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Username or email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type="text"
              placeholder="you@example.com"
              className="pl-10"
              autoComplete="username"
              {...register("identifier")}
            />
          </div>
          {errors.identifier && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500"
            >
              {errors.identifier.message}
            </motion.p>
          )}
        </div>

        {/* Password field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              className="pl-10 pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500"
            >
              {errors.password.message}
            </motion.p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg"
          >
            {error}
          </motion.div>
        )}

        {/* Submit button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </div>
    </motion.form>
  )
}
