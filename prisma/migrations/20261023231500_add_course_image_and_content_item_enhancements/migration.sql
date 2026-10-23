-- AlterEnum
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'YOUTUBE_VIDEO';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "content_items" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "content_items" ADD COLUMN IF NOT EXISTS "assignmentId" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "content_items_assignmentId_idx" ON "content_items"("assignmentId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_items_assignmentId_fkey'
  ) THEN
    ALTER TABLE "content_items" ADD CONSTRAINT "content_items_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
