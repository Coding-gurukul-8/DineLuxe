import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import * as ctrl from './shifts.controller';
import { createShiftSchema, updateShiftSchema } from './shifts.schema';

const router: import('express').Router = Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', validate(createShiftSchema), ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', validate(updateShiftSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
