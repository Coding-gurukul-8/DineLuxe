import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { success } from '../../utils/response';
import {
  getWorkloadSummary,
  manuallyAssignWaiter,
} from './waiter-assignment.service';

const router: import('express').Router = Router();

router.use(authenticate, injectTenant);

// ---------------------------------------------------------------------------
// GET /waiter-assignment/workloads?branch_id=
// Returns the scored workload list for every active waiter in the branch.
// Used by the manager dashboard to show who is busiest.
// ---------------------------------------------------------------------------
router.get(
  '/workloads',
  requireRole('manager', 'owner'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // branch_id can come from query param (owners viewing a specific branch)
      // or fall back to the JWT's branch context
      const branchId =
        typeof req.query.branch_id === 'string' && req.query.branch_id.trim()
          ? req.query.branch_id.trim()
          : req.branchId!;

      if (!branchId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_BRANCH_ID', message: 'branch_id is required' },
        });
        return;
      }

      const workloads = await getWorkloadSummary(branchId);
      res.json(success(workloads));
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /waiter-assignment/assign
// Manager override — manually assign a specific waiter to a table.
// Body: { table_id: string, waiter_id: string }
// ---------------------------------------------------------------------------
router.post(
  '/assign',
  requireRole('manager', 'owner'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { table_id, waiter_id } = req.body as { table_id: string; waiter_id: string };

      if (!table_id || !waiter_id) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'table_id and waiter_id are required',
          },
        });
        return;
      }

      await manuallyAssignWaiter(
        table_id,
        waiter_id,
        req.branchId!,
        req.restaurantId!,
      );

      res.json(success({ assigned: true, table_id, waiter_id }, 'Waiter assigned successfully'));
    } catch (err) {
      next(err);
    }
  },
);

export default router;