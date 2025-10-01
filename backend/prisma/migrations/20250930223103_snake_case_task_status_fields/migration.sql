-- AlterTable: Rename columns in task_statuses table to snake_case
ALTER TABLE "task_statuses" RENAME COLUMN "isDefault" TO "is_default";
ALTER TABLE "task_statuses" RENAME COLUMN "workflowId" TO "workflow_id";
ALTER TABLE "task_statuses" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "task_statuses" RENAME COLUMN "updatedAt" TO "updated_at";

-- Drop foreign key constraint that references the old column name
ALTER TABLE "task_statuses" DROP CONSTRAINT "task_statuses_workflowId_fkey";

-- Re-add foreign key constraint with new column name
ALTER TABLE "task_statuses" ADD CONSTRAINT "task_statuses_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- Update unique constraint to use new column name
DROP INDEX IF EXISTS "task_statuses_workflowId_name_key";
CREATE UNIQUE INDEX "task_statuses_workflow_id_name_key" ON "task_statuses"("workflow_id", "name");
