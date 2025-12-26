-- CreateTable
CREATE TABLE "public_task_shares" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "task_id" UUID NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_task_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_task_shares_token_key" ON "public_task_shares"("token");

-- CreateIndex
CREATE INDEX "public_task_shares_token_idx" ON "public_task_shares"("token");

-- CreateIndex
CREATE INDEX "public_task_shares_task_id_idx" ON "public_task_shares"("task_id");

-- AddForeignKey
ALTER TABLE "public_task_shares" ADD CONSTRAINT "public_task_shares_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_task_shares" ADD CONSTRAINT "public_task_shares_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
