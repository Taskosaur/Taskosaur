-- AlterTable: Add trello_card_id to tasks
ALTER TABLE "tasks" ADD COLUMN "trello_card_id" TEXT;

-- CreateIndex: unique constraint on trello_card_id
CREATE UNIQUE INDEX "tasks_trello_card_id_key" ON "tasks"("trello_card_id");

-- CreateTable: trello_syncs
CREATE TABLE "trello_syncs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "trello_board_id" TEXT NOT NULL,
    "trello_api_key" TEXT NOT NULL,
    "trello_token" TEXT NOT NULL,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_interval" INTEGER NOT NULL DEFAULT 15,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" "SyncStatus",
    "last_sync_error" TEXT,
    "cards_imported" INTEGER NOT NULL DEFAULT 0,
    "status_mappings" JSONB,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trello_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique project_id in trello_syncs
CREATE UNIQUE INDEX "trello_syncs_project_id_key" ON "trello_syncs"("project_id");

-- AddForeignKey: trello_syncs.project_id -> projects.id
ALTER TABLE "trello_syncs" ADD CONSTRAINT "trello_syncs_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: trello_syncs.created_by_id -> users.id
ALTER TABLE "trello_syncs" ADD CONSTRAINT "trello_syncs_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: trello_syncs.updated_by_id -> users.id
ALTER TABLE "trello_syncs" ADD CONSTRAINT "trello_syncs_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
