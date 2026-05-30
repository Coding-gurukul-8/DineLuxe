import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createGroupSchema, preOrderSchema } from './social-dining.schema';
import * as ctrl from './social-dining.controller';

const router: import('express').Router = Router();

router.get('/invite/:code', ctrl.getInviteTeaser);

router.use(authenticate);

router.post('/', validate({ body: createGroupSchema }), ctrl.createGroup);
router.post('/join/:code', ctrl.joinGroup);
router.get('/booking/:bookingId', ctrl.getGroupForBooking);
router.patch('/:groupId/pre-orders', validate({ body: preOrderSchema }), ctrl.updatePreOrders);
router.post('/:groupId/close', ctrl.closeGroup);
router.get('/:groupId/summary', ctrl.getGroupPreOrderSummary);

export default router;