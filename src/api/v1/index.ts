import { Router } from 'express';
import { healthRoutes } from '../../modules/health/health.routes';
import { createRateLimiter } from '../../modules/rate-limit';

const router = Router();

// 1. Health endpoints are mounted before rate limiting to keep liveness probes exempt
router.use('/health', healthRoutes);

// 2. Conservative default rate limiter for general API routes
router.use(
  createRateLimiter({
    keyPrefix: 'api-v1',
  })
);

export const v1ApiRouter = router;
export default router;
