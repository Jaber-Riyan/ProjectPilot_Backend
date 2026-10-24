import { z } from 'zod';

export const createReviewSchema = z
  .object({
    status: z.enum(
      ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUESTED'],
      {
        message: 'Status must be UNDER_REVIEW, APPROVED, REJECTED, or RESUBMISSION_REQUESTED',
      }
    ),
    comment: z
      .string()
      .trim()
      .max(10000, 'Feedback cannot exceed 10000 characters')
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'REJECTED' || data.status === 'RESUBMISSION_REQUESTED') {
      if (!data.comment || data.comment.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Written feedback is required when rejecting a submission or requesting resubmission',
          path: ['comment'],
        });
      }
    }
  });

export const updateReviewSchema = z
  .object({
    status: z
      .enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUESTED'])
      .optional(),
    comment: z
      .string()
      .trim()
      .max(10000, 'Feedback cannot exceed 10000 characters')
      .nullable()
      .optional(),
  })
  .refine((data) => data.status !== undefined || data.comment !== undefined, {
    message: 'At least one of status or comment must be provided to update a review',
  })
  .superRefine((data, ctx) => {
    if (data.status === 'REJECTED' || data.status === 'RESUBMISSION_REQUESTED') {
      if (data.comment !== undefined && (!data.comment || data.comment.trim().length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Written feedback cannot be empty when rejecting a submission or requesting resubmission',
          path: ['comment'],
        });
      }
    }
  });

export const reviewQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUESTED'])
    .optional(),
  assignmentId: z.string().uuid('Invalid assignment UUID').optional(),
  studentId: z.string().uuid('Invalid student UUID').optional(),
  startDate: z.string().datetime({ message: 'startDate must be a valid ISO 8601 datetime' }).optional(),
  endDate: z.string().datetime({ message: 'endDate must be a valid ISO 8601 datetime' }).optional(),
});

export type CreateReviewSchemaInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewSchemaInput = z.infer<typeof updateReviewSchema>;
export type ReviewQueueQuerySchemaInput = z.infer<typeof reviewQueueQuerySchema>;
