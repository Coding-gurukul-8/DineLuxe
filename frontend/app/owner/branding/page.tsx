"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
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
import { useBrandingUpdated } from "@/hooks/useBrandingUpdated";
import { useBrandingPreview } from "@/components/layout/BrandingProvider";
import {
  BrandingPreviewPanel,
  type PreviewScreen,
} from "@/components/layout/BrandingPreviewPanel";
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

const FONT_OPTIONS = [
  "Inter",
  "Poppins",
  "Roboto",
  "Nunito",
  "Lato",
  "Playfair Display",
] as const;

type FontOption = (typeof FONT_OPTIONS)[number];

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
    .enum(FONT_OPTIONS)
    .optional(),
});

type BrandingFormData = z.infer<typeof brandingSchema>;

// ── Font URLs (for live preview loading) ──────────────────────────────────────

const FONT_URLS: Record<FontOption, string> = {
  Inter:
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
  Poppins:
    "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap",
  Roboto:
    "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap",
  Nunito:
    "https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap",
  Lato:
    "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap",
  "Playfair Display":
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap",
};

/** Preload a font so the picker renders in the correct typeface */
function preloadFont(name: FontOption) {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[data-preview-font="${name}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_URLS[name];
  link.dataset.previewFont = name;
  document.head.appendChild(link);
}

// ── LogoDropZone ──────────────────────────────────────────────────────────────

function LogoDropZone({
  restaurantId,
  value,
  onChange,
}: {
  restaurantId: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const uploadLogo = useCallback(async (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/x-icon"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Logo must be JPEG, PNG, WebP, SVG, or ICO");
      return;
    }

    setIsUploading(true);
    try {
      const uploadInfo = await apiClient.post<{
        upload_url: string;
        public_url: string;
        expires_in: number;
        max_size_bytes: number;
      }>(`/restaurants/${restaurantId}/branding/upload-url`, {
        file_type: "logo",
        content_type: file.type,
      });

      if (file.size > uploadInfo.max_size_bytes) {
        toast.error(`Logo must be smaller than ${(uploadInfo.max_size_bytes / (1024 * 1024)).toFixed(0)} MB`);
        return;
      }

      const response = await fetch(uploadInfo.upload_url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      onChange(uploadInfo.public_url);
      toast.success("Logo uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload logo");
    } finally {
      setIsUploading(false);
    }
  }, [onChange, restaurantId]);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void uploadLogo(file);
      }}
      className={cn(
        "rounded-xl border border-dashed p-4 transition-colors",
        isDragging ? "border-[#1A3C5E] bg-[#1A3C5E]/5" : "border-gray-200 bg-gray-50"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml,image/x-icon"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadLogo(file);
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">Drop a logo here</p>
          <p className="text-xs text-gray-500">
            PNG, JPG, WebP, SVG, or ICO. Uploads update the preview and save to the branding record.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="shrink-0 rounded-lg bg-[#1A3C5E] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {isUploading ? "Uploading..." : value ? "Replace" : "Choose file"}
        </button>
      </div>
      {value && (
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-white p-3 border border-gray-200">
          <img src={value} alt="Logo preview" className="h-10 w-10 rounded-md object-cover" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-700 truncate">Uploaded logo</p>
            <p className="text-[10px] text-gray-400 truncate">{value}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Font Picker ───────────────────────────────────────────────────────────────

function FontPicker({
  value,
  onChange,
}: {
  value: FontOption;
  onChange: (f: FontOption) => void;
}) {
  // Preload all fonts so picker renders each option in its own typeface
  useEffect(() => {
    FONT_OPTIONS.forEach(preloadFont);
  }, []);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {FONT_OPTIONS.map((font) => (
        <button
          key={font}
          type="button"
          onClick={() => onChange(font)}
          className={cn(
            "relative flex min-h-14 flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition",
            value === font
              ? "border-[#1A3C5E] bg-[#1A3C5E]/5 ring-1 ring-[#1A3C5E]"
              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
          )}
        >
          {value === font && (
            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#1A3C5E]">
              <Check size={10} className="text-white" />
            </span>
          )}
          <span
            className="text-base font-semibold text-gray-900"
            style={{ fontFamily: `'${font}', sans-serif` }}
          >
            Aa
          </span>
          <span className="mt-0.5 text-[10px] font-medium leading-tight text-gray-500">
            {font}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrandingPage() {
  const { restaurantId } = useAuth();
  const qc = useQueryClient();
  const [screen, setScreen] = useState<PreviewScreen>("Splash");
  const [shareCopied, setShareCopied] = useState(false);

  const { setPreviewOverride, clearPreview } = useBrandingPreview();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
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

  useBrandingUpdated({
    restaurantId: restaurantId ?? undefined,
    onBrandingUpdated: () => {
      qc.invalidateQueries({ queryKey: ["branding", restaurantId] });
      void refetch();
    },
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
  const fontFamily = (watch("font_family") || "Inter") as FontOption;
  const previewAppName = watch("app_name") || "DineLuxe";
  const previewTagline = watch("tagline") || "Fine dining, made effortless";
  const previewLogoUrl = watch("logo_url") || null;

  // Sync form changes → BrandingProvider for global CSS var preview
  useEffect(() => {
    setPreviewOverride({
      primaryColor,
      secondaryColor,
      fontPreference: fontFamily,
      appNameDisplay: previewAppName,
    });
  }, [primaryColor, secondaryColor, fontFamily, previewAppName, setPreviewOverride]);

  // Restore saved branding on unmount
  useEffect(() => () => clearPreview(), [clearPreview]);

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

              {/* Logo */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-800">
                  Logo
                </label>
                <LogoDropZone
                  restaurantId={restaurantId}
                  value={watch("logo_url") ?? ""}
                  onChange={(url) => setValue("logo_url", url, { shouldDirty: true, shouldValidate: true })}
                />
                {errors.logo_url && (
                  <p className="text-xs text-red-500">{errors.logo_url.message}</p>
                )}
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

              {/* Font family — visual picker */}
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-800">
                  Font family
                </label>
                <FontPicker
                  value={fontFamily}
                  onChange={(f) =>
                    setValue("font_family", f, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                {errors.font_family && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.font_family.message}
                  </p>
                )}
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
            <div className="xl:sticky xl:top-6 xl:self-start">
              <BrandingPreviewPanel
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                font={fontFamily}
                appName={previewAppName}
                tagline={previewTagline}
                logoUrl={previewLogoUrl}
                screen={screen}
                onScreenChange={setScreen}
              />
            </div>
          </div>
        </form>
      )}
    </PageWrapper>
  );
}