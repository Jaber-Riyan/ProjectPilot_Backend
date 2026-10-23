import { Router } from 'express';
import { Role } from '../../models';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { updateContentItemSchema } from './content.schema';
import { contentController } from './content.controller';

const router = Router();

// Individual Content Item Operations
router.get('/:contentId', optionalAuthenticate, contentController.getDetail);
router.patch(
  '/:contentId',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(updateContentItemSchema),
  contentController.update
);
router.delete(
  '/:contentId',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  contentController.delete
);

export const contentRoutes = router;
export default router;
