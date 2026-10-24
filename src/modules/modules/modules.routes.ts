import { Router } from 'express';
import { Role } from '../../models';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validateBody, validateQuery } from '../../middleware/validate';
import {
  createModuleSchema,
  updateModuleSchema,
  moduleQuerySchema,
} from './modules.schema';
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

// 3. Independent Module Collection & Creation
router.get(
  '/',
  optionalAuthenticate,
  validateQuery(moduleQuerySchema),
  moduleController.listIndependent
);
router.post(
  '/',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(createModuleSchema),
  moduleController.createIndependent
);

// 4. Individual Module Operations
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
  moduleController.deleteIndependent
);

export const moduleRoutes = router;
export default router;
