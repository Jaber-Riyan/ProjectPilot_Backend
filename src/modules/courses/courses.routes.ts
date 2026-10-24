import { Router } from 'express';
import { Role } from '../../models';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validateBody, validateQuery } from '../../middleware/validate';
import { createCourseSchema, updateCourseSchema, courseQuerySchema } from './courses.schema';
import { courseController } from './courses.controller';
import { attachOrAddModuleSchema, reorderModulesSchema } from '../modules/modules.schema';
import { moduleController } from '../modules/modules.controller';

const router = Router();

// 1. Course Collection & Creation
router.get('/', optionalAuthenticate, validateQuery(courseQuerySchema), courseController.list);
router.post(
  '/',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(createCourseSchema),
  courseController.create
);

// 2. Nested Course-Module Reordering
router.patch(
  '/:courseId/modules/reorder',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(reorderModulesSchema),
  moduleController.reorder
);

// 3. Nested Course-Module Association & Creation
router.post(
  '/:courseId/modules',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(attachOrAddModuleSchema),
  moduleController.attachOrAdd
);
router.get('/:courseId/modules', optionalAuthenticate, moduleController.listByCourse);
router.delete(
  '/:courseId/modules/:moduleId',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  moduleController.detach
);

// 4. Individual Course Retrieval & Management
router.get('/:courseId', optionalAuthenticate, courseController.getDetail);
router.patch(
  '/:courseId',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(updateCourseSchema),
  courseController.update
);
router.delete(
  '/:courseId',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  courseController.delete
);

export const courseRoutes = router;
export default router;
