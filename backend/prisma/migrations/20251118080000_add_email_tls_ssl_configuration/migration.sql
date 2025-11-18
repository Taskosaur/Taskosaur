-- Add comprehensive TLS/SSL configuration for email accounts
-- This migration consolidates multiple iterations of TLS config into the final optimized version

-- IMAP TLS/SSL Configuration
-- These fields control secure IMAP connections (typically port 993)
ALTER TABLE "email_accounts" ADD COLUMN IF NOT EXISTS "imap_tls_reject_unauthorized" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "email_accounts" ADD COLUMN IF NOT EXISTS "imap_tls_min_version" TEXT DEFAULT 'TLSv1.2';
ALTER TABLE "email_accounts" ADD COLUMN IF NOT EXISTS "imap_servername" TEXT;

-- SMTP TLS/SSL Configuration
-- These fields control secure SMTP connections (typically port 587 with STARTTLS or 465 with implicit TLS)
ALTER TABLE "email_accounts" ADD COLUMN IF NOT EXISTS "smtp_tls_reject_unauthorized" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "email_accounts" ADD COLUMN IF NOT EXISTS "smtp_tls_min_version" TEXT DEFAULT 'TLSv1.2';
ALTER TABLE "email_accounts" ADD COLUMN IF NOT EXISTS "smtp_servername" TEXT;
ALTER TABLE "email_accounts" ADD COLUMN IF NOT EXISTS "smtp_require_tls" BOOLEAN NOT NULL DEFAULT false;

-- Clean up any previously added but unused TLS fields (from earlier iterations)
-- These were added but never implemented in the actual email services
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "imap_start_tls";
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "smtp_use_tls";
ALTER TABLE "email_accounts" DROP COLUMN IF EXISTS "smtp_start_tls";

-- Field Descriptions:
--
-- IMAP Fields:
--   imap_tls_reject_unauthorized: Reject self-signed/invalid certificates (default: true for security)
--   imap_tls_min_version: Minimum TLS version (default: TLSv1.2, recommended minimum)
--   imap_servername: SNI hostname for TLS validation (required for IP-based connections to Gmail, Office365, etc.)
--
-- SMTP Fields:
--   smtp_tls_reject_unauthorized: Reject self-signed/invalid certificates (default: true for security)
--   smtp_tls_min_version: Minimum TLS version (default: TLSv1.2, recommended minimum)
--   smtp_servername: SNI hostname for TLS validation (required for IP-based connections to Gmail, Office365, etc.)
--   smtp_require_tls: Force STARTTLS upgrade even if server doesn't advertise support (prevents plaintext fallback)
