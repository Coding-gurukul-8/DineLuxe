"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ShieldCheck, Store, Utensils } from "lucide-react"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
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
          <h1 className="text-3xl font-bold text-gray-900">Choose your portal</h1>
          <p className="text-sm text-gray-500 mt-2">
            Pick the experience that matches your role.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/auth/admin"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-primary/40 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <ShieldCheck size={22} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Admin App</h2>
            <p className="mt-2 text-sm text-gray-500">
              Platform operations, restaurants, analytics, and system health.
            </p>
            <span className="mt-4 inline-flex text-sm font-medium text-brand-primary">
              Continue as admin
            </span>
          </Link>

          <Link
            href="/auth/restaurant"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-primary/40 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <Store size={22} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Restaurant Team</h2>
            <p className="mt-2 text-sm text-gray-500">
              Owners, managers, and staff dashboards for day-to-day operations.
            </p>
            <span className="mt-4 inline-flex text-sm font-medium text-brand-primary">
              Continue as restaurant
            </span>
          </Link>

          <Link
            href="/auth/customer"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-primary/40 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <Utensils size={22} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Customer</h2>
            <p className="mt-2 text-sm text-gray-500">
              Browse restaurants, book tables, and manage your orders.
            </p>
            <span className="mt-4 inline-flex text-sm font-medium text-brand-primary">
              Continue as customer
            </span>
          </Link>
        </div>

        <div className="mt-8 text-center">
          <Link href="/auth/forgot-password" className="text-sm text-brand-primary hover:underline">
            Forgot your password?
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
