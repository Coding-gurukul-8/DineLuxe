import { apiClient } from "@/lib/api-client"
import {
  clearAuthTokens,
  clearPendingSignup,
  getPendingSignup,
  getRefreshToken,
  setAuthTokens,
  setPendingSignup,
} from "@/lib/auth-storage"
import type { AuthProfile, AuthTokens, AuthUser } from "@/types/auth"

type LoginInput = {
  identifier: string
  password: string
}

type SignupInput = {
  firstName?: string
  lastName?: string
  email: string
  phone?: string
  password: string
}

function mapProfileToAuthUser(profile: AuthProfile): AuthUser {
  const name = profile.name ?? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
  return {
    id: profile.id,
    email: profile.email,
    name: name || undefined,
    role: profile.role,
    restaurantId: profile.restaurant_id ?? undefined,
    branchId: profile.branch_id ?? undefined,
  }
}

async function fetchProfile(): Promise<AuthUser> {
  const profile = await apiClient.get<AuthProfile>("/users/me")
  return mapProfileToAuthUser(profile)
}

export async function login({ identifier, password }: LoginInput): Promise<AuthUser> {
  const tokens = await apiClient.post<AuthTokens>("/auth/login", {
    email: identifier,
    password,
  })
  setAuthTokens(tokens)
  return fetchProfile()
}

export async function signup(input: SignupInput) {
  const payload = {
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
  }
  const result = await apiClient.post<{ message?: string }>("/auth/signup", payload)
  setPendingSignup(payload)
  return result
}

export async function resendSignupOtp() {
  const pending = getPendingSignup()
  if (!pending) throw new Error("Signup details not found. Please sign up again.")
  return signup(pending)
}

export async function verifyOtp(email: string, otp: string): Promise<AuthUser> {
  const tokens = await apiClient.post<AuthTokens>("/auth/verify-otp", { email, otp })
  setAuthTokens(tokens)
  clearPendingSignup()
  return fetchProfile()
}

export async function forgotPassword(email: string) {
  return apiClient.post<{ message?: string }>("/auth/forgot-password", { email })
}

export async function resetPassword(email: string, otp: string, newPassword: string) {
  return apiClient.post<{ message?: string }>("/auth/reset-password", {
    email,
    otp,
    newPassword,
  })
}

export async function refreshTokens() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error("Missing refresh token")
  const tokens = await apiClient.post<AuthTokens>("/auth/refresh", { refreshToken })
  setAuthTokens(tokens)
  return tokens
}

export async function logout() {
  try {
    await apiClient.post("/auth/logout", {})
  } catch {
    // Ignore logout errors and clear locally
  } finally {
    clearAuthTokens()
    clearPendingSignup()
  }
}

export { mapProfileToAuthUser }
