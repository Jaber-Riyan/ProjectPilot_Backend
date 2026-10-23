import { Router } from 'express';
import { healthRoutes } from '../../modules/health/health.routes';
import { authRoutes } from '../../modules/auth/auth.routes';
import { courseRoutes } from '../../modules/courses/courses.routes';
import { moduleRoutes } from '../../modules/modules/modules.routes';
import { contentRoutes } from '../../modules/content/content.routes';
import { createRateLimiter } from '../../modules/rate-limit';

const router = Router();

// 1. Health endpoints are mounted first to keep liveness & readiness probes exempt
router.use('/health', healthRoutes);

// 2. Authentication routes with route-specific database rate limiters
router.use('/auth', authRoutes);

// 3. Conservative default rate limiter for general API routes
router.use(
  createRateLimiter({
    keyPrefix: 'api-v1',
  })
);

// 4. Learning Management Feature Routes
router.use('/courses', courseRoutes);
router.use('/modules', moduleRoutes);
router.use('/content', contentRoutes);

export const v1ApiRouter = router;
export default router;
