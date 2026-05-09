import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  getNotifications,
  markRead,
  markAllRead,
  registerDevice,
  removeDevice,
} from './notifications.controller';
import { registerDeviceSchema } from './notifications.schema';

const router: import('express').Router = Router();

router.use(authenticate);

// GET /notifications
router.get('/', getNotifications);

// POST/DELETE literal paths BEFORE dynamic /:id/read
router.post('/register-device', validate(registerDeviceSchema), registerDevice);

router.delete('/device/:token', removeDevice);

// PATCH /notifications/read-all  ← before /:id/read
router.patch('/read-all', markAllRead);

// PATCH /notifications/:id/read
router.patch('/:id/read', markRead);

export default router;
