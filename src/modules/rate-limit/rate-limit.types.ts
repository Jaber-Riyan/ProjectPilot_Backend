import { Request } from 'express';

export interface RateLimitPolicy {
  /**
   * Length of the rate limit window in milliseconds (default: 120,000ms / 2 minutes)
   */
  windowMs: number;

  /**
   * Maximum allowed requests in the window
   */
  maxRequests: number;

  /**
   * Namespace/prefix for the rate limit bucket (e.g. 'global', 'auth:login')
   */
  keyPrefix?: string;

  /**
   * Custom message returned when limit is exceeded
   */
  customMessage?: string;

  /**
   * Policy when database is unavailable:
   * - true (default): block requests (fail-closed, secure)
   * - false: allow requests (fail-open)
   */
  failClosed?: boolean;

  /**
   * Optional custom key generator
   */
  keyGenerator?: (req: Request) => string | Promise<string>;

  /**
   * Optional condition to bypass rate limiting
   */
  skip?: (req: Request) => boolean | Promise<boolean>;
}

export interface RateLimitDecision {
  allowed: boolean;
  total: number;
  remaining: number;
  resetTime: Date;
  retryAfterSeconds: number;
  windowStartedAt: Date;
}

export interface RateLimitRow {
  id: string;
  key: string;
  count: number;
  windowStartedAt: Date;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
