import { Router } from 'express';
  import { healthController } from './health.controller';

const router = Router();

router.get('/', (req, res, next) => healthController.getHealth(req, res, next));
router.get('/ready', (req, res, next) => healthController.getReadiness(req, res, next));

export const healthRoutes = router;
