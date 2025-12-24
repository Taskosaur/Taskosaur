/*
  Warnings:

  - A unique constraint covering the columns `[userId,key]` on the table `settings` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
ALTER TABLE "settings"
DROP CONSTRAINT IF EXISTS "settings_key_key";

-- Remove unique index
DROP INDEX IF EXISTS "settings_key_key";

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "userId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "settings_userId_key_key" ON "settings"("userId", "key");

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
