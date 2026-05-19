"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Copy,
  Link2,
  MonitorSmartphone,
  Palette,
  Smartphone,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import PageWrapper from "@/components/layout/PageWrapper";
import { SkeletonCard } from "@/components/shared/SkeletonCard";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandingData {
  app_name: string | null;
  app_name_display: string | null;
  tagline: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  banner_url: string | null;
  font_family: string | null;
  updated_at: string | null;
}

// ── Validation — mirrors backend updateBrandingSchema ─────────────────────────
// NOTE: backend validates logo_url / banner_url against Supabase Storage URLs.
// The free-text URL fields below are sent as-is; invalid URLs will be rejected
// by the backend with a 422 validation error that the mutation's onError
// surfaces via toast.

const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

const brandingSchema = z.object({
  app_name: z.string().min(1).max(60).optional(),
  tagline: z.string().max(120).optional(),
  primary_color: z
    .string()
    .regex(hexRegex, "Must be a valid hex color e.g. #1A3C5E")
    .optional()
    .or(z.literal("")),
  secondary_color: z
    .string()
    .regex(hexRegex, "Must be a valid hex color")
    .optional()
    .or(z.literal("")),
  logo_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  banner_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  font_family: z
    .enum(["Inter", "Poppins", "Roboto", "Nunito", "Lato", "Playfair Display"])
    .optional(),
});

type BrandingFormData = z.infer<typeof brandingSchema>;

type PreviewScreen = "Splash" | "Login" | "Home";

// ── Phone Preview ─────────────────────────────────────────────────────────────

function BrandLogo({
  logoUrl,
  appName,
}: {
  logoUrl: string | null;
  appName: string;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${appName} logo`}
        className="h-16 w-16 rounded-md object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-md bg-white/20 text-xl font-bold text-white">
      {appName.slice(0, 2).toUpperCase()}
    </span>
  );
}

function PhonePreview({
  screen,
  appName,
  tagline,
  logoUrl,
}: {
  screen: PreviewScreen;
  appName: string;
  tagline: string;
  logoUrl: string | null;
}) {
  if (screen === "Splash") {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[var(--preview-primary)] px-8 text-center text-white">
        <div className="mb-7">
          <BrandLogo logoUrl={logoUrl} appName={appName} />
        </div>
        <h3 className="text-3xl font-bold">{appName}</h3>
        <p className="mt-2 text-sm text-white/80">{tagline}</p>
        <div className="mt-10 flex gap-2">
          <span className="h-2 w-8 rounded-full bg-[var(--preview-secondary)]" />
          <span className="h-2 w-2 rounded-full bg-white/40" />
          <span className="h-2 w-2 rounded-full bg-white/40" />
        </div>
      </div>
    );
  }

  if (screen === "Login") {
    return (
      <div className="flex h-full flex-col bg-gray-50">
        <div className="bg-[var(--preview-primary)] px-6 pb-10 pt-12 text-white">
          <BrandLogo logoUrl={logoUrl} appName={appName} />
          <h3 className="mt-5 text-2xl font-bold">{appName}</h3>
          <p className="mt-1 text-sm text-white/80">{tagline}</p>
        </div>
        <div className="-mt-5 space-y-3 px-5">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <div className="h-11 rounded-lg bg-gray-100" />
            <div className="mt-3 h-11 rounded-lg bg-gray-100" />
            <div className="mt-4 h-12 w-full rounded-lg bg-[var(--preview-secondary)] flex items-center justify-center text-sm font-bold text-gray-950">
              Sign In
            </div>
          </div>
          <p className="text-center text-xs text-gray-500">
            Create Account · Forgot Password
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50">
      <div className="bg-[var(--preview-primary)] px-5 pb-5 pt-9 text-white">
        <div className="flex items-center gap-3">
          <BrandLogo logoUrl={logoUrl} appName={appName} />
          <div>
            <h3 className="text-lg font-bold">{appName}</h3>
            <p className="text-xs text-white/75">{tagline}</p>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-5">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Recommended
          </p>
          <h4 className="mt-2 text-lg font-bold text-gray-950">
            Chef's tasting menu
          </h4>
          <div className="mt-4 h-11 rounded-lg bg-[var(--preview-secondary)] flex items-center px-4 text-sm font-bold text-gray-950">
            Reserve table
          </div>
        </div>
        {["Live menu", "Queue status", "Order tracking"].map((item) => (
          <div
            key={item}
            className="rounded-lg bg-white p-4 text-sm font-semibold text-gray-800 shadow-sm"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrandingPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [screen, setScreen] = useState<PreviewScreen>("Splash");
  const [shareCopied, setShareCopied] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<BrandingFormData>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      app_name: "",
      tagline: "",
      primary_color: "#1A3C5E",
      secondary_color: "#E8A020",
      logo_url: "",
      banner_url: "",
      font_family: "Inter",
    },
  });

  // ── Fetch current branding ─────────────────────────────────────────────────
  const {
    data: branding,
    isLoading,
    isError,
    refetch,
  } = useQuery<BrandingData>({
    queryKey: ["branding", restaurantId],
    queryFn: () =>
      apiClient.get<BrandingData>(`/restaurants/${restaurantId}/branding`),
    enabled: !!restaurantId,
  });

  // Pre-fill form when branding loads
  useEffect(() => {
    if (!branding) return;
    reset({
      app_name: branding.app_name ?? branding.app_name_display ?? "",
      tagline: branding.tagline ?? "",
      primary_color: branding.primary_color ?? "#1A3C5E",
      secondary_color: branding.secondary_color ?? "#E8A020",
      logo_url: branding.logo_url ?? "",
      banner_url: branding.banner_url ?? "",
      font_family:
        (branding.font_family as BrandingFormData["font_family"]) ?? "Inter",
    });
  }, [branding, reset]);

  // ── Save mutation — backend uses PATCH (not PUT) ───────────────────────────
  const { mutate: saveBranding, isPending: isSaving } = useMutation({
    mutationFn: (data: BrandingFormData) => {
      // Strip empty strings — don't send blank optional fields
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && value !== "") payload[key] = value;
      }
      return apiClient.patch(`/restaurants/${restaurantId}/branding`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branding", restaurantId] });
      toast.success("Branding saved successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Failed to save branding");
    },
  });

  // ── Live preview values ────────────────────────────────────────────────────
  const primaryColor = watch("primary_color") || "#1A3C5E";
  const secondaryColor = watch("secondary_color") || "#E8A020";
  const previewAppName = watch("app_name") || "DineLuxe";
  const previewTagline = watch("tagline") || "Fine dining, made effortless";
  const previewLogoUrl = watch("logo_url") || null;

  const previewVars = useMemo(
    () =>
      ({
        "--preview-primary": primaryColor,
        "--preview-secondary": secondaryColor,
      }) as React.CSSProperties,
    [primaryColor, secondaryColor]
  );

  const copyPreviewLink = async () => {
    const url = `${window.location.origin}/owner/branding?preview=${encodeURIComponent(previewAppName)}`;
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    toast.success("Preview link copied");
    setTimeout(() => setShareCopied(false), 1800);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageWrapper
      title="Branding"
      subtitle="Tune your white-label experience and preview customer screens before publishing"
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={copyPreviewLink}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            {shareCopied ? (
              <Copy size={15} />
            ) : (
              <Link2 size={15} />
            )}
            {shareCopied ? "Copied" : "Share Preview"}
          </button>
        </div>
      }
    >
      {/* Loading */}
      {isLoading && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <SkeletonCard variant="card" count={1} />
          <SkeletonCard variant="card" count={1} />
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <p className="text-gray-500 text-sm">Failed to load branding settings.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-[#1A3C5E] text-white text-sm font-semibold rounded-lg hover:bg-[#15304d] transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* No restaurantId guard */}
      {!restaurantId && !isLoading && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          Restaurant ID not found in your session. Please log out and log in again.
        </div>
      )}

      {/* Form + Preview */}
      {!isLoading && !isError && restaurantId && (
        <form onSubmit={handleSubmit((data) => saveBranding(data))}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            {/* ── Left: Settings panel ──────────────────────────────────── */}
            <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <Palette className="text-[#1A3C5E]" size={20} />
                <div>
                  <h2 className="text-base font-semibold text-gray-950">
                    Brand Setup
                  </h2>
                  <p className="text-sm text-gray-500">
                    Changes update the phone preview instantly.
                  </p>
                </div>
              </div>

              {/* Colors */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-800">
                    Primary color
                  </label>
                  <span className="flex min-h-12 items-center gap-3 rounded-lg border border-gray-200 px-3">
                    <input
                      type="color"
                      {...register("primary_color")}
                      className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <input
                      {...register("primary_color")}
                      className="w-full bg-transparent text-sm font-medium outline-none"
                      placeholder="#1A3C5E"
                    />
                  </span>
                  {errors.primary_color && (
                    <p className="text-xs text-red-500">
                      {errors.primary_color.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-800">
                    Secondary color
                  </label>
                  <span className="flex min-h-12 items-center gap-3 rounded-lg border border-gray-200 px-3">
                    <input
                      type="color"
                      {...register("secondary_color")}
                      className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <input
                      {...register("secondary_color")}
                      className="w-full bg-transparent text-sm font-medium outline-none"
                      placeholder="#E8A020"
                    />
                  </span>
                  {errors.secondary_color && (
                    <p className="text-xs text-red-500">
                      {errors.secondary_color.message}
                    </p>
                  )}
                </div>
              </div>

              {/* App name + tagline */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-800">
                    App name
                  </label>
                  <input
                    {...register("app_name")}
                    placeholder="e.g. DineLuxe Bistro"
                    className="min-h-12 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1A3C5E]"
                  />
                  {errors.app_name && (
                    <p className="text-xs text-red-500">{errors.app_name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-800">
                    Tagline
                  </label>
                  <input
                    {...register("tagline")}
                    placeholder="e.g. Fine dining, made effortless"
                    className="min-h-12 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1A3C5E]"
                  />
                  {errors.tagline && (
                    <p className="text-xs text-red-500">{errors.tagline.message}</p>
                  )}
                </div>
              </div>

              {/* Logo URL */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-800">
                  Logo URL
                </label>
                <input
                  {...register("logo_url")}
                  type="url"
                  placeholder="https://your-supabase.supabase.co/storage/v1/object/public/..."
                  className="min-h-12 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1A3C5E]"
                />
                {errors.logo_url && (
                  <p className="text-xs text-red-500">{errors.logo_url.message}</p>
                )}
                <p className="text-xs text-gray-400">
                  Must be a Supabase Storage public URL. Use the Upload API to get one.
                </p>
              </div>

              {/* Banner URL */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-800">
                  Banner URL
                </label>
                <input
                  {...register("banner_url")}
                  type="url"
                  placeholder="https://your-supabase.supabase.co/storage/v1/object/public/..."
                  className="min-h-12 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1A3C5E]"
                />
                {errors.banner_url && (
                  <p className="text-xs text-red-500">{errors.banner_url.message}</p>
                )}
              </div>

              {/* Font */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-800">
                  Font family
                </label>
                <select
                  {...register("font_family")}
                  className="min-h-12 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1A3C5E] bg-white"
                >
                  {[
                    "Inter",
                    "Poppins",
                    "Roboto",
                    "Nunito",
                    "Lato",
                    "Playfair Display",
                  ].map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Save button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving || !isDirty}
                  className="flex items-center justify-center gap-2 min-h-12 w-full rounded-lg bg-[#1A3C5E] text-white text-sm font-semibold hover:bg-[#15304d] transition disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {isSaving ? "Saving…" : "Save Branding"}
                </button>
              </div>
            </section>

            {/* ── Right: Live phone preview ─────────────────────────────── */}
            <aside className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MonitorSmartphone
                    size={20}
                    className="text-[#1A3C5E]"
                  />
                  <h2 className="text-base font-semibold text-gray-950">
                    Live Mockup
                  </h2>
                </div>
                <Smartphone size={18} className="text-gray-400" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {(["Splash", "Login", "Home"] as PreviewScreen[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScreen(s)}
                    className={cn(
                      "min-h-11 rounded-lg text-sm font-semibold transition",
                      screen === s
                        ? "bg-[#1A3C5E] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="mt-6 flex justify-center">
                <div className="w-[280px] rounded-[34px] border-[10px] border-gray-950 bg-gray-950 shadow-lg">
                  <div
                    className="h-[580px] overflow-hidden rounded-[24px] bg-white"
                    style={previewVars}
                  >
                    <PhonePreview
                      screen={screen}
                      appName={previewAppName}
                      tagline={previewTagline}
                      logoUrl={previewLogoUrl}
                    />
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </form>
      )}
    </PageWrapper>
  );
}