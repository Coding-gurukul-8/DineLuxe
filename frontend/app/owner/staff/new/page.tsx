"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Briefcase,
  KeyRound,
  Loader2,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────────

const STAFF_ROLES = [
  { value: "waiter",   label: "Waiter" },
  { value: "chef",     label: "Chef" },
  { value: "cashier",  label: "Cashier" },
  { value: "host",     label: "Host" },
  { value: "manager",  label: "Manager" },
  { value: "delivery", label: "Delivery" },
] as const;

type StaffRole = (typeof STAFF_ROLES)[number]["value"];

// ── Schema ─────────────────────────────────────────────────────────────────────

const schema = z.object({
  first_name:     z.string().min(1, "First name is required"),
  last_name:      z.string().min(1, "Last name is required"),
  email:          z.string().email("Enter a valid email address"),
  phone:          z.string().optional(),
  role:           z.enum(["waiter", "chef", "cashier", "host", "manager", "delivery"], {
    required_error: "Please select a role",
  }),
  temp_password:  z.string().min(8, "Password must be at least 8 characters"),
});

type FormData = z.infer<typeof schema>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;
  const rand = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = [rand(upper), rand(lower), rand(digits), rand(special)];
  for (let i = 0; i < 8; i++) base.push(rand(all));
  return base.sort(() => Math.random() - 0.5).join("");
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const inputCls = (hasError?: boolean) =>
  cn(
    "w-full px-3 py-2.5 rounded-xl border text-sm bg-white outline-none transition",
    "focus:ring-2 focus:ring-[#1A3C5E]/20 focus:border-[#1A3C5E]",
    hasError ? "border-red-300 bg-red-50/40" : "border-gray-200"
  );

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NewStaffPage() {
  const router = useRouter();
  const { branchId } = useAuth();
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { temp_password: generatePassword() },
  });

  const tempPassword = watch("temp_password");

  const { mutate: createStaff } = useMutation({
    mutationFn: (data: FormData) =>
      apiClient.post("/staff", {
        first_name:    data.first_name,
        last_name:     data.last_name,
        email:         data.email,
        phone:         data.phone?.trim() || undefined,
        role:          data.role,
        branch_id:     branchId,
        temp_password: data.temp_password,
      }),
    onSuccess: () => {
      toast.success("Staff member created — login credentials sent via email");
      router.push("/owner/staff");
    },
    onError: (err: any) => {
      if (err?.statusCode === 409) {
        setError("email", { message: "This email is already registered in the system" });
      } else {
        toast.error("Failed to create staff member. Please try again.");
      }
    },
  });

  function handleCopyPassword() {
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleRegeneratePassword() {
    setValue("temp_password", generatePassword(), { shouldValidate: true });
  }

  return (
    <PageWrapper>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/owner/staff")}
          className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30 transition"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            Add Staff Member
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Create a new staff account for your branch
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <form
          onSubmit={handleSubmit((d) => createStaff(d))}
          className="space-y-5"
        >
          {/* Personal info card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
          >
            <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-gray-50">
              <div className="w-8 h-8 rounded-lg bg-[#1A3C5E]/8 flex items-center justify-center text-[#1A3C5E]">
                <User size={15} />
              </div>
              <h2 className="text-sm font-semibold text-gray-800">Personal Information</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name" error={errors.first_name?.message} required>
                  <div className="relative">
                    <input
                      {...register("first_name")}
                      placeholder="e.g. Priya"
                      className={inputCls(!!errors.first_name)}
                    />
                  </div>
                </Field>
                <Field label="Last Name" error={errors.last_name?.message} required>
                  <input
                    {...register("last_name")}
                    placeholder="e.g. Sharma"
                    className={inputCls(!!errors.last_name)}
                  />
                </Field>
              </div>

              <Field label="Email Address" error={errors.email?.message} required>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="staff@restaurant.com"
                    className={cn(inputCls(!!errors.email), "pl-9")}
                  />
                </div>
              </Field>

              <Field label="Phone Number" error={errors.phone?.message}>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    {...register("phone")}
                    type="tel"
                    placeholder="+91 98765 43210"
                    className={cn(inputCls(!!errors.phone), "pl-9")}
                  />
                </div>
              </Field>

              <Field label="Role" error={errors.role?.message} required>
                <div className="relative">
                  <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <select
                    {...register("role")}
                    className={cn(inputCls(!!errors.role), "pl-9 appearance-none")}
                  >
                    <option value="">Select a role…</option>
                    {STAFF_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>
          </motion.div>

          {/* Temp password card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
          >
            <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-gray-50">
              <div className="w-8 h-8 rounded-lg bg-[#1A3C5E]/8 flex items-center justify-center text-[#1A3C5E]">
                <KeyRound size={15} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Temporary Password</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Staff will be prompted to change this on first login
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Field label="Temporary Password" error={errors.temp_password?.message} required>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      {...register("temp_password")}
                      type="text"
                      className={cn(inputCls(!!errors.temp_password), "font-mono tracking-wide")}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    title="Copy password"
                    className={cn(
                      "px-3 rounded-xl border text-sm font-medium transition flex items-center gap-1.5",
                      copied
                        ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                        : "border-gray-200 text-gray-500 hover:border-[#1A3C5E]/40 hover:text-[#1A3C5E]"
                    )}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRegeneratePassword}
                    title="Generate new password"
                    className="px-3 rounded-xl border border-gray-200 text-gray-500 hover:border-[#1A3C5E]/40 hover:text-[#1A3C5E] transition"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </Field>

              {/* Strength meter */}
              {tempPassword && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="pt-1"
                >
                  <PasswordStrengthMeter password={tempPassword} />
                </motion.div>
              )}

              <div className="px-3 py-2.5 bg-[#1A3C5E]/4 rounded-xl text-xs text-gray-500 leading-relaxed">
                This temporary password will be sent to the staff member&apos;s email along with login instructions.
                They will be required to set a new password on first login.
              </div>
            </div>
          </motion.div>

          {/* Branch info */}
          {branchId && (
            <div className="flex items-center gap-2 px-4 py-3 bg-[#E8A020]/8 border border-[#E8A020]/20 rounded-xl text-sm text-gray-600">
              <div className="w-2 h-2 rounded-full bg-[#E8A020]" />
              Staff will be assigned to your current branch (ID: <span className="font-mono text-xs">{branchId}</span>)
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => router.push("/owner/staff")}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-[#1A3C5E] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#15304d] disabled:opacity-60 transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating…
                </>
              ) : (
                "Create Staff Member"
              )}
            </button>
          </div>
        </form>
      </div>
    </PageWrapper>
  );
}