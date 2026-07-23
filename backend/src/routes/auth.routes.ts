import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema, refreshSchema,
} from '../validators/auth.validators';
import {
  login, refresh, logout, changePassword, forgotPassword, resetPassword, me,
} from '../controllers/auth.controller';

const router = Router();

// Slow down brute-force attempts on auth endpoints specifically
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', validate(refreshSchema), refresh);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);
router.get('/me', authenticate, me);

export default router;
