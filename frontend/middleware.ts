import { NextRequest, NextResponse } from "next/server";

// In development we short-circuit middleware to avoid importing server SDKs
// which can cause issues in the edge runtime during local dev.

const ROLE_ROUTES: Record<string, string[]> = {
  "/admin":          ["super_admin"],
  "/owner":          ["owner"],
  "/staff/manager":  ["manager", "owner"],
  "/staff/host":     ["host", "manager", "owner"],
  "/staff/waiter":   ["waiter", "manager", "owner"],
  "/staff/chef":     ["chef", "manager", "owner"],
  "/staff/cashier":  ["cashier", "manager", "owner"],
  "/staff":          ["manager", "host", "waiter", "chef", "cashier", "owner"],
  "/delivery":       ["delivery_partner"],
};

function getRoleRequirement(pathname: string): string[] | null {
  for (const [prefix, roles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(prefix)) return roles;
  }
  return null;
}

function dashboardForRole(role: string) {
  const dashboardMap: Record<string, string> = {
    super_admin: "/admin/dashboard",
    owner:       "/owner/dashboard",
    manager:     "/staff/manager/dashboard",
    host:        "/staff/host",
    waiter:      "/staff/waiter",
    chef:        "/staff/chef/kitchen",
    cashier:     "/staff/cashier",
    customer:    "/customer/home",
    delivery_partner: "/delivery",
  };
  return dashboardMap[role] ?? "/auth/login";
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // DEV NOTE: Auth middleware is skipped in development to avoid edge-runtime
  // import issues with server-side SDKs. Route protection only enforces in production.
  // To test auth protection locally, temporarily set NODE_ENV=production in .env.
  if (process.env.NODE_ENV !== 'production') return response;

  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return response;
  }

  const accessToken = request.cookies.get("dineluxe_access_token")?.value;
  if (!accessToken) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = decodeJwt(accessToken);
  const userRole = payload?.role as string | undefined;
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  if (!userRole || (exp && exp * 1000 < Date.now())) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }
  const requiredRoles = getRoleRequirement(pathname);

  if (requiredRoles && userRole && !requiredRoles.includes(userRole)) {
    return NextResponse.redirect(new URL(dashboardForRole(userRole), request.url));
  }

  return response;
}

function decodeJwt(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
