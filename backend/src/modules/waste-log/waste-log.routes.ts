import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import * as ctrl from './waste-log.controller';
import { createWasteLogSchema, updateWasteLogSchema } from './waste-log.schema';

const router: import('express').Router = Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', validate(createWasteLogSchema), ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', validate(updateWasteLogSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
