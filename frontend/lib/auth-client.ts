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
  inviteCode?: string
  phone?: string
  password: string
}

type SuperAdminSignupInput = {
  firstName: string
  lastName: string
  email: string
  password: string
  phone?: string
}

type RestaurantRegisterInput = {
  owner: {
    firstName: string
    lastName: string
    email: string
    phone: string
    dob: string
    password: string
  }
  restaurant: {
    name: string
    cuisineTypes: string[]
    description?: string
    gstNumber?: string
    contactEmail?: string
    contactPhone?: string
    website?: string
  }
  branch: {
    name: string
    addressLine1: string
    addressLine2?: string
    city: string
    state: string
    pincode: string
    phone?: string
    seatingCapacity: number
  }
}

type RestaurantRegisterResponse = {
  restaurant: unknown
  branch: unknown
}

function cleanOptionalString(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
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

export async function signupSuperAdmin(input: SuperAdminSignupInput) {
  const payload = {
    email: input.email,
    password: input.password,
    first_name: input.firstName,
    last_name: input.lastName,
    ...(input.phone ? { phone: input.phone } : {}),
  }

  return apiClient.post<{ id: string; email: string; name: string; role: string }>(
    "/admin/signup",
    payload
  )
}

export async function registerRestaurant(input: RestaurantRegisterInput) {
  const payload = {
    owner: {
      first_name: input.owner.firstName,
      last_name: input.owner.lastName,
      email: input.owner.email,
      phone: input.owner.phone,
      dob: input.owner.dob,
      password: input.owner.password,
    },
    restaurant: {
      name: input.restaurant.name,
      cuisine_types: input.restaurant.cuisineTypes,
      description: cleanOptionalString(input.restaurant.description),
      gst_number: cleanOptionalString(input.restaurant.gstNumber),
      contact_email: cleanOptionalString(input.restaurant.contactEmail),
      contact_phone: cleanOptionalString(input.restaurant.contactPhone),
      website: cleanOptionalString(input.restaurant.website),
    },
    branch: {
      name: input.branch.name,
      address_line1: input.branch.addressLine1,
      address_line2: cleanOptionalString(input.branch.addressLine2),
      city: input.branch.city,
      state: input.branch.state,
      pincode: input.branch.pincode,
      phone: cleanOptionalString(input.branch.phone),
      seating_capacity: input.branch.seatingCapacity,
    },
  }

  return apiClient.post<RestaurantRegisterResponse>("/restaurants/register", payload)
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