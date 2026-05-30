import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { saveTablePreferenceSchema, upsertDietaryProfileSchema } from './customer-preferences.schema';
import {
  handleGetDietaryProfile,
  handleUpsertDietaryProfile,
  handleGetAllPreferences,
  handleGetTablePreference,
  handleSaveTablePreference,
} from './customer-preferences.controller';

const router: import('express').Router = Router();

// All routes require customer authentication
router.use(authenticate);

// ─── Dietary Profile ──────────────────────────────────────────────────────────

// GET /customer-preferences/dietary — fetch the customer's dietary profile
router.get('/dietary', handleGetDietaryProfile);

// PATCH /customer-preferences/dietary — create or update dietary profile
router.patch(
  '/dietary',
  validate({ body: upsertDietaryProfileSchema }),
  handleUpsertDietaryProfile,
);

// ─── Table Preferences ────────────────────────────────────────────────────────

// GET /customer-preferences/tables — all saved preferences across branches
// NOTE: must be declared BEFORE /tables/:branchId so Express doesn't treat
// a request to /tables as matching /:branchId with branchId = undefined
router.get('/tables', handleGetAllPreferences);

// GET /customer-preferences/tables/:branchId — preference for one branch
router.get('/tables/:branchId', handleGetTablePreference);

// POST /customer-preferences/tables — save or update preferred table
router.post(
  '/tables',
  validate({ body: saveTablePreferenceSchema }),
  handleSaveTablePreference,
);

export default router;