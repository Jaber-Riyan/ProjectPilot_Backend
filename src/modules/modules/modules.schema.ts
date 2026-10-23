import { z } from 'zod';

export const createModuleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Module title is required')
    .max(200, 'Module title cannot exceed 200 characters'),
  description: z
    .string()
    .trim()
    .max(5000, 'Description cannot exceed 5000 characters')
    .nullable()
    .optional(),
  isPublished: z.boolean().default(false),
  order: z.number().int().min(1).optional(),
});

export const updateModuleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Module title cannot be empty')
    .max(200, 'Module title cannot exceed 200 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(5000, 'Description cannot exceed 5000 characters')
    .nullable()
    .optional(),
  isPublished: z.boolean().optional(),
});

export const reorderModulesSchema = z.object({
  moduleIds: z
    .array(z.string().min(1, 'Module ID is required'))
    .min(1, 'At least one module ID must be provided in reorder list')
    .refine((items) => new Set(items).size === items.length, {
      message: 'moduleIds must not contain duplicate entries',
    }),
});

export type CreateModuleSchemaInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleSchemaInput = z.infer<typeof updateModuleSchema>;
export type ReorderModulesSchemaInput = z.infer<typeof reorderModulesSchema>;
