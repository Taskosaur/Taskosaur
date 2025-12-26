-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RecurrenceEndType" AS ENUM ('NEVER', 'ON_DATE', 'AFTER_OCCURRENCES');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "is_recurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurring_task_id" UUID;

-- CreateTable
CREATE TABLE "recurring_tasks" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "recurrence_type" "RecurrenceType" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "days_of_week" INTEGER[],
    "day_of_month" INTEGER,
    "month_of_year" INTEGER,
    "end_type" "RecurrenceEndType" NOT NULL,
    "end_date" TIMESTAMP(3),
    "occurrence_count" INTEGER,
    "current_occurrence" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "next_occurrence" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recurring_tasks_task_id_key" ON "recurring_tasks"("task_id");

-- AddForeignKey
ALTER TABLE "recurring_tasks" ADD CONSTRAINT "recurring_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
