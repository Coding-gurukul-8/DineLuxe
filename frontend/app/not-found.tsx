"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { ROLES } from "@/lib/constants";
import { Home, ArrowLeft } from "lucide-react";

const ROLE_HOME: Record<string, string> = {
  [ROLES.SUPER_ADMIN]:      "/admin/dashboard",
  [ROLES.OWNER]:            "/owner/dashboard",
  [ROLES.MANAGER]:          "/staff/manager",
  [ROLES.HOST]:             "/staff/host",
  [ROLES.WAITER]:           "/staff/waiter",
  [ROLES.CHEF]:             "/staff/chef",
  [ROLES.CASHIER]:          "/staff/cashier",
  [ROLES.CUSTOMER]:         "/customer/home",
  [ROLES.DELIVERY_PARTNER]: "/delivery",
  [ROLES.SUPPORT]:          "/admin/dashboard",
};

export default function NotFound() {
  const { role, isAuthenticated } = useAuth();
  const router = useRouter();

  const homePath =
    isAuthenticated && role ? (ROLE_HOME[role] ?? "/") : "/auth/login";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        {/* Big 404 */}
        <p className="text-8xl font-black text-gray-100 leading-none select-none">
          404
        </p>

        {/* Heading */}
        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft size={16} />
            Go back
          </button>
          <button
            onClick={() => router.push(homePath)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1A3C5E] text-sm font-semibold text-white hover:bg-[#15304d] transition-colors"
          >
            <Home size={16} />
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}