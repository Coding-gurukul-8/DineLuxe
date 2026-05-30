import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import * as ctrl from './dynamic-pricing.controller';
import { createDynamicPricingSchema, updateDynamicPricingSchema } from './dynamic-pricing.schema';

const router: import('express').Router = Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', validate(createDynamicPricingSchema), ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', validate(updateDynamicPricingSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
