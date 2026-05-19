"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import PageWrapper from "@/components/layout/PageWrapper";
import { cn } from "@/lib/utils";

// ── Validation — mirrors backend createBranchSchema ───────────────────────────
// Backend expects: name, address_line1, address_line2?, city, state, pincode,
//   phone?, seating_capacity, manager_id?, operating_hours?
// Prompt's simplified fields (address, capacity, opening_time, closing_time)
// are mapped to the actual backend field names here.

const branchSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  address_line1: z.string().min(5, "Address is required").max(200),
  address_line2: z.string().max(200).optional(),
  city: z.string().min(2, "City is required").max(100),
  state: z.string().min(2, "State is required").max(100),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
  seating_capacity: z
    .number({ invalid_type_error: "Capacity must be a number" })
    .int()
    .min(1, "Minimum capacity is 1")
    .max(1000),
});

type BranchFormData = z.infer<typeof branchSchema>;

interface BranchResponse {
  id: string;
  name: string;
}

// ── Reusable field wrapper ────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls = (hasError?: boolean) =>
  cn(
    "w-full min-h-11 px-3 py-2.5 rounded-lg border text-sm outline-none transition",
    "focus:ring-2 focus:ring-[#1A3C5E]/20 focus:border-[#1A3C5E]",
    hasError ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
  );

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewBranchPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: { seating_capacity: undefined },
  });

  const { mutate: createBranch, isPending } = useMutation({
    mutationFn: (data: BranchFormData) => {
      // Strip empty optional fields before sending
      const payload = {
        ...data,
        phone: data.phone?.trim() || undefined,
        address_line2: data.address_line2?.trim() || undefined,
      };
      return apiClient.post<BranchResponse>("/branches", payload);
    },
    onSuccess: () => {
      toast.success("Branch created successfully");
      router.push("/owner/branches");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to create branch");
    },
  });

  return (
    <PageWrapper
      title="New Branch"
      subtitle="Add a new restaurant location to your network"
      action={
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <ArrowLeft size={15} />
          Back
        </button>
      }
    >
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Form header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A3C5E] text-white">
              <Building2 size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">Branch Details</p>
              <p className="text-xs text-gray-500">
                All fields marked <span className="text-red-500">*</span> are required
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit((data) => createBranch(data))}
            className="p-6 space-y-5"
          >
            {/* Name */}
            <Field label="Branch Name" required error={errors.name?.message}>
              <input
                {...register("name")}
                placeholder="e.g. Koramangala Branch"
                className={inputCls(!!errors.name)}
              />
            </Field>

            {/* Address */}
            <Field
              label="Address Line 1"
              required
              error={errors.address_line1?.message}
            >
              <input
                {...register("address_line1")}
                placeholder="Street address, building, plot no."
                className={inputCls(!!errors.address_line1)}
              />
            </Field>

            <Field label="Address Line 2" error={errors.address_line2?.message}>
              <input
                {...register("address_line2")}
                placeholder="Floor, landmark (optional)"
                className={inputCls(!!errors.address_line2)}
              />
            </Field>

            {/* City / State / Pincode */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="City" required error={errors.city?.message}>
                <input
                  {...register("city")}
                  placeholder="e.g. Bengaluru"
                  className={inputCls(!!errors.city)}
                />
              </Field>
              <Field label="State" required error={errors.state?.message}>
                <input
                  {...register("state")}
                  placeholder="e.g. Karnataka"
                  className={inputCls(!!errors.state)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Pincode" required error={errors.pincode?.message}>
                <input
                  {...register("pincode")}
                  placeholder="6-digit pincode"
                  maxLength={6}
                  className={inputCls(!!errors.pincode)}
                />
              </Field>
              <Field label="Phone" error={errors.phone?.message}>
                <input
                  {...register("phone")}
                  type="tel"
                  placeholder="10-digit mobile no."
                  className={inputCls(!!errors.phone)}
                />
              </Field>
            </div>

            {/* Capacity */}
            <Field
              label="Seating Capacity"
              required
              error={errors.seating_capacity?.message}
            >
              <input
                {...register("seating_capacity", { valueAsNumber: true })}
                type="number"
                min={1}
                max={1000}
                placeholder="e.g. 60"
                className={inputCls(!!errors.seating_capacity)}
              />
            </Field>

            {/* Submit */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => router.push("/owner/branches")}
                className="flex-1 min-h-11 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 min-h-11 rounded-lg bg-[#1A3C5E] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#15304d] transition disabled:opacity-60"
              >
                {isPending && <Loader2 size={15} className="animate-spin" />}
                {isPending ? "Creating…" : "Create Branch"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageWrapper>
  );
}