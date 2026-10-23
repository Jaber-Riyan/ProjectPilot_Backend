import { z } from 'zod';

export const createCourseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Course title is required')
    .max(200, 'Title cannot exceed 200 characters'),
  description: z
    .string()
    .trim()
    .max(5000, 'Description cannot exceed 5000 characters')
    .nullable()
    .optional(),
  imageUrl: z
    .string()
    .trim()
    .url('Image URL must be a valid URL')
    .nullable()
    .optional()
    .or(z.literal('')),
  isPublished: z.boolean().default(false),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug cannot exceed 100 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
});

export const updateCourseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Course title cannot be empty')
    .max(200, 'Title cannot exceed 200 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(5000, 'Description cannot exceed 5000 characters')
    .nullable()
    .optional(),
  imageUrl: z
    .string()
    .trim()
    .url('Image URL must be a valid URL')
    .nullable()
    .optional()
    .or(z.literal('')),
  isPublished: z.boolean().optional(),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug cannot exceed 100 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
});

export const courseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isPublished: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return undefined;
    }, z.boolean().optional())
    .optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

export type CreateCourseSchemaInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseSchemaInput = z.infer<typeof updateCourseSchema>;
export type CourseQuerySchemaInput = z.infer<typeof courseQuerySchema>;
