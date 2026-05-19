import { Router } from 'express';
import { authLimiter } from '../../middleware/rate-limit.middleware';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import {
  signupController,
  verifyOtpController,
  loginController,
  logoutController,
  refreshController,
  forgotPasswordController,
  resetPasswordController,
  changePasswordController,
  checkEmailController,
  sendVerificationOtpController,
} from './auth.controller';
import {
  signupSchema,
  loginSchema,
  otpSchema,
  resetPasswordSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  refreshTokenSchema,
  requestOtpSchema,
} from './auth.schema';

const router: import('express').Router = Router();

// All auth routes share the authLimiter
router.use(authLimiter);

router.post('/signup', validate(signupSchema), signupController);
router.post('/verify-otp', validate(otpSchema), verifyOtpController);
router.post('/login', validate(loginSchema), loginController);
router.post('/logout', authenticate, logoutController);
router.post('/refresh', validate(refreshTokenSchema), refreshController);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPasswordController);
router.post('/reset-password', validate(resetPasswordSchema), resetPasswordController);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePasswordController);
router.post('/send-otp', validate(requestOtpSchema), sendVerificationOtpController);
router.get('/check-email', checkEmailController);

export default router;
