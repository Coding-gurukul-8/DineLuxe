"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  User,
  Mail,
  Phone,
  Briefcase,
  Hash,
  CalendarDays,
  UserX,
  UserCheck,
  AlertCircle,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { apiClient } from "@/lib/api-client";
import { formatDate, cn } from "@/lib/utils";

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
type RoleBadgeRole =
  | "super_admin" | "owner" | "manager" | "host"
  | "waiter" | "chef" | "cashier" | "customer"
  | "delivery_partner" | "support_agent";

function toRoleBadgeRole(role: StaffRole): RoleBadgeRole {
  return role === "delivery" ? "delivery_partner" : (role as RoleBadgeRole);
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  employee_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  role: StaffRole;
  is_active: boolean;
  joined_at?: string | null;
  branch_id: string;
  branch?: { name: string };
}

// ── Schema ─────────────────────────────────────────────────────────────────────

const editSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name:  z.string().min(1, "Last name is required"),
  phone:      z.string().optional(),
  role:       z.enum(["waiter", "chef", "cashier", "host", "manager", "delivery"]),
});

type EditForm = z.infer<typeof editSchema>;

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

function InfoChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 bg-gray-50 rounded-xl">
      <div className="text-gray-400 mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-gray-700 font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function StaffDetailPage() {
  const { staffId } = useParams<{ staffId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  // ── Load staff member ──────────────────────────────────────────────────────
  const {
    data: staff,
    isLoading,
    isError,
  } = useQuery<StaffMember>({
    queryKey: ["staff", staffId],
    queryFn: () => apiClient.get<StaffMember>(`/staff/${staffId}`),
    staleTime: 30_000,
    enabled: !!staffId,
  });

  // ── Edit form ──────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    if (staff) {
      reset({
        first_name: staff.first_name,
        last_name:  staff.last_name,
        phone:      staff.phone ?? "",
        role:       staff.role,
      });
    }
  }, [staff, reset]);

  // ── Save mutation ──────────────────────────────────────────────────────────
  const { mutate: saveStaff, isPending: isSaving } = useMutation({
    mutationFn: (data: EditForm) =>
      apiClient.patch(`/staff/${staffId}`, {
        first_name: data.first_name,
        last_name:  data.last_name,
        phone:      data.phone?.trim() || undefined,
        role:       data.role,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff", staffId] });
      qc.invalidateQueries({ queryKey: ["staff", "branch"] });
      toast.success("Staff member updated successfully");
    },
    onError: () => toast.error("Failed to update staff member"),
  });

  // ── Toggle access mutation ─────────────────────────────────────────────────
  const { mutate: toggleAccess, isPending: isToggling } = useMutation({
    mutationFn: () =>
      apiClient.patch(`/staff/${staffId}/toggle-access`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff", staffId] });
      qc.invalidateQueries({ queryKey: ["staff", "branch"] });
      toast.success(
        staff?.is_active
          ? `${staff.first_name}'s access has been revoked`
          : `${staff?.first_name}'s access has been restored`
      );
    },
    onError: () => toast.error("Failed to update access"),
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <PageWrapper>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-7 w-48 bg-gray-100 rounded-lg animate-pulse" />
        </div>
        <div className="max-w-2xl space-y-4">
          <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </PageWrapper>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (isError || !staff) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm">Staff member not found</p>
          <button
            onClick={() => router.push("/owner/staff")}
            className="text-sm text-[#1A3C5E] hover:underline flex items-center gap-1"
          >
            <ArrowLeft size={13} /> Back to staff list
          </button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/owner/staff")}
          className="p-2 rounded-xl border border-gray-200 text-gray-400 hover:text-[#1A3C5E] hover:border-[#1A3C5E]/30 transition"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "Playfair Display, serif" }}
          >
            {staff.first_name} {staff.last_name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <RoleBadge role={toRoleBadgeRole(staff.role)} size="sm" />
            <StatusBadge status={staff.is_active ? "active" : "inactive"} size="sm" />
          </div>
        </div>

        {/* Access toggle */}
        <button
          onClick={() => toggleAccess()}
          disabled={isToggling}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition",
            staff.is_active
              ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100"
          )}
        >
          {isToggling ? (
            <Loader2 size={14} className="animate-spin" />
          ) : staff.is_active ? (
            <UserX size={14} />
          ) : (
            <UserCheck size={14} />
          )}
          {staff.is_active ? "Suspend" : "Reactivate"}
        </button>
      </div>

      <div className="max-w-2xl space-y-4">
        {/* Info card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
        >
          <div className="flex items-center gap-2.5 mb-4 pb-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-lg bg-[#1A3C5E]/8 flex items-center justify-center text-[#1A3C5E]">
              <User size={15} />
            </div>
            <h2 className="text-sm font-semibold text-gray-800">Staff Information</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoChip icon={<Mail size={14} />} label="Email" value={staff.email} />
            {staff.phone && (
              <InfoChip icon={<Phone size={14} />} label="Phone" value={staff.phone} />
            )}
            {staff.employee_id && (
              <InfoChip icon={<Hash size={14} />} label="Employee ID" value={staff.employee_id} />
            )}
            {staff.joined_at && (
              <InfoChip
                icon={<CalendarDays size={14} />}
                label="Joined"
                value={formatDate(staff.joined_at)}
              />
            )}
            {staff.branch?.name && (
              <InfoChip
                icon={<Briefcase size={14} />}
                label="Branch"
                value={staff.branch.name}
              />
            )}
          </div>

          {/* Access revoked banner */}
          {!staff.is_active && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <AlertCircle size={14} />
              This staff member&apos;s access has been suspended. They cannot log in.
            </div>
          )}
        </motion.div>

        {/* Edit form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
        >
          <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-gray-50">
            <div className="w-8 h-8 rounded-lg bg-[#1A3C5E]/8 flex items-center justify-center text-[#1A3C5E]">
              <Save size={15} />
            </div>
            <h2 className="text-sm font-semibold text-gray-800">Edit Details</h2>
          </div>

          <form
            onSubmit={handleSubmit((d) => saveStaff(d))}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" error={errors.first_name?.message} required>
                <input {...register("first_name")} className={inputCls(!!errors.first_name)} />
              </Field>
              <Field label="Last Name" error={errors.last_name?.message} required>
                <input {...register("last_name")} className={inputCls(!!errors.last_name)} />
              </Field>
            </div>

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
                  {STAFF_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </Field>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => reset()}
                disabled={!isDirty || isSaving}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={!isDirty || isSaving || isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-[#1A3C5E] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#15304d] disabled:opacity-50 transition"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </PageWrapper>
  );
}