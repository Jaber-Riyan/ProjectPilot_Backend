# ProjectPilot LMS — Backend Architecture & Authentication System

Production-ready Express.js + TypeScript REST API foundation, Prisma ORM v7 with Neon PostgreSQL, modular repository-based architecture, database-backed atomic rate limiting, and secure role-based JWT authentication for the ProjectPilot Learning Management System.

---

## 1. Project Overview & Architectural Phases

ProjectPilot LMS is a platform designed for students and mentors to manage courses, modules, assignments, and submissions.

- **Phase 1: Production-Ready Express + TypeScript Backend Foundation**
  - Strict TypeScript configuration (`ES2022`, CommonJS).
  - Separation of application definition (`app.ts`) from runtime listener/lifecycle (`server.ts`).
  - Correlation IDs (`X-Request-Id`) and structured logging with automatic secret redaction.
  - Security headers via Helmet, body size protection, and CORS origin validation.
  - Centralized error handling and standardized JSON response envelopes.
  - Health checks (liveness and readiness).
- **Phase 2: Prisma ORM v7 & Neon PostgreSQL Integration**
  - Stable Prisma ORM v7 (`7.10.1`) with the official Neon driver adapter (`@prisma/adapter-neon`).
  - Separation of CLI operations (`DIRECT_URL` in `prisma.config.ts`) and runtime pooled queries (`DATABASE_URL`).
  - Core LMS domain schema and referential protection rules (`onDelete: Restrict` for student submissions and history).
- **Phase 3: Modular, Repository-Based Architecture & Multi-File Schemas**
  - Multi-file Prisma schemas organized cleanly under `prisma/models/` (`user.prisma`, `course.prisma`, `module.prisma`, etc.).
  - Centralized application settings (`src/config/app-config.ts`).
  - Strict unidirectional dependency flow: `Route → Middleware → Controller → Service → Repository → Database`.
  - Type-safe generic `BaseRepository` for common CRUD operations.
  - Re-exported domain entity types from generated Prisma clients (`src/models/index.ts`).
  - Turnkey Vercel serverless deployment (`api/index.ts` & `vercel.json`).
- **Phase 4: Database-Backed Atomic Rate Limiting**
  - Persistent rate limiting via `RateLimitEntry` stored in PostgreSQL.
  - Concurrency-safe atomic fixed-window algorithm using PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` with row-level locking.
  - Standard headers emitted: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After`.
  - Privacy-preserving SHA-256 hashed keys (no raw IPs stored in the database).
  - Configurable fail-closed / fail-open failure policies.
  - Expiry cleanup strategy with bounded batch deletions (`npm run db:cleanup-rate-limits`).
  - Liveness probe (`/api/v1/health`) completely exempt from rate limiting.
- **Phase 5: Secure Authentication, JWT, Argon2id & Role Authorization**
  - Student self-registration (`POST /api/v1/auth/signup`) strictly enforcing `Role.STUDENT`.
  - Secure login (`POST /api/v1/auth/login`) with timing-safe, uniform generic `401 Unauthorized` responses.
  - Password hashing via state-of-the-art **Argon2id** (memory cost 64MB, time cost 3, parallelism 1, 8–128 character bounds).
  - Short-lived JWT access tokens (HS256, 15m default expiry, claims: `sub`, `email`, `role`).
  - Strict authentication middleware (`authenticate`) validating token signature, expiration, active account status (`isActive`), and DB existence.
  - Role-based authorization middleware (`requireRole('STUDENT')`, `requireRole('MENTOR', 'ADMIN')`).
  - Idempotent seed script (`npm run db:seed`) provisioning initial mentor and administrator accounts safely.
  - Route-specific database-backed rate limiting on auth endpoints (10 attempts per 15-minute window) without affecting health probes or standard API routes.

---

## 2. Directory Architecture

```text
backend/
├── api/
│   └── index.ts                         # Vercel serverless function entry point
├── prisma/
│   ├── schema.prisma                    # Root Prisma generator & datasource definition
│   ├── models/                          # Multi-file Prisma schema models & enums
│   │   ├── user.prisma                  # User model & Role enum (STUDENT, MENTOR, ADMIN)
│   │   ├── course.prisma                # Course model
│   │   ├── module.prisma                # Module model
│   │   ├── content-item.prisma          # ContentItem model & ContentType enum
│   │   ├── assignment.prisma            # Assignment model & SubmissionPolicy enum
│   │   ├── submission.prisma            # Submission model & SubmissionStatus enum
│   │   ├── feedback.prisma              # Feedback model
│   │   └── rate-limit.prisma            # RateLimitEntry model & indexes
│   └── migrations/                      # PostgreSQL migration history
│
├── src/
│   ├── app.ts                           # Express application factory & middleware pipeline
│   ├── server.ts                        # HTTP listener with graceful shutdown lifecycle
│   ├── api/
│   │   └── v1/
│   │       └── index.ts                 # Versioned API route mount point (/api/v1)
│   ├── config/
│   │   ├── env.ts                       # Zod runtime environment validation (with defaults)
│   │   └── app-config.ts                # Centralized application defaults & limits
│   ├── db/
│   │   └── prisma.ts                    # Shared lazy-singleton Prisma client (Neon adapter)
│   ├── errors/
│   │   └── app-error.ts                 # AppError domain class & JSON response envelopes
│   ├── lib/
│   │   ├── async-handler.ts             # Type-safe Express async route wrapper
│   │   ├── jwt.ts                       # HS256 token signing, verification & claim extraction
│   │   ├── logger.ts                    # Structured JSON logger with secret redaction
│   │   └── password.ts                  # Argon2id password hashing and constant-time verification
│   ├── middleware/
│   │   ├── authenticate.ts              # JWT extraction, verification & DB user resolution
│   │   ├── authorize.ts                 # Role-based access control (requireRole)
│   │   ├── error-handler.ts             # Central error handling middleware (Zod & AppError)
│   │   ├── not-found.ts                 # 404 handler for unmatched routes
│   │   ├── request-context.ts           # Correlation ID (X-Request-Id) and latency logger
│   │   └── validate.ts                  # Zod request body/query/params validation middleware
│   ├── models/
│   │   ├── index.ts                     # Domain entity type re-exports from Prisma
│   │   └── README.md                    # Documentation on prisma/models vs src/models
│   ├── modules/
│   │   ├── auth/                        # Authentication & authorization module
│   │   │   ├── auth.controller.ts       # HTTP handlers (signup, login, me)
│   │   │   ├── auth.repository.ts       # User persistence and lookups
│   │   │   ├── auth.routes.ts           # Auth router with rate limiting and validation
│   │   │   ├── auth.schema.ts           # Zod schemas (signupSchema, loginSchema)
│   │   │   ├── auth.service.ts          # Core auth business logic & sanitization
│   │   │   ├── auth.types.ts            # DTOs and interface definitions
│   │   │   └── index.ts
│   │   ├── health/                      # Health module (liveness & readiness)
│   │   └── rate-limit/                  # Database-backed rate limiting module
│   ├── repositories/
│   │   ├── base.repository.ts           # Generic type-safe CRUD repository
│   │   └── repository.types.ts          # Delegate types & pagination interfaces
│   ├── scripts/
│   │   ├── cleanup-rate-limits.ts       # Bounded batch deletion of expired rate limit entries
│   │   ├── seed.ts                      # Idempotent mentor and administrator database seeder
│   │   └── verify-db.ts                 # Direct database connectivity probe
│   └── types/
│       └── express.d.ts                 # Express.Request augmentation (req.user, req.id)
└── tests/
    ├── app.test.ts                      # Foundation & health check tests
    ├── auth.test.ts                     # Auth, Argon2id, JWT, Roles & Seed tests (32 tests)
    ├── base-repository.test.ts          # Generic repository CRUD tests
    ├── rate-limit-db.test.ts            # PostgreSQL concurrency & expiry tests
    ├── rate-limit.test.ts               # In-memory rate limiting middleware tests
    └── utils.test.ts                    # Pagination & utility unit tests
```

---

## 3. Authentication & Authorization Specifications

### Endpoints

| Method | Endpoint | Protection | Description | Rate Limit |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/signup` | Public | Registers a new student account | 10 requests / 15 mins |
| `POST` | `/api/v1/auth/login` | Public | Authenticates student, mentor, or admin | 10 requests / 15 mins |
| `GET` | `/api/v1/auth/me` | Bearer JWT | Returns current authenticated user profile | General API limit |

### Security Guarantees

1. **Privilege Escalation Prevention**:
   - The public signup endpoint strictly hardcodes `role: Role.STUDENT`.
   - Any client-supplied `role` parameter in the request payload is stripped and ignored.
2. **Timing-Safe Generic Login Failures**:
   - Attempting to log in with an unregistered email returns HTTP 401 with `INVALID_CREDENTIALS` ("Invalid email or password").
   - Attempting to log in with an incorrect password returns the identical HTTP 401 and code, completely preventing user enumeration.
3. **Deactivated Accounts**:
   - When `isActive: false`, login attempts are rejected with HTTP 401 `ACCOUNT_DEACTIVATED`.
   - The `authenticate` middleware checks `user.isActive` against the live database on every protected request, instantly revoking access if an account is disabled.
4. **Password Security**:
   - Algorithm: **Argon2id** (`type: argon2.argon2id`)
   - Parameters: Memory cost: 65,536 KB (64 MB), Time cost: 3 iterations, Parallelism: 1 thread.
   - Length limits: Minimum 8 characters, maximum 128 characters.
   - Plaintext passwords and password hashes are never logged and never included in API response envelopes.
5. **JSON Web Tokens (JWT)**:
   - Algorithm: `HS256` (HMAC SHA-256)
   - Secret: Validated at startup via `JWT_SECRET` (minimum 32 characters in production).
   - Lifetime: 15 minutes by default (`JWT_EXPIRES_IN`).
   - Claims: `sub` (User ID), `email`, `role`, `name`.
6. **Role-Based Authorization**:
   - Middleware: `requireRole(Role.ADMIN)` or `requireRole(Role.MENTOR, Role.ADMIN)`.
   - Returns HTTP 403 `FORBIDDEN` ("You do not have permission to access this resource") when the user lacks required roles.

---

## 4. Database Seeding (`npm run db:seed`)

The backend includes an idempotent seeding script to provision initial administrative and mentor accounts without risking data corruption or duplicates:

```bash
npm run db:seed
```

### Seed Behavior & Idempotency:
- Reads credentials from environment variables (`SEED_MENTOR_EMAIL`, `SEED_MENTOR_PASSWORD`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`).
- Checks if the user already exists in PostgreSQL before creating.
- If not found, securely hashes the password with Argon2id and creates the user with the respective role (`Role.MENTOR` or `Role.ADMIN`).
- If the account already exists, confirms role permissions and active status without duplicating records.
- Plaintext passwords are never logged to console or logs.

---

## 5. Environment Variables Reference

| Variable | Type | Default | Description |
|---|---|---|---|
| `NODE_ENV` | `'development' \| 'test' \| 'production'` | `'development'` | Runtime environment |
| `PORT` | `number` | `5000` | Server listening port |
| `CORS_ORIGIN` | `string` | `http://localhost:3000` | Allowed CORS origins |
| `DATABASE_URL` | `string` | — | Neon pooled connection string for runtime queries |
| `DIRECT_URL` | `string` | — | Neon direct connection string for Prisma migrations |
| `RATE_LIMIT_ENABLED` | `boolean` | `true` | Enable or disable rate limiting globally |
| `RATE_LIMIT_WINDOW_MS` | `number` | `120000` (2 mins) | Default rate limit window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | `number` | `100` | Default maximum requests allowed per window |
| `RATE_LIMIT_CLEANUP_BATCH_SIZE` | `number` | `1000` | Maximum rows deleted in a single cleanup batch |
| `JWT_SECRET` | `string` | `...dev_secret...` | HMAC secret for signing JWTs (min 32 chars in prod) |
| `JWT_EXPIRES_IN` | `string` | `'15m'` | Expiration duration for access tokens |
| `SEED_MENTOR_EMAIL` | `string` | `'mentor@projectpilot.dev'` | Default mentor email for seeding |
| `SEED_MENTOR_PASSWORD` | `string` | `'MentorSecret2026!'` | Default mentor password for seeding |
| `SEED_ADMIN_EMAIL` | `string` | `'admin@projectpilot.dev'` | Default admin email for seeding |
| `SEED_ADMIN_PASSWORD` | `string` | `'AdminSecret2026!'` | Default admin password for seeding |

---

## 6. Development & Production Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts development server with hot reload (`tsx watch src/server.ts`) |
| `npm run build` | Compiles TypeScript source to `./dist` (`tsc`) |
| `npm start` | Executes compiled production server (`node dist/server.js`) |
| `npm run typecheck` | Validates TypeScript types across the project (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint across the codebase |
| `npm test` | Runs all Vitest test suites (71 tests across 6 files) |
| `npm run db:seed` | Idempotently provisions initial mentor and admin accounts |
| `npm run prisma:generate` | Generates Prisma v7 Client into `src/generated/prisma` |
| `npm run prisma:validate` | Validates multi-file schemas in `prisma/` against `prisma.config.ts` |
| `npm run prisma:migrate:deploy` | Applies pending migrations in production / CI |
| `npm run db:check` | Verifies Neon database connectivity (`SELECT 1`) |
| `npm run db:cleanup-rate-limits` | Runs bounded batch deletion of expired rate limit records |

---

## 7. Health Endpoints

- **Liveness Probe (`GET /api/v1/health`)**:
  - Always exempt from rate limiting.
  - Returns `200 OK` confirming the HTTP server process is responsive.
- **Readiness Probe (`GET /api/v1/health/ready`)**:
  - Probes live database connectivity (`SELECT 1`).
  - Returns `200 OK` when connected, or `503 Service Unavailable` if unreachable.

---

## 8. Vercel Serverless Deployment

The project is structured for native Vercel deployment:
- Entry point: [`api/index.ts`](file:///C:/Currently%20Working/PHT/Backend/api/index.ts) exports the listener-free Express `app`.
- Routing: [`vercel.json`](file:///C:/Currently%20Working/PHT/Backend/vercel.json) rewrites all requests to `/api/index.ts`.
- Trust proxy enabled (`app.set('trust proxy', 1)`) for accurate IP resolution behind Vercel edge routers.
- Scheduled cleanup can be triggered via a Vercel Cron invoking a maintenance endpoint or task.
