import { Router } from 'express';
import { Role } from '../../models';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validateBody, validateQuery } from '../../middleware/validate';
import {
  createAssignmentSchema,
  updateAssignmentSchema,
  assignmentQuerySchema,
} from './assignments.schema';
import { assignmentController } from './assignments.controller';
import {
  createSubmissionSchema,
  submissionQuerySchema,
} from '../submissions/submissions.schema';
import { submissionController } from '../submissions/submissions.controller';

const router = Router();

// 1. Assignment Collection & Creation
router.get(
  '/',
  optionalAuthenticate,
  validateQuery(assignmentQuerySchema),
  assignmentController.list
);
router.post(
  '/',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(createAssignmentSchema),
  assignmentController.create
);

// 2. Nested Submissions for Assignment (Registered before generic /:assignmentId)
router.post(
  '/:assignmentId/submissions',
  authenticate,
  validateBody(createSubmissionSchema),
  submissionController.submit
);
router.get(
  '/:assignmentId/submissions/me',
  authenticate,
  submissionController.getMyAttempts
);
router.get(
  '/:assignmentId/submissions',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateQuery(submissionQuerySchema),
  submissionController.list
);

// 3. Individual Assignment Retrieval & Management
router.get('/:assignmentId', optionalAuthenticate, assignmentController.getDetail);
router.patch(
  '/:assignmentId',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(updateAssignmentSchema),
  assignmentController.update
);
router.delete(
  '/:assignmentId',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  assignmentController.delete
);

export const assignmentRoutes = router;
export default router;
