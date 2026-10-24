-- CreateTable
CREATE TABLE IF NOT EXISTS "course_modules" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- Backfill existing relationships if any modules had courseId
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'modules' AND column_name = 'courseId'
  ) THEN
    INSERT INTO "course_modules" ("id", "courseId", "moduleId", "order", "createdAt", "updatedAt")
    SELECT gen_random_uuid(), "courseId", "id", "order", "createdAt", "updatedAt"
    FROM "modules"
    WHERE "courseId" IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "course_modules_courseId_moduleId_key" ON "course_modules"("courseId", "moduleId");
CREATE UNIQUE INDEX IF NOT EXISTS "course_modules_courseId_order_key" ON "course_modules"("courseId", "order");
CREATE INDEX IF NOT EXISTS "course_modules_courseId_idx" ON "course_modules"("courseId");
CREATE INDEX IF NOT EXISTS "course_modules_moduleId_idx" ON "course_modules"("moduleId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_modules_courseId_fkey'
  ) THEN
    ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'course_modules_moduleId_fkey'
  ) THEN
    ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable modules: remove courseId and order, add createdById
ALTER TABLE "modules" DROP CONSTRAINT IF EXISTS "modules_courseId_fkey";
DROP INDEX IF EXISTS "modules_courseId_order_key";
DROP INDEX IF EXISTS "modules_courseId_idx";
ALTER TABLE "modules" DROP COLUMN IF EXISTS "courseId";
ALTER TABLE "modules" DROP COLUMN IF EXISTS "order";

ALTER TABLE "modules" ADD COLUMN IF NOT EXISTS "createdById" UUID;
CREATE INDEX IF NOT EXISTS "modules_createdById_idx" ON "modules"("createdById");
CREATE INDEX IF NOT EXISTS "modules_isPublished_idx" ON "modules"("isPublished");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'modules_createdById_fkey'
  ) THEN
    ALTER TABLE "modules" ADD CONSTRAINT "modules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable courses: add createdById
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "createdById" UUID;
CREATE INDEX IF NOT EXISTS "courses_createdById_idx" ON "courses"("createdById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courses_createdById_fkey'
  ) THEN
    ALTER TABLE "courses" ADD CONSTRAINT "courses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable assignments: remove moduleId, add createdById
ALTER TABLE "assignments" DROP CONSTRAINT IF EXISTS "assignments_moduleId_fkey";
DROP INDEX IF EXISTS "assignments_moduleId_idx";
ALTER TABLE "assignments" DROP COLUMN IF EXISTS "moduleId";

ALTER TABLE "assignments" ADD COLUMN IF NOT EXISTS "createdById" UUID;
CREATE INDEX IF NOT EXISTS "assignments_createdById_idx" ON "assignments"("createdById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assignments_createdById_fkey'
  ) THEN
    ALTER TABLE "assignments" ADD CONSTRAINT "assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
