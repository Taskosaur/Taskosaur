-- AlterTable
ALTER TABLE "inbox_messages" ADD COLUMN "imap_uid" BIGINT;

-- CreateIndex
CREATE INDEX "inbox_messages_imap_uid_idx" ON "inbox_messages"("imap_uid");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_messages_project_inbox_id_imap_uid_key" ON "inbox_messages"("project_inbox_id", "imap_uid");
