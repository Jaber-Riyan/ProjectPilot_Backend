import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { submissionController } from './submissions.controller';

const router = Router();

// GET /api/v1/submissions/:submissionId
router.get('/:submissionId', authenticate, submissionController.getDetail);

export const submissionRoutes = router;
export default router;
