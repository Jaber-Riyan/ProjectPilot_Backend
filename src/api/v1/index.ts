import { Router } from 'express';
import { healthRoutes } from '../../modules/health/health.routes';

const router = Router();

// Mount feature routers under /api/v1
router.use('/health', healthRoutes);

export const v1ApiRouter = router;
export default router;
