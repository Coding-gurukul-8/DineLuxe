import React, { useState, useRef } from 'react';
import { Star, Camera, X, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../lib/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostOrderRatingProps {
  orderId: string;
  restaurantId: string;
  customerId: string;
  restaurantName: string;
  onSubmit: () => void;
  onSkip?: () => void;
}

interface ReviewData {
  order_id: string;
  customer_id: string;
  restaurant_id: string;
  overall_rating: number;
  food_rating: number | null;
  service_rating: number | null;
  ambiance_rating: number | null;
  comment: string;
  is_anonymous: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PHOTOS = 3;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StarRatingProps {
  label: string;
  value: number | null;
  onChange: (rating: number) => void;
  required?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({ label, value, onChange, required }) => {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                star <= (hovered ?? value ?? 0)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Photo Slot
// ---------------------------------------------------------------------------

interface PhotoSlotProps {
  index: number;
  preview: string | null;
  isUploading: boolean;
  isUploaded: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, index: number) => void;
  onRemove: (index: number) => void;
}

const PhotoSlot: React.FC<PhotoSlotProps> = ({
  index,
  preview,
  isUploading,
  isUploaded,
  onFileSelect,
  onRemove,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Empty slot ---
  if (!preview) {
    return (
      <div
        onClick={() => inputRef.current?.click()}
        className="
          relative w-24 h-24 rounded-xl border-2 border-dashed border-gray-300
          flex flex-col items-center justify-center gap-1
          cursor-pointer hover:border-orange-400 hover:bg-orange-50
          transition-colors group
        "
        role="button"
        aria-label={`Add photo ${index + 1}`}
      >
        <Camera className="w-6 h-6 text-gray-400 group-hover:text-orange-400 transition-colors" />
        <span className="text-xs text-gray-400 group-hover:text-orange-400 transition-colors font-medium">
          Add Photo
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME_TYPES.join(',')}
          className="sr-only"
          onChange={(e) => onFileSelect(e, index)}
          aria-hidden="true"
        />
      </div>
    );
  }

  // --- Slot with image (loading or uploaded) ---
  return (
    <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-gray-200 group">
      {/* Thumbnail */}
      <img
        src={preview}
        alt={`Review photo ${index + 1}`}
        className="w-full h-full object-cover"
      />

      {/* Loading overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
      )}

      {/* Success checkmark overlay */}
      {isUploaded && !isUploading && (
        <div className="absolute bottom-1.5 right-1.5 bg-green-500 rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </div>
      )}

      {/* Remove button — only shown when not uploading */}
      {!isUploading && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="
            absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80
            flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-opacity
          "
          aria-label={`Remove photo ${index + 1}`}
        >
          <X className="w-3 h-3 text-white" strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const PostOrderRating: React.FC<PostOrderRatingProps> = ({
  orderId,
  restaurantId,
  customerId,
  restaurantName,
  onSubmit,
  onSkip,
}) => {
  // --- Rating state ---
  const [overallRating, setOverallRating] = useState<number>(0);
  const [foodRating, setFoodRating] = useState<number | null>(null);
  const [serviceRating, setServiceRating] = useState<number | null>(null);
  const [ambianceRating, setAmbianceRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  // --- Photo state ---
  // photoPreviews: object URLs for immediate local display
  // uploadedUrls:  permanent Supabase public URLs after upload completes
  // uploadingIndex: which slot is currently uploading (null = none)
  const [photoPreviews, setPhotoPreviews] = useState<(string | null)[]>(
    Array(MAX_PHOTOS).fill(null),
  );
  const [uploadedUrls, setUploadedUrls] = useState<(string | null)[]>(
    Array(MAX_PHOTOS).fill(null),
  );
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  // --- Submission state ---
  const [isSubmitting, setIsSubmitting] = useState(false);

  // -------------------------------------------------------------------------
  // Photo upload pipeline
  // -------------------------------------------------------------------------

  /**
   * Step 1 — Ask our backend for a short-lived signed upload URL.
   * Step 2 — PUT the file directly to Supabase Storage (no backend proxy).
   * Returns the permanent public URL for persisting on the review row.
   */
  const uploadPhoto = async (file: File, index: number): Promise<string> => {
    // Get pre-signed upload URL from backend
    const { upload_url, public_url } = await apiClient.post<{
      upload_url: string;
      public_url: string;
    }>(`/reviews/temp/upload-url`, {
      // We use a temporary placeholder review id until the review is created.
      // The route is /reviews/:id/upload-url, but we need the id first.
      // See handleSubmit for the corrected two-step flow.
      photo_index: index,
      file_type: file.type,
    });

    // Upload directly to Supabase Storage — bypasses our API server for perf
    const uploadResponse = await fetch(upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Storage upload failed: ${uploadResponse.statusText}`);
    }

    return public_url;
  };

  /**
   * Handles a file being chosen in one of the photo input slots.
   * Validates the file client-side, shows a local preview immediately,
   * then uploads in the background while the user fills in the rest of
   * the form.
   *
   * NOTE: The signed URL requires a real review ID. We defer the actual
   * upload until handleSubmit (create review → upload → attach). Here we
   * only set the preview so the UI shows the chosen image immediately,
   * and stash the File object for use in handleSubmit.
   */
  const pendingFiles = useRef<(File | null)[]>(Array(MAX_PHOTOS).fill(null));

  const handlePhotoSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input value so the same file can be reselected after removal
    e.target.value = '';

    // Client-side validation
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('Photo must be under 5 MB');
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error('Please select a JPG, PNG, WebP, or HEIC image');
      return;
    }

    // Show local preview immediately (good UX — user sees their pick at once)
    const localUrl = URL.createObjectURL(file);
    setPhotoPreviews((prev) => {
      const next = [...prev];
      next[index] = localUrl;
      return next;
    });

    // Stash the file for upload when the review is submitted
    pendingFiles.current[index] = file;

    // Clear any previously uploaded URL for this slot
    setUploadedUrls((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  /**
   * Remove a photo from the given slot — clears preview, pending file,
   * and any already-uploaded URL.
   */
  const handlePhotoRemove = (index: number) => {
    // Revoke the object URL to free memory
    const prev = photoPreviews[index];
    if (prev && prev.startsWith('blob:')) {
      URL.revokeObjectURL(prev);
    }

    setPhotoPreviews((p) => {
      const n = [...p];
      n[index] = null;
      return n;
    });
    setUploadedUrls((p) => {
      const n = [...p];
      n[index] = null;
      return n;
    });
    pendingFiles.current[index] = null;
  };

  // -------------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------------

  const handleSubmit = async () => {
    if (overallRating === 0) {
      toast.error('Please select an overall rating');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create the review row
      const reviewData: ReviewData = {
        order_id: orderId,
        customer_id: customerId,
        restaurant_id: restaurantId,
        overall_rating: overallRating,
        food_rating: foodRating,
        service_rating: serviceRating,
        ambiance_rating: ambianceRating,
        comment: comment.trim(),
        is_anonymous: isAnonymous,
      };

      const reviewResult = await apiClient.post<{ id: string }>('/reviews', reviewData);
      const reviewId = reviewResult.id;

      // 2. Upload any pending photo files directly to Supabase Storage
      const uploadedPublicUrls: (string | null)[] = [...uploadedUrls];

      const uploadTasks = pendingFiles.current.map(async (file, index) => {
        if (!file) return;

        setUploadingIndex(index);

        try {
          // Get a signed upload URL scoped to the real review ID
          const { upload_url, public_url } = await apiClient.post<{
            upload_url: string;
            public_url: string;
          }>(`/reviews/${reviewId}/upload-url`, {
            photo_index: index,
            file_type: file.type,
          });

          // PUT directly to storage
          const uploadResponse = await fetch(upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
          });

          if (!uploadResponse.ok) {
            throw new Error(`Storage upload failed: ${uploadResponse.statusText}`);
          }

          uploadedPublicUrls[index] = public_url;

          // Update the UI to reflect successful upload
          setUploadedUrls((prev) => {
            const next = [...prev];
            next[index] = public_url;
            return next;
          });
        } catch {
          toast.error(`Photo ${index + 1} failed to upload — your review was still saved.`);
        } finally {
          setUploadingIndex(null);
        }
      });

      // Run all uploads (sequential to avoid hammering storage with concurrent
      // signed-URL requests; change to Promise.all if you want parallel)
      for (const task of uploadTasks) {
        await task;
      }

      // 3. Attach any successfully uploaded photos to the review
      const validUrls = uploadedPublicUrls.filter((url): url is string => Boolean(url));
      if (validUrls.length > 0) {
        await apiClient.patch(`/reviews/${reviewId}/photos`, {
          photo_urls: validUrls,
        });
      }

      toast.success('Review submitted — thank you!');
      onSubmit();
    } catch (err) {
      console.error('[PostOrderRating] handleSubmit error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const hasAnyUpload = photoPreviews.some(Boolean);
  const isAnyUploadInProgress = uploadingIndex !== null;

  return (
    <div className="bg-white rounded-2xl shadow-lg max-w-md w-full mx-auto overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5">
        <h2 className="text-white text-xl font-bold">How was your meal?</h2>
        <p className="text-orange-100 text-sm mt-0.5">
          Rate your experience at{' '}
          <span className="font-semibold text-white">{restaurantName}</span>
        </p>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-5">
        {/* Ratings */}
        <div className="divide-y divide-gray-100">
          <StarRating
            label="Overall"
            value={overallRating || null}
            onChange={setOverallRating}
            required
          />
          <StarRating label="Food Quality" value={foodRating} onChange={setFoodRating} />
          <StarRating label="Service" value={serviceRating} onChange={setServiceRating} />
          <StarRating label="Ambiance" value={ambianceRating} onChange={setAmbianceRating} />
        </div>

        {/* Comment */}
        <div>
          <label
            htmlFor="review-comment"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Comments <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="review-comment"
            rows={3}
            placeholder="Tell us more about your experience…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            className="
              w-full rounded-xl border border-gray-200 px-3.5 py-2.5
              text-sm text-gray-800 placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent
              resize-none transition
            "
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{comment.length}/1000</p>
        </div>

        {/* Photo Upload Section */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Add Photos{' '}
            <span className="text-gray-400 font-normal">
              (up to {MAX_PHOTOS}, max 5 MB each)
            </span>
          </p>

          <div className="flex gap-3">
            {Array.from({ length: MAX_PHOTOS }, (_, i) => (
              <PhotoSlot
                key={i}
                index={i}
                preview={photoPreviews[i]}
                isUploading={uploadingIndex === i}
                isUploaded={Boolean(uploadedUrls[i])}
                onFileSelect={handlePhotoSelect}
                onRemove={handlePhotoRemove}
              />
            ))}
          </div>

          {hasAnyUpload && (
            <p className="text-xs text-gray-400 mt-2">
              Photos upload when you submit your review.
            </p>
          )}
        </div>

        {/* Anonymous toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setIsAnonymous((v) => !v)}
            className={`
              relative w-10 h-6 rounded-full transition-colors
              ${isAnonymous ? 'bg-orange-500' : 'bg-gray-200'}
            `}
            role="switch"
            aria-checked={isAnonymous}
          >
            <span
              className={`
                absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow
                transition-transform ${isAnonymous ? 'translate-x-4' : 'translate-x-0'}
              `}
            />
          </div>
          <span className="text-sm text-gray-700">Submit anonymously</span>
        </label>
      </div>

      {/* Footer actions */}
      <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={isSubmitting || isAnyUploadInProgress}
            className="
              flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium
              text-gray-600 hover:bg-gray-50 transition disabled:opacity-50
            "
          >
            Skip
          </button>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || overallRating === 0 || isAnyUploadInProgress}
          className="
            flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600
            text-white text-sm font-semibold transition
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2
          "
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting…
            </>
          ) : (
            'Submit Review'
          )}
        </button>
      </div>
    </div>
  );
};

export default PostOrderRating;