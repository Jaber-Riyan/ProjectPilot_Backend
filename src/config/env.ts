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
    DATABASE_URL: z.string().min(1, 'DATABASE_URL cannot be empty').optional(),
    DIRECT_URL: z.string().min(1, 'DIRECT_URL cannot be empty').optional(),
    CORS_ORIGIN: z.string().default('http://localhost:3000'),
  })
  .superRefine((data, ctx) => {
    // In production, database connection is strictly required
    if (data.NODE_ENV === 'production' && !data.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DATABASE_URL is required in production',
        path: ['DATABASE_URL'],
      });
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
