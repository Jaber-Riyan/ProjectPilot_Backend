import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/authorize';
import { validateQuery } from '../../middleware/validate';
import { asyncHandler } from '../../lib/async-handler';
import { Role } from '../../models';
import {
  dashboardSummaryQuerySchema,
  studentSubmissionsQuerySchema,
  mentorSubmissionsQuerySchema,
  mentorCoursesQuerySchema,
  adminUsersQuerySchema,
  adminSubmissionsQuerySchema,
} from './dashboard.schema';

const router = Router();

// ==========================================
// Student Dashboard Routes (Role.STUDENT only)
// ==========================================
router.get(
  '/student',
  authenticate,
  requireRole(Role.STUDENT),
  validateQuery(dashboardSummaryQuerySchema),
  asyncHandler(dashboardController.getStudentDashboard)
);

router.get(
  '/student/submissions',
  authenticate,
  requireRole(Role.STUDENT),
  validateQuery(studentSubmissionsQuerySchema),
  asyncHandler(dashboardController.getStudentSubmissions)
);

// ==========================================
// Mentor Dashboard Routes (Role.MENTOR only)
// ==========================================
router.get(
  '/mentor',
  authenticate,
  requireRole(Role.MENTOR),
  validateQuery(dashboardSummaryQuerySchema),
  asyncHandler(dashboardController.getMentorDashboard)
);

router.get(
  '/mentor/submissions',
  authenticate,
  requireRole(Role.MENTOR),
  validateQuery(mentorSubmissionsQuerySchema),
  asyncHandler(dashboardController.getMentorSubmissions)
);

router.get(
  '/mentor/courses',
  authenticate,
  requireRole(Role.MENTOR),
  validateQuery(mentorCoursesQuerySchema),
  asyncHandler(dashboardController.getMentorCourses)
);

// ==========================================
// Admin Dashboard Routes (Role.ADMIN only)
// ==========================================
router.get(
  '/admin',
  authenticate,
  requireRole(Role.ADMIN),
  validateQuery(dashboardSummaryQuerySchema),
  asyncHandler(dashboardController.getAdminDashboard)
);

router.get(
  '/admin/users',
  authenticate,
  requireRole(Role.ADMIN),
  validateQuery(adminUsersQuerySchema),
  asyncHandler(dashboardController.getAdminUsers)
);

router.get(
  '/admin/submissions',
  authenticate,
  requireRole(Role.ADMIN),
  validateQuery(adminSubmissionsQuerySchema),
  asyncHandler(dashboardController.getAdminSubmissions)
);

export const dashboardRoutes = router;
export default router;
