# Feature Modules (`src/modules`)

This directory houses domain-specific, vertical slice feature modules.

---

## 1. Directory Structure of a Module

Each feature module is organized cleanly by responsibility:

```text
src/modules/<feature>/
├── <feature>.routes.ts       # Endpoint declarations & middleware attachment
├── <feature>.controller.ts   # HTTP request parsing, status codes & delegating to service
├── <feature>.service.ts      # Pure business logic, validation & coordination
├── <feature>.repository.ts   # Model-specific database queries (optional/when needed)
├── <feature>.schema.ts       # Zod DTO validation schemas (for request body/params)
└── <feature>.types.ts        # Module-specific TypeScript types & interfaces
```

---

## 2. Dependency Flow

All code follows a strict top-down dependency flow:

```text
HTTP Request
    ↓
Route (<feature>.routes.ts)
    ↓
Middleware (auth, validation, rate-limiting)
    ↓
Controller (<feature>.controller.ts)
    ↓
Service (<feature>.service.ts)
    ↓
Repository (<feature>.repository.ts)
    ↓
Shared Database Client (src/db/prisma.ts)
    ↓
Neon PostgreSQL
```

### Dependency Rules:
1. **Routes** define HTTP methods/paths and mount validation or authorization middleware.
2. **Controllers** extract request data (`req.body`, `req.params`, `req.query`), call the service, and respond with standardized envelopes. **Controllers never execute direct Prisma queries.**
3. **Services** contain business logic and transactional coordination. **Services never touch Express `req` or `res` objects.**
4. **Repositories** execute database queries using Prisma. **Repositories never accept Express request objects.**
5. **Shared Utilities** (`src/utils`, `src/lib`) contain framework-agnostic helpers.
6. **No Circular Dependencies**: Lower layers never import from upper layers.

---

## 3. How to Add a New Feature Module (Step-by-Step)

Example: Adding a `courses` module:

1. **Define Schema**: Create `prisma/models/course.prisma` and run `npm run prisma:generate`.
2. **Create Module Folder**: `src/modules/courses/`
3. **Create Repository** (`courses.repository.ts`):
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
4. **Create Service** (`courses.service.ts`):
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
5. **Create Controller** (`courses.controller.ts`):
   ```typescript
   export class CourseController {
     constructor(private courseService = new CourseService()) {}

     getCourse = asyncHandler(async (req, res) => {
       const course = await this.courseService.getCourseBySlug(req.params.slug);
       res.status(200).json({ success: true, data: course });
     });
   }
   ```
6. **Create Routes** (`courses.routes.ts`):
   ```typescript
   const router = Router();
   const controller = new CourseController();
   router.get('/:slug', controller.getCourse);
   export const courseRoutes = router;
   ```
7. **Mount in `src/api/v1/index.ts`**:
   ```typescript
   router.use('/courses', courseRoutes);
   ```
