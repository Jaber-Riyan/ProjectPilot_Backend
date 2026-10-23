import { Router } from 'express';
import { Role } from '../../models';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { updateModuleSchema } from './modules.schema';
import { moduleController } from './modules.controller';
import { createContentItemSchema, reorderContentItemsSchema } from '../content/content.schema';
import { contentController } from '../content/content.controller';

const router = Router();

// 1. Nested Content Reordering (Must be registered before generic /:moduleId)
router.patch(
  '/:moduleId/content/reorder',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(reorderContentItemsSchema),
  contentController.reorder
);

// 2. Nested Content Item Creation & Collection
router.post(
  '/:moduleId/content',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(createContentItemSchema),
  contentController.create
);
router.get('/:moduleId/content', optionalAuthenticate, contentController.listByModule);

// 3. Individual Module Operations
router.get('/:moduleId', optionalAuthenticate, moduleController.getDetail);
router.patch(
  '/:moduleId',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(updateModuleSchema),
  moduleController.update
);
router.delete(
  '/:moduleId',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  moduleController.delete
);

export const moduleRoutes = router;
export default router;
