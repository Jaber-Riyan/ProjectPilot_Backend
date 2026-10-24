import { z } from 'zod';

export const createSubmissionSchema = z.object({
  projectName: z
    .string()
    .trim()
    .min(1, 'Project name is required')
    .max(200, 'Project name cannot exceed 200 characters'),
  repoUrl: z
    .string()
    .trim()
    .min(1, 'Repository URL is required')
    .regex(/^https?:\/\/.+/i, 'Repository URL must be a valid HTTP or HTTPS URL'),
  liveUrl: z
    .string()
    .trim()
    .regex(/^https?:\/\/.+/i, 'Live URL must be a valid HTTP or HTTPS URL')
    .nullable()
    .optional(),
  description: z
    .string()
    .trim()
    .max(5000, 'Description cannot exceed 5000 characters')
    .nullable()
    .optional(),
});

export const submissionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  studentId: z.string().uuid().optional(),
});

export type CreateSubmissionSchemaInput = z.infer<typeof createSubmissionSchema>;
export type SubmissionQuerySchemaInput = z.infer<typeof submissionQuerySchema>;
