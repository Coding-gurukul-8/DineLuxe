import { FirstLoginForm } from "@/components/auth/FirstLoginForm"

export default function FirstLoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2744] via-[#1a3c5e] to-[#0f2744] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 border border-white/20 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Welcome — Please set your password
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Your account was created with a temporary password. Set a new one to continue.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white shadow-2xl shadow-black/30 p-8">
          <FirstLoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
          DineLuxe — Staff Portal
        </p>
      </div>
    </div>
  )
}