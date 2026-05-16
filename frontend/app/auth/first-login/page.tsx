import { FirstLoginForm } from "@/components/auth/FirstLoginForm"
import { KeyRound, Sparkles, ShieldCheck } from "lucide-react"

export default function Page() {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-6 animate-fade-in">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary">
          <Sparkles size={14} />
          First login
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold text-gray-950 sm:text-4xl">
            Lock in your access with a strong, private password.
          </h1>
          <p className="text-sm text-gray-600 sm:text-base">
            Your manager created this account with a temporary password. Update it now to
            unlock your workspace and keep your branch secure.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm">
            <ShieldCheck className="text-brand-primary" size={20} />
            <h2 className="mt-4 text-sm font-semibold text-gray-900">Security check</h2>
            <p className="mt-2 text-sm text-gray-500">
              We require a unique password before you can access staff tools and live orders.
            </p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm">
            <KeyRound className="text-brand-primary" size={20} />
            <h2 className="mt-4 text-sm font-semibold text-gray-900">One-time update</h2>
            <p className="mt-2 text-sm text-gray-500">
              You will not see this screen again once the new password is saved.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">Password rules</p>
          <ul className="mt-4 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              Minimum 8 characters
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              One uppercase letter
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              One number
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
              One special character
            </li>
          </ul>
        </div>
      </section>

      <section className="animate-scale-in">
        <FirstLoginForm />
      </section>
    </div>
  )
}
