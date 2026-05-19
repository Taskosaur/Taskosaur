-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "jira_issue_id" TEXT;

-- AlterTable
ALTER TABLE "trello_syncs" ADD COLUMN     "trello_workspace_id" TEXT,
ADD COLUMN     "workspace_id" UUID,
ALTER COLUMN "project_id" DROP NOT NULL,
ALTER COLUMN "trello_board_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "jira_syncs" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "workspace_id" UUID,
    "jira_site_url" TEXT NOT NULL,
    "jira_project_key" TEXT,
    "jira_email" TEXT NOT NULL,
    "jira_api_token" TEXT NOT NULL,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_interval" INTEGER NOT NULL DEFAULT 15,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" "SyncStatus",
    "last_sync_error" TEXT,
    "issues_imported" INTEGER NOT NULL DEFAULT 0,
    "status_mappings" JSONB,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jira_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "session_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "conversation_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jira_syncs_project_id_key" ON "jira_syncs"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "jira_syncs_workspace_id_key" ON "jira_syncs"("workspace_id");

-- CreateIndex
CREATE INDEX "jira_syncs_workspace_id_idx" ON "jira_syncs"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_session_id_key" ON "conversations"("session_id");

-- CreateIndex
CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");

-- CreateIndex
CREATE INDEX "conversations_updated_at_idx" ON "conversations"("updated_at");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_jira_issue_id_key" ON "tasks"("jira_issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "trello_syncs_workspace_id_key" ON "trello_syncs"("workspace_id");

-- CreateIndex
CREATE INDEX "trello_syncs_workspace_id_idx" ON "trello_syncs"("workspace_id");

-- AddForeignKey
ALTER TABLE "trello_syncs" ADD CONSTRAINT "trello_syncs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_syncs" ADD CONSTRAINT "jira_syncs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_syncs" ADD CONSTRAINT "jira_syncs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_syncs" ADD CONSTRAINT "jira_syncs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_syncs" ADD CONSTRAINT "jira_syncs_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
