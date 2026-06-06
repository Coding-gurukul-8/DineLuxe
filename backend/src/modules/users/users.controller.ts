/**
 * backend/src/modules/users/users.controller.ts
 *
 * Changes vs. pre-GDPR version:
 *   - deleteMe()      → REMOVED (was soft-deactivate only — non-compliant)
 *   - anonymizeAccount() → NEW  (GDPR M23 full anonymisation)
 *   - exportMyData()     → NEW  (GDPR right to data portability)
 */

import { Request, Response, NextFunction } from 'express';
import * as authService from '../auth/auth.service';
import * as usersService from './users.service';
import { success, error } from '../../utils/response';

type AuthenticatedRequest = Request & {
  user: { id: string; branch_id?: string; role: string; restaurant_id?: string };
  restaurantId: string;
  branchId: string;
};

// ─── GET /users/me ────────────────────────────────────────────────────────────

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const profile = await usersService.getMe(authReq.user!.id);
    res.json(success(profile, 'Profile fetched'));
  } catch (err) {
    next(err);
  }
}

// ─── GET /users?role=&restaurant_id= ─────────────────────────────────────────

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const queryRestaurantId =
      typeof req.query.restaurant_id === 'string' ? req.query.restaurant_id : undefined;
    const restaurantId =
      authReq.restaurantId || authReq.user?.restaurant_id || queryRestaurantId;

    if (!restaurantId) {
      return res
        .status(400)
        .json(error('VALIDATION_ERROR', 'Restaurant context is required'));
    }

    const users = await usersService.listUsers(restaurantId, role);
    res.json(success(users));
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /users/me ──────────────────────────────────────────────────────────

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const updated = await usersService.updateMe(authReq.user!.id, req.body);
    res.json(success(updated, 'Profile updated'));
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /users/me ─────────────────────────────────────────────────────────
//
// GDPR M23: full anonymisation — replaces the old deleteMe() soft-deactivate.
//
// Service enforces:
//   • role === 'customer'  (staff cannot self-delete)
//   • is_active === true   (already-deleted accounts return 409)
//
// Error mapping:
//   • "Staff accounts…"       → 403 FORBIDDEN
//   • "already been deleted"  → 409 CONFLICT
//   • anything else           → 500 via next(err)
// ─────────────────────────────────────────────────────────────────────────────

export async function anonymizeAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await usersService.anonymizeUserAccount(authReq.user!.id);
    res.json(success(result, result.message));
  } catch (err: any) {
    if (err?.message?.includes('Staff accounts')) {
      return res.status(403).json(error('FORBIDDEN', err.message));
    }
    if (err?.message?.includes('already been deleted')) {
      return res.status(409).json(error('CONFLICT', err.message));
    }
    next(err);
  }
}

// ─── GET /users/me/data-export ────────────────────────────────────────────────
//
// GDPR right to data portability (Article 20).
// Returns a JSON snapshot of all data the platform holds for the caller.
// Content-Disposition header allows browsers / API clients to save it directly.
// ─────────────────────────────────────────────────────────────────────────────

export async function exportMyData(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const exportData = await usersService.exportUserData(authReq.user!.id);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="my-data-${Date.now()}.json"`,
    );
    res.json(success(exportData, 'Data export ready'));
  } catch (err) {
    next(err);
  }
}

// ─── GET /users/:id  (manager / owner / admin) ───────────────────────────────

export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;

    // BUG FIX: restaurantId comes from injectTenant middleware on this route;
    // fall back to user.restaurant_id from the JWT for routes that skip it.
    const restaurantId = authReq.restaurantId || authReq.user?.restaurant_id;
    if (!restaurantId) {
      return res
        .status(400)
        .json(error('VALIDATION_ERROR', 'Restaurant context is required'));
    }

    const user = await usersService.getUserById(req.params.id, restaurantId);
    res.json(success(user, 'User fetched'));
  } catch (err) {
    next(err);
  }
}

// ─── GET /users/:id/notification-preferences ─────────────────────────────────

export async function getNotificationPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.id !== req.params.id) {
      return res.status(403).json(error('FORBIDDEN', 'Cannot view another user account.'));
    }
    const prefs = await usersService.getNotificationPreferences(req.params.id);
    res.json(success(prefs));
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /users/:id/notification-preferences ───────────────────────────────

export async function updateNotificationPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.id !== req.params.id) {
      return res.status(403).json(error('FORBIDDEN', 'Cannot update another user account.'));
    }
    const updated = await usersService.updateNotificationPreferences(req.params.id, req.body);
    res.json(success(updated, 'Notification preferences saved'));
  } catch (err) {
    next(err);
  }
}

// ─── GET /users/:id/sessions ──────────────────────────────────────────────────

export async function getUserSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.id !== req.params.id) {
      return res.status(403).json(error('FORBIDDEN', 'Cannot view another user account.'));
    }
    const sessions = await usersService.getActiveSessions(req.params.id);
    res.json(success(sessions));
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /users/:id/sessions ──────────────────────────────────────────────

export async function revokeUserSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.id !== req.params.id) {
      return res.status(403).json(error('FORBIDDEN', 'Cannot revoke another user account.'));
    }
    const result = await usersService.revokeUserSessions(req.params.id);
    res.json(success(result, 'User sessions revoked'));
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /users/:id/password ────────────────────────────────────────────────

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.id !== req.params.id) {
      return res.status(403).json(error('FORBIDDEN', 'Cannot change password for another user.'));
    }
    const result = await authService.changePassword(req.params.id, req.body);
    res.json(success(result, 'Password updated successfully'));
  } catch (err) {
    next(err);
  }
}

// ─── GET /users/check-email?email= ───────────────────────────────────────────

export async function checkEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const email = req.query.email as string;

    // BUG FIX: original returned a plain string error instead of the
    // ErrorResponse shape — use the error() helper for API consistency.
    if (!email || !email.trim()) {
      return res
        .status(400)
        .json(error('VALIDATION_ERROR', 'email query parameter is required'));
    }

    const result = await usersService.checkEmail(email);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}
/*import { Request, Response, NextFunction } from 'express';
import * as authService from '../auth/auth.service';
import * as usersService from './users.service';
import { success, error } from '../../utils/response';

type AuthenticatedRequest = Request & {
  user: { id: string; branch_id?: string; role: string; restaurant_id?: string };
  restaurantId: string;
  branchId: string;
};

// GET /users/me
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const profile = await usersService.getMe(authReq.user!.id);
    res.json(success(profile, 'Profile fetched'));
  } catch (err) {
    next(err);
  }
}

// GET /users?role=&restaurant_id=
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const queryRestaurantId = typeof req.query.restaurant_id === 'string'
      ? req.query.restaurant_id
      : undefined;
    const restaurantId = authReq.restaurantId || authReq.user?.restaurant_id || queryRestaurantId;

    if (!restaurantId) {
      return res
        .status(400)
        .json(error('VALIDATION_ERROR', 'Restaurant context is required'));
    }

    const users = await usersService.listUsers(restaurantId, role);
    res.json(success(users));
  } catch (err) {
    next(err);
  }
}

// PATCH /users/me
export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const updated = await usersService.updateMe(authReq.user!.id, req.body);
    res.json(success(updated, 'Profile updated'));
  } catch (err) {
    next(err);
  }
}

// DELETE /users/me
export async function deleteMe(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    const result = await usersService.deleteMe(authReq.user!.id);
    res.json(success(result, 'Account deactivated'));
  } catch (err) {
    next(err);
  }
}

// GET /users/:id  (manager/owner/admin)
export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;

    // BUG FIX: restaurantId came from req.restaurantId (set by injectTenant),
    // but the routes file does NOT apply injectTenant for /:id — the route only
    // uses authenticate + requireRole. Fall back to user.restaurant_id from JWT.
    const restaurantId = authReq.restaurantId || authReq.user?.restaurant_id;
    if (!restaurantId) {
      return res
        .status(400)
        .json(error('VALIDATION_ERROR', 'Restaurant context is required'));
    }

    const user = await usersService.getUserById(req.params.id, restaurantId);
    res.json(success(user, 'User fetched'));
  } catch (err) {
    next(err);
  }
}

// GET /users/:id/notification-preferences
export async function getNotificationPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.id !== req.params.id) {
      return res.status(403).json(error('FORBIDDEN', 'Cannot view another user account.'));
    }

    const prefs = await usersService.getNotificationPreferences(req.params.id);
    res.json(success(prefs));
  } catch (err) {
    next(err);
  }
}

// PATCH /users/:id/notification-preferences
export async function updateNotificationPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.id !== req.params.id) {
      return res.status(403).json(error('FORBIDDEN', 'Cannot update another user account.'));
    }

    const updated = await usersService.updateNotificationPreferences(req.params.id, req.body);
    res.json(success(updated, 'Notification preferences saved'));
  } catch (err) {
    next(err);
  }
}

// GET /users/:id/sessions
export async function getUserSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.id !== req.params.id) {
      return res.status(403).json(error('FORBIDDEN', 'Cannot view another user account.'));
    }

    const sessions = await usersService.getActiveSessions(req.params.id);
    res.json(success(sessions));
  } catch (err) {
    next(err);
  }
}

// DELETE /users/:id/sessions
export async function revokeUserSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.id !== req.params.id) {
      return res.status(403).json(error('FORBIDDEN', 'Cannot revoke another user account.'));
    }

    const result = await usersService.revokeUserSessions(req.params.id);
    res.json(success(result, 'User sessions revoked'));
  } catch (err) {
    next(err);
  }
}

// PATCH /users/:id/password
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user.id !== req.params.id) {
      return res.status(403).json(error('FORBIDDEN', 'Cannot change password for another user.'));
    }

    const result = await authService.changePassword(req.params.id, req.body);
    res.json(success(result, 'Password updated successfully'));
  } catch (err) {
    next(err);
  }
}

// GET /users/check-email?email=
export async function checkEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const email = req.query.email as string;

    // BUG FIX: original returned a plain string error (not the ErrorResponse
    // shape) — use the error() helper for a consistent API response shape.
    if (!email || !email.trim()) {
      return res
        .status(400)
        .json(error('VALIDATION_ERROR', 'email query parameter is required'));
    }

    const result = await usersService.checkEmail(email);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
}
*/