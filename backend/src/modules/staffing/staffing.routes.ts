import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import * as ctrl from './staffing.controller';

const router: import('express').Router = Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
