"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Bell,
  Clock,
  Shield,
  AlertTriangle,
  Loader2,
  Check,
  Eye,
  EyeOff,
  MonitorSmartphone,
  BadgeCheck,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

import PageWrapper from "@/components/layout/PageWrapper";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RestaurantProfile {
  id: string;
  name: string;
  cuisine_type: string | null;
  gst_number: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: "active" | "suspended" | "pending" | "inactive";
}

interface NotificationPreferences {
  email_new_orders: boolean;
  push_staff_actions: boolean;
  daily_sales_summary: boolean;
  low_inventory_alerts: boolean;
  new_review_alerts: boolean;
}

interface CancellationPolicy {
  cancel_within_hours: number;
  walkin_grace_period_minutes: number;
  noshow_autocancel_minutes: number;
}

interface ActiveSessionsData {
  count: number;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(1, "Restaurant name is required").max(120),
  cuisine_type: z.string().max(80).optional(),
  gst_number: z.string().max(40).optional(),
  contact_phone: z.string().max(20).optional(),
  contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
});
type ProfileFormData = z.infer<typeof profileSchema>;

const notifSchema = z.object({
  email_new_orders: z.boolean(),
  push_staff_actions: z.boolean(),
  daily_sales_summary: z.boolean(),
  low_inventory_alerts: z.boolean(),
  new_review_alerts: z.boolean(),
});
type NotifFormData = z.infer<typeof notifSchema>;

const cancellationSchema = z.object({
  cancel_within_hours: z.coerce
    .number()
    .min(0, "Must be 0 or more")
    .max(72, "Max 72 hours"),
  walkin_grace_period_minutes: z.coerce
    .number()
    .min(0)
    .max(120, "Max 120 minutes"),
  noshow_autocancel_minutes: z.coerce.number().min(0).max(120, "Max 120 minutes"),
});
type CancellationFormData = z.infer<typeof cancellationSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z
      .string()
      .min(8, "At least 8 characters")
      .max(128),
    confirm_password: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });
type PasswordFormData = z.infer<typeof passwordSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useSavedFeedback() {
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const triggerSaved = useCallback(() => {
    setSaved(true);
    setErrorMsg(null);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  const triggerError = useCallback((msg: string) => {
    setErrorMsg(msg);
    setSaved(false);
  }, []);

  return { saved, errorMsg, triggerSaved, triggerError };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  danger?: boolean;
}

function SectionCard({ icon, title, subtitle, children, danger }: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "rounded-2xl bg-white shadow-sm border",
        danger ? "border-red-200" : "border-gray-100"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-6 py-4 border-b",
          danger ? "border-red-100" : "border-gray-100"
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            danger ? "bg-red-50 text-red-500" : "bg-[#1A3C5E]/10 text-[#1A3C5E]"
          )}
        >
          {icon}
        </span>
        <div>
          <h2
            className={cn(
              "text-sm font-semibold",
              danger ? "text-red-700" : "text-gray-900"
            )}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </motion.div>
  );
}

interface SaveRowProps {
  loading: boolean;
  saved: boolean;
  errorMsg: string | null;
  label?: string;
}

function SaveRow({ loading, saved, errorMsg, label = "Save" }: SaveRowProps) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-[#1A3C5E] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#15304d] disabled:opacity-60"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {loading ? "Saving…" : label}
      </button>
      <AnimatePresence>
        {saved && (
          <motion.span
            key="saved"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-600"
          >
            <Check size={13} /> Saved!
          </motion.span>
        )}
        {errorMsg && (
          <motion.span
            key="err"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            className="text-xs font-medium text-red-500"
          >
            {errorMsg}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, error, children, hint }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-gray-400">{hint}</p>}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#1A3C5E] focus:bg-white focus:ring-2 focus:ring-[#1A3C5E]/10";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}

function ToggleSwitch({ checked, onChange, label, description }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 transition hover:bg-gray-100/70"
    >
      <div className="text-left">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && (
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 transition-colors",
          checked ? "text-[#1A3C5E]" : "text-gray-300"
        )}
      >
        {checked ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
      </span>
    </button>
  );
}

// ─── Section 1: Restaurant Profile ───────────────────────────────────────────

function ProfileSection({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const { saved, errorMsg, triggerSaved, triggerError } = useSavedFeedback();

  const { data, isLoading } = useQuery<RestaurantProfile>({
    queryKey: ["restaurant-profile", restaurantId],
    queryFn: () =>
      apiClient.get<RestaurantProfile>(`/restaurants/${restaurantId}`),
    enabled: !!restaurantId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      cuisine_type: "",
      gst_number: "",
      contact_phone: "",
      contact_email: "",
    },
  });

  useEffect(() => {
    if (!data) return;
    reset({
      name: data.name ?? "",
      cuisine_type: data.cuisine_type ?? "",
      gst_number: data.gst_number ?? "",
      contact_phone: (data as any).contact_phone ?? "",
      contact_email: (data as any).contact_email ?? "",
    });
  }, [data, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: ProfileFormData) =>
      apiClient.patch(`/restaurants/${restaurantId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant-profile", restaurantId] });
      triggerSaved();
    },
    onError: (err: Error) => triggerError(err.message ?? "Failed to save"),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-11 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Restaurant Name" error={errors.name?.message}>
          <input
            {...register("name")}
            placeholder="e.g. The Grand Bistro"
            className={inputCls}
          />
        </Field>
        <Field label="Cuisine Type" error={errors.cuisine_type?.message}>
          <input
            {...register("cuisine_type")}
            placeholder="e.g. Italian, Indian, Multi-cuisine"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="GST / Registration Number" error={errors.gst_number?.message}>
        <input
          {...register("gst_number")}
          placeholder="e.g. 22AAAAA0000A1Z5"
          className={inputCls}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact Phone" error={errors.contact_phone?.message}>
          <input
            {...register("contact_phone")}
            type="tel"
            placeholder="+91 98765 43210"
            className={inputCls}
          />
        </Field>
        <Field label="Contact Email" error={errors.contact_email?.message}>
          <input
            {...register("contact_email")}
            type="email"
            placeholder="contact@yourrestaurant.com"
            className={inputCls}
          />
        </Field>
      </div>

      <SaveRow
        loading={isPending}
        saved={saved}
        errorMsg={errorMsg}
        label="Save Profile"
      />
    </form>
  );
}

// ─── Section 2: Notification Preferences ─────────────────────────────────────

function NotificationsSection({ userId }: { userId: string }) {
  const { saved, errorMsg, triggerSaved, triggerError } = useSavedFeedback();

  const { data, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["notification-prefs", userId],
    queryFn: () =>
      apiClient.get<NotificationPreferences>(
        `/users/${userId}/notification-preferences`
      ),
    enabled: !!userId,
  });

  const { handleSubmit, setValue, watch, reset } = useForm<NotifFormData>({
    resolver: zodResolver(notifSchema),
    defaultValues: {
      email_new_orders: true,
      push_staff_actions: true,
      daily_sales_summary: true,
      low_inventory_alerts: true,
      new_review_alerts: true,
    },
  });

  useEffect(() => {
    if (!data) return;
    reset(data);
  }, [data, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: NotifFormData) =>
      apiClient.patch(`/users/${userId}/notification-preferences`, payload),
    onSuccess: () => triggerSaved(),
    onError: (err: Error) => triggerError(err.message ?? "Failed to save"),
  });

  const toggles: { key: keyof NotifFormData; label: string; description: string }[] = [
    {
      key: "email_new_orders",
      label: "Email notifications for new orders",
      description: "Get an email each time a new order is placed",
    },
    {
      key: "push_staff_actions",
      label: "Push notifications for staff actions",
      description: "Be alerted when staff check in, clock out, or take actions",
    },
    {
      key: "daily_sales_summary",
      label: "Daily sales summary email",
      description: "Receive an end-of-day revenue and orders digest",
    },
    {
      key: "low_inventory_alerts",
      label: "Low inventory alerts",
      description: "Get notified when stock levels fall below threshold",
    },
    {
      key: "new_review_alerts",
      label: "New customer review alerts",
      description: "Be notified when customers leave a new review",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
      <div className="space-y-2">
        {toggles.map(({ key, label, description }) => (
          <ToggleSwitch
            key={key}
            checked={!!watch(key)}
            onChange={(v) => setValue(key, v)}
            label={label}
            description={description}
          />
        ))}
      </div>
      <SaveRow loading={isPending} saved={saved} errorMsg={errorMsg} label="Save Preferences" />
    </form>
  );
}

// ─── Section 3: Cancellation Policy ──────────────────────────────────────────

function CancellationSection({ restaurantId }: { restaurantId: string }) {
  const { saved, errorMsg, triggerSaved, triggerError } = useSavedFeedback();

  const { data, isLoading } = useQuery<CancellationPolicy>({
    queryKey: ["cancellation-policy", restaurantId],
    queryFn: () =>
      apiClient.get<CancellationPolicy>(`/restaurants/${restaurantId}/settings`),
    enabled: !!restaurantId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancellationFormData>({
    resolver: zodResolver(cancellationSchema),
    defaultValues: {
      cancel_within_hours: 2,
      walkin_grace_period_minutes: 10,
      noshow_autocancel_minutes: 15,
    },
  });

  useEffect(() => {
    if (!data) return;
    reset({
      cancel_within_hours: data.cancel_within_hours ?? 2,
      walkin_grace_period_minutes: data.walkin_grace_period_minutes ?? 10,
      noshow_autocancel_minutes: data.noshow_autocancel_minutes ?? 15,
    });
  }, [data, reset]);

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: CancellationFormData) =>
      apiClient.patch(`/restaurants/${restaurantId}/settings`, payload),
    onSuccess: () => triggerSaved(),
    onError: (err: Error) => triggerError(err.message ?? "Failed to save"),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-11 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
      <Field
        label="Allow cancellations within X hours of booking"
        error={errors.cancel_within_hours?.message}
        hint="Customers can cancel up to this many hours before their booking time"
      >
        <div className="relative">
          <input
            {...register("cancel_within_hours")}
            type="number"
            min={0}
            max={72}
            className={cn(inputCls, "pr-16")}
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
            hours
          </span>
        </div>
      </Field>

      <Field
        label="Cancellation grace period for walk-ins (minutes)"
        error={errors.walkin_grace_period_minutes?.message}
        hint="How long a walk-in customer has to cancel after joining the queue"
      >
        <div className="relative">
          <input
            {...register("walkin_grace_period_minutes")}
            type="number"
            min={0}
            max={120}
            className={cn(inputCls, "pr-16")}
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
            mins
          </span>
        </div>
      </Field>

      <Field
        label="Auto-cancel no-shows after X minutes"
        error={errors.noshow_autocancel_minutes?.message}
        hint="Bookings where the customer has not arrived are automatically cancelled"
      >
        <div className="relative">
          <input
            {...register("noshow_autocancel_minutes")}
            type="number"
            min={0}
            max={120}
            className={cn(inputCls, "pr-16")}
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
            mins
          </span>
        </div>
      </Field>

      <SaveRow loading={isPending} saved={saved} errorMsg={errorMsg} label="Save Policy" />
    </form>
  );
}

// ─── Section 4: Security ──────────────────────────────────────────────────────

function SecuritySection({ userId }: { userId: string }) {
  const { saved, errorMsg, triggerSaved, triggerError } = useSavedFeedback();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeDone, setRevokeDone] = useState(false);

  const { data: sessions } = useQuery<ActiveSessionsData>({
    queryKey: ["active-sessions", userId],
    queryFn: () =>
      apiClient.get<ActiveSessionsData>(`/users/${userId}/sessions`),
    enabled: !!userId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: PasswordFormData) =>
      apiClient.patch(`/users/${userId}/password`, {
        current_password: payload.current_password,
        new_password: payload.new_password,
      }),
    onSuccess: () => {
      triggerSaved();
      reset();
    },
    onError: (err: Error) => triggerError(err.message ?? "Failed to update password"),
  });

  const handleRevokeAll = async () => {
    setRevokeLoading(true);
    try {
      await apiClient.delete(`/users/${userId}/sessions`);
      setRevokeDone(true);
      setTimeout(() => setRevokeDone(false), 2000);
    } catch {
      // silently ignore
    } finally {
      setRevokeLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Change password */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Change Password
        </h3>
        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-3">
          <Field label="Current Password" error={errors.current_password?.message}>
            <div className="relative">
              <input
                {...register("current_password")}
                type={showCurrent ? "text" : "password"}
                placeholder="••••••••"
                className={cn(inputCls, "pr-10")}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="New Password" error={errors.new_password?.message}>
              <div className="relative">
                <input
                  {...register("new_password")}
                  type={showNew ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  className={cn(inputCls, "pr-10")}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            <Field label="Confirm New Password" error={errors.confirm_password?.message}>
              <div className="relative">
                <input
                  {...register("confirm_password")}
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repeat new password"
                  className={cn(inputCls, "pr-10")}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
          </div>

          <SaveRow
            loading={isPending}
            saved={saved}
            errorMsg={errorMsg}
            label="Update Password"
          />
        </form>
      </div>

      <div className="border-t border-gray-100" />

      {/* Active sessions */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Active Sessions</h3>
        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <MonitorSmartphone size={18} className="text-[#1A3C5E]" />
            <div>
              <p className="text-sm font-medium text-gray-800">
                {sessions?.count ?? "—"} active session{sessions?.count !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-gray-400">All active JWT tokens for your account</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRevokeAll}
            disabled={revokeLoading}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            {revokeLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : revokeDone ? (
              <Check size={12} />
            ) : null}
            {revokeDone ? "Revoked!" : "Revoke All"}
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* 2FA */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Two-Factor Authentication
        </h3>
        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <BadgeCheck size={18} className="text-[#1A3C5E]" />
            <div>
              <p className="text-sm font-medium text-gray-800">Two-factor authentication</p>
              <p className="text-xs text-gray-400">
                Adds an extra layer of security to your account
              </p>
            </div>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Section 5: Danger Zone ───────────────────────────────────────────────────

function DangerZoneSection({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const { data } = useQuery<RestaurantProfile>({
    queryKey: ["restaurant-profile", restaurantId],
    queryFn: () =>
      apiClient.get<RestaurantProfile>(`/restaurants/${restaurantId}`),
    enabled: !!restaurantId,
  });

  useEffect(() => {
    if (data) setIsClosed(data.status === "inactive");
  }, [data]);

  const applyToggle = async (close: boolean) => {
    setIsToggling(true);
    try {
      await apiClient.patch(`/restaurants/${restaurantId}`, {
        status: close ? "inactive" : "active",
      });
      setIsClosed(close);
      qc.invalidateQueries({ queryKey: ["restaurant-profile", restaurantId] });
    } catch {
      // silently ignore
    } finally {
      setIsToggling(false);
    }
  };

  const handleToggleAttempt = () => {
    if (!isClosed) {
      setConfirmOpen(true);
    } else {
      applyToggle(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-800">
              Temporarily close restaurant for operations
            </p>
            <p className="mt-1 text-xs text-gray-400">
              When enabled, customers cannot make new bookings or place orders.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleAttempt}
            disabled={isToggling}
            aria-label="Toggle restaurant operational status"
            className={cn(
              "shrink-0 transition-colors disabled:opacity-60",
              isClosed ? "text-red-500" : "text-gray-300 hover:text-gray-400"
            )}
          >
            {isToggling ? (
              <Loader2 size={28} className="animate-spin text-gray-400" />
            ) : isClosed ? (
              <ToggleRight size={34} />
            ) : (
              <ToggleLeft size={34} />
            )}
          </button>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Restaurant is:</span>
          <AnimatePresence mode="wait">
            {isClosed ? (
              <motion.span
                key="closed"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-red-600"
              >
                Temporarily Closed
              </motion.span>
            ) : (
              <motion.span
                key="open"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-emerald-700"
              >
                Open
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Temporarily close restaurant?"
        message="This will mark your restaurant as temporarily closed. Customers will not be able to make new bookings or orders."
        confirmLabel="Close Restaurant"
        cancelLabel="Keep Open"
        variant="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          applyToggle(true);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { restaurantId, user } = useAuth();
  const userId = user?.id ?? null;

  if (!restaurantId || !userId) {
    return (
      <PageWrapper title="Settings">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
          Session context missing — please log out and sign in again.
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Settings"
      subtitle="Manage your restaurant's platform configuration and preferences"
    >
      <div className="max-w-2xl space-y-6">
        <SectionCard
          icon={<Building2 size={18} />}
          title="Restaurant Profile"
          subtitle="Core identity and contact details"
        >
          <ProfileSection restaurantId={restaurantId} />
        </SectionCard>

        <SectionCard
          icon={<Bell size={18} />}
          title="Notification Preferences"
          subtitle="Choose which events trigger alerts for you"
        >
          <NotificationsSection userId={userId} />
        </SectionCard>

        <SectionCard
          icon={<Clock size={18} />}
          title="Cancellation Policy"
          subtitle="Rules for booking cancellations and no-shows"
        >
          <CancellationSection restaurantId={restaurantId} />
        </SectionCard>

        <SectionCard
          icon={<Shield size={18} />}
          title="Security"
          subtitle="Password, sessions, and two-factor authentication"
        >
          <SecuritySection userId={userId} />
        </SectionCard>

        <SectionCard
          icon={<AlertTriangle size={18} />}
          title="Danger Zone"
          subtitle="Irreversible or high-impact actions"
          danger
        >
          <DangerZoneSection restaurantId={restaurantId} />
        </SectionCard>
      </div>
    </PageWrapper>
  );
}