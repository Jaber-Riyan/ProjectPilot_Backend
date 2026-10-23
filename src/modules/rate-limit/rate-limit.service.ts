import { createHash } from 'crypto';
import { RateLimitRepository, rateLimitRepository } from './rate-limit.repository';
import { RateLimitDecision, RateLimitPolicy } from './rate-limit.types';
import { logger } from '../../lib/logger';
import { AppError } from '../../errors/app-error';

export class RateLimitService {
  constructor(private repository: RateLimitRepository = rateLimitRepository) {}

  /**
   * Generates a safe, uniform rate-limit bucket key.
   * Hashes the client identifier with SHA-256 so raw IP addresses or PII
   * are never stored in the database or exposed in logs.
   */
  generateKey(prefix: string, identifier: string): string {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const hash = createHash('sha256').update(normalizedIdentifier).digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * Evaluates and consumes a request under the specified rate-limit policy.
   */
  async consume(
    key: string,
    policy: RateLimitPolicy,
    now: Date = new Date()
  ): Promise<RateLimitDecision> {
    try {
      return await this.repository.consume(key, policy.windowMs, policy.maxRequests, now);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Rate limiting database operation failed', {
        error: message.replace(/:[^:@]+@/, ':***@'),
        keyPrefix: policy.keyPrefix,
      });

      // Fail-closed policy (default): reject requests when rate-limiter backend is unreachable
      if (policy.failClosed !== false) {
        throw new AppError(
          500,
          'RATE_LIMIT_ERROR',
          'Rate limiting service is temporarily unavailable. Please try again later.'
        );
      }

      // Fail-open policy (when explicitly configured): permit request with safe fallback metrics
      logger.warn('Rate limiter failing open due to database failure', {
        keyPrefix: policy.keyPrefix,
      });

      return {
        allowed: true,
        total: 1,
        remaining: policy.maxRequests - 1,
        resetTime: new Date(now.getTime() + policy.windowMs),
        retryAfterSeconds: 0,
        windowStartedAt: now,
      };
    }
  }

  /**
   * Bounded batch deletion of expired rate limit entries.
   */
  async cleanupExpired(batchSize = 1000, now: Date = new Date()): Promise<number> {
    try {
      return await this.repository.cleanupExpired(batchSize, now);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Rate limit cleanup operation failed', { error: message });
      throw err;
    }
  }
}

export const rateLimitService = new RateLimitService();
