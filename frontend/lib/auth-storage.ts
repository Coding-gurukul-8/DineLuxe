// COOKIE NAME CONTRACT
// ─────────────────────────────────────────────────────────────────────────────
// Cookie names defined here MUST stay in sync with middleware.ts:
//   "dineluxe_access_token"  → read by middleware to check authentication
//   "dineluxe_user_role"     → read by middleware for role-based routing
//
// Do NOT rename any cookie without updating both files simultaneously.
// ─────────────────────────────────────────────────────────────────────────────

import type { AuthTokens } from "@/types/auth"

const ACCESS_TOKEN_KEY   = "dineluxe_access_token"
const REFRESH_TOKEN_KEY  = "dineluxe_refresh_token"
const USER_ROLE_KEY      = "dineluxe_user_role"
const PENDING_SIGNUP_KEY = "dineluxe_pending_signup"

// Access tokens are short-lived (15 min). The role cookie lives as long as the
// refresh token so the middleware can route the user correctly for the full
// session without re-reading the JWT on every request.
const ACCESS_TOKEN_MAX_AGE  = 15 * 60           // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60  // 7 days

type PendingSignup = {
  email: string
  password: string
  firstName?: string
  lastName?: string
  phone?: string
}

function isBrowser(): boolean {
  return typeof window !== "undefined"
}

// Writes a cookie readable by both JS and the Next.js middleware (edge runtime).
// Secure flag is added automatically on HTTPS origins.
function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (!isBrowser()) return
  const secure      = window.location.protocol === "https:"
  const encoded     = encodeURIComponent(value)
  const secureFlag  = secure ? "; Secure" : ""
  document.cookie   = `${name}=${encoded}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secureFlag}`
}

function clearCookie(name: string): void {
  if (!isBrowser()) return
  // Setting max-age=0 instructs the browser to delete the cookie immediately.
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

// ── Token storage ─────────────────────────────────────────────────────────────

export function setAuthTokens(tokens: AuthTokens): void {
  if (!isBrowser()) return
  localStorage.setItem(ACCESS_TOKEN_KEY,  tokens.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  setCookie(ACCESS_TOKEN_KEY,  tokens.accessToken,  ACCESS_TOKEN_MAX_AGE)
  setCookie(REFRESH_TOKEN_KEY, tokens.refreshToken, REFRESH_TOKEN_MAX_AGE)
  // Role cookie is NOT written here because setAuthTokens receives only tokens.
  // The role is written separately by setUserRole() after fetching /users/me.
}

// Writes the role cookie so middleware.ts can route without a backend call.
// Call this immediately after receiving the AuthUser from fetchProfile().
// max-age matches the refresh token so the cookie outlives the access token.
export function setUserRole(role: string): void {
  if (!isBrowser()) return
  setCookie(USER_ROLE_KEY, role, REFRESH_TOKEN_MAX_AGE)
}

export function clearAuthTokens(): void {
  if (!isBrowser()) return
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  clearCookie(ACCESS_TOKEN_KEY)
  clearCookie(REFRESH_TOKEN_KEY)
  // Clear the role cookie so the middleware no longer sees the user as
  // authenticated after logout or session expiry.
  clearCookie(USER_ROLE_KEY)
}

export function getAccessToken(): string | null {
  return isBrowser() ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
}

export function getRefreshToken(): string | null {
  return isBrowser() ? localStorage.getItem(REFRESH_TOKEN_KEY) : null
}

// ── Pending signup ────────────────────────────────────────────────────────────
// Holds the email/password between the signup form and the OTP verify page so
// resendSignupOtp() can recover the email without an extra prop-drill.

export function setPendingSignup(data: PendingSignup): void {
  if (!isBrowser()) return
  localStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(data))
}

export function getPendingSignup(): PendingSignup | null {
  if (!isBrowser()) return null
  const raw = localStorage.getItem(PENDING_SIGNUP_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PendingSignup
  } catch {
    return null
  }
}

export function clearPendingSignup(): void {
  if (!isBrowser()) return
  localStorage.removeItem(PENDING_SIGNUP_KEY)
}