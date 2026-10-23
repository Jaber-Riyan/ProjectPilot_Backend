import { Router } from 'express';
import { healthController } from './health.controller';

const router = Router();

router.get('/', healthController.getHealth);
router.get('/ready', healthController.getReadiness);

export const healthRoutes = router;
