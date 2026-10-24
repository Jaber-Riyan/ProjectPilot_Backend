import { Router } from 'express';
import { Role } from '../../models';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validateQuery } from '../../middleware/validate';
import { reviewQueueQuerySchema } from './reviews.schema';
import { reviewController } from './reviews.controller';

const router = Router();

// 1. Review queue for mentors and administrators
router.get(
  '/',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateQuery(reviewQueueQuerySchema),
  reviewController.getReviewQueue
);

// 2. Submission detail for mentor/admin review
router.get(
  '/:submissionId',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  reviewController.getSubmissionDetailForReview
);

export const mentorSubmissionRoutes = router;
export default router;
