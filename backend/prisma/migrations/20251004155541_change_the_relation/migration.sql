-- DropForeignKey
ALTER TABLE "public"."inbox_messages" DROP CONSTRAINT "inbox_messages_task_id_fkey";

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_inbox_message_id_fkey" FOREIGN KEY ("inbox_message_id") REFERENCES "inbox_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
