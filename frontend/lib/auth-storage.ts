// COOKIE NAME CONTRACT: The access-token cookie is intentionally named
// "dineluxe_access_token" — this must match exactly what middleware.ts reads
// via `request.cookies.get("dineluxe_access_token")`. Do NOT rename either
// without updating both files simultaneously.
import type { AuthTokens } from "@/types/auth"

const ACCESS_TOKEN_KEY = "dineluxe_access_token"
const REFRESH_TOKEN_KEY = "dineluxe_refresh_token"
const PENDING_SIGNUP_KEY = "dineluxe_pending_signup"

const ACCESS_TOKEN_MAX_AGE = 15 * 60
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60

type PendingSignup = {
  email: string
  password: string
  firstName?: string
  lastName?: string
  phone?: string
}

function isBrowser() {
  return typeof window !== "undefined"
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (!isBrowser()) return
  const secure = window.location.protocol === "https:"
  const encoded = encodeURIComponent(value)
  const secureFlag = secure ? "; Secure" : ""
  document.cookie = `${name}=${encoded}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secureFlag}`
}

function clearCookie(name: string) {
  if (!isBrowser()) return
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

export function setAuthTokens(tokens: AuthTokens) {
  if (!isBrowser()) return
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  setCookie(ACCESS_TOKEN_KEY, tokens.accessToken, ACCESS_TOKEN_MAX_AGE)
  setCookie(REFRESH_TOKEN_KEY, tokens.refreshToken, REFRESH_TOKEN_MAX_AGE)
}

export function clearAuthTokens() {
  if (!isBrowser()) return
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  clearCookie(ACCESS_TOKEN_KEY)
  clearCookie(REFRESH_TOKEN_KEY)
}

export function getAccessToken() {
  return isBrowser() ? localStorage.getItem(ACCESS_TOKEN_KEY) : null
}

export function getRefreshToken() {
  return isBrowser() ? localStorage.getItem(REFRESH_TOKEN_KEY) : null
}

export function setPendingSignup(data: PendingSignup) {
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

export function clearPendingSignup() {
  if (!isBrowser()) return
  localStorage.removeItem(PENDING_SIGNUP_KEY)
}
