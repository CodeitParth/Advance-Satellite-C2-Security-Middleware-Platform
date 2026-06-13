-- SCSP Migration 003 — widen approval signature column for post-quantum mode
-- Ed25519 signatures are 128 hex chars; ML-DSA-65 (FIPS 204) are ~6618.
-- Idempotent: ALTER TYPE TEXT is a no-op when already TEXT.

ALTER TABLE approvals ALTER COLUMN token_hash TYPE TEXT;

INSERT INTO schema_migrations (version) VALUES ('003')
ON CONFLICT (version) DO NOTHING;
