-- SCSP Migration 002 — TOTP MFA columns (Phase 2 account security)
-- Idempotent: safe to run multiple times
-- Apply via: python backend/scripts/run_migration.py (applies all pending)

ALTER TABLE operators ADD COLUMN IF NOT EXISTS mfa_secret  VARCHAR(64);
ALTER TABLE operators ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;

INSERT INTO schema_migrations (version) VALUES ('002')
ON CONFLICT (version) DO NOTHING;
