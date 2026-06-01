import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  handleAssignDelivery,
  handleGetDelivery,
  handleUpdateDeliveryStatus,
  handleUpdateLocation,
  handleGetActiveDelivery,
  handleGetEarnings,
  handleGetDeliveryStatus,
  handleGetActiveDeliveriesForBranch,
  handleCompleteDelivery,
  handleUpdatePartnerStatus,
  handleGetPartnerHistory,
  handleGetPartnerStats,
  handleToggleOnlineStatus,
} from './delivery.controller';

const router: import('express').Router = Router();

router.use(authenticate);

// ── Manager / Owner operations ─────────────────────────────────────────────────

// POST /delivery/orders/:orderId/assign — assign a delivery partner to an order
router.post(
  '/orders/:orderId/assign',
  injectTenant,
  requireRole('manager', 'owner'),
  validate({
    body: z.object({
      partner_id: z.string().uuid(),
    }),
  }),
  handleAssignDelivery,
);

// GET /delivery/branch/:branchId/active — all active deliveries for a branch
router.get(
  '/branch/:branchId/active',
  injectTenant,
  requireRole('manager', 'owner', 'admin'),
  handleGetActiveDeliveriesForBranch,
);

// POST /delivery/:id/complete — manager/owner force-complete a delivery
router.post(
  '/:id/complete',
  injectTenant,
  requireRole('manager', 'owner'),
  handleCompleteDelivery,
);

// GET /delivery/:id/status — manager/owner view full delivery with partner info
router.get(
  '/:id/status',
  requireRole('manager', 'owner', 'admin'),
  handleGetDeliveryStatus,
);

// ── Delivery partner operations ────────────────────────────────────────────────

// GET /delivery/partner/active — partner's current active delivery
router.get(
  '/partner/active',
  requireRole('delivery_partner'),
  handleGetActiveDelivery,
);

// GET /delivery/partner/earnings — partner earnings summary
router.get(
  '/partner/earnings',
  requireRole('delivery_partner'),
  handleGetEarnings,
);

// GET /delivery/partner/history?page=&limit= — FIX 3: paginated delivery history
router.get(
  '/partner/history',
  requireRole('delivery_partner'),
  validate({
    query: z.object({
      page:  z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
      limit: z.string().optional().transform((v) => (v ? Math.min(parseInt(v, 10), 100) : 20)),
    }),
  }),
  handleGetPartnerHistory,
);

// GET /delivery/partner/stats — FIX 3: partner stats dashboard summary
router.get(
  '/partner/stats',
  requireRole('delivery_partner'),
  handleGetPartnerStats,
);

// P3-2 ADDITION: partner availability toggle endpoint (new frontend button path)
router.patch(
  '/partner/online',
  requireRole('delivery_partner'),
  validate({
    body: z.object({
      is_online: z.boolean(),
    }),
  }),
  handleToggleOnlineStatus,
);

// PATCH /delivery/partner/status — FIX 2: partner online/offline toggle
router.patch(
  '/partner/status',
  requireRole('delivery_partner'),
  validate({
    body: z.object({
      is_online: z.boolean(),
    }),
  }),
  handleUpdatePartnerStatus,
);

// POST /delivery/location — GPS update (throttled server-side)
router.post(
  '/location',
  requireRole('delivery_partner'),
  validate({
    body: z.object({
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      delivery_id: z.string().uuid().optional(),
    }),
  }),
  handleUpdateLocation,
);

// PATCH /delivery/:id/status — partner updates delivery status
router.patch(
  '/:id/status',
  requireRole('delivery_partner'),
  validate({
    body: z.object({
      status: z.enum(['accepted', 'rejected', 'picked_up', 'delivered', 'failed']),
    }),
  }),
  handleUpdateDeliveryStatus,
);

// GET /delivery/:id — partner/manager views a specific delivery
router.get('/:id', requireRole('delivery_partner', 'manager', 'owner'), handleGetDelivery);

export default router;