# Domain Models & Types (`src/models`)

This directory houses application-facing domain types and entity re-exports.

---

## Architecture Principle: Two Model Folders

1. **`prisma/models/` (Database Definition)**:
   - Contains the authoritative `.prisma` schema definition files (`user.prisma`, `course.prisma`, etc.).
   - Defines physical database schemas, PostgreSQL types, foreign keys, unique constraints, and indexes.

2. **`src/models/` (TypeScript Domain Re-exports)**:
   - Re-exports the generated TypeScript model types (`User`, `Course`, `Module`, etc.) and Enums (`Role`, `ContentType`, etc.) directly from `src/generated/prisma`.
   - **Never manually duplicate database entity types** in TypeScript interfaces. Prisma's generated types remain the single source of truth.
   - Houses custom domain view models, DTO extensions, or model aggregation types when needed.
