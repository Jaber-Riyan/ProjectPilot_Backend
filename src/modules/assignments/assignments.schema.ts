import { z } from 'zod';

export const createAssignmentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Assignment title is required')
    .max(200, 'Assignment title cannot exceed 200 characters'),
  instructions: z
    .string()
    .trim()
    .min(1, 'Instructions are required')
    .max(20000, 'Instructions cannot exceed 20000 characters'),
  submissionPolicy: z.enum(['ONE_TIME', 'RESUBMITTABLE']).default('ONE_TIME'),
  isPublished: z.boolean().default(false),
  dueAt: z
    .string()
    .datetime({ message: 'dueAt must be a valid ISO 8601 datetime string' })
    .nullable()
    .optional(),
});

export const updateAssignmentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Assignment title cannot be empty')
    .max(200, 'Assignment title cannot exceed 200 characters')
    .optional(),
  instructions: z
    .string()
    .trim()
    .min(1, 'Instructions cannot be empty')
    .max(20000, 'Instructions cannot exceed 20000 characters')
    .optional(),
  submissionPolicy: z.enum(['ONE_TIME', 'RESUBMITTABLE']).optional(),
  isPublished: z.boolean().optional(),
  dueAt: z
    .string()
    .datetime({ message: 'dueAt must be a valid ISO 8601 datetime string' })
    .nullable()
    .optional(),
});

export const assignmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isPublished: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  status: z.enum(['PUBLISHED', 'DRAFT']).optional(),
});

export type CreateAssignmentSchemaInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentSchemaInput = z.infer<typeof updateAssignmentSchema>;
export type AssignmentQuerySchemaInput = z.infer<typeof assignmentQuerySchema>;
