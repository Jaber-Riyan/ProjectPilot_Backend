# ProjectPilot LMS — Backend Architecture

Production-ready Express.js + TypeScript REST API foundation, Prisma ORM v7 with Neon PostgreSQL, and modular repository-based architecture for the ProjectPilot Learning Management System.

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
  - Strict unidirectional dependency flow: `Route → Controller → Service → Repository → Database`.
  - Type-safe generic `BaseRepository` for common CRUD operations.
  - Re-exported domain entity types from generated Prisma clients (`src/models/index.ts`).
  - Turnkey Vercel serverless deployment (`api/index.ts` & `vercel.json`).

---

## 2. Directory Architecture

```text
backend/
├── api/
│   └── index.ts                       # Vercel serverless function entry point
├── prisma/
│   ├── schema.prisma                  # Prisma root entry point (generator & datasource)
│   ├── models/                        # Multi-file Prisma schemas
│   │   ├── user.prisma                # User model & Role enum
│   │   ├── course.prisma              # Course model
│   │   ├── module.prisma              # Module model
│   │   ├── content-item.prisma        # ContentItem model & ContentType enum
│   │   ├── assignment.prisma          # Assignment model & SubmissionPolicy enum
│   │   ├── submission.prisma          # Submission model & SubmissionStatus enum
│   │   └── feedback.prisma            # Feedback model
│   └── migrations/                    # SQL migrations history
│
├── src/
│   ├── app.ts                         # Express app definition & middleware pipeline
│   ├── server.ts                      # HTTP listener & graceful shutdown lifecycle
│   ├── api/
│   │   └── v1/
│   │       └── index.ts               # Versioned API routes mount point (/api/v1)
│   ├── config/
│   │   ├── env.ts                     # Zod-validated environment schema
│   │   └── app-config.ts              # Centralized application defaults & limits
│   ├── db/
│   │   └── prisma.ts                  # Shared lazy-singleton Prisma client (Neon adapter)
│   ├── errors/
│   │   └── app-error.ts               # AppError class & API response types
│   ├── lib/
│   │   ├── logger.ts                  # Structured JSON logger with sensitive data redaction
│   │   └── async-handler.ts           # Safe async Express route wrapper
│   ├── middleware/
│   │   ├── error-handler.ts           # Central error handling middleware
│   │   ├── not-found.ts               # 404 handler for unknown routes
│   │   └── request-context.ts         # Correlation ID (X-Request-Id) and latency logger
│   ├── models/
│   │   ├── index.ts                   # Domain entity type re-exports from Prisma
│   │   └── README.md                  # Documentation on model separation
│   ├── modules/
│   │   ├── health/                    # Health module (liveness & readiness)
│   │   │   ├── health.controller.ts
│   │   │   ├── health.routes.ts
│   │   │   └── health.service.ts
│   │   └── README.md                  # Guide for adding new feature modules
│   ├── repositories/
│   │   ├── base.repository.ts         # Generic type-safe CRUD repository
│   │   ├── repository.types.ts        # Repository interfaces & pagination types
│   │   └── README.md                  # Guide for feature-specific repositories
│   ├── routes/
│   │   └── index.ts                   # Central route alias
│   ├── scripts/
│   │   └── verify-db.ts               # Harmless DB connectivity check script (SELECT 1)
│   ├── types/
│   │   └── express.d.ts               # Express request augmentation (req.id, startTime)
│   └── utils/
│       ├── pagination.ts              # Reusable pagination calculations
│       ├── slugify.ts                 # String to URL slug converter
│       └── index.ts
│
├── tests/
│   ├── app.test.ts                    # HTTP integration & lifecycle tests
│   ├── base-repository.test.ts        # Generic repository unit tests
│   └── utils.test.ts                  # Utility unit tests
├── .env.example                       # Environment variables template
├── eslint.config.mjs                  # ESLint 9 configuration
├── package.json                       # Scripts and dependencies
├── prisma.config.ts                   # Prisma v7 configuration file
├── tsconfig.json                      # Strict TypeScript compiler options
├── vercel.json                        # Vercel serverless routing
└── vitest.config.mts                  # Vitest test configuration
```

---

## 3. Dependency Flow & Architecture Rules

```text
HTTP Request
    ↓
Route (`<feature>.routes.ts`)
    ↓
Middleware (auth, validation, requestContext)
    ↓
Controller (`<feature>.controller.ts`)
    ↓
Service (`<feature>.service.ts`)
    ↓
Repository (`<feature>.repository.ts`)
    ↓
Shared Database Client (`src/db/prisma.ts`)
    ↓
Neon PostgreSQL
```

### Core Architecture Rules:
1. **Routes** define endpoints and mount middlewares. They never contain business logic.
2. **Controllers** parse HTTP input (`req.body`, `req.params`, `req.query`), delegate to services, and format standardized responses. **Controllers never execute direct Prisma queries.**
3. **Services** execute domain validation, coordinate business logic, and orchestrate transactions. **Services never touch Express `req` or `res` objects.**
4. **Repositories** execute database queries using Prisma. **Repositories never accept Express request objects.**
5. **Shared Database Client** is a lazy singleton in `src/db/prisma.ts` that prevents unwanted database connections during module imports or testing.
6. **No Circular Dependencies**: Lower layers never import from upper layers.

---

## 4. Prisma Multi-File Schemas

Prisma v7 natively supports multi-file schemas without custom build scripts.

- **Configuration (`prisma.config.ts`)**:
  Points the `schema` property directly to the `prisma` directory:
  ```typescript
  import 'dotenv/config';
  import { defineConfig, env } from 'prisma/config';

  export default defineConfig({
    schema: 'prisma',
    datasource: {
      url: env('DIRECT_URL'),
    },
  });
  ```
- **Root Entry Point (`prisma/schema.prisma`)**:
  Declares the `generator` and `datasource`:
  ```prisma
  generator client {
    provider = "prisma-client"
    output   = "../src/generated/prisma"
  }

  datasource db {
    provider = "postgresql"
  }
  ```
- **Individual Models (`prisma/models/*.prisma`)**:
  Each domain entity lives in its own `.prisma` file. Cross-file relations resolve automatically without explicit imports.

### How to Add a New Prisma Model:
1. Create `prisma/models/<entity>.prisma`.
2. Define the model and any relevant enums.
3. Validate: `npm run prisma:validate`.
4. Regenerate Client: `npm run prisma:generate`.

---

## 5. Repositories: Base vs. Feature-Specific

### Generic `BaseRepository`
Provides type-safe, reusable CRUD operations without boilerplate:
- `findById(id: string): Promise<T | null>`
- `findUnique(where: TWhereUniqueInput): Promise<T | null>`
- `findMany(options: FindManyOptions): Promise<PaginatedResult<T>>`
- `create(data: TCreateInput): Promise<T>`
- `update(where: TWhereUniqueInput, data: TUpdateInput): Promise<T>`
- `delete(where: TWhereUniqueInput): Promise<T>`
- `count(where?: TWhereInput): Promise<number>`
- `exists(where: TWhereUniqueInput): Promise<boolean>`

### Feature-Specific Repositories
Feature repositories extend `BaseRepository` or instantiate Prisma delegates directly for domain queries:
- Mentor dashboard review queues.
- Student submission history and attempt numbering.
- Complex multi-relation aggregations.

### Transactions
Coordinate multi-step operations using `prisma.$transaction`:
```typescript
await prisma.$transaction(async (tx) => {
  const submissionRepo = new SubmissionRepository(tx.submission);
  const feedbackRepo = new FeedbackRepository(tx.feedback);

  await submissionRepo.updateStatus(submissionId, 'APPROVED');
  await feedbackRepo.createFeedback({ submissionId, mentorId, comment });
});
```

---

## 6. How to Add a New Feature Module (Example)

Adding a `courses` module:

1. **Model**: Create `prisma/models/course.prisma` and run `npm run prisma:generate`.
2. **Repository** (`src/modules/courses/courses.repository.ts`):
   ```typescript
   import { BaseRepository } from '../../repositories/base.repository';
   import { Course, Prisma } from '../../generated/prisma/client';
   import { prisma } from '../../db/prisma';

   export class CourseRepository extends BaseRepository<
     Course,
     typeof prisma.course,
     Prisma.CourseWhereUniqueInput,
     Prisma.CourseWhereInput,
     Prisma.CourseOrderByWithRelationInput,
     Prisma.CourseCreateInput,
     Prisma.CourseUpdateInput
   > {
     constructor() {
       super(prisma.course);
     }

     async findBySlug(slug: string): Promise<Course | null> {
       return this.delegate.findUnique({ where: { slug } });
     }
   }
   ```
3. **Service** (`src/modules/courses/courses.service.ts`):
   ```typescript
   export class CourseService {
     constructor(private courseRepo = new CourseRepository()) {}

     async getCourseBySlug(slug: string) {
       const course = await this.courseRepo.findBySlug(slug);
       if (!course) throw AppError.notFound('Course not found');
       return course;
     }
   }
   ```
4. **Controller** (`src/modules/courses/courses.controller.ts`):
   ```typescript
   export class CourseController {
     constructor(private courseService = new CourseService()) {}

     getCourse = asyncHandler(async (req, res) => {
       const course = await this.courseService.getCourseBySlug(req.params.slug);
       res.status(200).json({ success: true, data: course });
     });
   }
   ```
5. **Routes** (`src/modules/courses/courses.routes.ts`):
   ```typescript
   const router = Router();
   const controller = new CourseController();
   router.get('/:slug', controller.getCourse);
   export const courseRoutes = router;
   ```
6. **Mount** in `src/api/v1/index.ts`:
   ```typescript
   router.use('/courses', courseRoutes);
   ```

---

## 7. Development & Production Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts development server with hot reload (`tsx watch src/server.ts`) |
| `npm run build` | Compiles TypeScript source to `./dist` (`tsc`) |
| `npm start` | Executes compiled production server (`node dist/server.js`) |
| `npm run typecheck` | Validates TypeScript types across the project (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint across the codebase |
| `npm run lint:fix` | Runs ESLint and auto-fixes issues |
| `npm test` | Runs the test suite via Vitest (`vitest run`) |
| `npm run test:watch` | Runs tests in interactive watch mode (`vitest`) |
| `npm run prisma:generate` | Generates Prisma v7 Client into `src/generated/prisma` |
| `npm run prisma:validate` | Validates multi-file schemas in `prisma/` against `prisma.config.ts` |
| `npm run prisma:migrate:dev` | Creates and applies development migrations |
| `npm run prisma:migrate:deploy` | Applies pending migrations in production / CI |
| `npm run prisma:studio` | Opens Prisma Studio web UI |
| `npm run db:check` | Verifies Neon database connectivity (`SELECT 1`) |

---

## 8. Health Endpoints

- **Liveness**: `GET /api/v1/health`
  - Returns `200 OK` confirming the process is alive.
- **Readiness**: `GET /api/v1/health/ready`
  - Probes live database connectivity (`SELECT 1`). Returns `200 OK` if connected, or `503 Service Unavailable` if unreachable.

---

## 9. Vercel Serverless Deployment

The project is structured for native Vercel deployment:
- Entry point: `api/index.ts` exports the listener-free Express `app`.
- Routing: `vercel.json` rewrites all requests to `/api/index.ts`.
- Ready for zero-config Vercel Preview and Production deployments.
