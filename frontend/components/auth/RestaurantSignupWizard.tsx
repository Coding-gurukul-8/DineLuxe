"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError } from "@repo/shared"
import { registerRestaurant } from "@/lib/auth-client"
import { PasswordStrengthMeter } from "./PasswordStrengthMeter"
import {
  Loader2, User, Mail, Phone, Lock,
  ChevronRight, ChevronLeft, Check, Store, Eye, EyeOff, CheckCircle2,
  Calendar, MapPin, Building2, Hash, Globe, ClipboardList,
} from "lucide-react"

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")

const requiredPhoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")

const optionalPhoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
  .optional()
  .or(z.literal(""))

const cuisineSchema = z
  .string()
  .min(1, "Enter at least one cuisine")
  .refine(
    (value) => value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean).length > 0,
    "Enter at least one cuisine"
  )

const restaurantSignupSchema = z
  .object({
    ownerFirstName: z.string().min(1, "First name is required"),
    ownerLastName: z.string().min(1, "Last name is required"),
    ownerEmail: z.string().email("Enter a valid email"),
    ownerPhone: requiredPhoneSchema,
    ownerDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "DOB must be YYYY-MM-DD"),

    restaurantName: z.string().min(2, "Restaurant name is required"),
    cuisineTypes: cuisineSchema,
    restaurantDescription: z.string().max(500, "Description must be 500 characters or less").optional().or(z.literal("")),
    restaurantGstNumber: z
      .string()
      .regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        "Invalid GST number"
      )
      .optional()
      .or(z.literal("")),
    restaurantContactEmail: z.string().email("Enter a valid contact email").optional().or(z.literal("")),
    restaurantContactPhone: optionalPhoneSchema,
    restaurantWebsite: z.string().url("Enter a valid website URL (include https://)").optional().or(z.literal("")),

    branchName: z.string().min(2, "Branch name is required"),
    branchAddressLine1: z.string().min(5, "Address is required").max(200),
    branchAddressLine2: z.string().max(200).optional().or(z.literal("")),
    branchCity: z.string().min(2, "City is required").max(100),
    branchState: z.string().min(2, "State is required").max(100),
    branchPincode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
    branchPhone: optionalPhoneSchema,
    branchSeatingCapacity: z
      .coerce
      .number({ invalid_type_error: "Seating capacity must be a number" })
      .int()
      .min(1, "Minimum capacity is 1")
      .max(500, "Maximum capacity is 500"),

    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type RestaurantSignupFormValues = z.infer<typeof restaurantSignupSchema>

function FloatingInput({
  id, label, type = "text", icon, error, disabled, registration, onChange: onChangeProp, suffix,
}: {
  id: string; label: string; type?: string; icon: React.ReactNode
  error?: string; disabled?: boolean; registration: object
  onChange?: () => void; suffix?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  const [hasValue, setHasValue] = useState(false)

  return (
    <div>
      <div className={`relative rounded-xl border transition-all duration-300 bg-white/60 backdrop-blur-sm
        ${error ? "border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]" : ""}
        ${focused && !error ? "border-[#E8A020] shadow-[0_0_0_3px_rgba(232,160,32,0.12)]" : ""}
        ${!focused && !error ? "border-[#1A3C5E]/12 hover:border-[#1A3C5E]/25" : ""}`}>
        <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none
          ${focused ? "text-[#E8A020]" : "text-[#1A3C5E]/30"}`}>{icon}</div>
        <label htmlFor={id}
          className={`absolute left-11 pointer-events-none transition-all duration-200 ease-out
            ${(focused || hasValue) ? "top-2 text-[10px] tracking-wider" : "top-1/2 -translate-y-1/2 text-sm"}
            ${focused ? "text-[#E8A020]" : error ? "text-red-400" : "text-[#1A3C5E]/50"}`}>
          {label}
        </label>
        <input id={id} type={type} disabled={disabled}
          className="w-full bg-transparent pt-6 pb-2 pl-11 pr-11 text-sm text-[#1A3C5E] outline-none rounded-xl placeholder-transparent disabled:opacity-50"
          {...(registration as object)}
          onFocus={() => setFocused(true)}
          onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
            setFocused(false); setHasValue(e.target.value.length > 0)
            ;(registration as { onBlur?: (e: React.FocusEvent) => void }).onBlur?.(e)
          }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setHasValue(e.target.value.length > 0)
            ;(registration as { onChange?: (e: React.ChangeEvent) => void }).onChange?.(e)
            onChangeProp?.()
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-xl">
          <motion.div className="h-full bg-[#E8A020]" initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: focused ? 1 : 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as any }} />
        </div>
        {suffix && <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-1.5 ml-1 text-xs text-red-500">{error}</motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

const STEPS = [
  { title: "Owner Details", description: "Tell us about the account owner" },
  { title: "Restaurant Details", description: "Set up your restaurant profile" },
  { title: "Branch Details", description: "Add your first branch" },
  { title: "Security Setup", description: "Create a strong password" },
]

function splitCuisines(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function cleanOptional(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function RestaurantSignupWizard({ initialStep = 0 }: { initialStep?: number } = {}) {
  const [step, setStep]       = useState(Math.max(0, Math.min(initialStep, 3)))
  const [direction, setDir]   = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const router = useRouter()

  const { register, handleSubmit, trigger, watch, formState: { errors } } = useForm<RestaurantSignupFormValues>({
    resolver: zodResolver(restaurantSignupSchema),
    mode: "onChange",
  })

  const password = watch("password") ?? ""
  const confirmPassword = watch("confirmPassword") ?? ""

  const handleNext = async () => {
    const fieldsPerStep: (keyof RestaurantSignupFormValues)[][] = [
      ["ownerFirstName", "ownerLastName", "ownerEmail", "ownerPhone", "ownerDob"],
      [
        "restaurantName",
        "cuisineTypes",
        "restaurantDescription",
        "restaurantGstNumber",
        "restaurantContactEmail",
        "restaurantContactPhone",
        "restaurantWebsite",
      ],
      [
        "branchName",
        "branchAddressLine1",
        "branchAddressLine2",
        "branchCity",
        "branchState",
        "branchPincode",
        "branchPhone",
        "branchSeatingCapacity",
      ],
      ["password", "confirmPassword"],
    ]
    const valid = await trigger(fieldsPerStep[step])
    if (valid) { setDir(1); setStep((p) => p + 1); setError(null) }
  }

  const handleBack = () => { setDir(-1); setStep((p) => p - 1); setError(null) }

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.statusCode === 409) return "An account with this email already exists."
      return err.message || "An unexpected error occurred. Please try again."
    }
    return "An unexpected error occurred. Please try again."
  }

  const onSubmit = async (data: RestaurantSignupFormValues) => {
    setIsSubmitting(true); setError(null)
    try {
      const cuisines = splitCuisines(data.cuisineTypes)
      await registerRestaurant({
        owner: {
          firstName: data.ownerFirstName.trim(),
          lastName: data.ownerLastName.trim(),
          email: data.ownerEmail.trim(),
          phone: data.ownerPhone.trim(),
          dob: data.ownerDob,
          password: data.password,
        },
        restaurant: {
          name: data.restaurantName.trim(),
          cuisineTypes: cuisines,
          description: cleanOptional(data.restaurantDescription),
          gstNumber: cleanOptional(data.restaurantGstNumber),
          contactEmail: cleanOptional(data.restaurantContactEmail),
          contactPhone: cleanOptional(data.restaurantContactPhone),
          website: cleanOptional(data.restaurantWebsite),
        },
        branch: {
          name: data.branchName.trim(),
          addressLine1: data.branchAddressLine1.trim(),
          addressLine2: cleanOptional(data.branchAddressLine2),
          city: data.branchCity.trim(),
          state: data.branchState.trim(),
          pincode: data.branchPincode.trim(),
          phone: cleanOptional(data.branchPhone),
          seatingCapacity: data.branchSeatingCapacity,
        },
      })
      setIsSuccess(true)
      setTimeout(() => router.push("/auth/restaurant"), 900)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as any } },
    exit: (dir: number) => ({ x: dir < 0 ? 50 : -50, opacity: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as any } }),
  }

  return (
    <div className="space-y-0">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-[10px] text-[#1A3C5E]/40 tracking-wider uppercase mb-2">
          <span>{STEPS[step].title}</span>
          <span>{step + 1} / {STEPS.length}</span>
        </div>
        <div className="h-1 rounded-full bg-[#1A3C5E]/8 overflow-hidden">
          <motion.div className="h-full rounded-full bg-[#E8A020]"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
        </div>
        <p className="mt-1.5 text-xs text-[#1A3C5E]/35">{STEPS[step].description}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="overflow-hidden min-h-[520px]">
          <AnimatePresence mode="wait" custom={direction}>
            {/* Step 0: Owner details */}
            {step === 0 && (
              <motion.div key="personal" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FloatingInput id="rst-owner-firstName" label="First name" icon={<User size={17} />}
                    error={errors.ownerFirstName?.message} disabled={isSubmitting} registration={register("ownerFirstName")} />
                  <FloatingInput id="rst-owner-lastName" label="Last name" icon={<User size={17} />}
                    error={errors.ownerLastName?.message} disabled={isSubmitting} registration={register("ownerLastName")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FloatingInput id="rst-owner-email" label="Email address" type="email" icon={<Mail size={17} />}
                    error={errors.ownerEmail?.message} disabled={isSubmitting} registration={register("ownerEmail")} />
                  <FloatingInput id="rst-owner-phone" label="Phone number" type="tel" icon={<Phone size={17} />}
                    error={errors.ownerPhone?.message} disabled={isSubmitting} registration={register("ownerPhone")} />
                </div>
                <FloatingInput id="rst-owner-dob" label="Date of birth" type="date" icon={<Calendar size={17} />}
                  error={errors.ownerDob?.message} disabled={isSubmitting} registration={register("ownerDob")} />
              </motion.div>
            )}

            {/* Step 1: Restaurant details */}
            {step === 1 && (
              <motion.div key="restaurant" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" className="space-y-4">
                <FloatingInput id="rst-restaurant-name" label="Restaurant name" icon={<Store size={17} />}
                  error={errors.restaurantName?.message} disabled={isSubmitting} registration={register("restaurantName")} />

                <div>
                  <FloatingInput id="rst-restaurant-cuisine" label="Cuisine types" icon={<ClipboardList size={17} />}
                    error={errors.cuisineTypes?.message} disabled={isSubmitting} registration={register("cuisineTypes")} />
                  <p className="mt-1.5 ml-1 text-[11px] text-[#1A3C5E]/40">Comma-separated (e.g. Indian, Chinese)</p>
                </div>

                <FloatingInput id="rst-restaurant-description" label="Description (optional)" icon={<ClipboardList size={17} />}
                  error={errors.restaurantDescription?.message} disabled={isSubmitting} registration={register("restaurantDescription")} />

                <FloatingInput id="rst-restaurant-gst" label="GST number (optional)" icon={<Hash size={17} />}
                  error={errors.restaurantGstNumber?.message} disabled={isSubmitting} registration={register("restaurantGstNumber")} />

                <div className="grid grid-cols-2 gap-3">
                  <FloatingInput id="rst-restaurant-contact-email" label="Contact email (optional)" type="email" icon={<Mail size={17} />}
                    error={errors.restaurantContactEmail?.message} disabled={isSubmitting} registration={register("restaurantContactEmail")} />
                  <FloatingInput id="rst-restaurant-contact-phone" label="Contact phone (optional)" type="tel" icon={<Phone size={17} />}
                    error={errors.restaurantContactPhone?.message} disabled={isSubmitting} registration={register("restaurantContactPhone")} />
                </div>

                <FloatingInput id="rst-restaurant-website" label="Website (optional)" type="url" icon={<Globe size={17} />}
                  error={errors.restaurantWebsite?.message} disabled={isSubmitting} registration={register("restaurantWebsite")} />
              </motion.div>
            )}

            {/* Step 2: Branch details */}
            {step === 2 && (
              <motion.div key="branch" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" className="space-y-4">
                <FloatingInput id="rst-branch-name" label="Branch name" icon={<Building2 size={17} />}
                  error={errors.branchName?.message} disabled={isSubmitting} registration={register("branchName")} />

                <FloatingInput id="rst-branch-address1" label="Address line 1" icon={<MapPin size={17} />}
                  error={errors.branchAddressLine1?.message} disabled={isSubmitting} registration={register("branchAddressLine1")} />

                <FloatingInput id="rst-branch-address2" label="Address line 2 (optional)" icon={<MapPin size={17} />}
                  error={errors.branchAddressLine2?.message} disabled={isSubmitting} registration={register("branchAddressLine2")} />

                <div className="grid grid-cols-2 gap-3">
                  <FloatingInput id="rst-branch-city" label="City" icon={<MapPin size={17} />}
                    error={errors.branchCity?.message} disabled={isSubmitting} registration={register("branchCity")} />
                  <FloatingInput id="rst-branch-state" label="State" icon={<MapPin size={17} />}
                    error={errors.branchState?.message} disabled={isSubmitting} registration={register("branchState")} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FloatingInput id="rst-branch-pincode" label="Pincode" icon={<Hash size={17} />}
                    error={errors.branchPincode?.message} disabled={isSubmitting} registration={register("branchPincode")} />
                  <FloatingInput id="rst-branch-phone" label="Branch phone (optional)" type="tel" icon={<Phone size={17} />}
                    error={errors.branchPhone?.message} disabled={isSubmitting} registration={register("branchPhone")} />
                </div>

                <FloatingInput id="rst-branch-capacity" label="Seating capacity" type="number" icon={<Store size={17} />}
                  error={errors.branchSeatingCapacity?.message} disabled={isSubmitting}
                  registration={register("branchSeatingCapacity", { valueAsNumber: true })} />
              </motion.div>
            )}

            {/* Step 3: Security */}
            {step === 3 && (
              <motion.div key="security" custom={direction} variants={slideVariants}
                initial="enter" animate="center" exit="exit" className="space-y-4">
                <div className="space-y-1">
                  <FloatingInput id="rst-password" label="Password" type={showPassword ? "text" : "password"}
                    icon={<Lock size={17} />} error={errors.password?.message} disabled={isSubmitting}
                    registration={register("password")}
                    suffix={
                      <button type="button" onClick={() => setShowPassword((v) => !v)}
                        className="text-[#1A3C5E]/30 hover:text-[#E8A020] transition-colors p-1" tabIndex={-1}>
                        <motion.div key={showPassword ? "h" : "s"} initial={{ opacity: 0, rotate: -15 }} animate={{ opacity: 1, rotate: 0 }} transition={{ duration: 0.2 }}>
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </motion.div>
                      </button>
                    }
                  />
                  {password && <PasswordStrengthMeter password={password} className="mt-2" />}
                </div>

                <div className="space-y-1">
                  <FloatingInput id="rst-confirm" label="Confirm password" type={showConfirm ? "text" : "password"}
                    icon={<Lock size={17} />} error={errors.confirmPassword?.message} disabled={isSubmitting}
                    registration={register("confirmPassword")}
                    suffix={
                      <button type="button" onClick={() => setShowConfirm((v) => !v)}
                        className="text-[#1A3C5E]/30 hover:text-[#E8A020] transition-colors p-1" tabIndex={-1}>
                        <motion.div key={showConfirm ? "h" : "s"} initial={{ opacity: 0, rotate: -15 }} animate={{ opacity: 1, rotate: 0 }} transition={{ duration: 0.2 }}>
                          {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                        </motion.div>
                      </button>
                    }
                  />
                  <AnimatePresence>
                    {confirmPassword && password === confirmPassword && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="mt-1.5 ml-1 text-xs text-emerald-600 flex items-center gap-1">
                        <Check size={11} />Passwords match
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-4 rounded-xl bg-red-50 border border-red-200/80 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`mt-6 flex gap-3 ${step > 0 ? "justify-between" : "justify-end"}`}>
          {step > 0 && (
            <button type="button" onClick={handleBack} disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 h-12 rounded-xl border border-[#1A3C5E]/12 text-sm text-[#1A3C5E]/60 hover:border-[#1A3C5E]/30 hover:text-[#1A3C5E] transition-all duration-200 disabled:opacity-40">
              <ChevronLeft size={16} />Back
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button type="button" onClick={handleNext}
              className="flex items-center gap-1.5 px-6 h-12 rounded-xl font-medium text-sm tracking-wide text-white ml-auto"
              style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #1a4a72 100%)" }}>
              Continue<ChevronRight size={16} />
            </button>
          ) : (
            <button type="submit" disabled={isSubmitting || isSuccess}
              className="flex items-center justify-center gap-2 px-6 h-12 rounded-xl font-medium text-sm tracking-wide text-white disabled:opacity-50 ml-auto min-w-40"
              style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #1a4a72 100%)" }}>
              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.span key="s" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 text-[#E8A020]">
                    <CheckCircle2 size={17} />Done!
                  </motion.span>
                ) : isSubmitting ? (
                  <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-white/70">
                    <Loader2 size={17} className="animate-spin" />Creating…
                  </motion.span>
                ) : (
                  <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-2">
                    <Store size={16} />Create Account
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )}
        </div>
      </form>
    </div>
  )
}