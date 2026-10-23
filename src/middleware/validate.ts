import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodTypeAny } from 'zod';

/**
 * Express middleware that validates req.body against a Zod schema.
 * Replaces req.body with the parsed/transformed data on success.
 * Passes ZodError to next() on failure, caught by global errorHandler.
 */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Express middleware that validates req.query against a Zod schema.
 */
export function validateQuery(schema: ZodTypeAny): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.query);
      Object.assign(req.query, parsed);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Express middleware that validates req.params against a Zod schema.
 */
export function validateParams(schema: ZodTypeAny): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.params);
      Object.assign(req.params, parsed);
      next();
    } catch (error) {
      next(error);
    }
  };
}
