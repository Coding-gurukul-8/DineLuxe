/**
 * sponsorship.public.routes.ts
 *
 * Public (no-auth) sponsorship endpoints consumed by the customer app.
 *
 * Mount in app.ts  ─────────────────────────────────────────────────────────
 *
 *   import sponsorshipPublicRoutes from './modules/admin/sponsorship.public.routes';
 *   app.use(`${API}/sponsorships`, sponsorshipPublicRoutes);
 *
 * (Add this line after the existing `app.use(`${API}/admin`, adminRoutes)` line)
 *
 * Routes
 * ──────
 *   GET  /api/v1/sponsorships/active?type=home_banner  → cached active banners
 *   POST /api/v1/sponsorships/:id/impression            → fire-and-forget, 204
 *   POST /api/v1/sponsorships/:id/click                 → fire-and-forget, 204
 */

import { Router } from 'express';
import {
  getActiveSponsorships,
  recordImpression,
  recordClick,
} from './admin.controller';

const router: import('express').Router = Router();

// GET /sponsorships/active?type=home_banner
// Returns currently live placements of the requested type.
// Cached in Redis for 5 minutes — safe to call on every page load.
router.get('/active', getActiveSponsorships);

// POST /sponsorships/:id/impression
// Customer banner entered the viewport.  Always 204 — never blocks the UI.
router.post('/:id/impression', recordImpression);

// POST /sponsorships/:id/click
// Customer tapped a banner.  Always 204 — never blocks the navigation.
router.post('/:id/click', recordClick);

export default router;