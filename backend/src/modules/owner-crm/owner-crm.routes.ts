import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.middleware';
import { injectTenant } from '../../middleware/tenant.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  listRestaurantCustomers,
  createCustomerByRestaurant,
  getCustomerHistory,
} from './order-crm.controller';

const router: import('express').Router = Router();

router.use(authenticate);

router.get(
  '/owner/customers',
  injectTenant,
  requireRole('owner', 'manager'),
  listRestaurantCustomers,
);

router.post(
  '/owner/customers/create-by-restaurant',
  injectTenant,
  requireRole('owner', 'manager'),
  validate({
    body: z.object({
      name: z.string().min(1),
      phone: z.string().min(4),
    }),
  }),
  createCustomerByRestaurant,
);

router.get(
  '/owner/customers/:id/history',
  injectTenant,
  requireRole('owner', 'manager'),
  getCustomerHistory,
);

export default router;
