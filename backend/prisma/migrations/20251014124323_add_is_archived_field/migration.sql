-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "archived_by" UUID,
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
