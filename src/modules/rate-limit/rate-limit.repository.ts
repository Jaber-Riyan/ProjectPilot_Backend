import { randomUUID } from 'crypto';
import { PrismaClient } from '../../generated/prisma/client';
import { getPrismaClient } from '../../db/prisma';
import { RateLimitDecision, RateLimitRow } from './rate-limit.types';

export class RateLimitRepository {
  private clientGetter: () => PrismaClient;

  constructor(clientOrGetter?: PrismaClient | (() => PrismaClient)) {
    if (typeof clientOrGetter === 'function') {
      this.clientGetter = clientOrGetter;
    } else if (clientOrGetter) {
      this.clientGetter = () => clientOrGetter;
    } else {
      this.clientGetter = () => getPrismaClient();
    }
  }

  private get client(): PrismaClient {
    return this.clientGetter();
  }

  /**
   * Concurrency-safe atomic rate limit check and increment.
   *
   * Uses a single PostgreSQL atomic upsert with conditional expressions:
   * 1. If key doesn't exist: creates row with count = 1.
   * 2. If key exists and expired: resets count = 1 and advances window.
   * 3. If key exists and active: increments count (capped at maxRequests + 1 to prevent overflow).
   *
   * PostgreSQL row-level locks on the conflict target guarantee atomic serialization
   * across simultaneous concurrent requests without race conditions.
   */
  async consume(
    key: string,
    windowMs: number,
    maxRequests: number,
    now: Date = new Date()
  ): Promise<RateLimitDecision> {
    const id = randomUUID();
    const expiresAt = new Date(now.getTime() + windowMs);

    const rows = await this.client.$queryRaw<RateLimitRow[]>`
      INSERT INTO "rate_limit_entries" ("id", "key", "count", "windowStartedAt", "expiresAt", "createdAt", "updatedAt")
      VALUES (${id}::uuid, ${key}, 1, ${now}, ${expiresAt}, ${now}, ${now})
      ON CONFLICT ("key") DO UPDATE
      SET
        "count" = CASE
          WHEN "rate_limit_entries"."expiresAt" <= ${now} THEN 1
          ELSE LEAST("rate_limit_entries"."count" + 1, ${maxRequests + 1})
        END,
        "windowStartedAt" = CASE
          WHEN "rate_limit_entries"."expiresAt" <= ${now} THEN ${now}
          ELSE "rate_limit_entries"."windowStartedAt"
        END,
        "expiresAt" = CASE
          WHEN "rate_limit_entries"."expiresAt" <= ${now} THEN ${expiresAt}
          ELSE "rate_limit_entries"."expiresAt"
        END,
        "updatedAt" = ${now}
      RETURNING
        "id",
        "key",
        "count",
        "windowStartedAt",
        "expiresAt"
    `;

    const entry = rows[0];
    if (!entry) {
      throw new Error('Rate limit record could not be created or updated');
    }

    const count = entry.count;
    const allowed = count <= maxRequests;
    const remaining = Math.max(0, maxRequests - count);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((entry.expiresAt.getTime() - now.getTime()) / 1000)
    );

    return {
      allowed,
      total: count,
      remaining,
      resetTime: entry.expiresAt,
      retryAfterSeconds,
      windowStartedAt: entry.windowStartedAt,
    };
  }

  /**
   * Bounded batch deletion of expired rate limit buckets.
   * Uses indexed "expiresAt" column to avoid scanning or locking the whole table.
   */
  async cleanupExpired(batchSize = 1000, now: Date = new Date()): Promise<number> {
    const result = await this.client.$executeRaw`
      WITH to_delete AS (
        SELECT "id" FROM "rate_limit_entries"
        WHERE "expiresAt" < ${now}
        ORDER BY "expiresAt" ASC
        LIMIT ${batchSize}
      )
      DELETE FROM "rate_limit_entries"
      WHERE "id" IN (SELECT "id" FROM to_delete);
    `;

    return result;
  }

  /**
   * Reads the current bucket state for inspection or testing.
   */
  async get(key: string): Promise<RateLimitRow | null> {
    const rows = await this.client.$queryRaw<RateLimitRow[]>`
      SELECT "id", "key", "count", "windowStartedAt", "expiresAt", "createdAt", "updatedAt"
      FROM "rate_limit_entries"
      WHERE "key" = ${key}
      LIMIT 1;
    `;
    return rows[0] ?? null;
  }

  /**
   * Clears a rate limit key (useful for test resets).
   */
  async delete(key: string): Promise<boolean> {
    const count = await this.client.$executeRaw`
      DELETE FROM "rate_limit_entries"
      WHERE "key" = ${key};
    `;
    return count > 0;
  }
}

export const rateLimitRepository = new RateLimitRepository();
