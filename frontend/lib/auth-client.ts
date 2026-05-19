import { apiClient } from "@/lib/api-client"
import {
  clearAuthTokens,
  clearPendingSignup,
  getPendingSignup,
  getRefreshToken,
  setAuthTokens,
  setPendingSignup,
  setUserRole,
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

// ── Profile mapping ───────────────────────────────────────────────────────────

export function mapProfileToAuthUser(profile: AuthProfile): AuthUser {
  const name =
    profile.name ??
    [profile.first_name, profile.last_name].filter(Boolean).join(" ")
  return {
    id:                  profile.id,
    email:               profile.email,
    name:                name || undefined,
    role:                profile.role,
    forcePasswordChange: profile.force_password_change ?? false,
    restaurantId:        profile.restaurant_id  ?? undefined,
    branchId:            profile.branch_id      ?? undefined,
  }
}

// Fetches GET /api/v1/users/me and maps to AuthUser.
// Also writes the "dineluxe_user_role" cookie via setUserRole() so the
// middleware can perform role-based routing on the next navigation.
async function fetchProfile(): Promise<AuthUser> {
  const profile = await apiClient.get<AuthProfile>("/users/me")
  const user    = mapProfileToAuthUser(profile)
  // Write role cookie immediately — middleware reads this on the next request.
  setUserRole(user.role)
  return user
}

// ── Auth flows ────────────────────────────────────────────────────────────────

export async function login({ identifier, password }: LoginInput): Promise<AuthUser> {
  const tokens = await apiClient.post<AuthTokens>("/auth/login", {
    email: identifier,
    password,
  })
  setAuthTokens(tokens)
  // fetchProfile() writes the role cookie → middleware can route correctly.
  return fetchProfile()
}

export async function signup(input: SignupInput) {
  const payload = {
    email:     input.email,
    password:  input.password,
    firstName: input.firstName,
    lastName:  input.lastName,
    phone:     input.phone,
  }
  const result = await apiClient.post<AuthTokens & { verification_pending?: boolean }>(
    "/auth/signup",
    payload
  )
  setAuthTokens(result)
  setPendingSignup(payload)
  // Role is not written here — the account is unverified. setUserRole() is
  // called by verifyOtp() once the email is confirmed and we have a real user.
  return result
}

export async function resendSignupOtp(email?: string) {
  const pending       = getPendingSignup()
  const resolvedEmail = email ?? pending?.email
  if (!resolvedEmail) throw new Error("Signup details not found. Please sign up again.")
  return apiClient.post<{ message?: string }>("/auth/send-otp", { email: resolvedEmail })
}

export async function verifyOtp(email: string, otp: string): Promise<AuthUser> {
  const tokens = await apiClient.post<AuthTokens>("/auth/verify-otp", { email, otp })
  setAuthTokens(tokens)
  clearPendingSignup()
  // fetchProfile() writes the role cookie → middleware can route correctly.
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

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiClient.post<{ message?: string }>("/auth/change-password", {
    currentPassword,
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
    // Swallow errors — always clear local state even if the backend is down.
  } finally {
    clearAuthTokens()    // also clears the role cookie (dineluxe_user_role)
    clearPendingSignup()
  }
}