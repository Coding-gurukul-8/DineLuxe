"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { LoginForm } from "@/components/auth/LoginForm"
import { ShieldCheck } from "lucide-react"

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
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
            <ShieldCheck size={32} className="text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Console</h1>
          <p className="text-sm text-gray-500 mt-1">Platform operators only</p>
        </div>

        <div className="bg-white rounded-md shadow-sm border border-gray-100 p-6">
          <LoginForm />
        </div>

        <div className="mt-6 text-center space-y-3">
          <Link href="/auth/login" className="text-sm text-brand-primary hover:underline">
            Back to portal
          </Link>
          <p className="text-xs text-gray-500">
            Not an admin? Use the appropriate portal above.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
