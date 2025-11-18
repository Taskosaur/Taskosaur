-- CreateTable
CREATE TABLE "message_rule_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "priority" "TaskPriority",
    "assignee_id" UUID,
    "label_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "task_type" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT true,
    "stopped" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_rule_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_rule_results_message_id_idx" ON "message_rule_results"("message_id");

-- CreateIndex
CREATE INDEX "message_rule_results_rule_id_idx" ON "message_rule_results"("rule_id");

-- AddForeignKey
ALTER TABLE "message_rule_results" ADD CONSTRAINT "message_rule_results_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "inbox_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_rule_results" ADD CONSTRAINT "message_rule_results_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "inbox_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
