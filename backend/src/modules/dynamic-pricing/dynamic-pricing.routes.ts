import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createRuleSchema, updateRuleSchema } from './dynamic-pricing.schema';
import {
  handleGetRulesForBranch,
  handleGetActiveRulesNow,
  handleCreateRule,
  handleUpdateRule,
  handleToggleRule,
  handleDeleteRule,
} from './dynamic-pricing.controller';

const router: import('express').Router = Router();

// ─── Public Route ─────────────────────────────────────────────────────────────
// Active rules used by the customer-facing menu to calculate discounted prices.
// NOTE: must be declared BEFORE the router.use(authenticate) block so it stays public.

router.get('/branch/:branchId/active', handleGetActiveRulesNow);

// ─── Protected Routes ─────────────────────────────────────────────────────────

router.use(authenticate, injectTenant);

// GET /dynamic-pricing/branch/:branchId — all rules for a branch
router.get(
  '/branch/:branchId',
  requireRole('manager', 'owner'),
  handleGetRulesForBranch,
);

// POST /dynamic-pricing — create a new rule
router.post(
  '/',
  requireRole('manager', 'owner'),
  validate({ body: createRuleSchema }),
  handleCreateRule,
);

// PATCH /dynamic-pricing/:id/toggle — must come before /:id to avoid Express
// treating 'toggle' as a rule id param
router.patch(
  '/:id/toggle',
  requireRole('manager', 'owner'),
  handleToggleRule,
);

// PATCH /dynamic-pricing/:id — update a rule
router.patch(
  '/:id',
  requireRole('manager', 'owner'),
  validate({ body: updateRuleSchema }),
  handleUpdateRule,
);

// DELETE /dynamic-pricing/:id — delete a rule
router.delete(
  '/:id',
  requireRole('manager', 'owner'),
  handleDeleteRule,
);

export default router;