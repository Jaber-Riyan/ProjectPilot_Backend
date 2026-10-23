import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../lib/logger';

// Load .env file into process.env before validation
dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce
      .number()
      .int()
      .min(1, 'PORT must be at least 1')
      .max(65535, 'PORT must be at most 65535')
      .default(5000),
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL cannot be empty')
      .refine(
        (val) => /^postgres(ql)?:\/\//.test(val),
        'DATABASE_URL must be a valid PostgreSQL connection URL'
      )
      .optional(),
    DIRECT_URL: z
      .string()
      .min(1, 'DIRECT_URL cannot be empty')
      .refine(
        (val) => /^postgres(ql)?:\/\//.test(val),
        'DIRECT_URL must be a valid PostgreSQL connection URL'
      )
      .optional(),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
    RATE_LIMIT_ENABLED: z
      .preprocess((val) => (val === undefined ? true : val === 'true' || val === true), z.boolean())
      .default(true),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(120000), // 2 minutes
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_CLEANUP_BATCH_SIZE: z.coerce.number().int().positive().default(1000),
    JWT_SECRET: z
      .string()
      .min(32, 'JWT_SECRET must be at least 32 characters long')
      .default('projectpilot_jwt_dev_secret_key_32_characters_minimum!'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    SEED_MENTOR_EMAIL: z.string().email().default('mentor@projectpilot.dev'),
    SEED_MENTOR_PASSWORD: z.string().min(8).default('MentorSecret2026!'),
    SEED_ADMIN_EMAIL: z.string().email().default('admin@projectpilot.dev'),
    SEED_ADMIN_PASSWORD: z.string().min(8).default('AdminSecret2026!'),
  })
  .superRefine((data, ctx) => {
    // In production, database connection and secure JWT secret are strictly required
    if (data.NODE_ENV === 'production') {
      if (!data.DATABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DATABASE_URL is required in production',
          path: ['DATABASE_URL'],
        });
      }
      if (!data.DIRECT_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DIRECT_URL is required in production for Prisma CLI and migrations',
          path: ['DIRECT_URL'],
        });
      }
      if (data.JWT_SECRET === 'projectpilot_jwt_dev_secret_key_32_characters_minimum!') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JWT_SECRET must be configured with a unique, secure secret in production',
          path: ['JWT_SECRET'],
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.issues.map((issue) => {
      const field = issue.path.join('.') || 'configuration';
      return `  - ${field}: ${issue.message}`;
    });

    const errorMessage = `[Config Error] Invalid environment configuration:\n${errorDetails.join('\n')}`;

    // Log the error cleanly without exposing sensitive variable values
    logger.error('Invalid environment variables', {
      fields: result.error.issues.map((i) => i.path.join('.')),
    });
    process.stderr.write(`${errorMessage}\n`);

    if (process.env.NODE_ENV === 'test') {
      throw new Error(errorMessage);
    }

    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
