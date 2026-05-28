"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Save,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/layout/PageWrapper";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────── */

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

interface UpdateProfilePayload {
  name: string;
  phone?: string;
}

interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

/* ─── Sub-components ────────────────────────────────────── */

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
    >
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-50">
        <div className="w-9 h-9 rounded-xl bg-[#1A3C5E]/8 flex items-center justify-center text-[#1A3C5E]">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  readOnly,
  type = "text",
  icon,
  rightSlot,
  className,
}: {
  id?: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  type?: string;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border rounded-xl px-3 py-2.5 transition-colors",
        readOnly || disabled
          ? "bg-gray-50 border-gray-100 text-gray-400"
          : "bg-white border-gray-200 focus-within:border-[#1A3C5E]/40 focus-within:ring-2 focus-within:ring-[#1A3C5E]/10",
        className
      )}
    >
      {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        autoComplete={type === "password" ? "current-password" : "off"}
        className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400 disabled:cursor-not-allowed"
      />
      {rightSlot}
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border rounded-xl px-3 py-2.5 transition-colors bg-white border-gray-200 focus-within:border-[#1A3C5E]/40 focus-within:ring-2 focus-within:ring-[#1A3C5E]/10"
      )}
    >
      <Lock size={14} className="text-gray-400 shrink-0" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder:text-gray-400"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────── */

export default function AdminSettingsPage() {
  /* Profile state */
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  /* Password state */
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");

  /* Load profile */
  const { data: profile, isLoading, isError } = useQuery<UserProfile>({
    queryKey: ["users", "me"],
    queryFn: () => apiClient.get<UserProfile>("/users/me"),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  /* Save profile mutation */
  const profileMutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) =>
      apiClient.patch<UserProfile>("/users/me", payload),
    onSuccess: () => toast.success("Profile updated successfully"),
    onError: () => toast.error("Failed to update profile"),
  });

  /* Change password mutation */
  const passwordMutation = useMutation({
    mutationFn: (payload: ChangePasswordPayload) =>
      apiClient.post("/auth/change-password", payload),
    onSuccess: () => {
      toast.success("Password changed successfully");
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      setPwError("");
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Failed to change password");
    },
  });

  function handleSaveProfile() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    profileMutation.mutate({ name: name.trim(), phone: phone.trim() || undefined });
  }

  function handleChangePassword() {
    setPwError("");
    if (!oldPw || !newPw || !confirmPw) {
      setPwError("All password fields are required.");
      return;
    }
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("New passwords do not match.");
      return;
    }
    passwordMutation.mutate({ old_password: oldPw, new_password: newPw });
  }

  return (
    <PageWrapper>
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Account Settings
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage your super-admin profile and security
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center py-16 gap-3 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm">Failed to load profile</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Profile form */}
          <SectionCard
            icon={<User size={16} />}
            title="Profile Information"
            subtitle="Update your display name and contact number"
          >
            <div className="space-y-4">
              <div>
                <FieldLabel>Full Name</FieldLabel>
                <TextInput
                  value={name}
                  onChange={setName}
                  placeholder="Your name"
                  icon={<User size={14} />}
                  disabled={profileMutation.isPending}
                />
              </div>

              <div>
                <FieldLabel>Email Address</FieldLabel>
                <TextInput
                  value={profile?.email ?? ""}
                  readOnly
                  icon={<Mail size={14} />}
                  rightSlot={
                    <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                      Read-only
                    </span>
                  }
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Email address cannot be changed here. Contact support if needed.
                </p>
              </div>

              <div>
                <FieldLabel>Phone Number</FieldLabel>
                <TextInput
                  value={phone}
                  onChange={setPhone}
                  placeholder="+1 (555) 000-0000"
                  icon={<Phone size={14} />}
                  disabled={profileMutation.isPending}
                />
              </div>

              {profile?.role && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-[#1A3C5E]/5 rounded-xl">
                  <ShieldCheck size={14} className="text-[#1A3C5E]" />
                  <span className="text-xs font-semibold text-[#1A3C5E] capitalize">
                    Role: {profile.role}
                  </span>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={profileMutation.isPending}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                    profileMutation.isPending
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-[#1A3C5E] text-white hover:bg-[#15324f] active:scale-[0.98] shadow-sm"
                  )}
                >
                  {profileMutation.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save size={14} /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Change Password */}
          <SectionCard
            icon={<Lock size={16} />}
            title="Change Password"
            subtitle="Use a strong, unique password"
          >
            <div className="space-y-4">
              <div>
                <FieldLabel>Current Password</FieldLabel>
                <PasswordInput
                  value={oldPw}
                  onChange={setOldPw}
                  placeholder="••••••••"
                  disabled={passwordMutation.isPending}
                  autoComplete="current-password"
                />
              </div>

              <div>
                <FieldLabel>New Password</FieldLabel>
                <PasswordInput
                  value={newPw}
                  onChange={(v) => { setNewPw(v); setPwError(""); }}
                  placeholder="Min. 8 characters"
                  disabled={passwordMutation.isPending}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <FieldLabel>Confirm New Password</FieldLabel>
                <PasswordInput
                  value={confirmPw}
                  onChange={(v) => { setConfirmPw(v); setPwError(""); }}
                  placeholder="Repeat new password"
                  disabled={passwordMutation.isPending}
                  autoComplete="new-password"
                />
              </div>

              {/* Strength hint */}
              {newPw.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[8, 10, 12, 16].map((threshold, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors",
                          newPw.length >= threshold
                            ? i < 2 ? "bg-[#E8A020]" : "bg-emerald-500"
                            : "bg-gray-100"
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {newPw.length < 8
                      ? "Too short"
                      : newPw.length < 12
                      ? "Fair — consider a longer password"
                      : "Strong password"}
                  </p>
                </div>
              )}

              {pwError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-600 flex items-center gap-1.5"
                >
                  <AlertCircle size={12} /> {pwError}
                </motion.p>
              )}

              <div className="pt-2">
                <button
                  onClick={handleChangePassword}
                  disabled={passwordMutation.isPending}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                    passwordMutation.isPending
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-[#E8A020] text-white hover:bg-[#d4911c] active:scale-[0.98] shadow-sm"
                  )}
                >
                  {passwordMutation.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Changing…
                    </>
                  ) : (
                    <>
                      <Lock size={14} /> Change Password
                    </>
                  )}
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </PageWrapper>
  );
}