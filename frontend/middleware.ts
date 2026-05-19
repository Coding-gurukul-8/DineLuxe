import { NextRequest, NextResponse } from "next/server";

// ── Cookie names ──────────────────────────────────────────────────────────────
// These MUST match the constants in lib/auth-storage.ts exactly.
const ACCESS_TOKEN_COOKIE = "dineluxe_access_token";
const USER_ROLE_COOKIE = "dineluxe_user_role";

// ── Role → dashboard map ──────────────────────────────────────────────────────
function dashboardForRole(role: string): string {
  const map: Record<string, string> = {
    super_admin:      "/admin/dashboard",
    owner:            "/owner/dashboard",
    manager:          "/staff/manager/dashboard",
    host:             "/staff/host",
    waiter:           "/staff/waiter",
    chef:             "/staff/chef/kitchen",
    cashier:          "/staff/cashier",
    customer:         "/customer/home",
    delivery_partner: "/delivery",
  };
  return map[role] ?? "/auth/login";
}

// ── Route → allowed roles map ─────────────────────────────────────────────────
// Order matters: more-specific prefixes must come before broader ones.
// "null" means the route is public (no role required, but still needs a token
// if it appears in a protected section — handled below).
const ROLE_ROUTES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/admin",          roles: ["super_admin"] },
  { prefix: "/owner",          roles: ["owner"] },
  { prefix: "/staff/manager",  roles: ["manager", "owner"] },
  { prefix: "/staff/host",     roles: ["host", "manager", "owner"] },
  { prefix: "/staff/waiter",   roles: ["waiter", "manager", "owner"] },
  { prefix: "/staff/chef",     roles: ["chef", "manager", "owner"] },
  { prefix: "/staff/cashier",  roles: ["cashier", "manager", "owner"] },
  // Generic /staff catches any remaining staff sub-routes
  { prefix: "/staff",          roles: ["manager", "host", "waiter", "chef", "cashier", "owner"] },
  { prefix: "/delivery",       roles: ["delivery_partner"] },
  { prefix: "/customer",       roles: ["customer"] },
];

function getRequiredRoles(pathname: string): string[] | null {
  for (const { prefix, roles } of ROLE_ROUTES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return roles;
    }
  }
  return null; // public route
}

// ── JWT decode (edge-safe, no crypto) ────────────────────────────────────────
// Reads the payload of a JWT without verifying the signature — signature
// verification is not possible in the edge runtime without the secret, so we
// rely on the HttpOnly access-token cookie being tamper-evident (cookie jar
// protection) and the backend re-validating on every API call.
//
// The role cookie ("dineluxe_user_role") is the primary source because it is
// simpler and avoids re-parsing on every request. The JWT payload is used as a
// fallback in case the role cookie was not written (e.g. older session).
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Read auth cookies ──────────────────────────────────────────────────
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const roleCookie  = request.cookies.get(USER_ROLE_COOKIE)?.value;

  // Resolve user role: prefer the dedicated role cookie (written by
  // auth-storage.ts on every login / OTP verify), fall back to the JWT claim.
  let userRole: string | undefined = roleCookie;
  let tokenExpired = false;

  if (accessToken) {
    const payload = decodeJwtPayload(accessToken);
    if (payload) {
      // Check expiry — exp is Unix seconds.
      const exp = typeof payload.exp === "number" ? payload.exp : null;
      if (exp && exp * 1000 < Date.now()) {
        tokenExpired = true;
      }
      // Fill role from JWT if cookie was absent.
      if (!userRole && typeof payload.role === "string") {
        userRole = payload.role;
      }
    }
  }

  const isAuthenticated = Boolean(accessToken && !tokenExpired);

  // ── 2. /auth/* — redirect to dashboard if already signed in ──────────────
  // Prevents logged-in users from hitting /auth/login or /auth/signup.
  // Exception: /auth/logout is always allowed through (it clears state).
  if (pathname.startsWith("/auth") && !pathname.startsWith("/auth/logout")) {
    if (isAuthenticated && userRole) {
      return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url));
    }
    return NextResponse.next();
  }

  // ── 3. Public routes ──────────────────────────────────────────────────────
  const requiredRoles = getRequiredRoles(pathname);
  if (requiredRoles === null) {
    // Route is public (e.g. "/", "/api/*" handled by matcher exclusion).
    return NextResponse.next();
  }

  // ── 4. Protected route — unauthenticated ──────────────────────────────────
  if (!isAuthenticated) {
    const loginUrl = new URL("/auth/login", request.url);
    // Preserve the intended destination so LoginForm can redirect back after
    // a successful sign-in (honours ?redirect= param).
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 5. Protected route — wrong role ──────────────────────────────────────
  // The user is authenticated but their role doesn't match this section.
  // Send them to their own dashboard rather than showing a blank 403.
  if (userRole && !requiredRoles.includes(userRole)) {
    return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url));
  }

  // ── 6. All checks passed ──────────────────────────────────────────────────
  return NextResponse.next();
}

// ── Matcher ───────────────────────────────────────────────────────────────────
// Runs on every route EXCEPT:
//   • Next.js internals  (_next/static, _next/image)
//   • Static assets      (.svg .png .jpg .jpeg .gif .webp .ico .woff2 etc.)
//   • API proxy routes   (/api/*) — the Express backend validates its own auth
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf|otf|eot|ico)$|api/).*)",
  ],
};