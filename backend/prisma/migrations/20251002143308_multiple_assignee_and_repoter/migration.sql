/*
  Warnings:

  - You are about to drop the column `assignee_id` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `reporter_id` on the `tasks` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_reporter_id_fkey";

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "assignee_id",
DROP COLUMN "reporter_id";

-- CreateTable
CREATE TABLE "_TaskAssignees" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TaskAssignees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TaskReporters" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TaskReporters_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TaskAssignees_B_index" ON "_TaskAssignees"("B");

-- CreateIndex
CREATE INDEX "_TaskReporters_B_index" ON "_TaskReporters"("B");

-- AddForeignKey
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_A_fkey" FOREIGN KEY ("A") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskReporters" ADD CONSTRAINT "_TaskReporters_A_fkey" FOREIGN KEY ("A") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskReporters" ADD CONSTRAINT "_TaskReporters_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
