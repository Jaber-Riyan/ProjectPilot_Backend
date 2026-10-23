import { Request, Response, NextFunction, RequestHandler } from 'express';
import { appConfig } from '../../config/app-config';
import { rateLimitService, RateLimitService } from './rate-limit.service';
import { RateLimitPolicy } from './rate-limit.types';
import { ApiResponseError } from '../../errors/app-error';

export function extractClientIdentifier(req: Request): string {
  // Uses Express req.ip which respects app.set('trust proxy', ...) configuration
  if (req.ip && req.ip.trim().length > 0) {
    return req.ip.trim();
  }
  if (req.socket?.remoteAddress && req.socket.remoteAddress.trim().length > 0) {
    return req.socket.remoteAddress.trim();
  }
  return 'unknown-client';
}

/**
 * Creates a configurable, database-backed rate limit middleware.
 */
export function createRateLimiter(
  options: Partial<RateLimitPolicy> = {},
  service: RateLimitService = rateLimitService
): RequestHandler {
  const policy: RateLimitPolicy = {
    windowMs: options.windowMs ?? appConfig.rateLimit.defaultWindowMs,
    maxRequests: options.maxRequests ?? appConfig.rateLimit.defaultMaxRequests,
    keyPrefix: options.keyPrefix ?? 'global',
    customMessage: options.customMessage,
    failClosed: options.failClosed ?? true,
    keyGenerator: options.keyGenerator,
    skip: options.skip,
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 1. Bypass if rate limiting is disabled globally
    if (!appConfig.rateLimit.enabled) {
      return next();
    }

    // 2. Check route-level skip predicate
    if (policy.skip && (await policy.skip(req))) {
      return next();
    }

    try {
      // 3. Resolve bucket key safely
      let identifier = '';
      if (policy.keyGenerator) {
        identifier = await policy.keyGenerator(req);
      } else {
        identifier = extractClientIdentifier(req);
      }

      const bucketKey = service.generateKey(policy.keyPrefix ?? 'global', identifier);

      // 4. Evaluate atomic rate limit
      const decision = await service.consume(bucketKey, policy);

      // 5. Emit standard RateLimit response headers
      res.setHeader('RateLimit-Limit', policy.maxRequests);
      res.setHeader('RateLimit-Remaining', decision.remaining);
      res.setHeader('RateLimit-Reset', Math.ceil(decision.resetTime.getTime() / 1000));

      // 6. Handle limit exceeded
      if (!decision.allowed) {
        res.setHeader('Retry-After', decision.retryAfterSeconds);

        const retryMinutes = Math.max(1, Math.ceil(decision.retryAfterSeconds / 60));
        const message =
          policy.customMessage ||
          `Too many requests. Please try again after ${retryMinutes} minute${
            retryMinutes > 1 ? 's' : ''
          }.`;

        const errorResponse: ApiResponseError = {
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message,
          },
        };

        res.status(429).json(errorResponse);
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
