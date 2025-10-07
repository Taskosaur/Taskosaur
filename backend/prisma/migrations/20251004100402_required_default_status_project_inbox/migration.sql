/*
  Warnings:

  - Made the column `default_status_id` on table `project_inboxes` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."project_inboxes" DROP CONSTRAINT "project_inboxes_default_status_id_fkey";

-- AlterTable
ALTER TABLE "project_inboxes" ALTER COLUMN "default_status_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "project_inboxes" ADD CONSTRAINT "project_inboxes_default_status_id_fkey" FOREIGN KEY ("default_status_id") REFERENCES "task_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
