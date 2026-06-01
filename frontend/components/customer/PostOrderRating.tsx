"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Camera, Image as ImageIcon, X, Loader2, Smile } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export type PostOrderItem = {
  menu_item_id: string;
  name: string;
  photo_url?: string;
  quantity: number;
};

type Props = {
  orderId: string;
  restaurantId: string;
  orderItems: PostOrderItem[];
  onSubmit: () => void;
  onSkip: () => void;
  onSubmittedToast?: boolean;
};

type RatingState = Record<string, number>; // menu_item_id -> rating

function clampRating(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

function StarRow({
  value,
  onChange,
  size = 18,
  allowHalf = false,
  labelColors = false,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
  allowHalf?: boolean;
  labelColors?: boolean;
}) {
  const colors = useMemo(() => {
    if (value <= 0) return "text-gray-300";
    return "text-[#E8A020] fill-[#E8A020]";
  }, [value]);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        const starValue = i + 1;

        const filled = value >= starValue;
        return (
          <button
            key={starValue}
            type="button"
            onClick={() => onChange(starValue)}
            className={cn(
              "transition-transform focus:outline-none",
              filled ? "scale-[1.04]" : "scale-100",
            )}
            aria-label={`Rate ${starValue} star${starValue === 1 ? "" : "s"}`}
          >
            <Star
              size={size}
              className={cn(
                filled ? "text-[#E8A020]" : "text-gray-300",
                filled ? "fill-[#E8A020]" : "fill-transparent",
                labelColors ? colors : undefined,
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function PostOrderRating({
  orderId,
  restaurantId,
  orderItems,
  onSubmit,
  onSkip,
  onSubmittedToast = true,
}: Props) {
  const [overall, setOverall] = useState<number>(0);
  const [itemRatings, setItemRatings] = useState<RatingState>({});
  const [textReview, setTextReview] = useState<string>("");
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = overall > 0 && !isSubmitting;

  useEffect(() => {
    // Reset sheet state if ids change
    setOverall(0);
    setItemRatings({});
    setTextReview("");
    setPhotos([null, null, null]);
  }, [orderId, restaurantId]);

  const charCount = textReview.length;

  const overallLabel = useMemo(() => {
    if (overall === 1) return "Terrible";
    if (overall === 2) return "Bad";
    if (overall === 3) return "OK";
    if (overall === 4) return "Good";
    if (overall === 5) return "Excellent";
    return "";
  }, [overall]);

  const activeItemRatings = useMemo(() => {
    // Only build item_ratings for items that have a rating (and overall > 0)
    if (overall <= 0) return [];
    return orderItems
      .filter((it) => clampRating(itemRatings[it.menu_item_id] ?? 0) > 0)
      .map((it) => ({
        order_item_id: it.menu_item_id, // NOTE: backend expects order_item_id; we use menu_item_id as fallback if provided.
        rating: clampRating(itemRatings[it.menu_item_id] ?? 0),
        menu_item_id: it.menu_item_id,
      }));
  }, [overall, itemRatings, orderItems]);

  async function handlePickFiles(files: FileList | null | undefined) {
    if (!files || files.length === 0) return;

    const maxBytes = 5 * 1024 * 1024; // 5MB each
    const selected = Array.from(files);

    const validFiles: File[] = [];
    for (const f of selected) {
      if (f.size > maxBytes) {
        toast.error("Each photo must be <= 5MB");
        continue;
      }
      validFiles.push(f);
    }

    if (validFiles.length === 0) return;

    setPhotos((prev) => {
      const next = [...prev];
      for (const file of validFiles) {
        const slot = next.findIndex((p) => p === null);
        if (slot === -1) break;
        next[slot] = URL.createObjectURL(file);
      }
      return next;
    });

    // We keep local object URLs for previews. The backend expects photo URLs (or public URLs),
    // so currently we are sending base64 is not supported here.
    // This app likely uses upload-url flow elsewhere; if needed we will integrate upload later.
    toast.message("Photos selected. Submit to send review (photo upload integration required).");
  }

  function buildPayload() {
    // IMPORTANT:
    // Backend schema expects:
    //  - item_ratings: [{ order_item_id: uuid, rating: 1..5 }]
    // The prompt asks for { menu_item_id, rating }, but backend already uses order_item_id.
    // Here we assume orderItems[].menu_item_id is actually the backend order_item_id.
    const itemPayload =
      overall > 0
        ? orderItems
            .map((it) => {
              const r = clampRating(itemRatings[it.menu_item_id] ?? 0);
              if (!r) return null;
              return { order_item_id: it.menu_item_id, rating: r };
            })
            .filter(Boolean)
        : [];

    const photoUrls = photos.filter(Boolean) as string[];

    return {
      order_id: orderId,
      restaurant_id: restaurantId,
      overall_rating: overall,
      text_review: textReview?.trim() ? textReview.trim() : undefined,
      item_ratings: itemPayload,
      photos: photoUrls.length ? photoUrls : undefined,
    };
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const payload = buildPayload();

      await apiClient.post("/reviews", payload);
      setIsSubmitting(false);

      if (onSubmittedToast) toast.success("Thanks for your review! 🙏");
      onSubmit();
    } catch (e: any) {
      setIsSubmitting(false);
      toast.error(e?.message ?? "Failed to submit review");
    }
  }

  function handleSkip() {
    onSkip();
  }

  return (
    <div className="fixed inset-0 z-60">
      <div className="absolute inset-0 bg-black/40" onClick={handleSkip} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 350, damping: 35 }}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl border border-gray-100"
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                How was your experience?
              </p>
              <h2 className="text-lg font-bold text-gray-900">Your feedback helps us improve</h2>
              {overallLabel ? (
                <p className="text-sm text-gray-500 mt-1">
                  Selected: <span className="font-semibold text-[#E8A020]">{overallLabel}</span>
                </p>
              ) : (
                <p className="text-sm text-gray-500 mt-1">Tap stars to rate</p>
              )}
            </div>
            <button
              type="button"
              className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100"
              onClick={handleSkip}
              aria-label="Close rating sheet"
            >
              <X size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pb-5 overflow-y-auto max-h-[70vh]">
          {/* Section 1 */}
          <div className="pt-2">
            <p className="text-sm font-semibold text-gray-800 mb-3">Overall Rating</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <StarRow value={overall} onChange={(n) => setOverall(n)} size={26} labelColors />
              </div>

              <div className="grid grid-cols-5 gap-2 text-[11px]">
                {[
                  { label: "Terrible", v: 1 },
                  { label: "Bad", v: 2 },
                  { label: "OK", v: 3 },
                  { label: "Good", v: 4 },
                  { label: "Excellent", v: 5 },
                ].map((x) => (
                  <div key={x.v} className="text-center">
                    <span
                      className={cn(
                        "block",
                        overall === x.v ? "text-[#E8A020] font-bold" : "text-gray-400",
                      )}
                    >
                      {x.v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2 */}
          {overall > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-800 mb-2">Rate each dish</p>

              <div className="overflow-x-auto pb-1">
                <div className="flex gap-3">
                  {orderItems.map((item) => {
                    const rating = clampRating(itemRatings[item.menu_item_id] ?? 0);
                    return (
                      <div key={item.menu_item_id} className="min-w-60 bg-gray-50 border border-gray-100 rounded-2xl p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center overflow-hidden">
                            {item.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-lg">🍽️</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                            <p className="text-xs text-gray-400">{item.quantity}×</p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-1">
                          {Array.from({ length: 5 }, (_, i) => {
                            const starValue = i + 1;
                            const filled = rating >= starValue;
                            return (
                              <button
                                key={starValue}
                                type="button"
                                onClick={() =>
                                  setItemRatings((prev) => ({
                                    ...prev,
                                    [item.menu_item_id]: starValue,
                                  }))
                                }
                              >
                                <Star
                                  size={14}
                                  className={cn(
                                    "transition-colors",
                                    filled ? "text-[#E8A020] fill-[#E8A020]" : "text-gray-300 fill-transparent",
                                  )}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Section 3 */}
          {overall > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-800 mb-2">Text Review (optional)</p>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
                <textarea
                  value={textReview}
                  onChange={(e) => setTextReview(e.target.value.slice(0, 500))}
                  placeholder="What did you love? What could be better?"
                  className="w-full bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400 min-h-22.5"
                />
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <Smile size={14} className="text-[#E8A020]" />
                    Optional
                  </div>
                  <div className="text-xs text-gray-500 font-semibold">
                    {charCount}/500
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 4 */}
          {overall > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-800 mb-2">Photo Upload (optional)</p>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3">
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(`photo-input-${idx}`) as HTMLInputElement | null;
                        el?.click();
                      }}
                      className={cn(
                        "w-full h-20 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden",
                        p ? "p-0" : "hover:border-[#E8A020]/50 transition-colors",
                      )}
                    >
                      {p ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p} alt={`Review photo ${idx + 1}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-gray-400">
                          <ImageIcon size={18} />
                          <span className="text-[11px] leading-none">Add</span>
                        </div>
                      )}
                      <input
                        id={`photo-input-${idx}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePickFiles(e.target.files)}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Up to 3 photos · max 5MB each
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="px-5 pb-6">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 py-3 rounded-2xl text-[#1A3C5E] font-bold border border-gray-100 bg-white"
              disabled={isSubmitting}
            >
              Skip Rating
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className={cn(
                "flex-1 py-3 rounded-2xl text-white font-bold bg-[#1A3C5E] shadow-sm flex items-center justify-center gap-2",
                !canSubmit && "opacity-50 cursor-not-allowed",
              )}
              disabled={!canSubmit}
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Submit Review"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
