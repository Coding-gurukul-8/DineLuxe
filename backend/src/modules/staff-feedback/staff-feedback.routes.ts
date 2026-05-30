import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import * as ctrl from './staff-feedback.controller';
import { createStaffFeedbackSchema, updateStaffFeedbackSchema } from './staff-feedback.schema';

const router: import('express').Router = Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', validate(createStaffFeedbackSchema), ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', validate(updateStaffFeedbackSchema), ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
