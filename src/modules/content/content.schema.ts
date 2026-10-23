import { z } from 'zod';

export const createContentItemSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Content item title is required')
      .max(200, 'Title cannot exceed 200 characters'),
    type: z.enum(['VIDEO', 'YOUTUBE_VIDEO', 'TEXT', 'LINK', 'ASSIGNMENT']),
    description: z
      .string()
      .trim()
      .max(5000, 'Description cannot exceed 5000 characters')
      .nullable()
      .optional(),
    body: z.string().trim().nullable().optional(),
    url: z.string().trim().nullable().optional(),
    assignmentId: z.string().uuid('assignmentId must be a valid UUID').nullable().optional(),
    order: z.number().int().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'YOUTUBE_VIDEO' || data.type === 'VIDEO') {
      if (!data.url || data.url.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Video URL is required for video content items',
          path: ['url'],
        });
      } else if (!/^https?:\/\/.+/i.test(data.url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Video URL must be a valid HTTP or HTTPS URL',
          path: ['url'],
        });
      }
    } else if (data.type === 'LINK') {
      if (!data.url || !/^https?:\/\/.+/i.test(data.url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A valid HTTP or HTTPS URL is required for link content items',
          path: ['url'],
        });
      }
    } else if (data.type === 'TEXT') {
      if (!data.body || data.body.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Body text is required for text content items',
          path: ['body'],
        });
      }
    } else if (data.type === 'ASSIGNMENT') {
      if (!data.assignmentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'assignmentId is required for assignment content items',
          path: ['assignmentId'],
        });
      }
    }
  });

export const updateContentItemSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title cannot be empty')
      .max(200, 'Title cannot exceed 200 characters')
      .optional(),
    type: z.enum(['VIDEO', 'YOUTUBE_VIDEO', 'TEXT', 'LINK', 'ASSIGNMENT']).optional(),
    description: z
      .string()
      .trim()
      .max(5000, 'Description cannot exceed 5000 characters')
      .nullable()
      .optional(),
    body: z.string().trim().nullable().optional(),
    url: z.string().trim().nullable().optional(),
    assignmentId: z.string().uuid('assignmentId must be a valid UUID').nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'YOUTUBE_VIDEO' || data.type === 'VIDEO') {
      if (data.url !== undefined && (!data.url || !/^https?:\/\/.+/i.test(data.url))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Video URL must be a valid HTTP or HTTPS URL',
          path: ['url'],
        });
      }
    } else if (data.type === 'LINK') {
      if (data.url !== undefined && (!data.url || !/^https?:\/\/.+/i.test(data.url))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A valid HTTP or HTTPS URL is required for link content items',
          path: ['url'],
        });
      }
    } else if (data.type === 'TEXT') {
      if (data.body !== undefined && (!data.body || data.body.trim().length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Body text cannot be empty for text content items',
          path: ['body'],
        });
      }
    }
  });

export const reorderContentItemsSchema = z
  .object({
    contentItemIds: z.array(z.string().min(1)).optional(),
    contentIds: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (data) =>
      (data.contentItemIds && data.contentItemIds.length > 0) ||
      (data.contentIds && data.contentIds.length > 0),
    {
      message: 'Either contentItemIds or contentIds array must be provided',
    }
  )
  .refine(
    (data) => {
      const list = data.contentItemIds || data.contentIds || [];
      return new Set(list).size === list.length;
    },
    { message: 'Content IDs list must not contain duplicates' }
  );

export type CreateContentItemSchemaInput = z.infer<typeof createContentItemSchema>;
export type UpdateContentItemSchemaInput = z.infer<typeof updateContentItemSchema>;
export type ReorderContentItemsSchemaInput = z.infer<typeof reorderContentItemsSchema>;
