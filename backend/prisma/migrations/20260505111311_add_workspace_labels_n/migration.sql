-- CreateTable
CREATE TABLE "workspace_labels" (
    "workspace_id" UUID NOT NULL,
    "label_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_labels_pkey" PRIMARY KEY ("workspace_id","label_id")
);

-- AddForeignKey
ALTER TABLE "workspace_labels" ADD CONSTRAINT "workspace_labels_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_labels" ADD CONSTRAINT "workspace_labels_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
