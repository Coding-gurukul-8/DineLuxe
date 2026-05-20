"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Utensils, Store, ShieldCheck, ChevronRight } from "lucide-react"

const portals = [
  {
    href: "/auth/signup/customer",
    icon: <Utensils size={22} />,
    title: "Customer",
    description: "Browse restaurants, book tables, and manage your orders.",
    cta: "Sign up as customer",
  },
  {
    href: "/auth/signup/restaurant",
    icon: <Store size={22} />,
    title: "Restaurant / Team",
    description: "Register your restaurant or join as an owner or staff member.",
    cta: "Sign up for restaurant",
  },
  {
    href: "/auth/signup/admin",
    icon: <ShieldCheck size={22} />,
    title: "Platform Admin",
    description: "Super-admin account for platform operations and oversight.",
    cta: "Sign up as admin",
  },
]

export default function SignupSelectPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl"
      >
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-16 h-16 bg-brand-primary rounded-md flex items-center justify-center mx-auto mb-4"
          >
            <Utensils size={32} className="text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900">Create an Account</h1>
          <p className="text-sm text-gray-500 mt-2">
            Choose the type of account that best fits your role.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {portals.map((portal, i) => (
            <motion.div
              key={portal.href}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
            >
              <Link
                href={portal.href}
                className="group flex flex-col h-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-primary/40 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                  {portal.icon}
                </div>
                <h2 className="mt-4 text-lg font-semibold text-gray-900">{portal.title}</h2>
                <p className="mt-2 text-sm text-gray-500 flex-1">{portal.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-primary">
                  {portal.cta}
                  <ChevronRight size={16} />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/auth/customer" className="text-brand-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}