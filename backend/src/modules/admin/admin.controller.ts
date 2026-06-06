import { Request, Response, NextFunction } from 'express';
import * as adminService from './admin.service';
import { success } from '../../utils/response';

// POST /admin/signup  (public — protected by X-Seed-Secret and allows multiple super_admin users)
export async function signupSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.createSuperAdmin(req.body);
    res.status(201).json(
      success(data, 'Super admin created. Log in at POST /api/v1/auth/login with your credentials.'),
    );
  } catch (err) {
    next(err);
  }
}

// POST /admin/create-admin  (super_admin JWT required)
export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.createAdmin(req.body);
    res.status(201).json(success(data, 'Admin account created successfully.'));
  } catch (err) {
    next(err);
  }
}

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getDashboard();
    res.json(success(data));
  } catch (err) { next(err); }
}

export async function getPlatformStats(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getPlatformStats();
    res.json(success(data));
  } catch (err) { next(err); }
}

export async function getHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getHealth();
    res.json(success(data));
  } catch (err) { next(err); }
}

export async function getDetailedHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getDetailedHealth();
    res.json(success(data));
  } catch (err) { next(err); }
}

// GET /admin/health/score  (admin + super_admin)
export async function getHealthScore(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getHealthScore();
    res.json(success(data));
  } catch (err) { next(err); }
}

export async function getRestaurants(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string | undefined;
    const result = await adminService.getRestaurants(page, limit, status);
    res.json(success(result));
  } catch (err) { next(err); }
}

export async function updateRestaurantStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.updateRestaurantStatus(req.params.id, req.body.status);
    res.json(success(data));
  } catch (err) { next(err); }
}

// GET /admin/restaurants/pending
export async function getPendingRestaurants(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await adminService.getPendingRestaurants(page, limit);
    res.json(success(result));
  } catch (err) { next(err); }
}

// POST /admin/restaurants/:id/approve
export async function approveRestaurant(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = (req as any).user?.id;
    if (!adminId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }
    const data = await adminService.approveRestaurant(req.params.id, adminId);
    res.json(success(data, 'Restaurant approved successfully.'));
  } catch (err) { next(err); }
}

// POST /admin/restaurants/:id/reject
export async function rejectRestaurant(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = (req as any).user?.id;
    if (!adminId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }
    const { reason } = req.body;
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        error: { message: 'Rejection reason must be at least 10 characters.' },
      });
      return;
    }
    const data = await adminService.rejectRestaurant(req.params.id, adminId, reason.trim());
    res.json(success(data, 'Restaurant application rejected.'));
  } catch (err) { next(err); }
}

export async function getCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as string | undefined;
    const result = await adminService.getCustomers(page, limit, status);
    res.json(success(result));
  } catch (err) { next(err); }
}

export async function updateCustomerStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.updateCustomerStatus(req.params.id, req.body.status);
    res.json(success(data));
  } catch (err) { next(err); }
}

export async function getFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await adminService.getFeedback(page, limit);
    res.json(success(result));
  } catch (err) { next(err); }
}

// ── Section 6.5 — customer account management ─────────────────────────────────

// GET /admin/customers/:id
export async function getCustomerDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.getCustomerDetail(req.params.id);
    res.json(success(data));
  } catch (err) { next(err); }
}

// PATCH /admin/customers/:id/suspend
export async function suspendCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = (req as any).user?.id;
    if (!adminId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }
    const data = await adminService.suspendCustomer(req.params.id, adminId, req.body.reason);
    res.json(success(data, 'Customer suspended successfully.'));
  } catch (err) { next(err); }
}

// PATCH /admin/customers/:id/unsuspend
export async function unsuspendCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = (req as any).user?.id;
    if (!adminId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }
    const data = await adminService.unsuspendCustomer(req.params.id, adminId);
    res.json(success(data, 'Customer unsuspended successfully.'));
  } catch (err) { next(err); }
}

// PATCH /admin/customers/:id/flag
export async function flagCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = (req as any).user?.id;
    if (!adminId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }
    const data = await adminService.flagCustomer(req.params.id, adminId, req.body.reason);
    res.json(success(data, 'Customer flagged for review.'));
  } catch (err) { next(err); }
}

// ════════════════════════════════════════════════════════════════════════════
// ─── SPONSORED PLACEMENT CONTROLLERS — Section 9.2 / 19.1 ────────────────
// ════════════════════════════════════════════════════════════════════════════

// GET /admin/sponsorships?page=1&limit=20
// Auth: super_admin only (enforced in routes)
export async function listSponsorships(req: Request, res: Response, next: NextFunction) {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await adminService.listSponsorships(page, limit);
    res.json(success(result));
  } catch (err) { next(err); }
}

// POST /admin/sponsorships
// Auth: super_admin only
export async function createSponsorship(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = (req as any).user?.id;
    if (!adminId) {
      res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      return;
    }

    const { restaurant_id, placement_type, banner_url, headline, cta_text, starts_at, ends_at, is_active } = req.body;

    if (!restaurant_id || !placement_type || !starts_at || !ends_at) {
      res.status(400).json({
        success: false,
        error: { message: 'restaurant_id, placement_type, starts_at and ends_at are required.' },
      });
      return;
    }

    const validTypes = ['home_banner', 'search_top', 'featured_card'];
    if (!validTypes.includes(placement_type)) {
      res.status(400).json({
        success: false,
        error: { message: `placement_type must be one of: ${validTypes.join(', ')}` },
      });
      return;
    }

    if (new Date(ends_at) <= new Date(starts_at)) {
      res.status(400).json({ success: false, error: { message: 'ends_at must be after starts_at.' } });
      return;
    }

    const data = await adminService.createSponsorship(
      { restaurant_id, placement_type, banner_url, headline, cta_text, starts_at, ends_at, is_active },
      adminId,
    );
    res.status(201).json(success(data, 'Sponsorship created successfully.'));
  } catch (err) { next(err); }
}

// PATCH /admin/sponsorships/:id/toggle
// Auth: super_admin only
export async function toggleSponsorship(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminService.toggleSponsorship(req.params.id);
    res.json(success(data, 'Sponsorship toggled.'));
  } catch (err) { next(err); }
}

// ── Public controllers (mounted at /api/v1/sponsorships via separate router) ──

// GET /sponsorships/active?type=home_banner
// No auth — customer-facing
export async function getActiveSponsorships(req: Request, res: Response, next: NextFunction) {
  try {
    const type = (req.query.type as string) || 'home_banner';
    const data = await adminService.getActiveSponsorships(type);
    res.json(success(data));
  } catch (err) { next(err); }
}

// POST /sponsorships/:id/impression
// No auth — fire-and-forget; always returns 204
export async function recordImpression(req: Request, res: Response, next: NextFunction) {
  // Intentionally NOT awaited — customer UI must never wait on this
  adminService.recordImpression(req.params.id).catch((err) =>
    console.error('[sponsored] recordImpression error:', err),
  );
  res.status(204).end();
}

// POST /sponsorships/:id/click
// No auth — fire-and-forget; always returns 204
export async function recordClick(req: Request, res: Response, next: NextFunction) {
  adminService.recordClick(req.params.id).catch((err) =>
    console.error('[sponsored] recordClick error:', err),
  );
  res.status(204).end();
}