import { Request, Response, NextFunction } from 'express';
import { ApiResponseError } from '../errors/app-error';

export function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  const response: ApiResponseError = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `The requested resource '${req.method} ${req.originalUrl}' was not found`,
    },
  };

  res.status(404).json(response);
}

export const notFoundMiddleware = notFoundHandler;
