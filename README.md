# ProjectPilot LMS — Backend Foundation (Phase 1)

Production-ready Express.js + TypeScript REST API foundation for the ProjectPilot Learning Management System.

---

## 1. Project Overview

ProjectPilot LMS is a platform designed for students and mentors to manage courses, modules, assignments, and submissions.

This repository represents **Phase 1: Production-Ready Express + TypeScript Backend Foundation**. It establishes:
- Strict TypeScript configuration.
- Separation of application definition (`app.ts`) from runtime listener/lifecycle (`server.ts`).
- Serverless-ready architecture compatible with traditional VM and Vercel environments.
- Comprehensive request correlation and structured logging without sensitive data leaks.
- Robust HTTP security headers and configurable CORS allowlist.
- Centralized error handling and standardized JSON response envelopes.
- Health checks (liveness and readiness).
- Automated test suite with Vitest and Supertest.

---

## 2. Prerequisites

- **Node.js**: v18.x, v20.x, or v22+ (tested on Node.js v24.17.0)
- **npm**: v9+ (or compatible package manager)

---

## 3. Installation

Clone or open the backend workspace and install dependencies:

```bash
npm install
```

Copy the environment variable example file:

```bash
cp .env.example .env
```

*(On Windows PowerShell: `Copy-Item .env.example .env`)*

---

## 4. Environment Variables

Environment variables are validated on startup using **Zod** (`src/config/env.ts`). If required variables are missing or invalid, the application fails fast at startup with clean, non-sensitive error messages.

| Variable | Type | Default | Description |
|---|---|---|---|
| `NODE_ENV` | `'development' \| 'test' \| 'production'` | `'development'` | Runtime environment |
| `PORT` | `number` (1 - 65535) | `5000` | Port for the HTTP listener |
| `CORS_ORIGIN` | `string` (comma-separated or single) | `http://localhost:3000` | Allowed origins for CORS requests |
| `DATABASE_URL` | `string` (Postgres URL) | *Optional in dev/test, Required in prod* | Neon PostgreSQL pooled connection string |
| `DIRECT_URL` | `string` (Postgres URL) | *Optional* | Neon PostgreSQL direct connection for migrations |

> **Security Note:** Never commit `.env` or production secrets to source control. The repository `.gitignore` ignores all `.env` files except `.env.example`.

---

## 5. Development & Production Commands

| Command | Action |
|---|---|
| `npm run dev` | Starts development server with hot reload (`tsx watch src/server.ts`) |
| `npm run build` | Compiles TypeScript source to `./dist` (`tsc`) |
| `npm start` | Executes the compiled production server (`node dist/server.js`) |
| `npm run typecheck` | Validates TypeScript types across the project without emitting files (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint flat config across the codebase |
| `npm run lint:fix` | Runs ESLint and automatically fixes formatting/lint issues |
| `npm test` | Runs the test suite via Vitest (`vitest run`) |
| `npm run test:watch` | Runs tests in interactive watch mode (`vitest`) |

---

## 6. Architecture & Directory Structure

```text
backend/
├── src/
│   ├── app.ts                         # Express app definition & middleware pipeline
│   ├── server.ts                      # HTTP listener & graceful shutdown lifecycle
│   ├── config/
│   │   └── env.ts                     # Zod-validated environment schema & safe logging
│   ├── errors/
│   │   └── app-error.ts               # Custom AppError class & API response types
│   ├── lib/
│   │   └── logger.ts                  # Structured JSON logger with sensitive data redaction
│   ├── middleware/
│   │   ├── error-handler.middleware.ts# Centralized error handler & status mapping
│   │   ├── not-found.middleware.ts    # 404 handler for unmatched routes
│   │   ├── request-id.middleware.ts   # X-Request-Id correlation UUID injection
│   │   └── request-logger.middleware.ts # HTTP request/response metrics logger
│   ├── modules/
│   │   └── health/
│   │       ├── health.controller.ts   # Request/response handlers for health endpoints
│   │       ├── health.routes.ts       # Route definitions for health endpoints
│   │       └── health.service.ts      # Health logic (liveness & readiness)
│   ├── routes/
│   │   └── index.ts                   # Central versioned router (/api/v1)
│   └── types/
│       └── express.d.ts               # Express Request augmentation (req.id, startTime)
├── prisma/
│   └── schema.prisma                  # Prisma data schema placeholder (Phase 2)
├── tests/
│   └── app.test.ts                    # Vitest integration tests for HTTP pipeline
├── .env.example                       # Non-sensitive configuration template
├── .gitignore                         # Standard git ignore definitions
├── eslint.config.mjs                  # Modern ESLint 9 configuration
├── package.json                       # Dependencies and lifecycle scripts
├── tsconfig.json                      # Strict TypeScript compiler options
└── vitest.config.mts                  # Vitest test configuration
```

---

## 7. Middleware Execution Order

Requests flow sequentially through the following pipeline:

1. **Helmet** (`helmet()`): Injects essential HTTP security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, etc.).
2. **CORS** (`cors(corsOptions)`): Enforces an explicit origin allowlist based on `CORS_ORIGIN`. Permits localhost during local development and blocks unauthorized cross-origin requests.
3. **Body Parsing** (`express.json({ limit: '10mb' })`, `express.urlencoded`): Parses incoming request bodies with payload protection against memory exhaustion.
4. **Request ID** (`requestIdMiddleware`): Reads incoming `X-Request-Id` or generates a cryptographically secure UUID (`crypto.randomUUID()`), attaching it to `req.id` and the `X-Request-Id` response header.
5. **Request Logger** (`requestLoggerMiddleware`): Tracks request latency, method, path, status code, and correlation ID.
6. **Routes** (`/api/v1`): Mounts versioned controllers and domain modules.
7. **404 Not Found** (`notFoundMiddleware`): Intercepts unhandled routes and returns a standard JSON error response.
8. **Centralized Error Handler** (`errorHandlerMiddleware`): Formats `AppError`, `SyntaxError` (malformed JSON), `ZodError`, and unexpected errors into a consistent structure. Never exposes internal stack traces in production.

---

## 8. Response & Error Envelope Conventions

### Standard Success Response

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource 'GET /api/v1/invalid' was not found"
  }
}
```

### Validation Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "path": "email",
        "message": "Invalid email address",
        "code": "invalid_string"
      }
    ]
  }
}
```

---

## 9. Health Endpoints

### 1. Liveness Probe: `GET /api/v1/health`

Confirms the HTTP server is responsive.

**Sample Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptimeSeconds": 42,
    "timestamp": "2026-10-23T14:15:00.000Z",
    "environment": "development",
    "version": "1.0.0"
  }
}
```

### 2. Readiness Probe: `GET /api/v1/health/ready`

Reports readiness of downstream dependencies (e.g. database). Designed for serverless zero-downtime health probes.

**Sample Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "services": {
      "http": "up",
      "database": "not_configured_phase_1"
    },
    "timestamp": "2026-10-23T14:15:00.000Z"
  }
}
```

---

## 10. Serverless & Vercel Compatibility

The application is structured to be 100% serverless-ready:
- `src/app.ts` contains no long-running background loops, timers, or port bindings.
- In Vercel, a simple serverless wrapper (e.g. `api/index.ts`) can export `app`.
- In `src/server.ts`, `app.listen()` is guarded by `process.env.VERCEL !== '1'`, ensuring zero collision in serverless runtimes.
- Database connection pooling (Neon) and migrations will be managed statelessly in Phase 2.
