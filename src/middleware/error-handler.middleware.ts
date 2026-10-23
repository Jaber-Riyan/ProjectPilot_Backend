import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ApiResponseError } from '../errors/app-error';
import { logger } from '../lib/logger';

export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const requestId = req.id;

  // 1. Handle custom AppError
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error(`Non-operational AppError: ${err.message}`, {
        requestId,
        code: err.code,
        statusCode: err.statusCode,
        stack: err.stack,
      });
    }

    const response: ApiResponseError = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // 2. Handle malformed JSON body from express.json()
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400 && 'body' in err) {
    const response: ApiResponseError = {
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload provided in request body',
      },
    };

    res.status(400).json(response);
    return;
  }

  // 3. Handle Zod validation errors
  if (err instanceof ZodError) {
    const formattedDetails = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    const response: ApiResponseError = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: formattedDetails,
      },
    };

    res.status(400).json(response);
    return;
  }

  // 4. Handle unexpected/unhandled errors
  const standardError = err instanceof Error ? err : new Error(String(err));
  
  logger.error(`Unhandled internal error: ${standardError.message}`, {
    requestId,
    url: req.originalUrl,
    method: req.method,
    stack: standardError.stack,
  });

  const response: ApiResponseError = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isProduction
        ? 'An unexpected error occurred. Please try again later.'
        : standardError.message,
      ...(!isProduction && standardError.stack ? { details: standardError.stack } : {}),
    },
  };

  res.status(500).json(response);
}
