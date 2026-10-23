import { Router } from 'express';
import { appConfig } from '../../config/app-config';
import { createRateLimiter } from '../rate-limit';
import { validateBody } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { signupSchema, loginSchema } from './auth.schema';
import { authController } from './auth.controller';

const router = Router();

// 1. Rate limiter for registration (prevents automated account spamming)
const signupRateLimiter = createRateLimiter({
  keyPrefix: 'auth:signup',
  maxRequests: appConfig.auth.rateLimit.maxSignupRequests,
  windowMs: appConfig.auth.rateLimit.windowMs,
  customMessage: 'Too many accounts created from this IP. Please try again later.',
});

// 2. Strict rate limiter for login (prevents brute-force and credential stuffing attacks)
const loginRateLimiter = createRateLimiter({
  keyPrefix: 'auth:login',
  maxRequests: appConfig.auth.rateLimit.maxLoginRequests,
  windowMs: appConfig.auth.rateLimit.windowMs,
  customMessage: 'Too many failed login attempts. Please try again later.',
});

// Route registration
router.post('/signup', signupRateLimiter, validateBody(signupSchema), authController.signup);
router.post('/login', loginRateLimiter, validateBody(loginSchema), authController.login);
router.get('/me', authenticate, authController.me);

export const authRoutes = router;
export default router;
