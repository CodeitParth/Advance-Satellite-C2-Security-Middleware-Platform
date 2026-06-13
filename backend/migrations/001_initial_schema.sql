-- SCSP Initial Schema — 001
-- Idempotent: safe to run multiple times
-- Apply via: python backend/scripts/run_migration.py

-- Track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(16) PRIMARY KEY,
    applied_at  TIMESTAMPTZ DEFAULT NOW()
);

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Operators ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operators (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username            VARCHAR(64) UNIQUE NOT NULL,
    password_hash       VARCHAR(256) NOT NULL,
    role                VARCHAR(32) NOT NULL
                        CHECK (role IN ('operator','approver','admin')),
    full_name           VARCHAR(128),
    baseline_profile    JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    last_login          TIMESTAMPTZ,
    is_active           BOOLEAN DEFAULT TRUE
);

-- ── Commands ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commands (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nonce               VARCHAR(64) UNIQUE NOT NULL,
    ccsds_apid          VARCHAR(16) NOT NULL,
    command_type        VARCHAR(64) NOT NULL,
    subsystem           VARCHAR(32) NOT NULL,
    parameters          JSONB DEFAULT '{}',
    sequence_count      INTEGER NOT NULL,
    raw_packet_hex      TEXT,
    risk_score          INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    risk_tier           VARCHAR(16)
                        CHECK (risk_tier IN ('LOW','MEDIUM','HIGH')),
    ai_justification    TEXT,
    sparta_technique    VARCHAR(32),
    cvss_estimate       VARCHAR(8),
    affected_subsystems TEXT[],
    sequence_alerts     TEXT[],
    telemetry_snapshot  JSONB,
    status              VARCHAR(40) NOT NULL DEFAULT 'SUBMITTED'
                        CHECK (status IN (
                          'SUBMITTED','PARSING','SCORED',
                          'PENDING_SINGLE_APPROVAL','PENDING_DUAL_APPROVAL',
                          'AUTO_APPROVED','REJECTED','BLOCKED',
                          'DISPATCHED','REPLAY_BLOCKED','EMERGENCY_OVERRIDE'
                        )),
    submitter_id        UUID REFERENCES operators(id),
    submitted_at        TIMESTAMPTZ DEFAULT NOW(),
    scored_at           TIMESTAMPTZ,
    dispatched_at       TIMESTAMPTZ,
    demo_mode           BOOLEAN DEFAULT FALSE
);

-- ── Approvals ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command_id      UUID NOT NULL REFERENCES commands(id) ON DELETE CASCADE,
    approver_id     UUID NOT NULL REFERENCES operators(id),
    decision        VARCHAR(16) NOT NULL
                    CHECK (decision IN ('APPROVED','REJECTED')),
    justification   TEXT,
    token_hash      VARCHAR(256),
    decided_at      TIMESTAMPTZ DEFAULT NOW(),
    token_expires   TIMESTAMPTZ,
    is_override     BOOLEAN DEFAULT FALSE,
    UNIQUE (command_id, approver_id)
);

-- ── Tamper-Evident Ledger ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger (
    entry_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence        BIGSERIAL UNIQUE NOT NULL,
    prev_hash       VARCHAR(64) NOT NULL,
    entry_hash      VARCHAR(64) NOT NULL,
    command_id      UUID REFERENCES commands(id),
    event_type      VARCHAR(64) NOT NULL,
    event_detail    JSONB DEFAULT '{}',
    operator_id     UUID REFERENCES operators(id),
    approver_ids    UUID[] DEFAULT '{}',
    timestamp       TIMESTAMPTZ DEFAULT NOW()
);

-- Append-only rules (idempotent via exception handler)
DO $$ BEGIN
    CREATE RULE ledger_no_update AS ON UPDATE TO ledger DO INSTEAD NOTHING;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE RULE ledger_no_delete AS ON DELETE TO ledger DO INSTEAD NOTHING;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Telemetry States ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telemetry_states (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    satellite_id        VARCHAR(32) DEFAULT 'SAT_ALPHA',
    battery_percent     FLOAT NOT NULL,
    safe_mode_active    BOOLEAN NOT NULL,
    thermal_status      VARCHAR(32) NOT NULL
                        CHECK (thermal_status IN ('NOMINAL','ELEVATED','CRITICAL')),
    orbital_phase       VARCHAR(32) NOT NULL
                        CHECK (orbital_phase IN ('SUNLIT','ECLIPSE','PENUMBRA')),
    link_margin_db      FLOAT,
    last_contact_min    INTEGER,
    recorded_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────────
-- Core lookups
CREATE INDEX IF NOT EXISTS idx_commands_status       ON commands(status);
CREATE INDEX IF NOT EXISTS idx_commands_submitter    ON commands(submitter_id);
CREATE INDEX IF NOT EXISTS idx_commands_nonce        ON commands(nonce);
CREATE INDEX IF NOT EXISTS idx_commands_submitted_at ON commands(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_sequence       ON ledger(sequence ASC);
CREATE INDEX IF NOT EXISTS idx_ledger_command_id     ON ledger(command_id);
CREATE INDEX IF NOT EXISTS idx_approvals_command     ON approvals(command_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded    ON telemetry_states(recorded_at DESC);

-- Composite: pending-timeout scan (status filter + time range)
CREATE INDEX IF NOT EXISTS idx_commands_status_submitted
    ON commands(status, submitted_at)
    WHERE status IN ('PENDING_SINGLE_APPROVAL', 'PENDING_DUAL_APPROVAL');

-- Composite: per-operator session context query
CREATE INDEX IF NOT EXISTS idx_commands_submitter_submitted
    ON commands(submitter_id, submitted_at DESC);

-- Ledger event_type filter (GET /ledger?event_type=...)
CREATE INDEX IF NOT EXISTS idx_ledger_event_type ON ledger(event_type);

-- Record migration
INSERT INTO schema_migrations (version) VALUES ('001')
ON CONFLICT (version) DO NOTHING;
