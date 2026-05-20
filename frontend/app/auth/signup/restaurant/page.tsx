"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Store } from "lucide-react"
import { RestaurantSignupWizard } from "@/components/auth/RestaurantSignupWizard"

export default function RestaurantSignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-16 h-16 bg-brand-primary rounded-md flex items-center justify-center mx-auto mb-4"
          >
            <Store size={32} className="text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900">Restaurant Registration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Register as an owner — you can add branches and staff after setup
          </p>
        </div>

        <div className="bg-white rounded-md shadow-sm border border-gray-100 p-6">
          <RestaurantSignupWizard />
        </div>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/auth/restaurant" className="text-brand-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
          <Link href="/auth/signup" className="text-sm text-brand-primary hover:underline block">
            ← Back to account types
          </Link>
        </div>
      </motion.div>
    </div>
  )
}