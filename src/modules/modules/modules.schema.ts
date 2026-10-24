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
});

export const attachOrAddModuleSchema = z
  .object({
    moduleId: z.string().uuid('Invalid moduleId UUID').optional(),
    title: z
      .string()
      .trim()
      .min(1, 'Module title is required')
      .max(200, 'Module title cannot exceed 200 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(5000, 'Description cannot exceed 5000 characters')
      .nullable()
      .optional(),
    isPublished: z.boolean().optional(),
    order: z.number().int().min(1).optional(),
  })
  .refine((data) => data.moduleId || data.title, {
    message: 'Either moduleId (to attach existing module) or title (to create a new module) must be provided',
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

export const moduleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isPublished: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export type CreateModuleSchemaInput = z.infer<typeof createModuleSchema>;
export type AttachOrAddModuleSchemaInput = z.infer<typeof attachOrAddModuleSchema>;
export type UpdateModuleSchemaInput = z.infer<typeof updateModuleSchema>;
export type ReorderModulesSchemaInput = z.infer<typeof reorderModulesSchema>;
export type ModuleQuerySchemaInput = z.infer<typeof moduleQuerySchema>;
