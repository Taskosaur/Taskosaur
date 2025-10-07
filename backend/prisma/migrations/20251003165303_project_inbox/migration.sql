/*
  Warnings:

  - A unique constraint covering the columns `[email_message_id]` on the table `task_comments` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[inbox_message_id]` on the table `tasks` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONVERTED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "task_comments" ADD COLUMN     "email_message_id" TEXT,
ADD COLUMN     "email_recipients" TEXT[],
ADD COLUMN     "email_sent_at" TIMESTAMP(3),
ADD COLUMN     "sent_as_email" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "allow_email_replies" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email_thread_id" TEXT,
ADD COLUMN     "inbox_message_id" UUID;

-- CreateTable
CREATE TABLE "project_inboxes" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "email_address" TEXT,
    "email_signature" TEXT,
    "auto_reply_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_reply_template" TEXT,
    "auto_create_task" BOOLEAN NOT NULL DEFAULT true,
    "default_task_type" "TaskType" NOT NULL DEFAULT 'TASK',
    "default_priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "default_status_id" UUID,
    "default_assignee_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_inboxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" UUID NOT NULL,
    "project_inbox_id" UUID NOT NULL,
    "email_address" TEXT NOT NULL,
    "display_name" TEXT,
    "imap_host" TEXT,
    "imap_port" INTEGER DEFAULT 993,
    "imap_username" TEXT,
    "imap_password" TEXT,
    "imap_use_ssl" BOOLEAN NOT NULL DEFAULT true,
    "imap_folder" TEXT NOT NULL DEFAULT 'INBOX',
    "smtp_host" TEXT,
    "smtp_port" INTEGER DEFAULT 587,
    "smtp_username" TEXT,
    "smtp_password" TEXT,
    "smtp_use_tls" BOOLEAN NOT NULL DEFAULT true,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "uid_validity" TEXT,
    "uid_next" INTEGER,
    "highest_mod_seq" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_messages" (
    "id" UUID NOT NULL,
    "project_inbox_id" UUID NOT NULL,
    "message_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "in_reply_to" TEXT,
    "references" TEXT[],
    "subject" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "from_name" TEXT,
    "to_emails" TEXT[],
    "cc_emails" TEXT[],
    "bcc_emails" TEXT[],
    "reply_to" TEXT,
    "body_text" TEXT,
    "body_html" TEXT,
    "snippet" TEXT,
    "headers" JSONB NOT NULL,
    "raw_size" INTEGER,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "importance" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "is_spam" BOOLEAN NOT NULL DEFAULT false,
    "spam_score" DOUBLE PRECISION,
    "task_id" UUID,
    "converted_at" TIMESTAMP(3),
    "converted_by" UUID,
    "email_date" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "content_id" TEXT,
    "storage_path" TEXT NOT NULL,
    "storage_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_rules" (
    "id" UUID NOT NULL,
    "project_inbox_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "stop_on_match" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sync_logs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL,
    "error" TEXT,
    "messages_processed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_inboxes_project_id_key" ON "project_inboxes"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_inboxes_email_address_key" ON "project_inboxes"("email_address");

-- CreateIndex
CREATE UNIQUE INDEX "email_accounts_project_inbox_id_key" ON "email_accounts"("project_inbox_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_accounts_email_address_key" ON "email_accounts"("email_address");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_messages_message_id_key" ON "inbox_messages"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_messages_task_id_key" ON "inbox_messages"("task_id");

-- CreateIndex
CREATE INDEX "inbox_messages_thread_id_idx" ON "inbox_messages"("thread_id");

-- CreateIndex
CREATE INDEX "inbox_messages_status_idx" ON "inbox_messages"("status");

-- CreateIndex
CREATE INDEX "inbox_messages_email_date_idx" ON "inbox_messages"("email_date");

-- CreateIndex
CREATE INDEX "inbox_rules_project_inbox_id_enabled_priority_idx" ON "inbox_rules"("project_inbox_id", "enabled", "priority");

-- CreateIndex
CREATE INDEX "email_sync_logs_project_id_started_at_idx" ON "email_sync_logs"("project_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_comments_email_message_id_key" ON "task_comments"("email_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_inbox_message_id_key" ON "tasks"("inbox_message_id");

-- AddForeignKey
ALTER TABLE "project_inboxes" ADD CONSTRAINT "project_inboxes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_inboxes" ADD CONSTRAINT "project_inboxes_default_status_id_fkey" FOREIGN KEY ("default_status_id") REFERENCES "task_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_inboxes" ADD CONSTRAINT "project_inboxes_default_assignee_id_fkey" FOREIGN KEY ("default_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_project_inbox_id_fkey" FOREIGN KEY ("project_inbox_id") REFERENCES "project_inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_project_inbox_id_fkey" FOREIGN KEY ("project_inbox_id") REFERENCES "project_inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_messages" ADD CONSTRAINT "inbox_messages_converted_by_fkey" FOREIGN KEY ("converted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "inbox_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_rules" ADD CONSTRAINT "inbox_rules_project_inbox_id_fkey" FOREIGN KEY ("project_inbox_id") REFERENCES "project_inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
