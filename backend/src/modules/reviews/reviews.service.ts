import { supabaseAdmin } from '../../config/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Review {
  id: string;
  order_id: string;
  customer_id: string;
  restaurant_id: string;
  overall_rating: number;
  food_rating?: number;
  service_rating?: number;
  ambiance_rating?: number;
  comment?: string;
  photo_urls?: string[];
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewDto {
  order_id: string;
  customer_id: string;
  restaurant_id: string;
  overall_rating: number;
  food_rating?: number;
  service_rating?: number;
  ambiance_rating?: number;
  comment?: string;
  is_anonymous?: boolean;
}

export interface ReviewSummary {
  restaurant_id: string;
  average_overall: number;
  average_food: number;
  average_service: number;
  average_ambiance: number;
  total_reviews: number;
}

// ---------------------------------------------------------------------------
// Allowed MIME types for review photos
// ---------------------------------------------------------------------------

const ALLOWED_PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

const MAX_PHOTOS = 3;

// ---------------------------------------------------------------------------
// Derive the Supabase storage domain from the project URL so we can
// validate that incoming URLs belong to our own bucket before persisting.
// ---------------------------------------------------------------------------

const getStorageDomain = (): string => {
  const url = process.env.SUPABASE_URL ?? '';
  // e.g. https://<project>.supabase.co  →  <project>.supabase.co
  return url.replace(/^https?:\/\//, '');
};

// ---------------------------------------------------------------------------
// Core CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new review for a completed order.
 */
export const createReview = async (dto: CreateReviewDto): Promise<Review> => {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .insert({
      order_id: dto.order_id,
      customer_id: dto.customer_id,
      restaurant_id: dto.restaurant_id,
      overall_rating: dto.overall_rating,
      food_rating: dto.food_rating ?? null,
      service_rating: dto.service_rating ?? null,
      ambiance_rating: dto.ambiance_rating ?? null,
      comment: dto.comment ?? null,
      is_anonymous: dto.is_anonymous ?? false,
      photo_urls: [],
    })
    .select()
    .single();

  if (error) {
    console.error('[ReviewsService] createReview error:', error);
    throw new Error(`Failed to create review: ${error.message}`);
  }

  return data as Review;
};

/**
 * Fetch a single review by ID.
 */
export const getReviewById = async (reviewId: string): Promise<Review | null> => {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('id', reviewId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // row not found
    console.error('[ReviewsService] getReviewById error:', error);
    throw new Error(`Failed to fetch review: ${error.message}`);
  }

  return data as Review;
};

/**
 * Get all reviews for a given restaurant, newest first.
 */
export const getReviewsByRestaurant = async (restaurantId: string): Promise<Review[]> => {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ReviewsService] getReviewsByRestaurant error:', error);
    throw new Error(`Failed to fetch reviews: ${error.message}`);
  }

  return (data ?? []) as Review[];
};

/**
 * Get all reviews submitted by a customer.
 */
export const getReviewsByCustomer = async (customerId: string): Promise<Review[]> => {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[ReviewsService] getReviewsByCustomer error:', error);
    throw new Error(`Failed to fetch reviews: ${error.message}`);
  }

  return (data ?? []) as Review[];
};

/**
 * Get the rating summary/aggregate for a restaurant.
 */
export const getRestaurantReviewSummary = async (
  restaurantId: string,
): Promise<ReviewSummary> => {
  const { data, error } = await supabaseAdmin
    .from('reviews')
    .select('overall_rating, food_rating, service_rating, ambiance_rating')
    .eq('restaurant_id', restaurantId);

  if (error) {
    console.error('[ReviewsService] getRestaurantReviewSummary error:', error);
    throw new Error(`Failed to fetch review summary: ${error.message}`);
  }

  const reviews = (data ?? []) as Array<{
    overall_rating: number;
    food_rating: number | null;
    service_rating: number | null;
    ambiance_rating: number | null;
  }>;

  if (reviews.length === 0) {
    return {
      restaurant_id: restaurantId,
      average_overall: 0,
      average_food: 0,
      average_service: 0,
      average_ambiance: 0,
      total_reviews: 0,
    };
  }

  const avg = (nums: (number | null)[]): number => {
    const valid = nums.filter((n): n is number => n !== null);
    return valid.length === 0 ? 0 : valid.reduce((a, b) => a + b, 0) / valid.length;
  };

  return {
    restaurant_id: restaurantId,
    average_overall: avg(reviews.map((r) => r.overall_rating)),
    average_food: avg(reviews.map((r) => r.food_rating)),
    average_service: avg(reviews.map((r) => r.service_rating)),
    average_ambiance: avg(reviews.map((r) => r.ambiance_rating)),
    total_reviews: reviews.length,
  };
};

/**
 * Soft-delete / mark a review as hidden (admin / moderation use).
 */
export const deleteReview = async (reviewId: string): Promise<void> => {
  const { error } = await supabaseAdmin
    .from('reviews')
    .delete()
    .eq('id', reviewId);

  if (error) {
    console.error('[ReviewsService] deleteReview error:', error);
    throw new Error(`Failed to delete review: ${error.message}`);
  }
};

// ---------------------------------------------------------------------------
// Photo upload pipeline  (P3-18 — Section 9.6)
// ---------------------------------------------------------------------------

/**
 * Generate a short-lived Supabase Storage signed upload URL so the
 * frontend can PUT a photo directly to the bucket without proxying
 * the bytes through our API server.
 *
 * @param reviewId   - UUID of the review these photos belong to
 * @param photoIndex - Slot index 0–2 (up to MAX_PHOTOS slots per review)
 * @param fileType   - MIME type supplied by the client
 * @returns upload_url  — signed URL the client should PUT to
 *          public_url  — permanent public URL to persist after upload
 */
export const getReviewPhotoUploadUrl = async (
  reviewId: string,
  photoIndex: number,
  fileType: string,
): Promise<{ upload_url: string; public_url: string }> => {
  // --- Validate MIME type ---
  const extension = ALLOWED_PHOTO_TYPES[fileType];
  if (!extension) {
    throw Object.assign(
      new Error(
        `Unsupported file type "${fileType}". Allowed types: ${Object.keys(ALLOWED_PHOTO_TYPES).join(', ')}`,
      ),
      { statusCode: 400 },
    );
  }

  // --- Validate photo slot index ---
  if (photoIndex < 0 || photoIndex >= MAX_PHOTOS || !Number.isInteger(photoIndex)) {
    throw Object.assign(
      new Error(`photo_index must be an integer between 0 and ${MAX_PHOTOS - 1}`),
      { statusCode: 400 },
    );
  }

  // --- Build unique storage key ---
  // Pattern: reviews/<reviewId>/photo_<index>_<timestamp>.<ext>
  const key = `reviews/${reviewId}/photo_${photoIndex}_${Date.now()}.${extension}`;

  // --- Request a signed upload URL from Supabase Storage ---
  const { data, error } = await supabaseAdmin.storage
    .from('reviews') // bucket name: 'reviews'
    .createSignedUploadUrl(key);

  if (error || !data) {
    console.error('[ReviewsService] createSignedUploadUrl error:', error);
    throw Object.assign(
      new Error('Failed to generate upload URL. Please try again.'),
      { statusCode: 500 },
    );
  }

  // --- Derive the permanent public URL for this key ---
  const { data: urlData } = supabaseAdmin.storage
    .from('reviews')
    .getPublicUrl(key);

  return {
    upload_url: data.signedUrl,
    public_url: urlData.publicUrl,
  };
};

/**
 * Persist an array of already-uploaded photo URLs onto a review row.
 *
 * Called by the frontend after the review has been created and all
 * direct-to-storage uploads have completed.
 *
 * @param reviewId  - UUID of the review to update
 * @param photoUrls - Array of public Supabase Storage URLs (max 3)
 */
export const attachPhotosToReview = async (
  reviewId: string,
  photoUrls: string[],
): Promise<void> => {
  // --- Validate count ---
  if (!Array.isArray(photoUrls)) {
    throw Object.assign(new Error('photo_urls must be an array'), { statusCode: 400 });
  }
  if (photoUrls.length > MAX_PHOTOS) {
    throw Object.assign(
      new Error(`Maximum ${MAX_PHOTOS} photos allowed per review`),
      { statusCode: 400 },
    );
  }

  // --- Validate each URL belongs to our Supabase Storage domain ---
  const storageDomain = getStorageDomain();
  for (const url of photoUrls) {
    if (!url || typeof url !== 'string') {
      throw Object.assign(new Error('Each photo URL must be a non-empty string'), {
        statusCode: 400,
      });
    }
    // Must be HTTPS and reference our Supabase project domain
    if (!url.startsWith('https://') || !url.includes(storageDomain)) {
      throw Object.assign(
        new Error(`Invalid photo URL: "${url}". URLs must belong to the application storage domain.`),
        { statusCode: 400 },
      );
    }
  }

  // --- Verify the review exists before updating ---
  const review = await getReviewById(reviewId);
  if (!review) {
    throw Object.assign(new Error(`Review "${reviewId}" not found`), { statusCode: 404 });
  }

  // --- Persist photo_urls onto the review row ---
  // photo_urls is a TEXT[] column in the reviews table.
  const { error } = await supabaseAdmin
    .from('reviews')
    .update({ photo_urls: photoUrls, updated_at: new Date().toISOString() })
    .eq('id', reviewId);

  if (error) {
    console.error('[ReviewsService] attachPhotosToReview error:', error);
    throw Object.assign(
      new Error(`Failed to attach photos to review: ${error.message}`),
      { statusCode: 500 },
    );
  }
};