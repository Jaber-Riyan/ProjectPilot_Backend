import { Router } from 'express';
import { Role } from '../../models';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validateBody } from '../../middleware/validate';
import { submissionController } from './submissions.controller';
import { createReviewSchema, updateReviewSchema } from '../reviews/reviews.schema';
import { reviewController } from '../reviews/reviews.controller';

const router = Router();

// 1. Student / Reviewer: Retrieve specific submission detail with feedbacks
router.get('/:submissionId', authenticate, submissionController.getDetail);

// 2. Mentor / Admin: Apply a review decision (approve, reject, resubmission requested, under review)
router.post(
  '/:submissionId/review',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(createReviewSchema),
  reviewController.createReview
);

// 3. Mentor / Admin: Update an existing review decision or append feedback
router.patch(
  '/:submissionId/review',
  authenticate,
  requireRole(Role.MENTOR, Role.ADMIN),
  validateBody(updateReviewSchema),
  reviewController.updateReview
);

export const submissionRoutes = router;
export default router;
