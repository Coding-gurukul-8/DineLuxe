import { Request, Response, NextFunction } from 'express';
import { success } from '../../utils/response';
import {
  submitFeedback,
  getFeedbackForRestaurant,
  getFeedbackForAdmin,
  flagFeedback,
} from './staff-feedback.service';

// ---------------------------------------------------------------------------
// Local type alias — matches express.d.ts augmentation
// ---------------------------------------------------------------------------
type AuthRequest = Request & {
  user: { id: string; role: string; restaurant_id?: string; branch_id?: string };
  restaurantId: string;
  branchId: string;
};

// ---------------------------------------------------------------------------
// POST /staff-feedback
// Any authenticated staff member can submit feedback
// ---------------------------------------------------------------------------
export async function submitFeedbackHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const { feedback_text, branch_id } = req.body as {
      feedback_text: string;
      branch_id?: string;
    };

    const result = await submitFeedback(
      authReq.user.id,
      authReq.restaurantId,
      branch_id,
      authReq.user.role,
      feedback_text,
    );

    res.status(201).json(success(result));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /staff-feedback
// Owner sees feedback for their own restaurant (restaurantId from JWT)
// ---------------------------------------------------------------------------
export async function getFeedbackForRestaurantHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const query = req.query as {
      branch_id?: string;
      sentiment?: 'positive' | 'neutral' | 'negative';
      page?: string;
      limit?: string;
    };

    const result = await getFeedbackForRestaurant(authReq.restaurantId, {
      branch_id: query.branch_id,
      sentiment: query.sentiment,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? Math.min(parseInt(query.limit, 10), 50) : 20,
    });

    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /staff-feedback/admin
// Super admin — can query across all restaurants
// ---------------------------------------------------------------------------
export async function getFeedbackForAdminHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as {
      restaurant_id?: string;
      branch_id?: string;
      sentiment?: 'positive' | 'neutral' | 'negative';
      page?: string;
      limit?: string;
    };

    const result = await getFeedbackForAdmin({
      restaurant_id: query.restaurant_id,
      branch_id: query.branch_id,
      sentiment: query.sentiment,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? Math.min(parseInt(query.limit, 10), 50) : 20,
    });

    res.json(success(result));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /staff-feedback/:id/flag
// Owner or super_admin can flag/unflag a feedback entry
// ---------------------------------------------------------------------------
export async function flagFeedbackHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    const { is_flagged } = req.body as { is_flagged: boolean };

    if (typeof is_flagged !== 'boolean') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'is_flagged must be a boolean' } });
      return;
    }

    // Super admins pass '' as restaurantId — service skips ownership check
    const restaurantId = authReq.user.role === 'super_admin' ? '' : authReq.restaurantId;

    const result = await flagFeedback(req.params.id, restaurantId, is_flagged);
    res.json(success(result, `Feedback ${is_flagged ? 'flagged' : 'unflagged'} successfully`));
  } catch (err) {
    next(err);
  }
}