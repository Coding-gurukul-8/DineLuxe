import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createCouponSchema, validateCouponSchema } from './coupons.schema';
import * as ctrl from './coupons.controller';

const router: import('express').Router = Router();

router.post('/validate', authenticate, validate({ body: validateCouponSchema }), ctrl.validateCoupon);

router.use(authenticate, injectTenant);

router.get('/', requireRole('owner', 'manager'), ctrl.listCoupons);
router.post('/', requireRole('owner', 'manager'), validate({ body: createCouponSchema }), ctrl.createCoupon);
router.patch('/:id/toggle', requireRole('owner', 'manager'), ctrl.toggleCoupon);

export default router;