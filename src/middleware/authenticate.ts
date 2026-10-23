import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from '../errors/app-error';
import { verifyToken } from '../lib/jwt';
import { authRepository, AuthRepository } from '../modules/auth/auth.repository';

/**
 * Creates an authentication middleware instance.
 * Accepts optional repository for testing/mocking.
 */
export function createAuthenticateMiddleware(
  repo: AuthRepository = authRepository
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw AppError.unauthorized('Authorization header is required', 'UNAUTHORIZED');
      }

      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (!match || !match[1]) {
        throw AppError.unauthorized(
          'Invalid authorization header format. Expected "Bearer <token>"',
          'UNAUTHORIZED'
        );
      }

      const token = match[1].trim();
      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        throw AppError.unauthorized('Invalid or expired authentication token', 'UNAUTHORIZED');
      }

      if (!payload.sub) {
        throw AppError.unauthorized('Invalid token payload: missing subject', 'UNAUTHORIZED');
      }

      const user = await repo.findById(payload.sub);
      if (!user) {
        throw AppError.unauthorized(
          'User associated with this token was not found',
          'UNAUTHORIZED'
        );
      }

      if (!user.isActive) {
        throw AppError.unauthorized(
          'Account is deactivated. Please contact support.',
          'ACCOUNT_DEACTIVATED'
        );
      }

      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

export const authenticate = createAuthenticateMiddleware();
