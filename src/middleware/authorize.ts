import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Role } from '../models';
import { AppError } from '../errors/app-error';

/**
 * Role-based authorization middleware.
 * Ensures the authenticated user has at least one of the specified allowed roles.
 */
export function requireRole(...allowedRoles: Role[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required', 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          'You do not have permission to access this resource',
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}
