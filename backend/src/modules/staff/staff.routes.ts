import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createStaffSchema, updateStaffSchema } from './staff.schema';
import * as ctrl from './staff.controller';
import { getWeeklyShifts, createShiftForStaff } from '../shifts/shifts.controller';
import { createShiftForStaffSchema, getShiftsQuerySchema } from '../shifts/shifts.schema';

const router: import('express').Router = Router();

// All routes: authenticated + tenant injected
router.use(authenticate, injectTenant);

// ── Shift sub-resource routes (declared BEFORE /:id wildcards) ────────────────
// GET  /staff/shifts?branch_id=&week_start=&staff_id=
// MUST come before /:id routes so Express does not match "shifts" as a :id param.
router.get('/shifts', requireRole('manager', 'owner'), validate(getShiftsQuerySchema, 'query'), getWeeklyShifts);

router.get('/branch/:branchId', requireRole('manager', 'owner', 'admin'), ctrl.getByBranch);
router.post('/create', requireRole('manager', 'owner'), validate(createStaffSchema), ctrl.create);

router.get('/:id', requireRole('manager', 'owner', 'admin'), ctrl.getById);
router.patch('/:id', requireRole('manager', 'owner'), validate(updateStaffSchema), ctrl.update);
router.patch('/:id/toggle-access', requireRole('manager', 'owner'), ctrl.toggleAccess);
router.get('/:id/performance', requireRole('manager', 'owner', 'admin'), ctrl.getPerformance);

// POST /staff/:staffId/shifts
router.post('/:staffId/shifts', requireRole('manager', 'owner'), validate(createShiftForStaffSchema), createShiftForStaff);

export default router;