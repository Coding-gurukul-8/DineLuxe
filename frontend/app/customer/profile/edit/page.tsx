"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronLeft, Camera, User, Mail, Phone, Loader2,
  Check, AlertCircle, Lock, Eye, EyeOff,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { DietaryProfile } from "@/components/customer/DietaryProfile";

// ── Schemas ───────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(50),
  last_name:  z.string().min(1, "Last name is required").max(50),
  phone:      z.string().optional().refine(
    (v) => !v || v.length >= 10,
    { message: "Enter a valid phone number" }
  ),
});

const passwordSchema = z.object({
  current_password:  z.string().min(1, "Current password is required"),
  new_password:      z.string().min(8, "Password must be at least 8 characters"),
  confirm_password:  z.string().min(1, "Please confirm your password"),
}).refine((d) => d.new_password === d.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

type ProfileFormValues  = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

// ── Floating Input ─────────────────────────────────────────────────────────────

function FloatingInput({
  id, label, type = "text", icon, error, disabled,
  value, onChange, suffix, readOnly,
}: {
  id: string; label: string; type?: string; icon: React.ReactNode
  error?: string; disabled?: boolean; value?: string
  onChange?: (v: string) => void; suffix?: React.ReactNode; readOnly?: boolean
}) {
  const [focused, setFocused] = useState(false);
  const hasValue = (value ?? "").length > 0;

  return (
    <div>
      <div className={cn(
        "relative rounded-xl border transition-all duration-300 bg-white",
        error ? "border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]" :
        focused && !error ? "border-[#E8A020] shadow-[0_0_0_3px_rgba(232,160,32,0.12)]" :
        "border-gray-200 hover:border-gray-300",
        readOnly && "bg-gray-50"
      )}>
        <div className={cn(
          "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 pointer-events-none",
          focused ? "text-[#E8A020]" : "text-gray-400"
        )}>
          {icon}
        </div>
        <label htmlFor={id}
          className={cn(
            "absolute left-11 pointer-events-none transition-all duration-200 ease-out",
            (focused || hasValue) ? "top-2 text-[10px] tracking-wider" : "top-1/2 -translate-y-1/2 text-sm",
            focused ? "text-[#E8A020]" : error ? "text-red-400" : "text-gray-400"
          )}>
          {label}
        </label>
        <input
          id={id} type={type} disabled={disabled || readOnly} readOnly={readOnly}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full bg-transparent pt-6 pb-2 pl-11 pr-11 text-sm text-gray-800 outline-none rounded-xl placeholder-transparent disabled:opacity-50 read-only:cursor-default"
        />
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-xl">
          <motion.div className="h-full bg-[#E8A020]" initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: focused ? 1 : 0 }} transition={{ duration: 0.3 }} />
        </div>
        {suffix && <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-1.5 ml-1 text-xs text-red-500 flex items-center gap-1">
            <AlertCircle size={11} />{error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string; email: string; first_name?: string; last_name?: string;
  phone?: string; profile_pic_url?: string;
  dietary_preferences?: string[];
  dietary_allergies?: string[];
}

export default function EditProfilePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, setUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");

  // ── Fetch current profile ────────────────────────────────────────────────
  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["customer", "me"],
    queryFn: () => apiClient.get<UserProfile>("/users/me"),
  });

  // ── Profile form ─────────────────────────────────────────────────────────
  const {
    register: regProfile,
    handleSubmit: handleProfile,
    setValue: setProfileValue,
    watch: watchProfile,
    formState: { errors: profileErrors, isDirty: profileDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: "onChange",
  });

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setProfileValue("first_name", profile.first_name ?? "");
      setProfileValue("last_name",  profile.last_name  ?? "");
      setProfileValue("phone",      profile.phone      ?? "");
    }
  }, [profile, setProfileValue]);

  const firstName = watchProfile("first_name") ?? "";
  const lastName  = watchProfile("last_name")  ?? "";
  const phone     = watchProfile("phone")      ?? "";

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: (data: ProfileFormValues) =>
      apiClient.patch<UserProfile>("/users/me", {
        first_name: data.first_name,
        last_name:  data.last_name,
        phone:      data.phone || null,
      }),
    onSuccess: (updated) => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["customer", "me"] });
      // Update auth context so header/avatar reflects immediately
      if (user) {
        setUser({
          ...user,
          name: `${updated.first_name ?? ""} ${updated.last_name ?? ""}`.trim(),
          phone: updated.phone ?? null,
        });
      }
    },
    onError: () => toast.error("Could not save profile. Please try again."),
  });

  // ── Password form ────────────────────────────────────────────────────────
  const {
    register: regPw,
    handleSubmit: handlePw,
    reset: resetPw,
    watch: watchPw,
    formState: { errors: pwErrors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    mode: "onChange",
  });

  const newPw      = watchPw("new_password") ?? "";
  const confirmPw  = watchPw("confirm_password") ?? "";

  const { mutate: changePassword, isPending: changingPw } = useMutation({
    mutationFn: (data: PasswordFormValues) =>
      apiClient.post("/auth/change-password", {
        current_password: data.current_password,
        new_password:     data.new_password,
      }),
    onSuccess: () => {
      toast.success("Password changed successfully");
      resetPw();
    },
    onError: (err: any) => {
      if (err?.statusCode === 401 || err?.statusCode === 403) {
        toast.error("Current password is incorrect");
      } else {
        toast.error("Could not change password. Please try again.");
      }
    },
  });

  // ── Avatar upload ────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", avatarFile);
      const res = await apiClient.postForm<{ url: string }>("/users/me/avatar", formData);
      toast.success("Photo updated");
      setAvatarPreview(null);
      setAvatarFile(null);
      qc.invalidateQueries({ queryKey: ["customer", "me"] });
      if (user) setUser({ ...user, profile_pic_url: res.url });
    } catch {
      toast.error("Could not upload photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const initials = profile
    ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase() || "?"
    : (user?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?");

  const avatarSrc = avatarPreview ?? profile?.profile_pic_url ?? user?.profile_pic_url ?? null;

  // ── Render ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={28} className="animate-spin text-[#E8A020]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 h-14 flex items-center gap-3">
        <motion.button whileTap={{ scale: 0.92 }} onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <ChevronLeft size={18} className="text-gray-700" />
        </motion.button>
        <h1 className="text-base font-bold text-gray-900">Edit Profile</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-24">

        {/* ── Avatar ─────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center py-8">
          <div className="relative">
            <motion.div whileHover={{ scale: 1.03 }} className="w-24 h-24 rounded-full overflow-hidden bg-linear-to-br from-[#1A3C5E] to-[#2A5C8E] flex items-center justify-center shadow-lg">
              {avatarSrc
                ? <img src={avatarSrc} alt="Profile" className="w-full h-full object-cover" />
                : <span className="text-white text-2xl font-bold">{initials}</span>
              }
            </motion.div>
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 bg-[#E8A020] rounded-full flex items-center justify-center shadow-md border-2 border-white">
              <Camera size={14} className="text-white" />
            </motion.button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </div>

          <AnimatePresence>
            {avatarFile && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-2">
                <span className="text-xs text-gray-500 truncate max-w-35">{avatarFile.name}</span>
                <motion.button whileTap={{ scale: 0.95 }} onClick={uploadAvatar} disabled={uploadingAvatar}
                  className="flex items-center gap-1.5 bg-[#E8A020] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm disabled:opacity-60">
                  {uploadingAvatar ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {uploadingAvatar ? "Uploading…" : "Save photo"}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Tab switcher ──────────────────────────────────────────── */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          {(["profile", "password"] as const).map((tab) => (
            <motion.button key={tab} whileTap={{ scale: 0.97 }} onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all",
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}>
              {tab === "profile" ? "Profile Info" : "Change Password"}
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Profile tab ──────────────────────────────────────────── */}
          {activeTab === "profile" && (
            <motion.div key="profile-tab"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <form onSubmit={handleProfile((d) => saveProfile(d))} className="space-y-4">

                <div className="grid grid-cols-2 gap-3">
                  <FloatingInput id="firstName" label="First name"
                    icon={<User size={17} />}
                    error={profileErrors.first_name?.message}
                    disabled={savingProfile}
                    value={firstName}
                    onChange={(v) => setProfileValue("first_name", v, { shouldDirty: true })}
                  />
                  <FloatingInput id="lastName" label="Last name"
                    icon={<User size={17} />}
                    error={profileErrors.last_name?.message}
                    disabled={savingProfile}
                    value={lastName}
                    onChange={(v) => setProfileValue("last_name", v, { shouldDirty: true })}
                  />
                </div>

                {/* Email — read-only */}
                <FloatingInput id="email" label="Email address"
                  type="email" icon={<Mail size={17} />}
                  value={profile?.email ?? user?.email ?? ""}
                  readOnly
                />
                <p className="text-xs text-gray-400 -mt-2 ml-1">Email address cannot be changed</p>

                <FloatingInput id="phone" label="Phone number"
                  type="tel" icon={<Phone size={17} />}
                  error={profileErrors.phone?.message}
                  disabled={savingProfile}
                  value={phone}
                  onChange={(v) => setProfileValue("phone", v, { shouldDirty: true })}
                />

                {/* ── Dietary preferences ─────────────────────────────── */}
                <div className="border-t border-gray-100 pt-5 space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                    Dietary Preferences
                  </p>
                  <DietaryProfile
                    initialPreferences={profile?.dietary_preferences ?? []}
                    initialAllergies={profile?.dietary_allergies ?? []}
                  />
                </div>

                <motion.button type="submit" whileTap={{ scale: 0.97 }}
                  disabled={savingProfile}
                  className="w-full h-12 rounded-2xl font-bold text-white text-sm shadow-md transition-all disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #1A3C5E 0%, #2A5C8E 100%)" }}>
                  <AnimatePresence mode="wait">
                    {savingProfile ? (
                      <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" />Saving…
                      </motion.span>
                    ) : (
                      <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        Save Changes
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </form>
            </motion.div>
          )}

          {/* ── Password tab ─────────────────────────────────────────── */}
          {activeTab === "password" && (
            <motion.div key="password-tab"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <form onSubmit={handlePw((d) => changePassword(d))} className="space-y-4">

                <FloatingInput id="currentPw" label="Current password"
                  type={showCurrentPw ? "text" : "password"} icon={<Lock size={17} />}
                  error={pwErrors.current_password?.message}
                  disabled={changingPw}
                  value={watchPw("current_password") ?? ""}
                  onChange={(v) => {
                    const field = regPw("current_password");
                    field.onChange({ target: { value: v, name: field.name } } as any);
                  }}
                  suffix={
                    <button type="button" onClick={() => setShowCurrentPw((v) => !v)}
                      className="text-gray-400 hover:text-[#E8A020] transition-colors p-1">
                      {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />

                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">New password</p>

                  <div className="space-y-3">
                    <FloatingInput id="newPw" label="New password"
                      type={showNewPw ? "text" : "password"} icon={<Lock size={17} />}
                      error={pwErrors.new_password?.message}
                      disabled={changingPw}
                      value={newPw}
                      onChange={(v) => {
                        const field = regPw("new_password");
                        field.onChange({ target: { value: v, name: field.name } } as any);
                      }}
                      suffix={
                        <button type="button" onClick={() => setShowNewPw((v) => !v)}
                          className="text-gray-400 hover:text-[#E8A020] transition-colors p-1">
                          {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      }
                    />

                    {/* Inline strength bar */}
                    {newPw && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                        <div className="flex gap-1">
                          {[1,2,3,4].map((i) => {
                            const score = newPw.length >= 12 && /[A-Z]/.test(newPw) && /[0-9]/.test(newPw) && /[^a-zA-Z0-9]/.test(newPw) ? 4
                              : newPw.length >= 10 && /[A-Z]/.test(newPw) && /[0-9]/.test(newPw) ? 3
                              : newPw.length >= 8 && (/[A-Z]/.test(newPw) || /[0-9]/.test(newPw)) ? 2 : 1;
                            return (
                              <div key={i} className={cn(
                                "flex-1 h-1 rounded-full transition-all",
                                i <= score
                                  ? score === 1 ? "bg-red-400"
                                    : score === 2 ? "bg-yellow-400"
                                    : score === 3 ? "bg-blue-400"
                                    : "bg-green-500"
                                  : "bg-gray-200"
                              )} />
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-gray-400">
                          {newPw.length < 8 ? "Too short" : /[A-Z]/.test(newPw) && /[0-9]/.test(newPw) && /[^a-zA-Z0-9]/.test(newPw) && newPw.length >= 12 ? "Strong password ✓" : "Add uppercase, numbers & symbols"}
                        </p>
                      </motion.div>
                    )}

                    <FloatingInput id="confirmPw" label="Confirm new password"
                      type={showConfirmPw ? "text" : "password"} icon={<Lock size={17} />}
                      error={pwErrors.confirm_password?.message}
                      disabled={changingPw}
                      value={confirmPw}
                      onChange={(v) => {
                        const field = regPw("confirm_password");
                        field.onChange({ target: { value: v, name: field.name } } as any);
                      }}
                      suffix={
                        <button type="button" onClick={() => setShowConfirmPw((v) => !v)}
                          className="text-gray-400 hover:text-[#E8A020] transition-colors p-1">
                          {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      }
                    />

                    <AnimatePresence>
                      {confirmPw && newPw === confirmPw && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="text-xs text-emerald-600 flex items-center gap-1 ml-1">
                          <Check size={11} />Passwords match
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <motion.button type="submit" whileTap={{ scale: 0.97 }}
                  disabled={changingPw}
                  className="w-full h-12 rounded-2xl font-bold text-white text-sm shadow-md transition-all disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #C0392B 0%, #E74C3C 100%)" }}>
                  <AnimatePresence mode="wait">
                    {changingPw ? (
                      <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" />Changing…
                      </motion.span>
                    ) : (
                      <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        Change Password
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </form>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}