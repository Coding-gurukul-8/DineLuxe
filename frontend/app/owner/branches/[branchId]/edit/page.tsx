"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import PageWrapper from "@/components/layout/PageWrapper";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Branch {
  id: string;
  name: string;
  // Backend stores address_line1 etc. only during create; after persisting,
  // they are merged into the single `address` column. We reconstruct fields
  // from the combined address when editing.
  address: string;
  phone: string | null;
  seating_capacity: number | null;
  is_active: boolean;
  operating_hours: Record<string, unknown> | null;
}

// ── Validation — mirrors backend updateBranchSchema (all optional PATCH) ──────

const editBranchSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  address_line1: z.string().min(5, "Address is required").max(200).optional(),
  address_line2: z.string().max(200).optional(),
  city: z.string().min(2, "City is required").max(100).optional(),
  state: z.string().min(2, "State is required").max(100).optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Pincode must be exactly 6 digits")
    .optional(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
  seating_capacity: z
    .number({ invalid_type_error: "Capacity must be a number" })
    .int()
    .min(1)
    .max(1000)
    .optional(),
});

type EditBranchFormData = z.infer<typeof editBranchSchema>;

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
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

export default function EditBranchPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditBranchFormData>({
    resolver: zodResolver(editBranchSchema),
  });

  // ── Fetch existing branch data ─────────────────────────────────────────────
  const {
    data: branch,
    isLoading,
    isError,
    refetch,
  } = useQuery<Branch>({
    queryKey: ["branch", branchId],
    queryFn: () => apiClient.get<Branch>(`/branches/${branchId}`),
    enabled: !!branchId,
  });

  // Pre-fill form once branch loads.
  // The backend stores a combined `address` string. We place it in address_line1
  // since we cannot reliably split it, and leave address_line2 blank. The user
  // can correct the split before saving.
  useEffect(() => {
    if (!branch) return;
    reset({
      name: branch.name ?? "",
      address_line1: branch.address ?? "",
      address_line2: "",
      city: "",
      state: "",
      pincode: "",
      phone: branch.phone ?? "",
      seating_capacity: branch.seating_capacity ?? undefined,
    });
  }, [branch, reset]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const { mutate: updateBranch, isPending } = useMutation({
    mutationFn: (data: EditBranchFormData) => {
      // Only send changed/non-empty fields
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== "") {
          payload[key] = value;
        }
      }
      return apiClient.patch<Branch>(`/branches/${branchId}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch", branchId] });
      qc.invalidateQueries({ queryKey: ["owner-branches"] });
      toast.success("Branch updated successfully");
      router.push(`/owner/branches/${branchId}`);
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to update branch");
    },
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageWrapper
      title="Edit Branch"
      subtitle="Update branch details — only changed fields are sent to the server"
      action={
        <button
          onClick={() => router.push(`/owner/branches/${branchId}`)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <ArrowLeft size={15} />
          Back
        </button>
      }
    >
      <div className="max-w-2xl">
        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            <SkeletonCard variant="stat" count={1} />
            <SkeletonCard variant="text" count={1} />
          </div>
        )}

        {/* Error */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <p className="text-gray-500 text-sm">Failed to load branch.</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-[#1A3C5E] text-white text-sm font-semibold rounded-lg hover:bg-[#15304d] transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Form */}
        {!isLoading && !isError && branch && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A3C5E] text-white">
                <Building2 size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Editing: {branch.name}
                </p>
                <p className="text-xs text-gray-500">
                  Leave a field unchanged to keep its current value
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit((data) => updateBranch(data))}
              className="p-6 space-y-5"
            >
              {/* Name */}
              <Field label="Branch Name" error={errors.name?.message}>
                <input
                  {...register("name")}
                  placeholder="Branch name"
                  className={inputCls(!!errors.name)}
                />
              </Field>

              {/* Address */}
              <Field label="Address Line 1" error={errors.address_line1?.message}>
                <input
                  {...register("address_line1")}
                  placeholder="Street address"
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
                <Field label="City" error={errors.city?.message}>
                  <input
                    {...register("city")}
                    placeholder="City"
                    className={inputCls(!!errors.city)}
                  />
                </Field>
                <Field label="State" error={errors.state?.message}>
                  <input
                    {...register("state")}
                    placeholder="State"
                    className={inputCls(!!errors.state)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Pincode" error={errors.pincode?.message}>
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
              <Field label="Seating Capacity" error={errors.seating_capacity?.message}>
                <input
                  {...register("seating_capacity", { valueAsNumber: true })}
                  type="number"
                  min={1}
                  max={1000}
                  placeholder="e.g. 60"
                  className={inputCls(!!errors.seating_capacity)}
                />
              </Field>

              {/* Actions */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/owner/branches/${branchId}`)}
                  className="flex-1 min-h-11 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !isDirty}
                  className="flex-1 min-h-11 rounded-lg bg-[#1A3C5E] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#15304d] transition disabled:opacity-60"
                >
                  {isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {isPending ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}