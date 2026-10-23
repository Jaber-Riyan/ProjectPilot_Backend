import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { rateLimitRepository } from '../src/modules/rate-limit/rate-limit.repository';
import { disconnectDatabase } from '../src/db/prisma';

describe('RateLimitRepository PostgreSQL Integration Tests', () => {
  afterAll(async () => {
    await disconnectDatabase();
  });

  it('should atomically handle concurrent requests against PostgreSQL without race conditions', async () => {
    const testKey = `test:concurrency:${randomUUID()}`;
    const windowMs = 60000;
    const maxRequests = 5;
    const concurrency = 10;
    const now = new Date();

    try {
      // Fire 10 simultaneous requests concurrently
      const results = await Promise.all(
        Array.from({ length: concurrency }).map(() =>
          rateLimitRepository.consume(testKey, windowMs, maxRequests, now)
        )
      );

      const allowedDecisions = results.filter((r) => r.allowed);
      const blockedDecisions = results.filter((r) => !r.allowed);

      // In an atomic database upsert, exactly 5 must be allowed and 5 must be blocked
      expect(allowedDecisions.length).toBe(5);
      expect(blockedDecisions.length).toBe(5);

      // Verify that every allowed decision received a unique remaining count from 0 to 4
      const remainingCounts = allowedDecisions.map((d) => d.remaining).sort((a, b) => b - a);
      expect(remainingCounts).toEqual([4, 3, 2, 1, 0]);

      // Verify blocked decisions
      for (const blocked of blockedDecisions) {
        expect(blocked.remaining).toBe(0);
        expect(blocked.total).toBeGreaterThan(maxRequests);
        expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      }
    } finally {
      // Cleanup isolated test key
      await rateLimitRepository.delete(testKey);
    }
  });

  it('should reset window when active window has expired in PostgreSQL', async () => {
    const testKey = `test:expiry:${randomUUID()}`;
    const windowMs = 2000; // 2 seconds
    const maxRequests = 1;
    const t0 = new Date('2026-01-01T00:00:00.000Z');

    try {
      // First request at t0
      const first = await rateLimitRepository.consume(testKey, windowMs, maxRequests, t0);
      expect(first.allowed).toBe(true);
      expect(first.total).toBe(1);

      // Second request within window should be blocked
      const second = await rateLimitRepository.consume(testKey, windowMs, maxRequests, t0);
      expect(second.allowed).toBe(false);

      // Request after window expires (t0 + 2001ms) should start a brand new window atomically
      const t1 = new Date('2026-01-01T00:00:02.001Z');
      const third = await rateLimitRepository.consume(testKey, windowMs, maxRequests, t1);

      expect(third.allowed).toBe(true);
      expect(third.total).toBe(1);
      expect(third.remaining).toBe(0);
    } finally {
      await rateLimitRepository.delete(testKey);
    }
  });
});
