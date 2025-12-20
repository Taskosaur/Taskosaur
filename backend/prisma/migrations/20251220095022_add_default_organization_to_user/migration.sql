-- AlterTable
ALTER TABLE "users" ADD COLUMN     "default_organization_id" UUID;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_default_organization_id_fkey" FOREIGN KEY ("default_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing isDefault from organization_members to users.default_organization_id
UPDATE "users" u
SET "default_organization_id" = om."organization_id"
FROM "organization_members" om
WHERE om."user_id" = u."id"
  AND om."is_default" = true;
