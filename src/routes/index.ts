import { Router } from 'express';
import { healthRoutes } from '../modules/health/health.routes';

const router = Router();

// Register v1 routes
router.use('/health', healthRoutes);

export const v1Routes = router;
