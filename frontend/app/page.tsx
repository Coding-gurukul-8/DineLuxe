import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRoleDashboard } from "@/lib/role-routing";
import type { Role } from "@/lib/constants";

const ACCESS_TOKEN_COOKIE = "dineluxe_access_token";
const USER_ROLE_COOKIE = "dineluxe_user_role";

function FirstVisitLanding() {
  return (
    <div className="min-h-screen bg-linear-to-br from-[#0f2744] via-[#1a3c5e] to-[#0f2744] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl bg-white/10 border border-white/15 backdrop-blur p-8">
          <h1 className="font-['Playfair_Display',Georgia,serif] text-3xl sm:text-4xl tracking-wide">
            Welcome to DineLuxe
          </h1>
          <p className="mt-3 text-sm sm:text-base text-white/70 leading-relaxed">
            We’re getting your session set up. Continue to sign in so we can route you to the right dashboard.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <a
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-xl bg-[#E8A020] text-[#0f2744] font-semibold px-5 py-3 hover:opacity-95 transition-opacity"
            >
              Continue to Login
            </a>
            <a
              href="/auth/customer"
              className="inline-flex items-center justify-center rounded-xl bg-white/10 text-white font-semibold px-5 py-3 border border-white/15 hover:bg-white/15 transition-colors"
            >
              Customer Portal
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function RootPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const role = cookieStore.get(USER_ROLE_COOKIE)?.value as Role | undefined;

  // Authenticated: role cookie decides where to route.
  if (accessToken && role) {
    const dashboard = getRoleDashboard(role);
    if (dashboard && dashboard !== "/") redirect(dashboard);
  }

  // Not authenticated → send to the general login.
  if (!accessToken) {
    redirect("/auth/login");
  }

  // Authenticated but role missing (“first visit” / older session) → show landing.
  return <FirstVisitLanding />;
}

