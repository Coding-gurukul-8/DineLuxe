"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { Store } from "lucide-react"
import { RestaurantSignupWizard } from "@/components/auth/RestaurantSignupWizard"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any } },
}
const cardVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as any } },
}

export default function RestaurantSignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-md">
        {/* Brand */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <Link href="/auth/signup" className="inline-flex items-center gap-2.5 mb-6 group">
            <div className="w-9 h-9 rounded-lg bg-[#1A3C5E] flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <Store size={18} className="text-[#E8A020]" />
            </div>
            <span className="font-['Playfair_Display',Georgia,serif] text-xl text-[#1A3C5E] tracking-wide">DineLuxe</span>
          </Link>
          <h1 className="font-['Playfair_Display',Georgia,serif] text-3xl text-[#1A3C5E] mb-1.5">Restaurant signup</h1>
          <p className="text-sm text-[#1A3C5E]/45 tracking-wide">Register your restaurant or join an existing team</p>
        </motion.div>

        {/* Glassmorphism card */}
        <motion.div
          variants={cardVariants}
          className="rounded-3xl border border-white/70 p-8"
          style={{
            background: "rgba(255,255,255,0.65)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(26,60,94,0.08), 0 2px 8px rgba(26,60,94,0.04), inset 0 1px 0 rgba(255,255,255,0.8)",
          }}
        >
          <RestaurantSignupWizard />
          <div className="mt-6 pt-5 border-t border-[#1A3C5E]/6 text-center">
            <p className="text-sm text-[#1A3C5E]/40">
              Already have an account?{" "}
              <Link href="/auth/restaurant" className="text-[#E8A020] font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="mt-6 text-center">
          <Link href="/auth/signup"
            className="inline-flex items-center gap-1.5 text-xs text-[#1A3C5E]/35 hover:text-[#1A3C5E]/60 transition-colors tracking-wide">
            ← Back to account type selection
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}
