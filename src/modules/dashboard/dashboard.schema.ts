import { z } from 'zod';

const dateRangeRefinement = <T extends { from?: string; to?: string }>(data: T, ctx: z.RefinementCtx) => {
  if (data.from && data.to) {
    const fromTime = new Date(data.from).getTime();
    const toTime = new Date(data.to).getTime();
    if (fromTime > toTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '"from" date must be before or equal to "to" date',
        path: ['from'],
      });
    }
  }
};

/**
 * Summary Query Schema (optional date windowing)
 */
export const dashboardSummaryQuerySchema = z
  .object({
    from: z.string().datetime({ message: '"from" must be a valid ISO 8601 datetime' }).optional(),
    to: z.string().datetime({ message: '"to" must be a valid ISO 8601 datetime' }).optional(),
  })
  .superRefine(dateRangeRefinement);

/**
 * Student Submissions List Query Schema
 */
export const studentSubmissionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
    search: z.string().trim().max(100, 'Search term too long').optional(),
    status: z
      .enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUESTED'], {
        message: 'Invalid submission status filter',
      })
      .optional(),
    assignmentId: z.string().uuid('Invalid assignment UUID').optional(),
    from: z.string().datetime({ message: '"from" must be a valid ISO 8601 datetime' }).optional(),
    to: z.string().datetime({ message: '"to" must be a valid ISO 8601 datetime' }).optional(),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'attemptNumber', 'projectName', 'status'], {
        message: 'Sort field must be one of: createdAt, updatedAt, attemptNumber, projectName, status',
      })
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc'], { message: 'Sort order must be asc or desc' }).default('desc'),
  })
  .superRefine(dateRangeRefinement);

/**
 * Mentor Submissions List Query Schema
 */
export const mentorSubmissionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
    search: z.string().trim().max(100, 'Search term too long').optional(),
    status: z
      .enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUESTED'], {
        message: 'Invalid submission status filter',
      })
      .optional(),
    assignmentId: z.string().uuid('Invalid assignment UUID').optional(),
    courseId: z.string().uuid('Invalid course UUID').optional(),
    studentId: z.string().uuid('Invalid student UUID').optional(),
    from: z.string().datetime({ message: '"from" must be a valid ISO 8601 datetime' }).optional(),
    to: z.string().datetime({ message: '"to" must be a valid ISO 8601 datetime' }).optional(),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'attemptNumber', 'projectName', 'status'], {
        message: 'Sort field must be one of: createdAt, updatedAt, attemptNumber, projectName, status',
      })
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc'], { message: 'Sort order must be asc or desc' }).default('desc'),
  })
  .superRefine(dateRangeRefinement);

/**
 * Mentor Courses List Query Schema
 */
export const mentorCoursesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
    search: z.string().trim().max(100, 'Search term too long').optional(),
    status: z.enum(['published', 'draft'], { message: 'Status must be published or draft' }).optional(),
    from: z.string().datetime({ message: '"from" must be a valid ISO 8601 datetime' }).optional(),
    to: z.string().datetime({ message: '"to" must be a valid ISO 8601 datetime' }).optional(),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'title'], {
        message: 'Sort field must be one of: createdAt, updatedAt, title',
      })
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc'], { message: 'Sort order must be asc or desc' }).default('desc'),
  })
  .superRefine(dateRangeRefinement);

/**
 * Admin Users List Query Schema
 */
export const adminUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
    search: z.string().trim().max(100, 'Search term too long').optional(),
    role: z.enum(['STUDENT', 'MENTOR', 'ADMIN'], { message: 'Role must be STUDENT, MENTOR, or ADMIN' }).optional(),
    status: z.enum(['active', 'inactive'], { message: 'Status must be active or inactive' }).optional(),
    from: z.string().datetime({ message: '"from" must be a valid ISO 8601 datetime' }).optional(),
    to: z.string().datetime({ message: '"to" must be a valid ISO 8601 datetime' }).optional(),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'name', 'email', 'role'], {
        message: 'Sort field must be one of: createdAt, updatedAt, name, email, role',
      })
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc'], { message: 'Sort order must be asc or desc' }).default('desc'),
  })
  .superRefine(dateRangeRefinement);

/**
 * Admin Submissions List Query Schema
 */
export const adminSubmissionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
    limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
    search: z.string().trim().max(100, 'Search term too long').optional(),
    status: z
      .enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUESTED'], {
        message: 'Invalid submission status filter',
      })
      .optional(),
    assignmentId: z.string().uuid('Invalid assignment UUID').optional(),
    courseId: z.string().uuid('Invalid course UUID').optional(),
    studentId: z.string().uuid('Invalid student UUID').optional(),
    from: z.string().datetime({ message: '"from" must be a valid ISO 8601 datetime' }).optional(),
    to: z.string().datetime({ message: '"to" must be a valid ISO 8601 datetime' }).optional(),
    sortBy: z
      .enum(['createdAt', 'updatedAt', 'attemptNumber', 'projectName', 'status'], {
        message: 'Sort field must be one of: createdAt, updatedAt, attemptNumber, projectName, status',
      })
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc'], { message: 'Sort order must be asc or desc' }).default('desc'),
  })
  .superRefine(dateRangeRefinement);

export type DashboardSummaryQueryInput = z.infer<typeof dashboardSummaryQuerySchema>;
export type StudentSubmissionsQueryInput = z.infer<typeof studentSubmissionsQuerySchema>;
export type MentorSubmissionsQueryInput = z.infer<typeof mentorSubmissionsQuerySchema>;
export type MentorCoursesQueryInput = z.infer<typeof mentorCoursesQuerySchema>;
export type AdminUsersQueryInput = z.infer<typeof adminUsersQuerySchema>;
export type AdminSubmissionsQueryInput = z.infer<typeof adminSubmissionsQuerySchema>;
