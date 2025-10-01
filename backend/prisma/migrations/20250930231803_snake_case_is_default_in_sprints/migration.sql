
-- AlterTable: Rename isDefault column in sprints table to snake_case
ALTER TABLE "sprints" RENAME COLUMN "isDefault" TO "is_default";