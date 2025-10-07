/*
  Warnings:

  - You are about to drop the column `task_id` on the `inbox_messages` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."inbox_messages_task_id_key";

-- AlterTable
ALTER TABLE "inbox_messages" DROP COLUMN "task_id";
