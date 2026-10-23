import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import {
  RateLimitService,
  RateLimitRepository,
  createRateLimiter,
  extractClientIdentifier,
} from '../src/modules/rate-limit';
import { errorHandler } from '../src/middleware/error-handler';
import { RateLimitDecision, RateLimitRow } from '../src/modules/rate-limit/rate-limit.types';

describe('Database-Backed Rate Limiting', () => {
  let inMemoryStore: Map<string, RateLimitRow>;
  let mockRepository: RateLimitRepository;
  let service: RateLimitService;

  beforeEach(() => {
    inMemoryStore = new Map();

    // In-memory simulation of the exact PostgreSQL atomic upsert query
    mockRepository = {
      consume: vi.fn(
        async (
          key: string,
          windowMs: number,
          maxRequests: number,
          now: Date = new Date()
        ): Promise<RateLimitDecision> => {
          let row = inMemoryStore.get(key);

          if (!row || row.expiresAt <= now) {
            // New bucket or expired window
            row = {
              id: 'mock-id',
              key,
              count: 1,
              windowStartedAt: now,
              expiresAt: new Date(now.getTime() + windowMs),
            };
          } else {
            // Active window atomic increment (capped at maxRequests + 1)
            row = {
              ...row,
              count: Math.min(row.count + 1, maxRequests + 1),
            };
          }

          inMemoryStore.set(key, row);

          const allowed = row.count <= maxRequests;
          const remaining = Math.max(0, maxRequests - row.count);
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((row.expiresAt.getTime() - now.getTime()) / 1000)
          );

          return {
            allowed,
            total: row.count,
            remaining,
            resetTime: row.expiresAt,
            retryAfterSeconds,
            windowStartedAt: row.windowStartedAt,
          };
        }
      ),
      cleanupExpired: vi.fn(async (batchSize = 1000, now: Date = new Date()): Promise<number> => {
        let deleted = 0;
        for (const [key, row] of inMemoryStore.entries()) {
          if (row.expiresAt < now) {
            inMemoryStore.delete(key);
            deleted++;
            if (deleted >= batchSize) break;
          }
        }
        return deleted;
      }),
      get: vi.fn(async (key: string) => inMemoryStore.get(key) ?? null),
      delete: vi.fn(async (key: string) => inMemoryStore.delete(key)),
    } as unknown as RateLimitRepository;

    service = new RateLimitService(mockRepository);
  });

  describe('Key Generation & Hashing', () => {
    it('should generate consistent SHA-256 hashed keys without storing raw IPs', () => {
      const key1 = service.generateKey('global', '192.168.1.1');
      const key2 = service.generateKey('global', '192.168.1.1');
      const key3 = service.generateKey('global', '192.168.1.2');

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).toMatch(/^global:[a-f0-9]{64}$/);
      expect(key1).not.toContain('192.168.1.1');
    });

    it('should normalize uppercase or whitespace in client identifiers', () => {
      const key1 = service.generateKey('auth', ' 10.0.0.1 ');
      const key2 = service.generateKey('auth', '10.0.0.1');

      expect(key1).toBe(key2);
    });

    it('should safely extract client identifier with fallback', () => {
      const mockReqValid = { ip: '127.0.0.1' } as unknown as express.Request;
      expect(extractClientIdentifier(mockReqValid)).toBe('127.0.0.1');

      const mockReqMissing = { ip: '' } as unknown as express.Request;
      expect(extractClientIdentifier(mockReqMissing)).toBe('unknown-client');
    });
  });

  describe('Atomic Fixed-Window Policy', () => {
    it('should create a new bucket and allow requests within limit', async () => {
      const policy = { windowMs: 60000, maxRequests: 3 };
      const decision = await service.consume('test-bucket-1', policy);

      expect(decision.allowed).toBe(true);
      expect(decision.total).toBe(1);
      expect(decision.remaining).toBe(2);
      expect(decision.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('should reject requests exceeding the configured maximum allowance', async () => {
      const policy = { windowMs: 60000, maxRequests: 2 };
      const now = new Date();

      const d1 = await service.consume('test-bucket-2', policy, now);
      const d2 = await service.consume('test-bucket-2', policy, now);
      const d3 = await service.consume('test-bucket-2', policy, now);

      expect(d1.allowed).toBe(true);
      expect(d1.remaining).toBe(1);

      expect(d2.allowed).toBe(true);
      expect(d2.remaining).toBe(0);

      expect(d3.allowed).toBe(false);
      expect(d3.remaining).toBe(0);
      expect(d3.total).toBe(3);
    });

    it('should start a new window when active window expires', async () => {
      const policy = { windowMs: 10000, maxRequests: 2 };
      const t0 = new Date('2026-01-01T00:00:00.000Z');

      await service.consume('test-bucket-expire', policy, t0);
      await service.consume('test-bucket-expire', policy, t0);
      const blocked = await service.consume('test-bucket-expire', policy, t0);
      expect(blocked.allowed).toBe(false);

      // Advance time beyond windowMs (10 seconds)
      const tExpired = new Date('2026-01-01T00:00:10.001Z');
      const resetDecision = await service.consume('test-bucket-expire', policy, tExpired);

      expect(resetDecision.allowed).toBe(true);
      expect(resetDecision.total).toBe(1);
      expect(resetDecision.remaining).toBe(1);
      expect(resetDecision.windowStartedAt).toEqual(tExpired);
    });

    it('should treat exact window boundary (now = expiresAt) as starting a new window', async () => {
      const policy = { windowMs: 10000, maxRequests: 1 };
      const t0 = new Date('2026-01-01T00:00:00.000Z');
      await service.consume('test-boundary', policy, t0);

      // Exact boundary: now equals expiresAt
      const tBoundary = new Date('2026-01-01T00:00:10.000Z');
      const boundaryDecision = await service.consume('test-boundary', policy, tBoundary);

      expect(boundaryDecision.allowed).toBe(true);
      expect(boundaryDecision.total).toBe(1);
    });

    it('should maintain independent buckets for different client keys', async () => {
      const policy = { windowMs: 60000, maxRequests: 1 };

      const clientA = await service.consume('client-A', policy);
      const clientB = await service.consume('client-B', policy);

      expect(clientA.allowed).toBe(true);
      expect(clientB.allowed).toBe(true);

      const clientABlocked = await service.consume('client-A', policy);
      expect(clientABlocked.allowed).toBe(false);

      // Client B has not exceeded their independent allowance
      const clientBSecond = inMemoryStore.get('client-B');
      expect(clientBSecond?.count).toBe(1);
    });

    it('should safely enforce concurrency under simultaneous requests', async () => {
      const policy = { windowMs: 60000, maxRequests: 5 };
      const key = 'concurrent-test';

      // Fire 10 parallel simulated requests
      const decisions = await Promise.all(
        Array.from({ length: 10 }).map(() => service.consume(key, policy))
      );

      const allowedCount = decisions.filter((d) => d.allowed).length;
      const blockedCount = decisions.filter((d) => !d.allowed).length;

      expect(allowedCount).toBe(5);
      expect(blockedCount).toBe(5);
    });
  });

  describe('Cleanup Strategy', () => {
    it('should delete only expired records and retain active records', async () => {
      const now = new Date('2026-01-01T12:00:00.000Z');

      // Create expired entry
      inMemoryStore.set('expired-key', {
        id: '1',
        key: 'expired-key',
        count: 5,
        windowStartedAt: new Date(now.getTime() - 60000),
        expiresAt: new Date(now.getTime() - 1000),
      });

      // Create active entry
      inMemoryStore.set('active-key', {
        id: '2',
        key: 'active-key',
        count: 2,
        windowStartedAt: now,
        expiresAt: new Date(now.getTime() + 60000),
      });

      const deleted = await service.cleanupExpired(100, now);

      expect(deleted).toBe(1);
      expect(inMemoryStore.has('expired-key')).toBe(false);
      expect(inMemoryStore.has('active-key')).toBe(true);
    });

    it('should respect cleanup batch size', async () => {
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        inMemoryStore.set(`expired-${i}`, {
          id: `${i}`,
          key: `expired-${i}`,
          count: 1,
          windowStartedAt: new Date(now.getTime() - 10000),
          expiresAt: new Date(now.getTime() - 1000),
        });
      }

      const deleted = await service.cleanupExpired(3);
      expect(deleted).toBe(3);
      expect(inMemoryStore.size).toBe(2);
    });
  });

  describe('Express Middleware Integration', () => {
    let testApp: Express;

    beforeEach(() => {
      testApp = express();
      testApp.set('trust proxy', 1);

      // Create rate-limited test route (limit: 2 requests per 2 minutes)
      testApp.get(
        '/api/test-rate-limit',
        createRateLimiter(
          {
            windowMs: 120000,
            maxRequests: 2,
            keyPrefix: 'test-route',
          },
          service
        ),
        (_req, res) => {
          res.status(200).json({ success: true, message: 'allowed' });
        }
      );

      testApp.use(errorHandler);
    });

    it('should emit standard rate-limit headers on allowed requests', async () => {
      const res = await request(testApp).get('/api/test-rate-limit');

      expect(res.status).toBe(200);
      expect(res.headers['ratelimit-limit']).toBe('2');
      expect(res.headers['ratelimit-remaining']).toBe('1');
      expect(res.headers['ratelimit-reset']).toBeDefined();
      expect(res.headers['retry-after']).toBeUndefined();
    });

    it('should return HTTP 429 with Retry-After header and standard error envelope when exceeded', async () => {
      await request(testApp).get('/api/test-rate-limit');
      await request(testApp).get('/api/test-rate-limit');

      const blockedRes = await request(testApp).get('/api/test-rate-limit');

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers['ratelimit-remaining']).toBe('0');
      expect(blockedRes.headers['retry-after']).toBeDefined();
      expect(blockedRes.body).toEqual({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: expect.stringContaining('Too many requests. Please try again after 2 minutes.'),
        },
      });
    });

    it('should fail-closed safely when database errors occur', async () => {
      vi.mocked(mockRepository.consume).mockRejectedValueOnce(new Error('Connection lost to PostgreSQL'));

      const res = await request(testApp).get('/api/test-rate-limit');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RATE_LIMIT_ERROR');
      // Must not leak internal database error details
      expect(res.body.error.message).not.toContain('PostgreSQL');
    });

    it('should support fail-open when explicitly configured on a route', async () => {
      const failOpenApp = express();
      failOpenApp.get(
        '/api/fail-open',
        createRateLimiter(
          {
            failClosed: false,
          },
          service
        ),
        (_req, res) => res.status(200).json({ success: true, message: 'fail-open-ok' })
      );

      vi.mocked(mockRepository.consume).mockRejectedValueOnce(new Error('DB unreachable'));

      const res = await request(failOpenApp).get('/api/fail-open');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('fail-open-ok');
    });
  });
});
