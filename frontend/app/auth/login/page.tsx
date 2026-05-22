"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ShieldCheck, Store, Utensils } from "lucide-react"

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
    href: "/auth/admin",
    icon: ShieldCheck,
    label: "Admin Portal",
    title: "Admin App",
    description: "Platform operations, restaurants, analytics, and system health.",
    cta: "Continue as admin",
    delay: 0,
  },
  {
    href: "/auth/restaurant",
    icon: Store,
    label: "Restaurant Portal",
    title: "Restaurant Team",
    description: "Owners, managers, and staff dashboards for day-to-day operations.",
    cta: "Continue as restaurant",
    delay: 0.08,
    featured: true,
  },
  {
    href: "/auth/customer",
    icon: Utensils,
    label: "Customer Portal",
    title: "Customer",
    description: "Browse restaurants, book tables, and manage your orders.",
    cta: "Continue as customer",
    delay: 0.16,
  },
]

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#1A3C5E]">
        {/* Ambient particles (CSS-only) */}
        <div className="absolute inset-0">
          {[...Array(18)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-[#E8A020]/20"
              style={{
                width: `${6 + (i % 5) * 4}px`,
                height: `${6 + (i % 5) * 4}px`,
                left: `${(i * 17 + 11) % 90}%`,
                top: `${(i * 23 + 7) % 85}%`,
                animation: `float-particle ${6 + (i % 4) * 2}s ease-in-out ${i * 0.4}s infinite alternate`,
              }}
            />
          ))}
        </div>

        {/* Diagonal grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Ambient glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-[#E8A020]/10 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full bg-white/5 blur-2xl" />

        {/* Food montage — abstract SVG illustration */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] as any }}
            className="relative w-80 h-80"
            style={{ animation: "slow-parallax 8s ease-in-out infinite alternate" }}
          >
            <svg viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              {/* Plate base */}
              <ellipse cx="160" cy="220" rx="110" ry="18" fill="#E8A020" opacity="0.15" />
              <circle cx="160" cy="180" r="90" fill="white" opacity="0.05" stroke="#E8A020" strokeWidth="1" strokeDasharray="4 6" />
              <circle cx="160" cy="180" r="72" fill="white" opacity="0.04" />
              {/* Stylized food elements */}
              <path d="M110 160 Q130 120 160 155 Q190 120 210 160 Q200 200 160 205 Q120 200 110 160Z" fill="#E8A020" opacity="0.35" />
              <path d="M130 150 Q160 115 190 150 Q180 185 160 188 Q140 185 130 150Z" fill="#E8A020" opacity="0.5" />
              {/* Fork */}
              <line x1="80" y1="120" x2="80" y2="200" stroke="#E8A020" strokeWidth="2" strokeLinecap="round" />
              <line x1="74" y1="120" x2="74" y2="145" stroke="#E8A020" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="80" y1="120" x2="80" y2="145" stroke="#E8A020" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="86" y1="120" x2="86" y2="145" stroke="#E8A020" strokeWidth="1.5" strokeLinecap="round" />
              {/* Knife */}
              <line x1="240" y1="120" x2="240" y2="200" stroke="#E8A020" strokeWidth="2" strokeLinecap="round" />
              <path d="M240 120 L248 140 L240 145Z" fill="#E8A020" opacity="0.6" />
              {/* Stars/sparkles */}
              <circle cx="100" cy="90" r="3" fill="#E8A020" opacity="0.7" />
              <circle cx="220" cy="80" r="2" fill="#E8A020" opacity="0.5" />
              <circle cx="250" cy="150" r="2.5" fill="#E8A020" opacity="0.4" />
              <circle cx="70" cy="220" r="2" fill="#E8A020" opacity="0.4" />
            </svg>
          </motion.div>
        </div>

        {/* Left panel text */}
        <div className="absolute bottom-0 left-0 right-0 p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] as any }}
          >
            <p className="text-[#E8A020] text-xs tracking-[0.25em] uppercase font-medium mb-3">
              Fine Dining, Elevated
            </p>
            <h2 className="font-['Playfair_Display',Georgia,serif] text-3xl text-white leading-snug">
              The operating system<br />
              <em>great restaurants</em> run on.
            </h2>
          </motion.div>
        </div>

        <style jsx>{`
          @keyframes float-particle {
            from { transform: translateY(0px) scale(1); opacity: 0.2; }
            to { transform: translateY(-20px) scale(1.1); opacity: 0.5; }
          }
          @keyframes slow-parallax {
            from { transform: translateY(0px) rotate(0deg); }
            to { transform: translateY(-12px) rotate(1deg); }
          }
        `}</style>
      </div>

      {/* Right panel — portal selector */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-16 bg-[#FDFAF5]">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md"
        >
          {/* Brand mark */}
          <motion.div variants={itemVariants} className="text-center mb-12">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#1A3C5E] flex items-center justify-center">
                <Utensils size={20} className="text-[#E8A020]" />
              </div>
              <span className="font-['Playfair_Display',Georgia,serif] text-2xl text-[#1A3C5E] tracking-wide">
                DineLuxe
              </span>
            </div>
            <h1 className="font-['Playfair_Display',Georgia,serif] text-3xl text-[#1A3C5E] mb-2">
              Welcome back
            </h1>
            <p className="text-sm text-[#1A3C5E]/50 tracking-wide">
              Select your portal to continue
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
                    {/* Gold accent bar on hover */}
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
                        Enter →
                      </span>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>

          <motion.div variants={itemVariants} className="mt-8 text-center">
            <Link
              href="/auth/forgot-password"
              className="text-xs text-[#1A3C5E]/40 hover:text-[#E8A020] transition-colors tracking-wide"
            >
              Forgot your password?
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
