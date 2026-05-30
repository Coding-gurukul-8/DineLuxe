import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createShiftSchema,
  createShiftForStaffSchema,
  updateShiftSchema,
  getShiftsQuerySchema,
} from './shifts.schema';
import {
  getWeeklyShifts,
  createShift,
  createShiftForStaff,
  updateShift,
  deleteShift,
} from './shifts.controller';

// ============================================================
// PRIMARY ROUTER — mounted at /api/v1/shifts in app.ts
// ============================================================
// app.use(`${API}/shifts`, shiftsRoutes);   ← already in app.ts
// ============================================================

const router: import('express').Router = Router();

router.use(authenticate, injectTenant);

// GET  /shifts?branch_id=&week_start=&staff_id=
router.get(
  '/',
  requireRole('manager', 'owner'),
  validate(getShiftsQuerySchema, 'query'),
  getWeeklyShifts,
);

// POST /shifts
router.post(
  '/',
  requireRole('manager', 'owner'),
  validate(createShiftSchema),
  createShift,
);

// PATCH /shifts/:id
router.patch(
  '/:id',
  requireRole('manager', 'owner'),
  validate(updateShiftSchema),
  updateShift,
);

// DELETE /shifts/:id
router.delete(
  '/:id',
  requireRole('manager', 'owner'),
  deleteShift,
);

export default router;

// ============================================================
// STAFF SUB-RESOURCE ROUTER
// These two routes match the frontend call pattern:
//   POST /staff/:staffId/shifts
//   GET  /staff/shifts
//
// HOW TO MOUNT (in backend/src/modules/staff/staff.routes.ts):
//
//   import { staffShiftsRouter } from '../shifts/shifts.routes';
//   router.use('/', staffShiftsRouter);     // after existing staff routes
//
// OR in app.ts directly (both work):
//
//   import { staffShiftsRouter } from './modules/shifts/shifts.routes';
//   app.use(`${API}/staff`, staffShiftsRouter);
// ============================================================

export const staffShiftsRouter: import('express').Router = Router();

staffShiftsRouter.use(authenticate, injectTenant);

// GET  /staff/shifts?branch_id=&week_start=&staff_id=
// NOTE: This route MUST be declared before /:staffId routes in staff.routes.ts
//       to prevent Express matching "shifts" as a :staffId param.
staffShiftsRouter.get(
  '/shifts',
  requireRole('manager', 'owner'),
  validate(getShiftsQuerySchema, 'query'),
  getWeeklyShifts,
);

// POST /staff/:staffId/shifts
staffShiftsRouter.post(
  '/:staffId/shifts',
  requireRole('manager', 'owner'),
  validate(createShiftForStaffSchema),
  createShiftForStaff,
);