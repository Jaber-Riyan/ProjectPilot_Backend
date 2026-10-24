# ProjectPilot LMS — Backend Architecture & API Documentation

Production-ready Express.js + TypeScript REST API foundation, Prisma ORM v7 with Neon PostgreSQL, modular repository-based architecture, database-backed atomic rate limiting, secure role-based JWT authentication, reusable multi-course learning resources, independent assignments, and concurrency-safe student submission attempt tracking.

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
  - Content item CRUD and multi-type payload validation (`VIDEO`, `YOUTUBE_VIDEO`, `TEXT`, `LINK`, `ASSIGNMENT`).
  - Two-phase content reordering (`PATCH /api/v1/modules/:moduleId/content/reorder`) preventing unique constraint collisions on `(moduleId, order)`.
  - Student publication access protection: students and unauthenticated guests are strictly prevented from viewing draft courses or unpublished modules/content.
- **Phase 7: Assignment APIs, Submission Attempts, and Reusable LMS Resources**
  - **Decoupled Reusable Modules**: Modules exist as independent entities (`Module`) and can be attached to multiple courses via the `CourseModule` join model with course-specific deterministic ordering (`order`).
  - **Non-Destructive Course Detachment**: Detaching a module (`DELETE /api/v1/courses/:courseId/modules/:moduleId`) removes only the course association row; the module and its content items remain intact.
  - **Module Deletion Protection**: Deleting a module (`DELETE /api/v1/modules/:id`) is rejected with `409 Conflict` if the module is attached to any course.
  - **Independent Assignments**: Assignments are decoupled from specific modules and managed independently (`/api/v1/assignments`), referenced by any `ASSIGNMENT` content item.
  - **Student Submissions & Policies**: First-class support for `ONE_TIME` (single attempt strictly enforced) and `RESUBMITTABLE` (sequential attempts) policies.
  - **Concurrency Safety via PostgreSQL Advisory Locks**: Submission creation acquires transaction-level advisory locks (`pg_advisory_xact_lock(hashtext('sub:' || assignmentId || ':' || studentId))`), serializing concurrent attempts from the same student and preventing duplicate attempt numbers and policy bypasses.
  - **Audit & Feedback History Preservation**: Resubmissions generate new attempt records (`attemptNumber = 2, 3...`), preserving previous attempts and their associated mentor review feedback records.

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
│   │   ├── course.prisma                # Course model (with createdById & courseModules)
│   │   ├── module.prisma                # Independent Module model
│   │   ├── course-module.prisma         # CourseModule association model (many-to-many & ordering)
│   │   ├── content-item.prisma          # ContentItem model & ContentType enum
│   │   ├── assignment.prisma            # Independent Assignment model & SubmissionPolicy enum
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
│   │   └── index.ts                     # Re-exports domain entity types and enums from Prisma
│   ├── modules/
│   │   ├── auth/                        # Signup, login, password hashing & tokens
│   │   ├── courses/                     # Courses repository, service, controller & routes
│   │   ├── modules/                     # Independent modules & course-module associations
│   │   ├── content/                     # Content items CRUD & reordering
│   │   ├── assignments/                 # Independent assignment management
│   │   ├── submissions/                 # Submission attempts, policies & concurrency locking
│   │   ├── health/                      # Public liveness and database readiness probe
│   │   └── rate-limit/                  # Database-backed rate limiting middleware
│   └── utils/
│       ├── pagination.ts                # Standardized pagination calculator
│       └── slug.ts                      # Deterministic URL slug generator
│
└── tests/
    ├── app.test.ts                      # Express pipeline & correlation ID tests
    ├── auth.test.ts                     # Signup, login, timing safety & JWT tests
    ├── base-repository.test.ts          # Generic repository CRUD tests
    ├── course-module-content.test.ts    # Course, module & content management tests
    ├── assignments-submissions.test.ts  # Assignments, attempts, policies & concurrency tests
    ├── rate-limit-db.test.ts            # PostgreSQL concurrency & window tests
    ├── rate-limit.test.ts               # Rate limit middleware header tests
    └── utils.test.ts                    # Pagination & utility unit tests
```

---

## 3. Comprehensive API Reference

### Course Endpoints

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/api/v1/courses` | Public / Student / Mentor | Lists published courses (or all if Mentor/Admin) with pagination |
| `GET` | `/api/v1/courses/:courseId` | Public / Student / Mentor | Retrieves course detail by UUID or slug with nested ordered modules |
| `POST` | `/api/v1/courses` | `MENTOR`, `ADMIN` | Creates a new course (auto-generates slug if omitted) |
| `PATCH` | `/api/v1/courses/:courseId` | `MENTOR`, `ADMIN` | Updates course metadata or publication status |
| `DELETE` | `/api/v1/courses/:courseId` | `MENTOR`, `ADMIN` | Deletes a course |

### Module & Course-Module Endpoints

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/api/v1/modules` | Public / Student / Mentor | Lists independent modules with pagination |
| `POST` | `/api/v1/modules` | `MENTOR`, `ADMIN` | Creates an independent module (can later be attached to courses) |
| `GET` | `/api/v1/modules/:moduleId` | Public / Student / Mentor | Retrieves module detail with attached courses & ordered content items |
| `PATCH` | `/api/v1/modules/:moduleId` | `MENTOR`, `ADMIN` | Updates independent module title, description, or publication status |
| `DELETE` | `/api/v1/modules/:moduleId` | `MENTOR`, `ADMIN` | Deletes module (rejected with 409 Conflict if attached to any course) |
| `POST` | `/api/v1/courses/:courseId/modules` | `MENTOR`, `ADMIN` | Attaches an existing module or creates and attaches a new module |
| `GET` | `/api/v1/courses/:courseId/modules` | Public / Student / Mentor | Lists modules attached to this course in course-specific order |
| `DELETE` | `/api/v1/courses/:courseId/modules/:moduleId` | `MENTOR`, `ADMIN` | Detaches module from course (does NOT delete module or its content) |
| `PATCH` | `/api/v1/courses/:courseId/modules/reorder` | `MENTOR`, `ADMIN` | Two-phase transaction reordering of modules within a course |

### Content Item Endpoints

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/v1/modules/:moduleId/content` | `MENTOR`, `ADMIN` | Creates content item (appends to end if `order` omitted) |
| `GET` | `/api/v1/modules/:moduleId/content` | Public / Student / Mentor | Lists content items for a module in deterministic order |
| `PATCH` | `/api/v1/modules/:moduleId/content/reorder` | `MENTOR`, `ADMIN` | Reorders content items safely within a module |
| `GET` | `/api/v1/content/:contentId` | Public / Student / Mentor | Retrieves individual content item |
| `PATCH` | `/api/v1/content/:contentId` | `MENTOR`, `ADMIN` | Updates content title, payload, URL, or type |
| `DELETE` | `/api/v1/content/:contentId` | `MENTOR`, `ADMIN` | Deletes a content item |

### Assignment Endpoints

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/api/v1/assignments` | Public / Student / Mentor | Lists assignments with pagination and publication filtering |
| `POST` | `/api/v1/assignments` | `MENTOR`, `ADMIN` | Creates an independent assignment (`ONE_TIME` or `RESUBMITTABLE`) |
| `GET` | `/api/v1/assignments/:assignmentId` | Public / Student / Mentor | Retrieves assignment detail, instructions, and creator details |
| `PATCH` | `/api/v1/assignments/:assignmentId` | `MENTOR`, `ADMIN` | Updates assignment instructions, due date, or policy |
| `DELETE` | `/api/v1/assignments/:assignmentId` | `MENTOR`, `ADMIN` | Deletes assignment (rejected with 409 Conflict if submissions exist) |

### Student Submission Endpoints

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/v1/assignments/:assignmentId/submissions` | `STUDENT` | Creates a submission attempt with concurrency-safe atomic locking |
| `GET` | `/api/v1/assignments/:assignmentId/submissions/me` | `STUDENT` | Retrieves the authenticated student's attempt history and feedbacks |
| `GET` | `/api/v1/assignments/:assignmentId/submissions` | `MENTOR`, `ADMIN` | Paginated list of student submissions for this assignment |
| `GET` | `/api/v1/submissions/:submissionId` | Student / Mentor / Admin | Retrieves specific submission detail with mentor reviews (enforces student ownership) |

---

## 4. Concurrency Safety & PostgreSQL Advisory Locking

Submitting assignments requires strict atomicity to prevent race conditions:
1. **The Race Condition Threat**: Under high load or deliberate rapid double-clicking, two parallel HTTP requests from the same student could pass check queries simultaneously, producing duplicate `attemptNumber` rows or bypassing a `ONE_TIME` submission policy.
2. **PostgreSQL Advisory Lock Strategy**:
   Inside an atomic database transaction (`prisma.$transaction`), a transaction-level advisory lock is acquired using a 64-bit hash of the student ID and assignment ID:
   ```sql
   SELECT pg_advisory_xact_lock(hashtext('sub:' || :assignmentId || ':' || :studentId));
   ```
3. **Serialized Execution**:
   - The first concurrent request acquires the lock, determines `nextAttemptNumber`, inserts the submission, and commits the transaction (automatically releasing the lock).
   - The second request waits for the lock, acquires it, discovers existing attempts, and either increments the attempt number sequentially or rejects with `409 Conflict` if the assignment has a `ONE_TIME` policy.
4. **Database Backstop**:
   The unique constraint `@@unique([assignmentId, studentId, attemptNumber])` on the `submissions` table guarantees zero duplicate attempts at the relational engine level.

---

## 5. Development & Production Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts development server with hot reload (`tsx watch src/server.ts`) |
| `npm run build` | Compiles TypeScript source to `./dist` (`tsc`) |
| `npm start` | Executes compiled production server (`node dist/server.js`) |
| `npm run typecheck` | Validates TypeScript types across the project (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint across the codebase |
| `npm test` | Runs all Vitest test suites (112 tests across 8 test files) |
| `npm run db:seed` | Idempotently provisions initial mentor and admin accounts |
| `npm run prisma:generate` | Generates Prisma v7 Client into `src/generated/prisma` |
| `npm run prisma:validate` | Validates multi-file schemas in `prisma/` against `prisma.config.ts` |
| `npm run prisma:migrate:deploy` | Applies pending migrations in production / CI |
| `npm run db:check` | Verifies Neon database connectivity (`SELECT 1`) |
| `npm run db:cleanup-rate-limits` | Runs bounded batch deletion of expired rate limit records |
