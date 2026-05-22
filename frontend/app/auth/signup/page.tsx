"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Utensils, Store, ShieldCheck } from "lucide-react"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any } },
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as any } },
}

const portals = [
  {
    href: "/auth/signup/customer",
    icon: Utensils,
    label: "Customer signup",
    title: "Customer",
    description: "Browse restaurants, book tables, and manage your orders.",
    cta: "Sign up as customer",
    featured: true,
  },
  {
    href: "/auth/signup/restaurant",
    icon: Store,
    label: "Restaurant signup",
    title: "Restaurant / Team",
    description: "Register your restaurant or join as an owner or staff member.",
    cta: "Sign up for restaurant",
    featured: false,
  },
  {
    href: "/auth/signup/admin",
    icon: ShieldCheck,
    label: "Admin signup",
    title: "Platform Admin",
    description: "Super-admin account for platform operations and oversight.",
    cta: "Sign up as admin",
    featured: false,
  },
]

export default function SignupSelectPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md"
      >
        {/* Brand mark */}
        <motion.div variants={itemVariants} className="text-center mb-10">
          <Link href="/auth/login" className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="w-9 h-9 rounded-lg bg-[#1A3C5E] flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <Utensils size={18} className="text-[#E8A020]" />
            </div>
            <span className="font-['Playfair_Display',Georgia,serif] text-xl text-[#1A3C5E] tracking-wide">
              DineLuxe
            </span>
          </Link>
          <h1 className="font-['Playfair_Display',Georgia,serif] text-3xl text-[#1A3C5E] mb-2">
            Create an account
          </h1>
          <p className="text-sm text-[#1A3C5E]/45 tracking-wide">
            Choose the type of account that fits your role
          </p>
        </motion.div>

        {/* Portal cards */}
        <div className="space-y-3">
          {portals.map((portal) => {
            const Icon = portal.icon
            return (
              <motion.div key={portal.href} variants={cardVariants}>
                <Link
                  href={portal.href}
                  aria-label={portal.label}
                  className={`group relative block rounded-2xl border p-5 transition-all duration-300
                    ${portal.featured
                      ? "border-[#E8A020]/50 bg-[#1A3C5E] shadow-lg hover:shadow-xl hover:shadow-[#1A3C5E]/20"
                      : "border-[#1A3C5E]/10 bg-white hover:border-[#E8A020]/60 hover:shadow-md"
                    }`}
                >
                  <div className={`absolute left-0 top-4 bottom-4 w-0.5 rounded-full bg-[#E8A020] transition-all duration-300
                    ${portal.featured ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />

                  <div className="flex items-center gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110
                      ${portal.featured
                        ? "bg-[#E8A020]/20 text-[#E8A020]"
                        : "bg-[#1A3C5E]/6 text-[#1A3C5E] group-hover:bg-[#E8A020]/10 group-hover:text-[#E8A020]"
                      }`}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className={`text-base font-semibold ${portal.featured ? "text-white" : "text-[#1A3C5E]"}`}>
                        {portal.title}
                      </h2>
                      <p className={`text-xs mt-0.5 leading-relaxed ${portal.featured ? "text-white/60" : "text-[#1A3C5E]/50"}`}>
                        {portal.description}
                      </p>
                    </div>
                    <span className={`text-xs font-medium shrink-0 transition-colors duration-200
                      ${portal.featured ? "text-[#E8A020]" : "text-[#1A3C5E]/40 group-hover:text-[#E8A020]"}`}>
                      Start →
                    </span>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>

        <motion.div variants={itemVariants} className="mt-8 text-center">
          <p className="text-sm text-[#1A3C5E]/40">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-[#E8A020] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
