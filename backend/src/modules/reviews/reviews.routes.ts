import { Router, Request, Response } from 'express';
import {
  createReview,
  getReviewById,
  getReviewsByRestaurant,
  getReviewsByCustomer,
  getRestaurantReviewSummary,
  deleteReview,
  getReviewPhotoUploadUrl,
  attachPhotosToReview,
} from './reviews.service';
import {
  sendSuccess,
  sendCreated,
  sendError,
  sendBadRequest,
  sendNotFound,
} from '../../utils/response';

// ---------------------------------------------------------------------------
// Auth middleware (inline type — replace with your shared middleware import)
// ---------------------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

/**
 * Thin authenticate guard — replace with your actual JWT/session middleware.
 * Kept inline here so this file compiles standalone without external deps.
 */
const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: () => void,
): void => {
  // TODO: replace with real JWT verification middleware
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  next();
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

// ---------------------------------------------------------------------------
// POST /reviews
// Create a new review for a completed order
// ---------------------------------------------------------------------------
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      order_id,
      customer_id,
      restaurant_id,
      overall_rating,
      food_rating,
      service_rating,
      ambiance_rating,
      comment,
      is_anonymous,
    } = req.body;

    if (!order_id || !customer_id || !restaurant_id || overall_rating === undefined) {
      sendBadRequest(res, 'order_id, customer_id, restaurant_id and overall_rating are required');
      return;
    }

    if (overall_rating < 1 || overall_rating > 5) {
      sendBadRequest(res, 'overall_rating must be between 1 and 5');
      return;
    }

    const review = await createReview({
      order_id,
      customer_id,
      restaurant_id,
      overall_rating,
      food_rating,
      service_rating,
      ambiance_rating,
      comment,
      is_anonymous,
    });

    sendCreated(res, review, 'Review created successfully');
  } catch (err) {
    console.error('[ReviewsRoutes] POST /reviews error:', err);
    sendError(res, 'Failed to create review');
  }
});

// ---------------------------------------------------------------------------
// GET /reviews/:id
// Fetch a single review by ID
// ---------------------------------------------------------------------------
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const review = await getReviewById(req.params.id);
    if (!review) {
      sendNotFound(res, 'Review not found');
      return;
    }
    sendSuccess(res, review);
  } catch (err) {
    console.error('[ReviewsRoutes] GET /reviews/:id error:', err);
    sendError(res, 'Failed to fetch review');
  }
});

// ---------------------------------------------------------------------------
// GET /reviews/restaurant/:restaurantId
// All reviews for a restaurant
// ---------------------------------------------------------------------------
router.get('/restaurant/:restaurantId', async (req: Request, res: Response) => {
  try {
    const reviews = await getReviewsByRestaurant(req.params.restaurantId);
    sendSuccess(res, reviews);
  } catch (err) {
    console.error('[ReviewsRoutes] GET /reviews/restaurant/:id error:', err);
    sendError(res, 'Failed to fetch restaurant reviews');
  }
});

// ---------------------------------------------------------------------------
// GET /reviews/restaurant/:restaurantId/summary
// Aggregate rating summary for a restaurant
// ---------------------------------------------------------------------------
router.get('/restaurant/:restaurantId/summary', async (req: Request, res: Response) => {
  try {
    const summary = await getRestaurantReviewSummary(req.params.restaurantId);
    sendSuccess(res, summary);
  } catch (err) {
    console.error('[ReviewsRoutes] GET /reviews/restaurant/:id/summary error:', err);
    sendError(res, 'Failed to fetch review summary');
  }
});

// ---------------------------------------------------------------------------
// GET /reviews/customer/:customerId
// All reviews by a customer
// ---------------------------------------------------------------------------
router.get('/customer/:customerId', authenticate, async (req: Request, res: Response) => {
  try {
    const reviews = await getReviewsByCustomer(req.params.customerId);
    sendSuccess(res, reviews);
  } catch (err) {
    console.error('[ReviewsRoutes] GET /reviews/customer/:id error:', err);
    sendError(res, 'Failed to fetch customer reviews');
  }
});

// ---------------------------------------------------------------------------
// DELETE /reviews/:id
// Remove a review (admin / moderation)
// ---------------------------------------------------------------------------
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await deleteReview(req.params.id);
    sendSuccess(res, null, 200, 'Review deleted successfully');
  } catch (err) {
    console.error('[ReviewsRoutes] DELETE /reviews/:id error:', err);
    sendError(res, 'Failed to delete review');
  }
});

// ---------------------------------------------------------------------------
// POST /reviews/:id/upload-url                               (P3-18 — §9.6)
// Generate a pre-signed Supabase Storage upload URL for a photo slot.
//
// Body: { photo_index: number (0–2), file_type: string }
// Returns: { upload_url: string, public_url: string }
//
// The client uses upload_url to PUT the file directly to storage
// (bypassing our server for performance), then persists public_url
// via PATCH /reviews/:id/photos once the review is created.
// ---------------------------------------------------------------------------
router.post(
  '/:id/upload-url',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviewId = req.params.id;
      const { photo_index, file_type } = req.body;

      // Basic shape validation
      if (photo_index === undefined || photo_index === null) {
        sendBadRequest(res, 'photo_index is required');
        return;
      }
      if (!file_type || typeof file_type !== 'string') {
        sendBadRequest(res, 'file_type is required');
        return;
      }

      const index = Number(photo_index);
      if (!Number.isInteger(index) || index < 0 || index > 2) {
        sendBadRequest(res, 'photo_index must be an integer between 0 and 2');
        return;
      }

      const result = await getReviewPhotoUploadUrl(reviewId, index, file_type);
      sendSuccess(res, result);
    } catch (err: unknown) {
      console.error('[ReviewsRoutes] POST /reviews/:id/upload-url error:', err);
      const statusCode =
        err instanceof Error && 'statusCode' in err
          ? (err as Error & { statusCode: number }).statusCode
          : 500;
      const message =
        err instanceof Error ? err.message : 'Failed to generate upload URL';
      sendError(res, message, statusCode);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /reviews/:id/photos                                  (P3-18 — §9.6)
// Attach already-uploaded photo public URLs to an existing review.
//
// Body: { photo_urls: string[] }   (max 3 URLs)
//
// Called by the frontend after the review row is created and all
// direct-to-storage PUT requests have successfully completed.
// ---------------------------------------------------------------------------
router.patch(
  '/:id/photos',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviewId = req.params.id;
      const { photo_urls } = req.body;

      if (!photo_urls) {
        sendBadRequest(res, 'photo_urls is required');
        return;
      }

      await attachPhotosToReview(reviewId, photo_urls);
      sendSuccess(res, null, 200, 'Photos attached successfully');
    } catch (err: unknown) {
      console.error('[ReviewsRoutes] PATCH /reviews/:id/photos error:', err);
      const statusCode =
        err instanceof Error && 'statusCode' in err
          ? (err as Error & { statusCode: number }).statusCode
          : 500;
      const message =
        err instanceof Error ? err.message : 'Failed to attach photos';
      sendError(res, message, statusCode);
    }
  },
);

export default router;