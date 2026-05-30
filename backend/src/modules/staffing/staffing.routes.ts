import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import {
  handleGetDemandPrediction,
  handleGetRecommendation,
  handleGetWeeklyForecast,
} from './staffing.controller';

const router: import('express').Router = Router();

// All staffing routes require authentication, tenant context, and manager/owner role.
// Staffing data contains labour-planning info — customers and regular staff must not access it.
router.use(authenticate, injectTenant, requireRole('manager', 'owner'));

// GET /staffing/prediction?branch_id=&date=
// Returns hourly demand predictions for a target date
router.get('/prediction', handleGetDemandPrediction);

// GET /staffing/recommendation?branch_id=&date=
// Returns hourly staffing recommendations + warnings for a target date
router.get('/recommendation', handleGetRecommendation);

// GET /staffing/weekly?branch_id=&week_start=
// Returns a 7-day staffing forecast from week_start
router.get('/weekly', handleGetWeeklyForecast);

export default router;