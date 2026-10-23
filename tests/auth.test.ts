import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { hashPassword, verifyPassword } from '../src/lib/password';
import { signAccessToken, verifyAccessToken } from '../src/lib/jwt';
import { Role } from '../src/models';
import { getPrismaClient, disconnectDatabase } from '../src/db/prisma';
import { requireRole } from '../src/middleware/authorize';
import { seedDatabase } from '../src/scripts/seed';
import { Request, Response, NextFunction } from 'express';

describe('Phase 5 — Authentication Module Tests', () => {
  const prisma = getPrismaClient();
  const createdUserIds: string[] = [];
  const getTestIp = () =>
    `10.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 200 + 10)}`;

  afterAll(async () => {
    // Cleanup any users created during the tests
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await disconnectDatabase();
  });

  describe('1. Password Hashing & Verification (Argon2id)', () => {
    it('should hash password using Argon2id format ($argon2id$)', async () => {
      const password = 'TestSecurePassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash.startsWith('$argon2id$')).toBe(true);
    });

    it('should successfully verify a correct password against its hash', async () => {
      const password = 'CorrectPassword2026!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should fail verification for an incorrect password', async () => {
      const password = 'CorrectPassword2026!';
      const wrongPassword = 'WrongPassword2026!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should enforce password minimum length bound (<8 characters)', async () => {
      await expect(hashPassword('short')).rejects.toThrow(
        'Password must be at least 8 characters long'
      );
    });

    it('should enforce password maximum length bound (>128 characters)', async () => {
      const longPassword = 'A'.repeat(129);
      await expect(hashPassword(longPassword)).rejects.toThrow(
        'Password must not exceed 128 characters'
      );
    });

    it('should safely return false when verifying an invalid hash format', async () => {
      const isValid = await verifyPassword('TestPassword123!', 'invalid-hash-string');
      expect(isValid).toBe(false);
    });
  });

  describe('2. JWT Access Token Signing & Verification', () => {
    it('should generate a valid JWT with sub, email, and role claims', () => {
      const payload = {
        sub: 'usr_123456789',
        email: 'student@example.com',
        role: Role.STUDENT,
        name: 'Student Name',
      };

      const token = signAccessToken(payload);
      expect(typeof token).toBe('string');

      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.name).toBe(payload.name);
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should reject an expired JWT token', async () => {
      const payload = {
        sub: 'usr_expired',
        email: 'expired@example.com',
        role: Role.STUDENT,
      };

      // Sign with -1s expiration
      const expiredToken = signAccessToken(payload, '-1s');

      expect(() => verifyAccessToken(expiredToken)).toThrow();
    });

    it('should reject a tampered JWT token', () => {
      const payload = {
        sub: 'usr_tampered',
        email: 'tampered@example.com',
        role: Role.STUDENT,
      };

      const token = signAccessToken(payload);
      const tamperedToken = token.slice(0, -6) + 'abcdef';

      expect(() => verifyAccessToken(tamperedToken)).toThrow();
    });

    it('should reject a token signed with a different secret', () => {
      const payload = {
        sub: 'usr_wrong_secret',
        email: 'wrong@example.com',
        role: Role.STUDENT,
      };

      const foreignToken = jwt.sign(payload, 'foreign_secret_key_that_does_not_match_app_secret', {
        algorithm: 'HS256',
      });

      expect(() => verifyAccessToken(foreignToken)).toThrow();
    });
  });

  describe('3. Student Registration (POST /api/v1/auth/signup)', () => {
    it('should successfully register a student and return 201 with token and sanitized user', async () => {
      const email = `student_${randomUUID().slice(0, 8)}@example.com`;
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .set('X-Forwarded-For', getTestIp())
        .send({
          name: 'Alice Student',
          email: email.toUpperCase(), // Test case insensitivity / normalization
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.role).toBe(Role.STUDENT);
      expect(res.body.data.user.email).toBe(email.toLowerCase());
      expect(res.body.data.user.passwordHash).toBeUndefined();

      createdUserIds.push(res.body.data.user.id);
    });

    it('should ignore client-supplied privileged role and strictly assign STUDENT', async () => {
      const email = `attacker_${randomUUID().slice(0, 8)}@example.com`;
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .set('X-Forwarded-For', getTestIp())
        .send({
          name: 'Privilege Escalation Attempt',
          email,
          password: 'Password123!',
          role: 'ADMIN', // Injected role attempt
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe(Role.STUDENT);

      createdUserIds.push(res.body.data.user.id);

      // Verify in DB directly
      const dbUser = await prisma.user.findUnique({ where: { id: res.body.data.user.id } });
      expect(dbUser?.role).toBe(Role.STUDENT);
    });

    it('should reject duplicate email registration with 409 Conflict', async () => {
      const email = `duplicate_${randomUUID().slice(0, 8)}@example.com`;
      const ip = getTestIp();

      const firstRes = await request(app)
        .post('/api/v1/auth/signup')
        .set('X-Forwarded-For', ip)
        .send({
          name: 'First User',
          email,
          password: 'Password123!',
        });
      expect(firstRes.status).toBe(201);
      createdUserIds.push(firstRes.body.data.user.id);

      const secondRes = await request(app)
        .post('/api/v1/auth/signup')
        .set('X-Forwarded-For', ip)
        .send({
          name: 'Second User',
          email: email.toUpperCase(),
          password: 'Password123!',
        });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should reject password less than 8 characters with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .set('X-Forwarded-For', getTestIp())
        .send({
          name: 'Short Password User',
          email: `short_${randomUUID().slice(0, 8)}@example.com`,
          password: '12345',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid email format with 400 validation error', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .set('X-Forwarded-For', getTestIp())
        .send({
          name: 'Bad Email User',
          email: 'not-an-email',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('4. Authentication & Login (POST /api/v1/auth/login)', () => {
    let studentEmail: string;
    const studentPassword = 'ValidPassword2026!';

    beforeAll(async () => {
      studentEmail = `login_test_${randomUUID().slice(0, 8)}@example.com`;
      const hash = await hashPassword(studentPassword);
      const user = await prisma.user.create({
        data: {
          name: 'Login Test Student',
          email: studentEmail,
          passwordHash: hash,
          role: Role.STUDENT,
          isActive: true,
        },
      });
      createdUserIds.push(user.id);
    });

    it('should login successfully with correct credentials and case-insensitive email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', getTestIp())
        .send({
          email: studentEmail.toUpperCase(),
          password: studentPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe(studentEmail.toLowerCase());
      expect(res.body.data.user.role).toBe(Role.STUDENT);
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should fail with 401 and generic message when user does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', getTestIp())
        .send({
          email: 'nonexistent-user@example.com',
          password: 'SomePassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('should fail with identical generic 401 message when password is wrong', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', getTestIp())
        .send({
          email: studentEmail,
          password: 'WrongPassword999!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('should fail with 401 when user account is deactivated (isActive: false)', async () => {
      const deactEmail = `deactivated_${randomUUID().slice(0, 8)}@example.com`;
      const hash = await hashPassword('ValidPassword2026!');
      const user = await prisma.user.create({
        data: {
          name: 'Deactivated User',
          email: deactEmail,
          passwordHash: hash,
          role: Role.STUDENT,
          isActive: false, // Inactive account
        },
      });
      createdUserIds.push(user.id);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', getTestIp())
        .send({
          email: deactEmail,
          password: 'ValidPassword2026!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
    });
  });

  describe('5. Authentication Middleware & Protected Routes (GET /api/v1/auth/me)', () => {
    let activeToken: string;
    let studentId: string;

    beforeAll(async () => {
      const email = `me_test_${randomUUID().slice(0, 8)}@example.com`;
      const hash = await hashPassword('Password123!');
      const user = await prisma.user.create({
        data: {
          name: 'Me Test User',
          email,
          passwordHash: hash,
          role: Role.STUDENT,
          isActive: true,
        },
      });
      studentId = user.id;
      createdUserIds.push(user.id);

      activeToken = signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });
    });

    it('should return 401 when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when Authorization header does not use Bearer format', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Basic ${activeToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when token is invalid or corrupted', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when token has expired', async () => {
      const expiredToken = signAccessToken(
        {
          sub: studentId,
          email: 'test@example.com',
          role: Role.STUDENT,
        },
        '-1s'
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 with user profile when token is valid', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${activeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(studentId);
      expect(res.body.data.user.role).toBe(Role.STUDENT);
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should return 401 if user account is deactivated after token was issued', async () => {
      const deactEmail = `revoked_${randomUUID().slice(0, 8)}@example.com`;
      const hash = await hashPassword('Password123!');
      const user = await prisma.user.create({
        data: {
          name: 'Soon Deactivated',
          email: deactEmail,
          passwordHash: hash,
          role: Role.STUDENT,
          isActive: true,
        },
      });
      createdUserIds.push(user.id);

      const token = signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      // Deactivate user in database
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('ACCOUNT_DEACTIVATED');
    });
  });

  describe('6. Role-Based Authorization Middleware (requireRole)', () => {
    it('should allow access when user role matches single required role', () => {
      const middleware = requireRole(Role.ADMIN);
      const req = {
        user: { id: 'admin1', email: 'admin@test.com', name: 'Admin', role: Role.ADMIN, isActive: true },
      } as Request;
      const res = {} as Response;
      let nextCalledWith: unknown = 'NOT_CALLED';

      middleware(req, res, ((err?: unknown) => {
        nextCalledWith = err;
      }) as NextFunction);

      expect(nextCalledWith).toBeUndefined();
    });

    it('should allow access when user role matches one of multiple permitted roles', () => {
      const middleware = requireRole(Role.MENTOR, Role.ADMIN);
      const req = {
        user: { id: 'mentor1', email: 'mentor@test.com', name: 'Mentor', role: Role.MENTOR, isActive: true },
      } as Request;
      const res = {} as Response;
      let nextCalledWith: unknown = 'NOT_CALLED';

      middleware(req, res, ((err?: unknown) => {
        nextCalledWith = err;
      }) as NextFunction);

      expect(nextCalledWith).toBeUndefined();
    });

    it('should reject with 403 Forbidden when user role does not match required role', () => {
      const middleware = requireRole(Role.ADMIN);
      const req = {
        user: { id: 'student1', email: 'student@test.com', name: 'Student', role: Role.STUDENT, isActive: true },
      } as Request;
      const res = {} as Response;
      let nextCalledWith: unknown = null;

      middleware(req, res, ((err?: unknown) => {
        nextCalledWith = err;
      }) as NextFunction);

      expect(nextCalledWith).toBeDefined();
      const err = nextCalledWith as { statusCode: number; code: string };
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    });

    it('should reject with 401 Unauthorized if req.user is missing', () => {
      const middleware = requireRole(Role.STUDENT);
      const req = {} as Request;
      const res = {} as Response;
      let nextCalledWith: unknown = null;

      middleware(req, res, ((err?: unknown) => {
        nextCalledWith = err;
      }) as NextFunction);

      expect(nextCalledWith).toBeDefined();
      const err = nextCalledWith as { statusCode: number; code: string };
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
    });
  });

  describe('7. Idempotent Mentor & Admin Account Seeding', () => {
    it('should idempotently seed default mentor and admin accounts', async () => {
      const result = await seedDatabase();

      expect(result).toBeDefined();
      expect(result.mentorEmail).toBe(env.SEED_MENTOR_EMAIL.toLowerCase());
      expect(result.adminEmail).toBe(env.SEED_ADMIN_EMAIL.toLowerCase());

      // Query database to verify accounts and hashed passwords
      const mentor = await prisma.user.findUnique({
        where: { email: result.mentorEmail },
      });
      expect(mentor).not.toBeNull();
      expect(mentor?.role).toBe(Role.MENTOR);
      expect(mentor?.isActive).toBe(true);
      expect(mentor?.passwordHash.startsWith('$argon2id$')).toBe(true);

      const admin = await prisma.user.findUnique({
        where: { email: result.adminEmail },
      });
      expect(admin).not.toBeNull();
      expect(admin?.role).toBe(Role.ADMIN);
      expect(admin?.isActive).toBe(true);
      expect(admin?.passwordHash.startsWith('$argon2id$')).toBe(true);

      // Running seed again must not duplicate or fail
      const secondRun = await seedDatabase();
      expect(secondRun.mentorCreated).toBe(false);
      expect(secondRun.adminCreated).toBe(false);
    });
  });

  describe('8. Auth Rate Limiting & Endpoint Isolation', () => {
    it('should emit rate-limit headers on auth routes', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '203.0.113.88')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        });

      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
      expect(res.headers['ratelimit-reset']).toBeDefined();
    });

    it('should return 429 when auth endpoint rate limit is exceeded, while keeping health unaffected', async () => {
      const testIp = getTestIp();

      // Fire 10 parallel requests to consume login bucket limit
      await Promise.all(
        Array.from({ length: 10 }).map(() =>
          request(app)
            .post('/api/v1/auth/login')
            .set('X-Forwarded-For', testIp)
            .send({ email: 'bad@example.com', password: 'bad' })
        )
      );

      // 11th request must be blocked with 429 Too Many Requests
      const blockedRes = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', testIp)
        .send({ email: 'bad@example.com', password: 'bad' });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(blockedRes.headers['retry-after']).toBeDefined();

      // Verify health check from the exact same rate-limited IP is still 200 OK
      const healthRes = await request(app)
        .get('/api/v1/health')
        .set('X-Forwarded-For', testIp);

      expect(healthRes.status).toBe(200);
      expect(healthRes.body.success).toBe(true);
      expect(healthRes.body.data.status).toBe('ok');
    }, 15000);
  });
});
