"use client";

/**
 * StaffManagement — owner panel
 *
 * API CONTRACT FIXES (audit 2026-06-02)
 * ──────────────────────────────────────
 * 1. GET /staff/branch/:branchId returns { name } (combined), NOT first_name/last_name.
 *    The StaffMember interface now uses `name: string` and a `nameToDisplay()` helper
 *    splits it for display. The EditForm still sends first_name/last_name to PATCH
 *    (backend update() accepts them separately and recombines), so edit stays as-is.
 *
 * 2. POST /staff/create schema requires `dob` (YYYY-MM-DD) and `gender` — both were
 *    missing from the create form. Both fields are now collected and sent.
 *
 * 3. `delivery` role is NOT in the backend createStaffSchema / updateStaffSchema enum
 *    (only: manager | host | waiter | chef | cashier). Removed `delivery` from
 *    API_ROLES and STAFF_ROLES to prevent a 422 validation error on submit.
 *    The RoleBadge bridge (toRoleBadgeRole) is retained but no longer needs the
 *    delivery→delivery_partner mapping for staff creation.
 *
 * Existing correct behaviour preserved
 * ─────────────────────────────────────
 * • GET  /branches                      (branch selector)
 * • GET  /staff/branch/:branchId        (staff list)       ✓
 * • POST /staff/create                                     ✓
 * • PATCH /staff/:id                                       ✓
 * • PATCH /staff/:id/toggle-access                        ✓
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  UserX,
  UserCheck,
  X,
  Loader2,
  Search,
  Phone,
  Mail,
  CalendarDays,
  Hash,
  ExternalLink,
  GitBranch,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@repo/shared";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { RoleBadge } from "@/components/shared/RoleBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { maskPhone, formatDate, cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * FIX 3: `delivery` removed — backend createStaffSchema / updateStaffSchema only
 * accepts: manager | host | waiter | chef | cashier
 * Sending `delivery` causes a Zod 422 validation error from the backend.
 */
const STAFF_ROLES = [
  { value: "manager", label: "Manager" },
  { value: "waiter",  label: "Waiter" },
  { value: "cashier", label: "Cashier" },
  { value: "host",    label: "Host" },
  { value: "chef",    label: "Chef" },
] as const;

type StaffRole = (typeof STAFF_ROLES)[number]["value"];

const ROLE_FILTER_OPTIONS = [
  { value: "", label: "All Roles" },
  ...STAFF_ROLES,
];

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * FIX 1: The backend getByBranch query selects `name` (a single combined column),
 * NOT separate first_name / last_name columns. Updated type to match actual shape.
 */
interface StaffMember {
  id: string;
  employee_id?: string;
  /** Combined name from the DB `name` column, e.g. "Priya Sharma" */
  name: string;
  email: string;
  phone?: string | null;
  role: StaffRole;
  is_active: boolean;
  created_at?: string | null;
  branch_id: string;
}

interface StaffRow extends Record<string, unknown> {
  id: string;
  employee_id?: string;
  name: string;
  /** Derived: first token of name */
  first_name: string;
  /** Derived: remainder of name */
  last_name: string;
  email: string;
  phone?: string | null;
  role: StaffRole;
  is_active: boolean;
  created_at?: string | null;
  branch_id: string;
}

interface BranchOption {
  id: string;
  name: string;
}

// ── Name helper ────────────────────────────────────────────────────────────────

/** Splits "Priya Sharma" → { first: "Priya", last: "Sharma" }. */
function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last  = parts.slice(1).join(" ");
  return { first, last };
}

// ── RoleBadge compatibility bridge ─────────────────────────────────────────────

type RoleBadgeRole =
  | "super_admin"
  | "owner"
  | "manager"
  | "host"
  | "waiter"
  | "chef"
  | "cashier"
  | "customer"
  | "delivery_partner"
  | "support_agent";

function toRoleBadgeRole(role: StaffRole): RoleBadgeRole {
  return role as RoleBadgeRole;
}

// ── Schemas ────────────────────────────────────────────────────────────────────

/**
 * FIX 2: Backend createStaffSchema requires `dob` (YYYY-MM-DD) and `gender`.
 * These were absent from the old form — the POST would fail validation every time.
 */
const API_ROLES = ["manager", "waiter", "cashier", "host", "chef"] as const;

const createSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name:  z.string().min(1, "Last name is required"),
  email:      z.string().email("Enter a valid email"),
  phone:      z.string().optional(),
  dob:        z
    .string()
    .min(1, "Date of birth is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"], {
    required_error: "Select a gender",
  }),
  role: z.enum(API_ROLES, { required_error: "Select a role" }),
});

const editSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name:  z.string().min(1, "Last name is required"),
  phone:      z.string().optional(),
  role:       z.enum(API_ROLES),
});

type CreateForm = z.infer<typeof createSchema>;
type EditForm   = z.infer<typeof editSchema>;

// ── Query keys ─────────────────────────────────────────────────────────────────

const staffKey    = (branchId: string) => ["staff", "branch", branchId] as const;
const branchesKey = (restaurantId: string) => ["branches", restaurantId] as const;

// ── Branch selector ────────────────────────────────────────────────────────────

function BranchSelector({
  restaurantId,
  onSelect,
}: {
  restaurantId: string;
  onSelect: (branchId: string) => void;
}) {
  const { data: branches = [], isLoading, isError } = useQuery<BranchOption[]>({
    queryKey: branchesKey(restaurantId),
    queryFn: () => apiClient.get<BranchOption[]>("/branches"),
    enabled: !!restaurantId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <SkeletonCard variant="list-item" count={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
        <AlertCircle size={16} />
        Failed to load branches. Please refresh.
      </div>
    );
  }

  if (branches.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        No branches found for your restaurant.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <GitBranch size={15} />
        <span>Select a branch to manage its staff:</span>
      </div>
      {branches.map((branch) => (
        <button
          key={branch.id}
          onClick={() => onSelect(branch.id)}
          className="w-full text-left px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-[#1A3C5E] hover:bg-[#1A3C5E]/5 transition text-sm font-medium text-gray-800"
        >
          {branch.name}
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Create Staff Modal
// ══════════════════════════════════════════════════════════════════════════════

function CreateStaffModal({
  branchId,
  onClose,
}: {
  branchId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  const { mutate: createStaff } = useMutation({
    mutationFn: (data: CreateForm) =>
      apiClient.post("/staff/create", {
        first_name: data.first_name,
        last_name:  data.last_name,
        email:      data.email,
        // FIX 2: send dob and gender — required by backend createStaffSchema
        dob:        data.dob,
        gender:     data.gender,
        role:       data.role,
        branch_id:  branchId,
        phone:      data.phone?.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKey(branchId) });
      toast.success("Staff invited — login credentials sent via email");
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.statusCode === 409) {
        setError("email", { message: "Email already exists in the system" });
      } else {
        toast.error("Failed to create staff member");
      }
    },
  });

  return (
    <SlideOver title="Add Staff Member" onClose={onClose}>
      <form onSubmit={handleSubmit((d) => createStaff(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" error={errors.first_name?.message} required>
            <input
              {...register("first_name")}
              placeholder="Priya"
              className={inputCls(!!errors.first_name)}
            />
          </Field>
          <Field label="Last Name" error={errors.last_name?.message} required>
            <input
              {...register("last_name")}
              placeholder="Sharma"
              className={inputCls(!!errors.last_name)}
            />
          </Field>
        </div>

        <Field label="Email" error={errors.email?.message} required>
          <input
            {...register("email")}
            type="email"
            placeholder="staff@restaurant.com"
            className={inputCls(!!errors.email)}
          />
        </Field>

        <Field label="Phone" error={errors.phone?.message}>
          <input
            {...register("phone")}
            type="tel"
            placeholder="+91 98765 43210"
            className={inputCls(!!errors.phone)}
          />
        </Field>

        {/* FIX 2: dob — required by backend (used to generate the default password) */}
        <Field label="Date of Birth" error={errors.dob?.message} required>
          <input
            {...register("dob")}
            type="date"
            className={inputCls(!!errors.dob)}
          />
        </Field>

        {/* FIX 2: gender — required by backend schema */}
        <Field label="Gender" error={errors.gender?.message} required>
          <select {...register("gender")} className={inputCls(!!errors.gender)}>
            <option value="">Select gender…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </Field>

        <Field label="Role" error={errors.role?.message} required>
          <select {...register("role")} className={inputCls(!!errors.role)}>
            <option value="">Select a role…</option>
            {STAFF_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
          Staff will be assigned to the selected branch automatically. Their
          temporary password is generated from their date of birth (DDMMYYYY).
        </p>

        <SubmitButton loading={isSubmitting}>Invite Staff Member</SubmitButton>
      </form>
    </SlideOver>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Edit Staff Modal
// ══════════════════════════════════════════════════════════════════════════════

function EditStaffModal({
  staff,
  branchId,
  onClose,
}: {
  staff: StaffMember;
  branchId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { first, last } = splitName(staff.name);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      first_name: first,
      last_name:  last,
      phone:      staff.phone ?? "",
      role:       staff.role,
    },
  });

  const { mutate: updateStaff } = useMutation({
    mutationFn: (data: EditForm) =>
      apiClient.patch(`/staff/${staff.id}`, {
        first_name: data.first_name,
        last_name:  data.last_name,
        phone:      data.phone?.trim() || undefined,
        role:       data.role,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: staffKey(branchId) });
      toast.success("Staff member updated");
      onClose();
    },
    onError: () => toast.error("Failed to update staff member"),
  });

  return (
    <SlideOver
      title="Edit Staff Member"
      subtitle={staff.name}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl mb-5">
        {staff.employee_id && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Hash size={13} className="text-gray-400 shrink-0" />
            <span className="font-mono font-medium">{staff.employee_id}</span>
          </div>
        )}
        {staff.created_at && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CalendarDays size={13} className="text-gray-400 shrink-0" />
            <span>Joined {formatDate(staff.created_at)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-gray-500 col-span-2">
          <Mail size={13} className="text-gray-400 shrink-0" />
          <span className="truncate">{staff.email}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => updateStaff(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" error={errors.first_name?.message} required>
            <input {...register("first_name")} className={inputCls(!!errors.first_name)} />
          </Field>
          <Field label="Last Name" error={errors.last_name?.message} required>
            <input {...register("last_name")} className={inputCls(!!errors.last_name)} />
          </Field>
        </div>

        <Field label="Phone" error={errors.phone?.message}>
          <input
            {...register("phone")}
            type="tel"
            placeholder="+91 98765 43210"
            className={inputCls(!!errors.phone)}
          />
        </Field>

        <Field label="Role" error={errors.role?.message} required>
          <select {...register("role")} className={inputCls(!!errors.role)}>
            {STAFF_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        <SubmitButton loading={isSubmitting} disabled={!isDirty}>
          Save Changes
        </SubmitButton>
      </form>
    </SlideOver>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════════════

export function StaffManagement() {
  const { branchId, restaurantId } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const [search, setSearch]             = useState("");
  const [roleFilter, setRoleFilter]     = useState("");
  const [showCreate, setShowCreate]     = useState(false);
  const [editTarget, setEditTarget]     = useState<StaffMember | null>(null);
  const [toggleTarget, setToggleTarget] = useState<StaffMember | null>(null);

  const [overrideBranchId, setOverrideBranchId] = useState<string | null>(null);
  const selectedBranch: string | null = overrideBranchId ?? branchId ?? null;

  const debouncedSearch = useDebounce(search, 350);

  // ── Fetch staff list ─────────────────────────────────────────────────────
  // GET /staff/branch/:branchId  ← correct endpoint ✓

  const {
    data: staff = [],
    isLoading,
    isError,
  } = useQuery<StaffMember[]>({
    queryKey: staffKey(selectedBranch ?? ""),
    queryFn: () =>
      apiClient.get<StaffMember[]>(`/staff/branch/${selectedBranch}`),
    enabled: !!restaurantId && !!selectedBranch,
    staleTime: 30_000,
  });

  // ── Toggle access (optimistic) ────────────────────────────────────────────
  // PATCH /staff/:id/toggle-access  ← correct endpoint ✓

  const { mutate: toggleAccess } = useMutation({
    mutationFn: (member: StaffMember) =>
      apiClient.patch(`/staff/${member.id}/toggle-access`, {}),

    onMutate: async (member) => {
      await qc.cancelQueries({ queryKey: staffKey(selectedBranch ?? "") });
      const prev = qc.getQueryData<StaffMember[]>(staffKey(selectedBranch ?? ""));
      qc.setQueryData<StaffMember[]>(staffKey(selectedBranch ?? ""), (old) =>
        old?.map((s) =>
          s.id === member.id ? { ...s, is_active: !s.is_active } : s
        ) ?? []
      );
      return { prev };
    },

    onError: (_err, _member, ctx) => {
      if (ctx?.prev) qc.setQueryData(staffKey(selectedBranch ?? ""), ctx.prev);
      toast.error("Failed to update access");
    },

    onSuccess: (_data, member) => {
      const { first } = splitName(member.name);
      toast.success(
        member.is_active
          ? `${first}'s access revoked`
          : `${first}'s access restored`
      );
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: staffKey(selectedBranch ?? "") });
    },
  });

  // ── Filtered + searched rows ──────────────────────────────────────────────

  const rows = useMemo<StaffRow[]>(() => {
    const q = debouncedSearch.toLowerCase();
    return staff
      .filter((s) => {
        const matchesSearch =
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.role.toLowerCase().includes(q);
        const matchesRole = !roleFilter || s.role === roleFilter;
        return matchesSearch && matchesRole;
      })
      .map((s) => {
        const { first, last } = splitName(s.name);
        return {
          ...s,
          first_name: first,
          last_name:  last,
        };
      });
  }, [staff, debouncedSearch, roleFilter]);

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns: Column<StaffRow>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-semibold text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <Mail size={11} />
            {row.email}
          </p>
          {row.phone && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <Phone size={11} />
              {maskPhone(row.phone)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      render: (row) => (
        <RoleBadge role={toRoleBadgeRole(row.role)} size="sm" />
      ),
    },
    {
      key: "is_active",
      label: "Status",
      align: "center",
      render: (row) => (
        <StatusBadge status={row.is_active ? "active" : "inactive"} size="sm" />
      ),
    },
    {
      key: "created_at",
      label: "Joined",
      sortable: true,
      render: (row) =>
        row.created_at ? (
          <span className="text-xs text-gray-500">
            {formatDate(row.created_at as string)}
          </span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/owner/staff/${row.id}`);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#1A3C5E] hover:bg-[#1A3C5E]/5 transition"
            title="View staff profile"
          >
            <ExternalLink size={14} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditTarget(staff.find((s) => s.id === row.id) ?? null);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
            title="Edit staff member"
          >
            <Pencil size={14} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setToggleTarget(staff.find((s) => s.id === row.id) ?? null);
            }}
            className={cn(
              "p-1.5 rounded-lg transition",
              row.is_active
                ? "text-gray-400 hover:text-red-500 hover:bg-red-50"
                : "text-gray-400 hover:text-green-600 hover:bg-green-50"
            )}
            title={row.is_active ? "Revoke access" : "Restore access"}
          >
            {row.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
          </button>
        </div>
      ),
    },
  ];

  // ── No branch selected: show picker ───────────────────────────────────────

  if (!selectedBranch) {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Staff</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            You don&apos;t have a default branch — select one to manage its staff.
          </p>
        </div>
        {restaurantId ? (
          <BranchSelector
            restaurantId={restaurantId}
            onSelect={(id) => setOverrideBranchId(id)}
          />
        ) : (
          <div className="py-10 text-center text-sm text-gray-400">
            Restaurant context not available. Please refresh.
          </div>
        )}
      </div>
    );
  }

  // ── Normal render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Staff</h3>
          <p className="text-sm text-gray-400 mt-0.5">
            {staff.length} member{staff.length !== 1 ? "s" : ""} in this branch
            {overrideBranchId && (
              <button
                onClick={() => setOverrideBranchId(null)}
                className="ml-2 text-xs text-[#1A3C5E] underline underline-offset-2"
              >
                Switch branch
              </button>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1A3C5E] text-white text-sm font-semibold rounded-xl hover:bg-[#15304d] transition"
        >
          <Plus size={15} />
          Add Staff
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <SkeletonCard variant="list-item" count={4} />
        </div>
      )}

      {!isLoading && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 w-full max-w-xs">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or role…"
              className="flex-1 text-sm text-gray-700 bg-transparent focus:outline-none placeholder:text-gray-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-gray-300 hover:text-gray-500"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1A3C5E]/20"
          >
            {ROLE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">
              {staff.filter((s) => s.is_active).length} active
            </span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
              {staff.filter((s) => !s.is_active).length} inactive
            </span>
          </div>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} />
          Failed to load staff. Please refresh.
        </div>
      )}

      {!isLoading && (
        <DataTable<StaffRow>
          columns={columns}
          data={rows}
          loading={false}
          pageSize={15}
          keyField="id"
          emptyTitle="No staff found"
          emptyDesc={
            search || roleFilter
              ? "Try adjusting your search or filter"
              : "Add your first staff member to get started"
          }
        />
      )}

      {showCreate && (
        <CreateStaffModal
          branchId={selectedBranch}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editTarget && (
        <EditStaffModal
          staff={editTarget}
          branchId={selectedBranch}
          onClose={() => setEditTarget(null)}
        />
      )}

      <ConfirmDialog
        isOpen={toggleTarget !== null}
        title={toggleTarget?.is_active ? "Revoke Access?" : "Restore Access?"}
        message={
          toggleTarget?.is_active
            ? `${splitName(toggleTarget.name).first} ${splitName(toggleTarget.name).last} will lose access to the system immediately.`
            : `${splitName(toggleTarget?.name ?? "").first} ${splitName(toggleTarget?.name ?? "").last} will regain access to the system.`
        }
        confirmLabel={toggleTarget?.is_active ? "Revoke" : "Restore"}
        variant={toggleTarget?.is_active ? "danger" : "info"}
        onCancel={() => setToggleTarget(null)}
        onConfirm={() => {
          if (toggleTarget) toggleAccess(toggleTarget);
          setToggleTarget(null);
        }}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared sub-components (local to this file)
// ══════════════════════════════════════════════════════════════════════════════

function SlideOver({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">{title}</h2>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-400"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

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
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function SubmitButton({
  loading,
  disabled,
  children,
}: {
  loading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full py-3 mt-2 bg-[#1A3C5E] text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[#15304d] transition"
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "w-full px-3 py-2.5 border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 transition",
    hasError
      ? "border-red-300 focus:ring-red-200"
      : "border-gray-200 focus:ring-[#1A3C5E]/20"
  );
}