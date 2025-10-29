-- CreateEnum
CREATE TYPE "UserSource" AS ENUM ('MANUAL', 'EMAIL_INBOX', 'SSO', 'API', 'IMPORT', 'SIGNUP');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "source" "UserSource" NOT NULL DEFAULT 'MANUAL';
