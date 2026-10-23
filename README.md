# ProjectPilot LMS — Backend Architecture & Database-Backed Rate Limiting

Production-ready Express.js + TypeScript REST API foundation, Prisma ORM v7 with Neon PostgreSQL, modular repository-based architecture, and database-backed atomic rate limiting for the ProjectPilot Learning Management System.

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

---

## 2. Directory Architecture

```text
backend/
├── api/
│   └── index.ts                         # Vercel serverless function entry point
├── prisma/
│   ├── schema.prisma                    # Root Prisma generator & datasource definition
│   ├── models/                          # Multi-file Prisma schema models & enums
│   │   ├── user.prisma                  # User model & Role enum
│   │   ├── course.prisma                # Course model
│   │   ├── module.prisma                # Module model
│   │   ├── content-item.prisma          # ContentItem model & ContentType enum
│   │   ├── assignment.prisma            # Assignment model & SubmissionPolicy enum
│   │   ├── submission.prisma            # Submission model & SubmissionStatus enum
│   │   ├── feedback.prisma              # Feedback model
│   │   └── rate-limit.prisma            # RateLimitEntry model & indexes
│   └── migrations/                      # SQL migration history
│
├── src/
│   ├── app.ts                           # Express application factory & middleware pipeline
│   ├── server.ts                        # HTTP listener with graceful shutdown lifecycle
│   ├── api/
│   │   └── v1/
│   │       └── index.ts                 # Versioned API route mount point (/api/v1)
│   ├── config/
│   │   ├── env.ts                       # Zod runtime environment validation
│   │   └── app-config.ts                # Centralized application defaults & limits
│   ├── db/
│   │   └── prisma.ts                    # Shared lazy-singleton Prisma client (Neon adapter)
│   ├── errors/
│   │   └── app-error.ts                 # AppError domain class & JSON response envelopes
│   ├── lib/
│   │   ├── logger.ts                    # Structured JSON logger with secret redaction
│   │   └── async-handler.ts             # Type-safe Express async route wrapper
│   ├── middleware/
│   │   ├── error-handler.ts             # Central error handling middleware
│   │   ├── not-found.ts                 # 404 handler for unmatched routes
│   │   └── request-context.ts           # Correlation ID (X-Request-Id) and latency logger
│   ├── models/
│   │   ├── index.ts                     # Domain entity type re-exports from Prisma
│   │   └── README.md                    # Documentation on prisma/models vs src/models
│   ├── modules/
│   │   ├── health/                      # Health module (liveness & readiness)
│   │   │   ├── health.controller.ts
│   │   │   ├── health.routes.ts
│   │   │   └── health.service.ts
│   │   ├── rate-limit/                  # Database-backed rate limiting module
│   │   │   ├── rate-limit.types.ts      # Policy & decision interfaces
│   │   │   ├── rate-limit.repository.ts # Concurrency-safe atomic PostgreSQL operations
│   │   │   ├── rate-limit.service.ts    # Hashing, policy evaluations & failure handling
│   │   │   ├── rate-limit.middleware.ts # Configurable Express middleware factory
│   │   │   └── index.ts
│   │   └── README.md                    # Feature module implementation guide
│   ├── repositories/
│   │   ├── base.repository.ts           # Generic type-safe CRUD repository
│   │   ├── repository.types.ts          # Delegate types & pagination interfaces
│   │   └── README.md                    # Repository pattern & transaction guide
│   ├── routes/
│   │   └── index.ts                     # Central route alias
│   ├── scripts/
│   │   ├── verify-db.ts                 # Database connectivity check script (SELECT 1)
│   │   └── cleanup-rate-limits.ts       # Bounded expired rate-limit cleanup CLI
│   ├── types/
│   │   └── express.d.ts                 # Express request augmentation (req.id, startTime)
│   └── utils/
│       ├── pagination.ts                # Reusable pagination calculations
│       ├── slugify.ts                   # String to URL slug converter
│       └── index.ts
│
├── tests/
│   ├── app.test.ts                      # HTTP pipeline, health, 404 & error tests
│   ├── base-repository.test.ts          # BaseRepository generic CRUD unit tests
│   ├── rate-limit.test.ts               # Rate limiter unit, boundary, header & mock tests
│   ├── rate-limit-db.test.ts            # Live PostgreSQL atomic concurrency tests
│   └── utils.test.ts                    # Pagination & slugify unit tests
├── .env.example                         # Environment configuration template
├── eslint.config.mjs                    # ESLint 9 configuration
├── package.json                         # NPM scripts & dependencies
├── prisma.config.ts                     # Prisma v7 configuration (schema: 'prisma')
├── tsconfig.json                        # Strict TypeScript compiler options
├── vercel.json                          # Vercel serverless rewrite rules
└── vitest.config.mts                    # Vitest configuration
```

---

## 3. Database-Backed Rate Limiting Architecture

### Concurrency-Safe Atomic Algorithm

To eliminate read-then-write race conditions under simultaneous traffic, the rate limiter uses a single atomic PostgreSQL statement with row-level locking:

```sql
INSERT INTO "rate_limit_entries" ("id", "key", "count", "windowStartedAt", "expiresAt", "createdAt", "updatedAt")
VALUES ($1::uuid, $2, 1, $3, $4, $3, $3)
ON CONFLICT ("key") DO UPDATE
SET
  "count" = CASE
    WHEN "rate_limit_entries"."expiresAt" <= $3 THEN 1
    ELSE LEAST("rate_limit_entries"."count" + 1, $5 + 1)
  END,
  "windowStartedAt" = CASE
    WHEN "rate_limit_entries"."expiresAt" <= $3 THEN $3
    ELSE "rate_limit_entries"."windowStartedAt"
  END,
  "expiresAt" = CASE
    WHEN "rate_limit_entries"."expiresAt" <= $3 THEN $4
    ELSE "rate_limit_entries"."expiresAt"
  END,
  "updatedAt" = $3
RETURNING
  "id",
  "key",
  "count",
  "windowStartedAt",
  "expiresAt";
```

#### Why Concurrent Requests Cannot Bypass the Limit:
1. **Row-Level Locking**: PostgreSQL's `INSERT ... ON CONFLICT DO UPDATE` locks the target row during evaluation. Simultaneous requests arriving at the exact same millisecond are serialized by the database engine.
2. **Atomic Window Expiry**: If `expiresAt <= now`, the count resets to `1` and a new window begins atomically.
3. **Atomic Increment**: If the window is still active (`expiresAt > now`), `count` increments by 1.
4. **Zero Overflow**: `LEAST(count + 1, maxRequests + 1)` prevents integer overflow during denial-of-service attempts.

### Key Generation & Privacy Protection

Rate limit keys are formed as:
```text
<prefix>:<sha256(normalized_client_identifier)>
```
- Client identifiers (e.g. `req.ip` via `trust proxy`) are hashed with SHA-256 before database insertion.
- **Privacy Guarantee**: Raw IP addresses and PII are never stored in PostgreSQL or logged.
- Key prefixes isolate distinct rate limit buckets (e.g. `api-v1:...`, `auth:login:...`, `submissions:...`).

### Response Headers Emitted

| Header | Description | Example |
|---|---|---|
| `RateLimit-Limit` | Configured maximum requests for the window | `100` |
| `RateLimit-Remaining` | Remaining requests allowed in current window | `94` |
| `RateLimit-Reset` | Epoch timestamp (in seconds) when window resets | `1700000120` |
| `Retry-After` *(only on 429)* | Seconds client must wait before retrying | `120` |

### Blocked Response Format (`HTTP 429 Too Many Requests`)

```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests. Please try again after 2 minutes."
  }
}
```

### Route-Level Usage Examples

```typescript
import { createRateLimiter } from '../modules/rate-limit';

// 1. Strict Limiter for Login/Auth Endpoints (5 requests per 15 minutes)
authRouter.post(
  '/login',
  createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'auth:login',
    customMessage: 'Too many login attempts. Please try again after 15 minutes.',
  }),
  loginController
);

// 2. Custom Key Generator (e.g. Rate limit by authenticated User ID instead of IP)
submissionRouter.post(
  '/submit',
  createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 3,
    keyPrefix: 'assignment:submit',
    keyGenerator: (req) => req.user?.id || req.ip,
  }),
  submitController
);
```

### Expiry Cleanup Strategy

In addition to lazy in-request expiry resets, expired entries are cleaned up periodically using bounded batch deletions:
```bash
npm run db:cleanup-rate-limits
```
- Uses indexed `expiresAt` column to avoid table-wide locks.
- Bounded by `RATE_LIMIT_CLEANUP_BATCH_SIZE` (default 1000 rows).
- Suitable for scheduled serverless triggers (e.g. Vercel Cron, AWS EventBridge, or GitHub Actions).

### Database Failure Policy

When the database is unreachable:
- **`failClosed: true` (Default)**: Returns HTTP 500 `RATE_LIMIT_ERROR` to protect sensitive endpoints from abuse during database downtime. Does not leak connection strings or SQL queries.
- **`failClosed: false`**: Permits the request to continue with fallback metrics (useful for non-critical informational endpoints).
- **Liveness Probe**: `/api/v1/health` is mounted before the rate limiter and is 100% exempt from rate limiting.

---

## 4. Environment Variables Reference

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

---

## 5. Development & Production Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts development server with hot reload (`tsx watch src/server.ts`) |
| `npm run build` | Compiles TypeScript source to `./dist` (`tsc`) |
| `npm start` | Executes compiled production server (`node dist/server.js`) |
| `npm run typecheck` | Validates TypeScript types across the project (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint across the codebase |
| `npm test` | Runs all Vitest test suites (39 tests) |
| `npm run prisma:generate` | Generates Prisma v7 Client into `src/generated/prisma` |
| `npm run prisma:validate` | Validates multi-file schemas in `prisma/` against `prisma.config.ts` |
| `npm run prisma:migrate:deploy` | Applies pending migrations in production / CI |
| `npm run db:check` | Verifies Neon database connectivity (`SELECT 1`) |
| `npm run db:cleanup-rate-limits` | Runs bounded batch deletion of expired rate limit records |

---

## 6. Health Endpoints

- **Liveness Probe (`GET /api/v1/health`)**:
  - Always exempt from rate limiting.
  - Returns `200 OK` confirming the HTTP server process is responsive.
- **Readiness Probe (`GET /api/v1/health/ready`)**:
  - Probes live database connectivity (`SELECT 1`).
  - Returns `200 OK` when connected, or `503 Service Unavailable` if unreachable.

---

## 7. Vercel Serverless Deployment

The project is structured for native Vercel deployment:
- Entry point: [`api/index.ts`](file:///C:/Currently%20Working/PHT/Backend/api/index.ts) exports the listener-free Express `app`.
- Routing: [`vercel.json`](file:///C:/Currently%20Working/PHT/Backend/vercel.json) rewrites all requests to `/api/index.ts`.
- Trust proxy enabled (`app.set('trust proxy', 1)`) for accurate IP resolution behind Vercel edge routers.
- Scheduled cleanup can be triggered via a Vercel Cron invoking a maintenance endpoint or task.
