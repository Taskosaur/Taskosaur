-- Each client owns a separately revocable refresh-token session.
-- Existing users.refresh_token values remain for equality-checked adoption.
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
