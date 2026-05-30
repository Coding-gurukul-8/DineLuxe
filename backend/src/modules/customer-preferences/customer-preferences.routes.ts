import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import * as ctrl from './customer-preferences.controller';
import {
  createCustomerPreferenceSchema,
  updateCustomerPreferenceSchema,
} from './customer-preferences.schema';

const router: import('express').Router = Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', validate(createCustomerPreferenceSchema), ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', validate(updateCustomerPreferenceSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
