# ProjectPilot LMS — Backend Foundation (Phase 1 & Phase 2)

Production-ready Express.js + TypeScript REST API foundation and Neon PostgreSQL + Prisma ORM v7 integration for the ProjectPilot Learning Management System.

---

## 1. Project Overview

ProjectPilot LMS is a platform designed for students and mentors to manage courses, modules, assignments, and submissions.

- **Phase 1: Production-Ready Express + TypeScript Backend Foundation**
  - Strict TypeScript configuration (`ES2022`, CommonJS).
  - Separation of application definition (`app.ts`) from runtime listener/lifecycle (`server.ts`).
  - Serverless-ready architecture compatible with traditional VM and Vercel environments.
  - Correlation IDs (`X-Request-Id`) and structured logging with automatic secret redaction.
  - Security headers via Helmet and CORS origin validation.
  - Centralized error handling and standardized JSON response envelopes.
  - Health checks (liveness and readiness).
- **Phase 2: Prisma ORM v7 with Neon PostgreSQL Integration**
  - Stable Prisma ORM v7 (`7.10.1`) with the official Neon driver adapter (`@prisma/adapter-neon`).
  - Separation of CLI operations (`DIRECT_URL` in `prisma.config.ts`) and runtime pooled queries (`DATABASE_URL`).
  - Shared lazy singleton client (`src/db/prisma.ts`) preventing connection leaks on module imports or tests.
  - Core LMS domain schema (`User`, `Course`, `Module`, `ContentItem`, `Assignment`, `Submission`, `Feedback`).
  - Protected student submission and review history using referential action rules (`onDelete: Restrict`).
  - Initial migration generated (`20261023144200_init_lms_schema`).
  - Database connectivity verification script (`npm run db:check`).

---

## 2. Prerequisites

- **Node.js**: v18.x, v20.x, or v22+ (tested and verified on Node.js v24.17.0)
- **npm**: v9+ (tested on npm 11.13.0)
- **Neon Account**: A hosted PostgreSQL database on [Neon](https://neon.tech)

---

## 3. Installation & Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   *(On Windows PowerShell: `Copy-Item .env.example .env`)*

3. **Generate Prisma Client**:
   ```bash
   npm run prisma:generate
   ```

---

## 4. Neon PostgreSQL Configuration

Neon provides serverless PostgreSQL with connection pooling. Prisma ORM v7 separates the CLI migration URL from the runtime application adapter:

```text
                               ┌────────────────────────────────────────────────────────┐
                               │                     Neon Project                       │
                               │                                                        │
┌───────────────────────────┐  │  ┌─────────────────────────┐   ┌────────────────────┐  │
│  Application Runtime      │──┼─>│ Neon PgBouncer Pooler   │──>│ Postgres Engine    │  │
│  (@prisma/adapter-neon)   │  │  │ (DATABASE_URL)          │   │                    │  │
└───────────────────────────┘  │  └─────────────────────────┘   │                    │  │
                               │                                │                    │  │
┌───────────────────────────┐  │                                │                    │  │
│  Prisma CLI / Migrations  │──┼───────────────────────────────>│ (DIRECT_URL)       │  │
│  (prisma.config.ts)       │  │                                └────────────────────┘  │
└───────────────────────────┘  │                                                        │
                               └────────────────────────────────────────────────────────┘
```

### How to Create a Neon Project and Obtain Connection Strings

1. Log in to [Neon Console](https://console.neon.tech).
2. Click **Create Project** (e.g., name it `projectpilot-lms`).
3. Select your cloud provider and region (e.g., AWS `us-east-2`).
4. On the **Dashboard**, locate the **Connection Details** card:
   - **Pooled connection URL (`DATABASE_URL`)**:
     Ensure **Connection pooling** is checked. Copy the pooled connection string:
     ```env
     DATABASE_URL="postgresql://[user]:[password]@[endpoint-id]-pooler.[region].aws.neon.tech/[dbname]?sslmode=require"
     ```
   - **Direct connection URL (`DIRECT_URL`)**:
     Uncheck **Connection pooling**. Copy the direct connection string:
     ```env
     DIRECT_URL="postgresql://[user]:[password]@[endpoint-id].[region].aws.neon.tech/[dbname]?sslmode=require"
     ```
5. Paste both values into your local `.env` file.

---

## 5. Environment Variables Reference

Environment variables are validated on startup using **Zod** (`src/config/env.ts`).

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `NODE_ENV` | `'development' \| 'test' \| 'production'` | `'development'` | No | Runtime environment |
| `PORT` | `number` (1 - 65535) | `5000` | No | Port for the HTTP listener |
| `CORS_ORIGIN` | `string` (comma-separated or single) | `http://localhost:3000` | No | Allowed origins for CORS requests |
| `DATABASE_URL` | `string` (Postgres URL) | — | Production | Neon pooled connection string for app queries |
| `DIRECT_URL` | `string` (Postgres URL) | — | Production | Neon direct connection string for Prisma CLI/migrations |

> **Security Note:** Never commit `.env` or production credentials to source control. The repository `.gitignore` excludes all `.env` files except `.env.example`. Connection strings are automatically redacted in application logs.

---

## 6. Development & Production Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts development server with hot reload (`tsx watch src/server.ts`) |
| `npm run build` | Compiles TypeScript source to `./dist` (`tsc`) |
| `npm start` | Executes the compiled production server (`node dist/server.js`) |
| `npm run typecheck` | Validates TypeScript types without emitting files (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint flat config across the codebase |
| `npm run lint:fix` | Runs ESLint and automatically fixes formatting issues |
| `npm test` | Runs the test suite via Vitest (`vitest run`) |
| `npm run test:watch` | Runs tests in interactive watch mode (`vitest`) |
| `npm run prisma:generate` | Generates Prisma v7 Client into `src/generated/prisma` |
| `npm run prisma:validate` | Validates `prisma/schema.prisma` against `prisma.config.ts` |
| `npm run prisma:migrate:dev` | Creates and applies development migrations against Neon |
| `npm run prisma:migrate:deploy` | Applies pending migrations in production/CI |
| `npm run prisma:studio` | Opens Prisma Studio web UI for browsing database models |
| `npm run db:check` | Verifies database connectivity using `src/scripts/verify-db.ts` |

---

## 7. Database Schema & Architecture

The database schema models the core ProjectPilot LMS entities with strict referential safety:

```text
   ┌──────────┐
   │  Course  │
   └────┬─────┘
        │ 1:N (Cascade)
        ▼
   ┌──────────┐
   │  Module  │
   └────┬─────┘
        ├────────────────────────────────┐ 1:N (Cascade)
        │ 1:N (Cascade)                  ▼
        ▼                        ┌──────────────┐
 ┌─────────────┐                 │  Assignment  │
 │ ContentItem │                 └──────┬───────┘
 └─────────────┘                        │ 1:N (Restrict - protects student work)
                                        ▼
 ┌─────────────┐ 1:N (Restrict)  ┌──────────────┐ 1:N (Cascade)  ┌──────────┐
 │    User     ├────────────────>│  Submission  │<───────────────┤ Feedback │
 └──────┬──────┘                 └──────────────┘                └────┬─────┘
        │                                                             │
        └─────────────────────────────────────────────────────────────┘
                                  1:N (Restrict)
```

### Models Summary

1. **`User` (`users`)**:
   - `id` (UUID), `name`, `email` (unique), `passwordHash`, `role` (`STUDENT` \| `MENTOR`), timestamps.
   - Separate named relations for student submissions, mentor reviews, and feedback.
2. **`Course` (`courses`)**:
   - `id` (UUID), `title`, `slug` (unique), `description`, `isPublished`, timestamps.
3. **`Module` (`modules`)**:
   - `id` (UUID), `courseId`, `title`, `description`, `order`, `isPublished`, timestamps.
   - Enforces `UNIQUE(courseId, order)`.
4. **`ContentItem` (`content_items`)**:
   - `id` (UUID), `moduleId`, `type` (`VIDEO` \| `TEXT` \| `LINK`), `title`, `body`, `url`, `order`, timestamps.
   - Enforces `UNIQUE(moduleId, order)`.
5. **`Assignment` (`assignments`)**:
   - `id` (UUID), `moduleId`, `title`, `instructions`, `submissionPolicy` (`ONE_TIME` \| `RESUBMITTABLE`), `isPublished`, `dueAt`, timestamps.
6. **`Submission` (`submissions`)**:
   - `id` (UUID), `assignmentId`, `studentId`, `attemptNumber`, `projectName`, `repoUrl`, `liveUrl`, `description`, `status` (`PENDING` \| `APPROVED` \| `REJECTED`), `reviewedById`, `reviewedAt`, timestamps.
   - Enforces `UNIQUE(assignmentId, studentId, attemptNumber)`.
   - Referential action: `onDelete: Restrict` prevents accidental deletion of assignments or student accounts if submissions exist.
   - Composite indexes on `(assignmentId, status)` and `studentId` for optimal mentor/student dashboard queries.
7. **`Feedback` (`feedbacks`)**:
   - `id` (UUID), `submissionId`, `mentorId`, `comment`, timestamps.
   - Referential action: `onDelete: Restrict` on mentor to preserve review history.

---

## 8. Migration Workflow

### Initial Migration
The initial migration is pre-generated in:
```text
prisma/migrations/20261023144200_init_lms_schema/migration.sql
```

### Developing New Migrations
When adding new fields or models in development with an active Neon database:
```bash
npm run prisma:migrate:dev -- --name descriptive_migration_name
```
*`prisma migrate dev` creates the SQL migration, tracks it in `prisma/migrations`, updates the schema, and regenerates Prisma Client.*

### Deploying Migrations in Production & CI/CD
In production environments or CI/CD pipelines, run:
```bash
npm run prisma:migrate:deploy
```
- Uses `DIRECT_URL` defined in `prisma.config.ts`.
- Bypasses connection poolers to execute DDL migrations safely.
- Never runs destructive drops or prompts interactively.

---

## 9. Database Verification Script

To verify that your Neon connection parameters are valid without starting the HTTP server:

```bash
npm run db:check
```

**Behavior**:
- Imports the shared client from `src/db/prisma.ts`.
- Executes a non-destructive query (`SELECT 1`).
- Measures and logs latency.
- Exits with `0` on success or `1` on connection error.
- Cleans up the connection pool and shuts down cleanly.
- Never prints passwords or tokens in error logs.

---

## 10. Health Endpoints

### 1. Liveness Probe: `GET /api/v1/health`
Confirms the HTTP server process is running and responsive.

**Sample Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptimeSeconds": 15,
    "timestamp": "2026-10-23T14:50:00.000Z",
    "environment": "development",
    "version": "1.0.0"
  }
}
```

### 2. Readiness Probe: `GET /api/v1/health/ready`
Performs an active database connectivity check using the shared Prisma client.

- **Healthy Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "services": {
        "http": "up",
        "database": "connected"
      },
      "latencyMs": 14,
      "timestamp": "2026-10-23T14:50:00.000Z"
    }
  }
  ```
- **Degraded Response (`503 Service Unavailable`)**:
  ```json
  {
    "success": false,
    "data": {
      "status": "degraded",
      "services": {
        "http": "up",
        "database": "disconnected"
      },
      "timestamp": "2026-10-23T14:50:00.000Z"
    },
    "error": {
      "code": "DATABASE_UNAVAILABLE",
      "message": "Database connection failed"
    }
  }
  ```
