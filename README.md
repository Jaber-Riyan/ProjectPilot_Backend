# ProjectPilot LMS — Backend Architecture & Course/Module Management

Production-ready Express.js + TypeScript REST API foundation, Prisma ORM v7 with Neon PostgreSQL, modular repository-based architecture, database-backed atomic rate limiting, secure role-based JWT authentication, and comprehensive course, module, content management with deterministic ordering for the ProjectPilot Learning Management System.

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
  - Route-specific database-backed rate limiting on auth endpoints (10 attempts per 15-minute window).
- **Phase 6: Course & Module APIs, Content Management & Deterministic Ordering**
  - Course retrieval with pagination (`GET /api/v1/courses`) and detail retrieval (`GET /api/v1/courses/:courseId`).
  - Mentor/Admin course management (`POST`, `PATCH`, `DELETE`).
  - Module management with automatic append-to-end positioning (`POST /api/v1/courses/:courseId/modules`).
  - Safe two-phase module reordering (`PATCH /api/v1/courses/:courseId/modules/reorder`) with atomic transactions preventing unique constraint collisions on `(courseId, order)`.
  - Content item CRUD and multi-type payload validation (`VIDEO`, `YOUTUBE_VIDEO`, `TEXT`, `LINK`, `ASSIGNMENT`).
  - Two-phase content reordering (`PATCH /api/v1/modules/:moduleId/content/reorder`) preventing unique constraint collisions on `(moduleId, order)`.
  - Student publication access protection: students and unauthenticated guests are strictly prevented from viewing draft courses or unpublished modules/content.

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
│   │   ├── course.prisma                # Course model (with imageUrl)
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
│   │   ├── authenticate.ts              # Strict and optional JWT authentication middleware
│   │   ├── authorize.ts                 # Role-based access control (requireRole)
│   │   ├── error-handler.ts             # Central error handling middleware (Zod & AppError)
│   │   ├── not-found.ts                 # 404 handler for unmatched routes
│   │   ├── request-context.ts           # Correlation ID (X-Request-Id) and latency logger
│   │   └── validate.ts                  # Zod request body/query/params validation middleware
│   ├── models/
│   │   └── index.ts                     # Domain entity type re-exports from Prisma
│   ├── modules/
│   │   ├── auth/                        # Authentication & authorization module
│   │   ├── courses/                     # Course module (CRUD, pagination, slug generation)
│   │   │   ├── courses.controller.ts
│   │   │   ├── courses.repository.ts
│   │   │   ├── courses.routes.ts
│   │   │   ├── courses.schema.ts
│   │   │   ├── courses.service.ts
│   │   │   ├── courses.types.ts
│   │   │   └── index.ts
│   │   ├── modules/                     # Module management (CRUD, reordering, ordering)
│   │   │   ├── modules.controller.ts
│   │   │   ├── modules.repository.ts
│   │   │   ├── modules.routes.ts
│   │   │   ├── modules.schema.ts
│   │   │   ├── modules.service.ts
│   │   │   ├── modules.types.ts
│   │   │   └── index.ts
│   │   ├── content/                     # Content item management (CRUD, reordering, types)
│   │   │   ├── content.controller.ts
│   │   │   ├── content.repository.ts
│   │   │   ├── content.routes.ts
│   │   │   ├── content.schema.ts
│   │   │   ├── content.service.ts
│   │   │   ├── content.types.ts
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
│   ├── types/
│   │   └── express.d.ts                 # Express.Request augmentation (req.user, req.id)
│   └── utils/
│       ├── pagination.ts                # Safe pagination calculator
│       └── slug.ts                      # URL slug generator
└── tests/
    ├── app.test.ts                      # Foundation & health check tests (9 tests)
    ├── auth.test.ts                     # Auth, Argon2id, JWT, Roles & Seed tests (32 tests)
    ├── base-repository.test.ts          # Generic repository CRUD tests (8 tests)
    ├── course-module-content.test.ts    # Course, Module & Content full integration suite (25 tests)
    ├── rate-limit-db.test.ts            # PostgreSQL concurrency & expiry tests (2 tests)
    ├── rate-limit.test.ts               # In-memory rate limiting middleware tests (15 tests)
    └── utils.test.ts                    # Pagination & utility unit tests (5 tests)
```

---

## 3. Course, Module & Content API Reference

### Course Endpoints

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/api/v1/courses` | Public / Student / Mentor | Lists published courses (or all if Mentor/Admin) with pagination |
| `GET` | `/api/v1/courses/:courseId` | Public / Student / Mentor | Retrieves course detail by UUID or slug with nested ordered modules |
| `POST` | `/api/v1/courses` | `MENTOR`, `ADMIN` | Creates a new course (auto-generates slug if omitted) |
| `PATCH` | `/api/v1/courses/:courseId` | `MENTOR`, `ADMIN` | Updates course metadata or publication status |
| `DELETE` | `/api/v1/courses/:courseId` | `MENTOR`, `ADMIN` | Deletes a course and cascades child modules/content |

### Module Endpoints

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/v1/courses/:courseId/modules` | `MENTOR`, `ADMIN` | Creates a module (appends to end if `order` omitted) |
| `GET` | `/api/v1/courses/:courseId/modules` | Public / Student / Mentor | Lists modules for course in deterministic order |
| `PATCH` | `/api/v1/courses/:courseId/modules/reorder` | `MENTOR`, `ADMIN` | Reorders modules safely within a parent course |
| `GET` | `/api/v1/modules/:moduleId` | Public / Student / Mentor | Retrieves module detail with ordered content items |
| `PATCH` | `/api/v1/modules/:moduleId` | `MENTOR`, `ADMIN` | Updates module title, description, or publication status |
| `DELETE` | `/api/v1/modules/:moduleId` | `MENTOR`, `ADMIN` | Deletes module and cascades its content items |

### Content Item Endpoints

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/v1/modules/:moduleId/content` | `MENTOR`, `ADMIN` | Creates content item (appends to end if `order` omitted) |
| `GET` | `/api/v1/modules/:moduleId/content` | Public / Student / Mentor | Lists content items for a module in deterministic order |
| `PATCH` | `/api/v1/modules/:moduleId/content/reorder` | `MENTOR`, `ADMIN` | Reorders content items safely within a module |
| `GET` | `/api/v1/content/:contentId` | Public / Student / Mentor | Retrieves individual content item |
| `PATCH` | `/api/v1/content/:contentId` | `MENTOR`, `ADMIN` | Updates content title, payload, URL, or type |
| `DELETE` | `/api/v1/content/:contentId` | `MENTOR`, `ADMIN` | Deletes a content item |

---

## 4. Deterministic Ordering & Two-Phase Transaction Safety

Both `Module` and `ContentItem` models have database unique constraints:
- `@@unique([courseId, order])` on `modules`
- `@@unique([moduleId, order])` on `content_items`

### The Collision Problem:
When updating positions in an arbitrary sequence (e.g., swapping items at orders 1 and 2), updating item A to order 1 while item B still occupies order 1 causes PostgreSQL to throw:
`duplicate key value violates unique constraint "modules_courseId_order_key"`.

### The Two-Phase Update Solution:
All reorder operations execute inside an atomic database transaction (`prisma.$transaction`):
1. **Validation**: Confirms the input contains the complete, exact set of IDs for that parent (no missing, no foreign, no duplicates).
2. **Phase 1 (Temporary Negative Offsets)**: Updates each item's order to `- (index + 1000)`. Because all active orders are positive numbers, negative orders never collide with existing entries or each other.
3. **Phase 2 (Final Sequential Normalization)**: Updates each item to its final target positive order (`1, 2, 3...`).
4. **Result**: The final order is 100% deterministic, collision-free, and transactional.

### Append-to-End by Default:
When a module or content item is created without specifying an order:
- The system queries `MAX("order")` for that parent.
- Automatically assigns `order = (maxOrder ?? 0) + 1`.

---

## 5. Supported Content Types & Payload Validation

| Type | Required Fields | Validation Rules |
|---|---|---|
| `YOUTUBE_VIDEO` | `url` | Must be a valid HTTP/HTTPS URL pointing to YouTube (`youtube.com` or `youtu.be`) or video resource |
| `VIDEO` | `url` | Must be a valid HTTP or HTTPS video resource URL |
| `LINK` | `url` | Must be a valid HTTP or HTTPS external URL |
| `TEXT` | `body` | Must be a non-empty string lesson body |
| `ASSIGNMENT` | `assignmentId` | Must be a valid UUID referencing an existing `Assignment` in the database |

---

## 6. Publication Access Control Matrix

| Action | Student / Public | Mentor | Admin |
|---|---|---|---|
| List published courses | Yes | Yes | Yes |
| View published course detail & modules | Yes | Yes | Yes |
| View draft course / modules / content | **No (Returns 404 Not Found)** | Yes | Yes |
| Create / Update / Delete courses | **No (403 Forbidden)** | Yes | Yes |
| Create / Update / Delete / Reorder modules | **No (403 Forbidden)** | Yes | Yes |
| Create / Update / Delete / Reorder content | **No (403 Forbidden)** | Yes | Yes |

---

## 7. Development & Production Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts development server with hot reload (`tsx watch src/server.ts`) |
| `npm run build` | Compiles TypeScript source to `./dist` (`tsc`) |
| `npm start` | Executes compiled production server (`node dist/server.js`) |
| `npm run typecheck` | Validates TypeScript types across the project (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint across the codebase |
| `npm test` | Runs all Vitest test suites (96 tests across 7 test files) |
| `npm run db:seed` | Idempotently provisions initial mentor and admin accounts |
| `npm run prisma:generate` | Generates Prisma v7 Client into `src/generated/prisma` |
| `npm run prisma:validate` | Validates multi-file schemas in `prisma/` against `prisma.config.ts` |
| `npm run prisma:migrate:deploy` | Applies pending migrations in production / CI |
| `npm run db:check` | Verifies Neon database connectivity (`SELECT 1`) |
| `npm run db:cleanup-rate-limits` | Runs bounded batch deletion of expired rate limit records |

---

## 8. Deferred Behaviors Documented

- **Course Ownership**: Currently, all mentors and administrators share full management access to all courses, modules, and content items. Granular per-mentor ownership or collaboration permissions will be introduced in subsequent phases.
- **Student Enrollment**: Publicly visible published courses are accessible for reading by all authenticated students. Restricting access to enrolled students only will be governed by the upcoming enrollment module.
- **Assignment Submissions**: Content items of type `ASSIGNMENT` reference assignments by `assignmentId`. Full assignment attempt histories and mentor review workflows will be handled in the assignment/submission phase.
